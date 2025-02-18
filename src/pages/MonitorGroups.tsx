import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Edit, Trash2, AlertCircle, Loader2, 
  Check, X, ChevronDown, ChevronUp, Users
} from 'lucide-react';
import type { MonitorGroup } from '../types';
import monitorService from '../services/monitorService';
import { toast } from 'react-hot-toast';

// Demo data
const demoGroups: MonitorGroup[] = [
  {
    id: '1',
    name: 'Production Services',
    description: 'Critical production environment services',
    monitorCount: 15,
    createdAt: '2024-03-15T10:00:00Z',
    isActive: true
  },
  {
    id: '2',
    name: 'Development APIs',
    description: 'Development environment API endpoints',
    monitorCount: 8,
    createdAt: '2024-03-14T15:30:00Z',
    isActive: true
  },
  {
    id: '3',
    name: 'Database Cluster',
    description: 'Database servers and related services',
    monitorCount: 6,
    createdAt: '2024-03-13T09:15:00Z',
    isActive: false
  }
];

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
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
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
              <Loader2 className="w-4 h-4 animate-spin" />
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

interface GroupFormProps {
  group?: MonitorGroup;
  onSave: (group: Partial<MonitorGroup>) => void;
  onCancel: () => void;
}

function GroupForm({ group, onSave, onCancel }: GroupFormProps) {
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [isActive, setIsActive] = useState(group?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      isActive
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-2xl dark:bg-gray-800 bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b dark:border-gray-700 border-gray-200">
          <h3 className="text-xl font-semibold dark:text-white text-gray-900">
            {group ? 'Edit Monitor Group' : 'Create Monitor Group'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 
                          text-red-700 dark:text-red-200 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
                Group Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg dark:bg-gray-700 bg-white border 
                         dark:border-gray-600 border-gray-300 dark:text-white text-gray-900 
                         focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                         transition-colors duration-200"
                placeholder="Enter group name"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 rounded-lg dark:bg-gray-700 bg-white border 
                         dark:border-gray-600 border-gray-300 dark:text-white text-gray-900 
                         focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                         transition-colors duration-200"
                placeholder="Enter group description"
              />
            </div>

            <div className="flex items-center">
              <label htmlFor="status" className="text-sm font-medium dark:text-gray-300 text-gray-700 mr-3">
                Status
              </label>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full 
                         border-2 border-transparent transition-colors duration-200 ease-in-out 
                         ${isActive ? 'dark:bg-green-600 bg-green-500' : 'dark:bg-gray-600 bg-gray-300'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full 
                           bg-white shadow ring-0 transition duration-200 ease-in-out
                           ${isActive ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                       dark:text-white text-gray-900 dark:hover:bg-gray-600 hover:bg-gray-200
                       transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white
                       transition-colors duration-200"
            >
              {group ? 'Save Changes' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MonitorGroups() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof MonitorGroup; direction: 'asc' | 'desc' }>({
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
  const [isAdding, setIsAdding] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  // Move fetchGroups outside useEffect so it can be reused
  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      const groupList = await monitorService.getMonitorGroupList();
      setGroups(groupList);
    } catch (err) {
      console.error('Failed to fetch monitor groups:', err);
      setNotification({
        type: 'error',
        message: 'Failed to load monitor groups'
      });
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
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: keyof MonitorGroup) => {
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
    } catch (error) {
      console.error('Failed to delete monitor group:', error);
      toast.error('Failed to delete monitor group', { position: 'bottom-right' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (group: MonitorGroupListItem) => {
    const fullGroup: MonitorGroup = {
      id: group.id,
      name: group.name,
      description: '',
      monitorCount: 0,
      createdAt: new Date().toISOString(),
      isActive: true
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
            <Loader2 className="w-8 h-8 animate-spin dark:text-blue-400 text-blue-600" />
          </div>
        )}
        
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="dark:bg-gray-800 bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 dark:text-gray-300 text-gray-700"
                    >
                      Name
                      {sortConfig.key === 'name' && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left dark:text-gray-300 text-gray-700">
                    Monitors
                  </th>
                  <th className="px-4 py-3 text-left dark:text-gray-300 text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center dark:text-gray-400 text-gray-500">
                      No monitor groups found
                    </td>
                  </tr>
                ) : (
                  sortedGroups.map(group => (
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
                        <div className="flex items-center gap-2 dark:text-gray-300 text-gray-700">
                          <Users className="w-4 h-4" />
                          {group.monitorCount}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditClick(group)}
                            className="p-1.5 rounded-lg dark:hover:bg-gray-600 hover:bg-gray-100
                                     transition-colors duration-200 dark:text-gray-400 text-gray-500
                                     hover:text-blue-500 dark:hover:text-blue-400"
                            title="Edit Group"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedGroup(group);
                              setShowDeleteConfirmation(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10
                                     transition-colors duration-200 text-red-500 dark:text-red-400
                                     hover:text-red-600 dark:hover:text-red-300"
                            title="Delete Group"
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
                    <Loader2 className="w-4 h-4 animate-spin" />
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
    </div>
  );
}