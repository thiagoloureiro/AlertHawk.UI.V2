import  { useState, useEffect } from 'react';
import {
  Search, Plus, Edit, Trash2, AlertCircle,
  Check, ChevronDown, ChevronUp
} from 'lucide-react';
import type { MonitorGroup } from '../types';
import monitorService from '../services/monitorService';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from '../components/ui';

interface DeleteConfirmationProps {
  group: MonitorGroup;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

function DeleteConfirmation({ group, onConfirm, onCancel, isDeleting }: DeleteConfirmationProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
          Delete monitor group
        </h3>

        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Are you sure you want to delete the group &quot;{group.name}&quot;?
          </p>

          {group.monitorCount > 0 && (
            <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium mb-0.5">Group has active monitors</p>
                <p className="text-xs">
                  This group contains {group.monitorCount} monitor
                  {group.monitorCount === 1 ? '' : 's'}. Deleting it will remove all monitor
                  assignments.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
          >
            {isDeleting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {isDeleting ? 'Deleting…' : 'Delete group'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface MonitorGroupListItem {
  id: number;
  name: string;
  description: string;
  monitorCount: number;
}

export function MonitorGroups() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof MonitorGroupListItem; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc'
  });
  const [selectedGroup, setSelectedGroup] = useState<MonitorGroup | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [groups, setGroups] = useState<MonitorGroupListItem[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [isAdding] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const recordsPerPageOptions = [10, 25, 50, 100];

  // Move fetchGroups outside useEffect so it can be reused
  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      const groupList = await monitorService.getMonitorGroupListByUser();
      setGroups(groupList || []); // Ensure we always set an array, even if groupList is null/undefined
    } catch (error: unknown) {
      console.error('Failed to fetch monitor groups:', error);
      setNotification({
        type: 'error',
        message: 'Failed to load monitor groups'
      });
      setGroups([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  // Update useEffect to use the function
  useEffect(() => {
    fetchGroups();
  }, []);

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedGroups = [...filteredGroups].sort((a, b) => {
    const aValue = a[sortConfig.key].toString().toLowerCase();
    const bValue = b[sortConfig.key].toString().toLowerCase();
    
    return sortConfig.direction === 'asc' 
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  });

  const handleSort = (key: keyof MonitorGroupListItem) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleDelete = async () => {
    if (!selectedGroup) return;

    try {
      setIsLoading(true);
      await monitorService.deleteMonitorGroup(selectedGroup.id);
      toast.success('Monitor group deleted successfully', { position: 'bottom-right' });
      setShowDeleteConfirmation(false);
      setSelectedGroup(null);
      await fetchGroups(); // Refresh the list after deletion
    } catch (error: any) {
      console.error('Failed to delete monitor group:', error);
      if (error.response?.status === 400) {
        toast.error('Cannot delete group: Please remove all monitors from this group first', { 
          position: 'bottom-right',
          duration: 5000
        });
      } else {
        toast.error('Failed to delete monitor group', { position: 'bottom-right' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (group: MonitorGroupListItem) => {
    const fullGroup: MonitorGroup = {
      id: group.id,
      name: group.name,
      description: group.description,
      monitorCount: group.monitorCount,
      createdAt: new Date().toISOString(),
      isActive: true,
      monitors: [],
      avgUptime1Hr: 0,
      avgUptime24Hrs: 0,
      avgUptime7Days: 0,
      avgUptime30Days: 0,
      avgUptime3Months: 0,
      avgUptime6Months: 0
    };
    
    setFormMode('edit');
    setSelectedGroup(fullGroup);
    setNewGroupName(group.name);
    setShowGroupForm(true);
  };

  const handleFormSubmit = async () => {
    if (!newGroupName.trim()) {
      toast.error('Group name cannot be empty', { position: 'bottom-right' });
      return;
    }

    setIsLoading(true);
    try {
      if (formMode === 'edit' && selectedGroup) {
        await monitorService.updateMonitorGroup({
          id: Number(selectedGroup.id),
          name: newGroupName
        });
        toast.success('Monitor group updated successfully', { position: 'bottom-right' });
      } else if (formMode === 'create') {
        await monitorService.addMonitorGroup(newGroupName);
        toast.success('Group added successfully', { position: 'bottom-right' });
      }
      
      await fetchGroups();
      setShowGroupForm(false);
      setSelectedGroup(null);
      setNewGroupName('');
      setFormMode('create');
    } catch (error) {
      console.error('Failed to handle monitor group:', error);
      toast.error(
        formMode === 'edit' 
          ? 'Failed to update monitor group' 
          : 'Failed to add group', 
        { position: 'bottom-right' }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewClick = () => {
    setFormMode('create');
    setSelectedGroup(null);
    setNewGroupName('');
    setShowGroupForm(true);
  };

  const handleFormClose = () => {
    setShowGroupForm(false);
    setSelectedGroup(null);
    setNewGroupName('');
    setFormMode('create');
  };

  const totalPages = Math.ceil(sortedGroups.length / recordsPerPage);
  const paginatedGroups = sortedGroups.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
        <div className="px-4 lg:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Monitoring
            </div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
              Monitor groups
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Organize monitors for access and notifications
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search groups…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <button
              onClick={handleAddNewClick}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create group
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-4">
        {notification && (
          <div
            className={`rounded-lg border px-3 py-2.5 text-sm flex items-center gap-2 ${
              notification.type === 'success'
                ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                : 'border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
            }`}
          >
            {notification.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            {notification.message}
          </div>
        )}

        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 bg-gray-900/10 dark:bg-gray-900/50 flex items-center justify-center z-10 rounded-lg">
              <LoadingSpinner size="lg" />
            </div>
          )}

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <th
                      onClick={() => handleSort('name')}
                      className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Name
                        {sortConfig.key === 'name' &&
                          (sortConfig.direction === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ))}
                      </div>
                    </th>
                    <th className="w-24 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
                  {paginatedGroups.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                      >
                        No monitor groups found
                      </td>
                    </tr>
                  ) : (
                    paginatedGroups.map((group) => (
                      <tr
                        key={group.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900/60"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {group.name}
                          </div>
                          {group.description ? (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {group.description}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => handleEditClick(group)}
                              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                              title="Edit group"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                const fullGroup: MonitorGroup = {
                                  id: group.id,
                                  name: group.name,
                                  description: group.description,
                                  monitorCount: group.monitorCount,
                                  createdAt: new Date().toISOString(),
                                  isActive: true,
                                  monitors: [],
                                  avgUptime1Hr: 0,
                                  avgUptime24Hrs: 0,
                                  avgUptime7Days: 0,
                                  avgUptime30Days: 0,
                                  avgUptime3Months: 0,
                                  avgUptime6Months: 0,
                                };
                                setSelectedGroup(fullGroup);
                                setShowDeleteConfirmation(true);
                              }}
                              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                              title="Delete group"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="pt-1 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">Records per page</label>
            <select
              value={recordsPerPage}
              onChange={(e) => {
                setRecordsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-md text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {recordsPerPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
              Page {currentPage} of {Math.max(totalPages, 1)}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showDeleteConfirmation && selectedGroup && (
        <DeleteConfirmation
          group={selectedGroup}
          onConfirm={handleDelete}
          onCancel={() => {
            setShowDeleteConfirmation(false);
            setSelectedGroup(null);
          }}
          isDeleting={isLoading}
        />
      )}

      {showGroupForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              {formMode === 'edit' ? 'Edit group' : 'Create group'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Group name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Enter group name"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={handleFormClose}
                  className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFormSubmit}
                  disabled={isLoading || isAdding}
                  className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
                >
                  {isLoading || isAdding ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {isLoading || isAdding
                    ? formMode === 'edit'
                      ? 'Updating…'
                      : 'Creating…'
                    : formMode === 'edit'
                      ? 'Update group'
                      : 'Create group'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}