import React, { useState, useMemo, useEffect } from 'react';
import { Search, AlertCircle, Check, Loader2, Edit, Trash2, X, Users } from 'lucide-react';
import userService, { UserListItem, UserGroup } from '../services/userService';
import monitorService, { MonitorGroup } from '../services/monitorService';
import { toast } from 'react-hot-toast';
import { Switch } from '../components/ui/switch';

export function UserManagement() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [adminFilter, setAdminFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [allGroups, setAllGroups] = useState<MonitorGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const data = await userService.getAllUsers();
        setUsers(data);
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setNotification({
          type: 'error',
          message: 'Failed to load users'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesAdminFilter = 
        adminFilter === 'all' ||
        (adminFilter === 'admin' && user.isAdmin) ||
        (adminFilter === 'user' && !user.isAdmin);

      return matchesSearch && matchesAdminFilter;
    });
  }, [users, searchTerm, adminFilter]);

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => a.username.localeCompare(b.username));
  }, [filteredUsers]);

  // Calculate pagination
  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage);
  const paginatedUsers = sortedUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, adminFilter]);

  const handleEdit = async (user: UserListItem) => {
    setSelectedUser(user);
    setShowEditModal(true);
    setIsLoadingGroups(true);
    
    try {
      const [userGroupsData, allGroupsData] = await Promise.all([
        userService.getUserGroups(user.id),
        monitorService.getMonitorGroupList()
      ]);
      
      setSelectedGroups(new Set(userGroupsData.map(ug => ug.groupMonitorId)));
      setUserGroups(userGroupsData);
      setAllGroups(allGroupsData);
    } catch (err: any) {
      console.error('Failed to load user groups:', err);
      toast.error('Failed to load user groups', { position: 'bottom-right' });
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleDelete = (user: UserListItem) => {
    setUserToDelete(user);
    setShowDeleteConfirmation(true);
  };

  const handleSelectAll = () => {
    const allGroupIds = sortedGroups.map(group => Number(group.id));
    setSelectedGroups(new Set(allGroupIds));
  };

  const handleRemoveAll = () => {
    setSelectedGroups(new Set());
  };

  const sortedGroups = useMemo(() => {
    return [...allGroups].sort((a, b) => a.name.localeCompare(b.name));
  }, [allGroups]);

  if (isLoading) return (
    <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading users...
      </div>
    </div>
  );

  return (
    <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-2">User Management</h1>
        <p className="dark:text-gray-400 text-gray-600">Manage users and their permissions</p>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-5 h-5 dark:text-gray-400 text-gray-500" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 
                     border-gray-300 dark:text-white text-gray-900 focus:ring-2 focus:ring-blue-500 
                     dark:focus:ring-blue-400 transition-colors duration-200"
          />
        </div>

        <div>
          <select
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value as 'all' | 'admin' | 'user')}
            className="w-full rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-300 
                     dark:text-white text-gray-900 p-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                     transition-colors duration-200"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admins Only</option>
            <option value="user">Users Only</option>
          </select>
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

      <div className="flex flex-col h-[calc(100vh-280px)]"> {/* Fixed height container */}
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-xs overflow-hidden flex-1">
          <div className="overflow-y-auto h-full">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="dark:bg-gray-700 bg-gray-50 border-b dark:border-gray-600">
                  <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">User</th>
                  <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Role</th>
                  <th className="w-20 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map(user => (
                  <tr key={user.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 dark:text-white text-gray-900">{user.username}</td>
                    <td className="px-4 py-3 dark:text-gray-300 text-gray-700">{user.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.isAdmin}
                          onCheckedChange={async (checked) => {
                            setIsUpdatingRole(user.id);
                            try {
                              const success = await userService.updateUser({
                                ...user,
                                isAdmin: checked
                              });
                              
                              if (success) {
                                toast.success('User role updated successfully', { position: 'bottom-right' });
                                // Refresh user list
                                const data = await userService.getAllUsers();
                                setUsers(data);
                              } else {
                                toast.error('Failed to update user role', { position: 'bottom-right' });
                              }
                            } catch (error) {
                              toast.error('Failed to update user role', { position: 'bottom-right' });
                            } finally {
                              setIsUpdatingRole(null);
                            }
                          }}
                          disabled={isUpdatingRole === user.id}
                        />
                        <span className="flex items-center gap-2">
                          {isUpdatingRole === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          ) : null}
                          <span className={`text-sm font-medium ${
                            user.isAdmin 
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {user.isAdmin ? 'Admin' : 'User'}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 rounded-lg dark:hover:bg-gray-600 hover:bg-gray-100
                                   transition-colors duration-200 text-blue-500 dark:text-blue-400"
                          title="Edit User Groups"
                        >
                          <Users className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-2 rounded-lg dark:hover:bg-gray-600 hover:bg-gray-100
                                   transition-colors duration-200 text-red-500 dark:text-red-400"
                          title="Delete User"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between px-4">
          <div className="text-sm dark:text-gray-400 text-gray-500">
            Showing {Math.min(itemsPerPage * (currentPage - 1) + 1, sortedUsers.length)} to{' '}
            {Math.min(itemsPerPage * currentPage, sortedUsers.length)} of {sortedUsers.length} users
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 
                       border-gray-300 dark:text-gray-300 text-gray-700 disabled:opacity-50
                       hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-lg dark:bg-gray-800 bg-white border dark:border-gray-700 
                       border-gray-300 dark:text-gray-300 text-gray-700 disabled:opacity-50
                       hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6 relative">
            <button
              onClick={() => {
                setShowDeleteConfirmation(false);
                setUserToDelete(null);
              }}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                       transition-colors duration-200 text-gray-500 dark:text-gray-400"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
              Delete User
            </h3>
            <p className="dark:text-gray-300 text-gray-600 mb-6">
              Are you sure you want to delete the user "{userToDelete.username}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                         dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!userToDelete) return;
                  
                  setIsDeleting(true);
                  try {
                    const success = await userService.deleteUser(userToDelete.id);
                    if (success) {
                      toast.success('User deleted successfully', { position: 'bottom-right' });
                      // Refresh user list
                      const data = await userService.getAllUsers();
                      setUsers(data);
                    } else {
                      toast.error('Failed to delete user', { position: 'bottom-right' });
                    }
                  } catch (error) {
                    toast.error('Failed to delete user', { position: 'bottom-right' });
                  } finally {
                    setIsDeleting(false);
                    setShowDeleteConfirmation(false);
                    setUserToDelete(null);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600
                         disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl dark:bg-gray-800 bg-white rounded-lg shadow-lg p-6 relative max-h-[80vh] flex flex-col">
            <button
              onClick={() => {
                setShowEditModal(false);
                setSelectedUser(null);
              }}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                       transition-colors duration-200 text-gray-500 dark:text-gray-400"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-4">
              Edit User Groups - {selectedUser.username}
            </h3>

            {isLoadingGroups ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="flex justify-end gap-2 mb-4">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600
                               transition-colors duration-200 flex items-center gap-2"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveAll}
                      className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600
                               transition-colors duration-200 flex items-center gap-2"
                    >
                      Remove All
                    </button>
                  </div>

                  <div className="space-y-2">
                    {sortedGroups.map(group => {
                      const isChecked = selectedGroups.has(Number(group.id));
                      const toggleGroup = () => {
                        setSelectedGroups(prev => {
                          const newSet = new Set(prev);
                          if (isChecked) {
                            newSet.delete(Number(group.id));
                          } else {
                            newSet.add(Number(group.id));
                          }
                          return newSet;
                        });
                      };

                      return (
                        <div
                          key={group.id}
                          onClick={toggleGroup}
                          className="flex items-center justify-between p-4 rounded-lg dark:bg-gray-700/50 
                                   bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer
                                   transition-colors duration-200"
                        >
                          <div>
                            <h4 className="font-medium dark:text-white text-gray-900">{group.name}</h4>
                            <p className="text-sm dark:text-gray-400 text-gray-600">{group.description}</p>
                          </div>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={toggleGroup}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleGroup();
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500
                                       cursor-pointer"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-4 pt-4 border-t dark:border-gray-700">
                  {/* Show validation error if present */}
                  {validationError && (
                    <div className="text-sm text-red-500 dark:text-red-400 mb-2">
                      {validationError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowEditModal(false);
                        setSelectedUser(null);
                        setValidationError(null);
                      }}
                      className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                               dark:text-white text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!selectedUser) return;
                        
                        // Clear any previous validation error
                        setValidationError(null);

                        // Check if at least one group is selected
                        if (selectedGroups.size === 0) {
                          setValidationError('Please select at least one group');
                          return;
                        }
                        
                        setIsSaving(true);
                        try {
                          const success = await userService.updateUserGroups(
                            selectedUser.id, 
                            Array.from(selectedGroups)
                          );
                          
                          if (success) {
                            toast.success('User groups updated successfully', { position: 'bottom-right' });
                            setShowEditModal(false);
                            setSelectedUser(null);
                            setValidationError(null);
                          } else {
                            toast.error('Failed to update user groups', { position: 'bottom-right' });
                          }
                        } catch (error) {
                          toast.error('Failed to update user groups', { position: 'bottom-right' });
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      disabled={isSaving || selectedGroups.size === 0}
                      className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600
                               disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}