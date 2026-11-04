import { dump as dumpYaml, load as loadYaml } from 'js-yaml';

export type MonitorKind = 'http' | 'tcp' | 'k8s';

export interface AllowedGroup {
  id: number;
  name: string;
}

export interface ExistingMonitorName {
  id: number;
  name: string;
}

export interface BulkPreviewRow {
  index: number;
  action: 'create' | 'update';
  kind: MonitorKind | null;
  name: string;
  groupId: number | null;
  groupLabel: string;
  target: string;
  allowed: boolean;
  issues: string[];
  payload: Record<string, unknown> | null;
}

export interface BulkParseResult {
  format: 'json' | 'yaml' | null;
  error: string | null;
  rows: BulkPreviewRow[];
}

export const BULK_MONITOR_LIMIT = 20;

const ENVIRONMENTS: Record<string, number> = {
  development: 1,
  staging: 2,
  qa: 3,
  testing: 4,
  preprod: 5,
  production: 6,
};

const REGIONS: Record<string, number> = {
  europe: 1,
  oceania: 2,
  northamerica: 3,
  southamerica: 4,
  sourthamerica: 4,
  africa: 5,
  asia: 6,
  custom: 7,
  custom2: 8,
  custom3: 9,
  custom4: 10,
  custom5: 11,
};

function exampleDocument(groups: AllowedGroup[]) {
  const group = groups[0]?.name ?? 'Your group';
  return {
    monitors: [
      {
        name: 'Production API',
        type: 'http',
        group,
        urlToCheck: 'https://example.com',
        method: 'GET',
        interval: 1,
        retries: 3,
        timeout: 30,
        region: 'Europe',
        environment: 'Production',
        status: true,
        paused: false,
        maxRedirects: 3,
        body: '',
        checkCertExpiry: true,
        ignoreTlsSsl: false,
        checkMonitorHttpHeaders: false,
        httpResponseCodeFrom: 200,
        httpResponseCodeTo: 299,
      },
      {
        name: 'Database',
        type: 'tcp',
        group,
        ip: '10.0.0.8',
        port: 5432,
        interval: 1,
        retries: 3,
        timeout: 30,
        region: 'Europe',
        environment: 'Production',
        status: true,
        paused: false,
        ignoreTlsSsl: false,
      },
    ],
  };
}

export function bulkMonitorExample(groups: AllowedGroup[], format: 'yaml' | 'json' = 'yaml'): string {
  const document = exampleDocument(groups);
  if (format === 'json') return JSON.stringify(document, null, 2);
  return `# Leave id out to create a monitor. Set id to update one.
# region: Europe, Oceania, NorthAmerica, SouthAmerica, Africa, Asia, Custom, Custom2, Custom3, Custom4, Custom5
# environment: Development, Staging, QA, Testing, PreProd, Production
# method: GET, POST, PUT
${dumpYaml(document, { lineWidth: -1, noRefs: true })}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function field(record: Record<string, unknown>, ...names: string[]): unknown {
  const entries = Object.entries(record);
  for (const name of names) {
    const hit = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (hit && hit[1] !== undefined && hit[1] !== null && hit[1] !== '') return hit[1];
  }
  return undefined;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

function asText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function resolveKind(record: Record<string, unknown>): MonitorKind | null {
  const raw = field(record, 'type', 'monitorType', 'monitorTypeId', 'kind');
  if (typeof raw === 'number') {
    if (raw === 1) return 'http';
    if (raw === 3) return 'tcp';
    if (raw === 4) return 'k8s';
    return null;
  }
  const text = asText(raw).toLowerCase();
  if (text === '1' || text === 'http' || text === 'https') return 'http';
  if (text === '3' || text === 'tcp') return 'tcp';
  if (text === '4' || text === 'k8s' || text === 'kubernetes') return 'k8s';
  return null;
}

function resolveGroup(
  record: Record<string, unknown>,
  groups: AllowedGroup[]
): { id: number | null; label: string; allowed: boolean; issue?: string } {
  const raw = field(record, 'monitorGroup', 'monitorGroupId', 'groupId', 'group');
  if (raw == null) {
    return { id: null, label: 'Missing group', allowed: false, issue: 'monitorGroup is required' };
  }

  const numeric = asNumber(raw);
  if (numeric != null) {
    const match = groups.find((group) => group.id === numeric);
    if (!match) {
      return {
        id: numeric,
        label: `Group ${numeric}`,
        allowed: false,
        issue: `You don't have access to group ${numeric}`,
      };
    }
    return { id: match.id, label: match.name, allowed: true };
  }

  const name = asText(raw).toLowerCase();
  const matches = groups.filter((group) => group.name.toLowerCase() === name);
  if (matches.length > 1) {
    return {
      id: null,
      label: asText(raw),
      allowed: false,
      issue: `More than one group is named "${asText(raw)}". Use the group id.`,
    };
  }
  const match = matches[0];
  if (!match) {
    return {
      id: null,
      label: asText(raw) || 'Unknown group',
      allowed: false,
      issue: `Unknown group "${asText(raw)}"`,
    };
  }
  return { id: match.id, label: match.name, allowed: true };
}

