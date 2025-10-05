import  { useState, useEffect } from 'react';
import { 
  Search, Plus, Edit, Trash2, AlertCircle, Loader2, 
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
      <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
          Delete Monitor Group
        </h3>
        
        <div className="mb-6">
          <p className="dark:text-gray-300 text-gray-700 mb-4">
            Are you sure you want to delete the group "{group.name}"?
          </p>
          
          {group.monitorCount > 0 && (
            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 
                          text-yellow-800 dark:text-yellow-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Warning: Group has active monitors</p>
                <p className="text-sm">
                  This group contains {group.monitorCount} monitor{group.monitorCount === 1 ? '' : 's'}. 
                  Deleting this group will remove all monitor assignments.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                     dark:text-white text-gray-900 dark:hover:bg-gray-600 hover:bg-gray-200
                     transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600
                     disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {isDeleting ? 'Deleting...' : 'Delete Group'}
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
    <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen transition-colors duration-200">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-2">Monitor Groups</h1>
            <p className="dark:text-gray-400 text-gray-600">Manage and organize your monitoring setup</p>
          </div>
          <button
            onClick={handleAddNewClick}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 
                     text-white transition-colors duration-200"
          >
            <Plus className="w-5 h-5" />
            Create New Group
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-5 h-5 dark:text-gray-400 text-gray-500" />
          <input
            type="text"
            placeholder="Search monitor groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg dark:bg-gray-800 bg-white border 
                     dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 
                     focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                     transition-colors duration-200"
          />
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
          notification.type === 'success' 
            ? 'dark:bg-green-900/20 bg-green-50 dark:text-green-200 text-green-800'
            : 'dark:bg-red-900/20 bg-red-50 dark:text-red-200 text-red-800'
        }`}>
          {notification.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {notification.message}
        </div>
      )}

      {/* Groups Table */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900/10 dark:bg-gray-900/50 
                        flex items-center justify-center z-10">
            <LoadingSpinner size="lg" />
          </div>
        )}
        
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="dark:bg-gray-700 bg-gray-50">
                  <th
                    onClick={() => handleSort('name')}
                    className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700 cursor-pointer
                             dark:hover:bg-gray-600 hover:bg-gray-100 transition-colors duration-200"
                  >
                    <div className="flex items-center gap-2">
                      Name
                      {sortConfig.key === 'name' && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium dark:text-gray-300 text-gray-700">
                    &nbsp;
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedGroups.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center dark:text-gray-400 text-gray-500">
                      No monitor groups found
                    </td>
                  </tr>
                ) : (
                  paginatedGroups.map(group => (
                    <tr 
                      key={group.id}
                      className="border-t dark:border-gray-700 border-gray-200 transition-colors duration-200"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="dark:text-white text-gray-900 font-medium">
                            {group.name}
                          </div>
                          <div className="text-sm dark:text-gray-400 text-gray-500">
                            {group.description}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditClick(group)}
                            className="p-2 rounded-lg dark:hover:bg-gray-600 hover:bg-gray-100
                                     transition-colors duration-200 text-blue-500 dark:text-blue-400"
                            title="Edit Group"
                          >
                            <Edit className="w-5 h-5" />
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
                                avgUptime6Months: 0
                              };
                              setSelectedGroup(fullGroup);
                              setShowDeleteConfirmation(true);
                            }}
                            className="p-2 rounded-lg dark:hover:bg-gray-600 hover:bg-gray-100
                                     transition-colors duration-200 text-red-500 dark:text-red-400"
                            title="Delete Group"
                          >
                            <Trash2 className="w-5 h-5" />
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

      {/* Delete Confirmation Dialog */}
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

      {/* Group Form Dialog */}
      {showGroupForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
              {formMode === 'edit' ? 'Edit Group' : 'Create New Group'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg dark:bg-gray-700 border dark:border-gray-600
                           dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter group name"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleFormClose}
                  className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                           dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFormSubmit}
                  disabled={isLoading || isAdding}
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600
                           disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading || isAdding ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {isLoading || isAdding ? 
                    (formMode === 'edit' ? 'Updating...' : 'Creating...') : 
                    (formMode === 'edit' ? 'Update Group' : 'Create Group')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add pagination controls after the table */}
      <div className="mt-4 py-4 border-t dark:border-gray-700 border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm dark:text-gray-300 text-gray-700">
              Records per page:
            </label>
            <select
              value={recordsPerPage}
              onChange={e => {
                setRecordsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-300 
                       dark:text-white text-gray-900 p-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                       transition-colors duration-200"
            >
              {recordsPerPageOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg dark:bg-gray-800 bg-white dark:text-white text-gray-900
                       dark:hover:bg-gray-700 hover:bg-gray-100 disabled:opacity-50
                       transition-colors duration-200"
            >
              Previous
            </button>
            <span className="dark:text-gray-300 text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg dark:bg-gray-800 bg-white dark:text-white text-gray-900
                       dark:hover:bg-gray-700 hover:bg-gray-100 disabled:opacity-50
                       transition-colors duration-200"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}