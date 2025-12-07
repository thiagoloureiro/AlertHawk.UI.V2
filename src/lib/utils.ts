export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Check if metrics features are enabled
 * Defaults to true if the environment variable is not set
 */
export function isMetricsEnabled(): boolean {
  const value = import.meta.env.VITE_APP_METRICS_ENABLED;
  // If not set, default to true
  if (value === undefined || value === '') {
    return true;
  }
  return value === 'true';
} 