function resolveCoded(
  value: unknown,
  names: Record<string, number>,
  fallback: number
): { value: number; issue?: string } {
  if (value == null || value === '') return { value: fallback };
  const numeric = asNumber(value);
  if (numeric != null) return { value: numeric };
  const key = asText(value).toLowerCase().replace(/[\s_-]+/g, '');
  const match = names[key];
  if (match == null) return { value: fallback, issue: `"${asText(value)}" is not recognized` };
  return { value: match };
}

function resolveMethod(value: unknown): number {
  if (typeof value === 'number' && value >= 1 && value <= 3) return value;
  const text = asText(value).toUpperCase();
  if (text === 'POST' || text === '2') return 2;
  if (text === 'PUT' || text === '3') return 3;
  return 1;
}

function encodeKubeconfig(value: string): string {
  if (!value) return '';
  if (value.includes('apiVersion') || value.includes('\n')) {
    return btoa(value);
  }
  return value;
}

function buildPayload(
  record: Record<string, unknown>,
  kind: MonitorKind,
  groupId: number,
  monitorId: number
): Record<string, unknown> {
  const name = asText(field(record, 'name'));
  const interval = asNumber(field(record, 'heartBeatInterval', 'interval')) ?? 1;
  const retries = asNumber(field(record, 'retries')) ?? 3;
  const timeout = asNumber(field(record, 'timeout')) ?? 30;
  const region = resolveCoded(field(record, 'monitorRegion', 'region'), REGIONS, 1).value;
  const environment = resolveCoded(field(record, 'monitorEnvironment', 'environment'), ENVIRONMENTS, 6).value;
  const status = asBoolean(field(record, 'status'), true);
  const paused = asBoolean(field(record, 'paused'), false);

  if (kind === 'k8s') {
    const kube = encodeKubeconfig(asText(field(record, 'kubeConfig', 'kubeconfig')));
    return {
      Id: monitorId,
      MonitorId: monitorId,
      MonitorTypeId: 4,
      MonitorType: { Id: 4, Name: 'Kubernetes' },
      Name: name,
      HeartBeatInterval: interval,
      Retries: retries,
      Status: status,
      DaysToExpireCert: 30,
      Paused: paused,
      UrlToCheck: '',
      CheckCertExpiry: false,
      MonitorGroup: groupId,
      MonitorRegion: region,
      ClusterName: asText(field(record, 'clusterName', 'cluster')),
      KubeConfig: kube,
      LastStatus: true,
      MonitorEnvironment: environment,
      Base64Content: kube,
    };
  }

  const shared = {
    id: monitorId,
    monitorId,
    name,
    monitorGroup: groupId,
    monitorRegion: region,
    monitorEnvironment: environment,
    heartBeatInterval: interval,
    retries,
    status,
    paused,
    daysToExpireCert: 0,
    timeout,
    lastStatus: true,
  };

  if (kind === 'tcp') {
    return {
      ...shared,
      monitorTypeId: 3,
      ip: asText(field(record, 'ip', 'host', 'address')),
      port: asNumber(field(record, 'port')) ?? 0,
      ignoreTlsSsl: asBoolean(field(record, 'ignoreTlsSsl', 'ignoreTls'), false),
      checkCertExpiry: false,
      part: 0,
    };
  }

  return {
    ...shared,
    monitorTypeId: 1,
    urlToCheck: asText(field(record, 'urlToCheck', 'url')),
    monitorHttpMethod: resolveMethod(field(record, 'monitorHttpMethod', 'method', 'httpMethod')),
    maxRedirects: asNumber(field(record, 'maxRedirects')) ?? 3,
    body: asText(field(record, 'body')),
    checkCertExpiry: asBoolean(field(record, 'checkCertExpiry'), true),
    ignoreTlsSsl: asBoolean(field(record, 'ignoreTlsSsl', 'ignoreTls'), false),
    checkMonitorHttpHeaders: asBoolean(field(record, 'checkMonitorHttpHeaders'), false),
    HttpResponseCodeFrom: asNumber(field(record, 'httpResponseCodeFrom', 'statusFrom')) ?? 200,
    HttpResponseCodeTo: asNumber(field(record, 'httpResponseCodeTo', 'statusTo')) ?? 299,
    responseStatusCode: 200,
    responseTime: 0,
  };
}

function targetOf(kind: MonitorKind, record: Record<string, unknown>): string {
  if (kind === 'http') return asText(field(record, 'urlToCheck', 'url'));
  if (kind === 'tcp') {
    const ip = asText(field(record, 'ip', 'host', 'address'));
    const port = asNumber(field(record, 'port'));
    return port ? `${ip}:${port}` : ip;
  }
  return asText(field(record, 'clusterName', 'cluster'));
}

function extractItems(document: unknown): unknown[] | null {
  if (Array.isArray(document)) return document;
  const record = asRecord(document);
  if (!record) return null;
  const list = field(record, 'monitors', 'items');
  if (Array.isArray(list)) return list;
  if (field(record, 'name') != null || field(record, 'type') != null || field(record, 'monitorTypeId') != null) {
    return [record];
  }
  return null;
}

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function parseBulkMonitors(
  source: string,
  groups: AllowedGroup[],
  existing: ExistingMonitorName[] = []
): BulkParseResult {
  const trimmed = source.trim();
  if (!trimmed) {
    return { format: null, error: 'Paste a JSON or YAML monitor list.', rows: [] };
  }

  let document: unknown;
  let format: 'json' | 'yaml';
  const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');

  if (looksLikeJson) {
    try {
      document = JSON.parse(trimmed);
      format = 'json';
    } catch (error) {
      return {
        format: 'json',
        error: error instanceof Error ? error.message : 'Invalid JSON',
        rows: [],
      };
    }
  } else {
    try {
      document = loadYaml(trimmed);
      format = 'yaml';
    } catch (error) {
      return {
        format: 'yaml',
        error: error instanceof Error ? error.message : 'Invalid YAML',
        rows: [],
      };
    }
  }

  const items = extractItems(document);
  if (!items) {
    return {
      format,
      error: 'Use a list of monitors, or an object with a monitors array.',
      rows: [],
    };
  }

  if (items.length > BULK_MONITOR_LIMIT) {
    return {
      format,
      error: `Bulk import is limited to ${BULK_MONITOR_LIMIT} monitors. This file has ${items.length}.`,
      rows: [],
    };
  }

  const namesInFile = new Map<string, number>();
  for (const item of items) {
    const record = asRecord(item);
    const key = record ? nameKey(asText(field(record, 'name'))) : '';
    if (!key) continue;
    namesInFile.set(key, (namesInFile.get(key) ?? 0) + 1);
  }

  const existingIdsByName = new Map<string, Set<number>>();
  for (const monitor of existing) {
    const key = nameKey(monitor.name);
    if (!key || monitor.id <= 0) continue;
    const ids = existingIdsByName.get(key) ?? new Set<number>();
    ids.add(monitor.id);
    existingIdsByName.set(key, ids);
  }

  const rows = items.map((item, index) => {
    const record = asRecord(item);
    if (!record) {
      return {
        index,
        action: 'create' as const,
        kind: null,
        name: '',
        groupId: null,
        groupLabel: '',
        target: '',
        allowed: false,
        issues: ['Each monitor must be an object'],
        payload: null,
      };
    }

    const issues: string[] = [];
    const name = asText(field(record, 'name'));
    const kind = resolveKind(record);
    const id = asNumber(field(record, 'id', 'monitorId')) ?? 0;
    const group = resolveGroup(record, groups);

    if (!name) issues.push('Name is required');
    const key = nameKey(name);
    if (key && (namesInFile.get(key) ?? 0) > 1) {
      issues.push('This name is used more than once in the file');
    }
    if (key) {
      const owners = existingIdsByName.get(key);
      if (owners && [...owners].some((ownerId) => ownerId !== id)) {
        issues.push(`A monitor named "${name}" already exists`);
      }
    }
    if (kind === 'k8s') issues.push('Bulk import supports HTTP and TCP');
    else if (!kind) issues.push('Type must be http or tcp');
    if (group.issue) issues.push(group.issue);
    const region = resolveCoded(field(record, 'monitorRegion', 'region'), REGIONS, 1);
    const environment = resolveCoded(field(record, 'monitorEnvironment', 'environment'), ENVIRONMENTS, 6);
    if (region.issue) issues.push(`Region ${region.issue}`);
    if (environment.issue) issues.push(`Environment ${environment.issue}`);

    if (kind === 'http' && !asText(field(record, 'urlToCheck', 'url'))) issues.push('URL is required');
    if (kind === 'tcp') {
      if (!asText(field(record, 'ip', 'host', 'address'))) issues.push('IP address is required');
      if (!asNumber(field(record, 'port'))) issues.push('Port is required');
    }

    const groupId = group.id;
    const ready = issues.length === 0 && kind != null && groupId != null;

    return {
      index,
      action: id > 0 ? 'update' as const : 'create' as const,
      kind,
      name,
      groupId,
      groupLabel: group.label,
      target: kind ? targetOf(kind, record) : '',
      allowed: ready,
      issues,
      payload: ready && kind != null && groupId != null
        ? buildPayload(record, kind, groupId, id)
        : null,
    };
  });

  return { format, error: null, rows };
}
