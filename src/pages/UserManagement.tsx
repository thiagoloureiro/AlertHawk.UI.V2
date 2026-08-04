import React, { useState, useMemo, useEffect } from 'react';
import { Search, AlertCircle, Check, Trash2, X, Users, Server, CreditCard } from 'lucide-react';
import { LoadingSpinner } from '../components/ui';
import userService, { UserListItem, UserGroup, UserCluster } from '../services/userService';
import finopsService, { SubscriptionSummary } from '../services/finopsService';
import monitorService, { MonitorGroup } from '../services/monitorService';
import metricsService from '../services/metricsService';
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
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [selectedUserForClusters, setSelectedUserForClusters] = useState<UserListItem | null>(null);
  const [allClusters, setAllClusters] = useState<string[]>([]);
  const [userClusters, setUserClusters] = useState<UserCluster[]>([]);
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());
  const [isLoadingClusters, setIsLoadingClusters] = useState(false);
  const [isSavingClusters, setIsSavingClusters] = useState(false);
  const [clusterValidationError, setClusterValidationError] = useState<string | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedUserForSubscriptions, setSelectedUserForSubscriptions] = useState<UserListItem | null>(null);
  const [allSubscriptions, setAllSubscriptions] = useState<SubscriptionSummary[]>([]);
  const [selectedSubscriptionIds, setSelectedSubscriptionIds] = useState<Set<string>>(new Set());
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(false);
  const [isSavingSubscriptions, setIsSavingSubscriptions] = useState(false);
  const [subscriptionValidationError, setSubscriptionValidationError] = useState<string | null>(null);

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

  const handleEditClusters = async (user: UserListItem) => {
    setSelectedUserForClusters(user);
    setShowClusterModal(true);
    setIsLoadingClusters(true);
    
    try {
      const [userClustersData, allClustersData] = await Promise.all([
        userService.getUserClusters(user.id),
        metricsService.getClusters()
      ]);
      
      setSelectedClusters(new Set(userClustersData.map(uc => uc.clusterName)));
      setUserClusters(userClustersData);
      setAllClusters(allClustersData);
    } catch (err: any) {
      console.error('Failed to load user clusters:', err);
      toast.error('Failed to load user clusters', { position: 'bottom-right' });
    } finally {
      setIsLoadingClusters(false);
    }
  };

  const handleEditSubscriptions = async (user: UserListItem) => {
    setSelectedUserForSubscriptions(user);
    setShowSubscriptionModal(true);
    setIsLoadingSubscriptions(true);

    try {
      const [userSubsData, finopsSubs] = await Promise.all([
        userService.getUserSubscriptions(user.id),
        finopsService.getSubscriptions()
      ]);

      setSelectedSubscriptionIds(new Set(userSubsData.map(us => us.subscriptionId)));
      setAllSubscriptions(finopsSubs);
    } catch (err: unknown) {
      console.error('Failed to load user subscriptions:', err);
      toast.error('Failed to load user subscriptions', { position: 'bottom-right' });
    } finally {
      setIsLoadingSubscriptions(false);
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

  const handleSelectAllClusters = () => {
    setSelectedClusters(new Set(allClusters));
  };

  const handleRemoveAllClusters = () => {
    setSelectedClusters(new Set());
  };

  const handleSelectAllSubscriptions = () => {
    setSelectedSubscriptionIds(new Set(sortedSubscriptions.map(s => s.subscriptionId)));
  };

  const handleRemoveAllSubscriptions = () => {
    setSelectedSubscriptionIds(new Set());
  };

  const sortedSubscriptions = useMemo(() => {
    return [...allSubscriptions].sort((a, b) => {
      const byName = a.subscriptionName.localeCompare(b.subscriptionName, undefined, { sensitivity: 'base' });
      if (byName !== 0) return byName;
      return a.subscriptionId.localeCompare(b.subscriptionId);
    });
  }, [allSubscriptions]);

  const sortedGroups = useMemo(() => {
    return [...allGroups].sort((a, b) => a.name.localeCompare(b.name));
  }, [allGroups]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <LoadingSpinner text="Loading users..." />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
        <div className="px-4 lg:px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Admin
            </div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
              User management
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Manage users, roles, groups, clusters, and FinOps access
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
            <select
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value as 'all' | 'admin' | 'user')}
              className="px-2.5 py-1.5 rounded-md text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="all">All roles</option>
              <option value="admin">Admins only</option>
              <option value="user">Users only</option>
            </select>
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

        <div className="flex flex-col min-h-[calc(100vh-14rem)]">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden flex-1">
            <div className="overflow-y-auto h-full">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      User
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Email
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Role
                    </th>
                    <th className="w-28 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
                  {paginatedUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/60"
                    >
                      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                        {user.username}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{user.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.isAdmin}
                            onCheckedChange={async (checked) => {
                              setIsUpdatingRole(user.id);
                              try {
                                const success = await userService.updateUser({
                                  ...user,
                                  isAdmin: checked,
                                });

                                if (success) {
                                  toast.success('User role updated successfully', {
                                    position: 'bottom-right',
                                  });
                                  const data = await userService.getAllUsers();
                                  setUsers(data);
                                } else {
                                  toast.error('Failed to update user role', {
                                    position: 'bottom-right',
                                  });
                                }
                              } catch {
                                toast.error('Failed to update user role', {
                                  position: 'bottom-right',
                                });
                              } finally {
                                setIsUpdatingRole(null);
                              }
                            }}
                            disabled={isUpdatingRole === user.id}
                          />
                          <span className="flex items-center gap-2">
                            {isUpdatingRole === user.id ? <LoadingSpinner size="sm" /> : null}
                            <span
                              className={`text-xs font-medium ${
                                user.isAdmin
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}
                            >
                              {user.isAdmin ? 'Admin' : 'User'}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                            title="Edit user groups"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditClusters(user)}
                            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                            title="Edit user clusters"
                          >
                            <Server className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditSubscriptions(user)}
                            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                            title="Edit user subscriptions (FinOps)"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Showing {Math.min(itemsPerPage * (currentPage - 1) + 1, sortedUsers.length)} to{' '}
              {Math.min(itemsPerPage * currentPage, sortedUsers.length)} of {sortedUsers.length} users
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
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
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-xl relative">
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

            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
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
                className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
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
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              >
                {isDeleting ? (
                  <>
                    <LoadingSpinner size="sm" />
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
          <div className="w-full max-w-2xl rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-xl relative max-h-[80vh] flex flex-col">
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

            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              Edit User Groups - {selectedUser.username}
            </h3>

            {isLoadingGroups ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="flex justify-end gap-2 mb-4">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors flex items-center gap-1.5"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveAll}
                      className="px-2.5 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors flex items-center gap-1.5"
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
                          className="flex items-center justify-between p-3 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-900 cursor-pointer transition-colors"
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

                <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
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
                      className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
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
                      className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                    >
                      {isSaving ? (
                        <>
                          <LoadingSpinner size="sm" />
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

      {/* Cluster Management Modal */}
      {showClusterModal && selectedUserForClusters && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-xl relative max-h-[80vh] flex flex-col">
            <button
              onClick={() => {
                setShowClusterModal(false);
                setSelectedUserForClusters(null);
                setClusterValidationError(null);
              }}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                       transition-colors duration-200 text-gray-500 dark:text-gray-400"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              Edit User Clusters - {selectedUserForClusters.username}
            </h3>

            {isLoadingClusters ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="flex justify-end gap-2 mb-4">
                    <button
                      type="button"
                      onClick={handleSelectAllClusters}
                      className="px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors flex items-center gap-1.5"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveAllClusters}
                      className="px-2.5 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors flex items-center gap-1.5"
                    >
                      Remove All
                    </button>
                  </div>

                  <div className="space-y-2">
                    {allClusters.map(cluster => {
                      const isChecked = selectedClusters.has(cluster);
                      const toggleCluster = () => {
                        setSelectedClusters(prev => {
                          const newSet = new Set(prev);
                          if (isChecked) {
                            newSet.delete(cluster);
                          } else {
                            newSet.add(cluster);
                          }
                          return newSet;
                        });
                      };

                      return (
                        <div
                          key={cluster}
                          onClick={toggleCluster}
                          className="flex items-center justify-between p-3 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-900 cursor-pointer transition-colors"
                        >
                          <div>
                            <h4 className="font-medium dark:text-white text-gray-900">{cluster}</h4>
                          </div>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={toggleCluster}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCluster();
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

                <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                  {/* Show validation error if present */}
                  {clusterValidationError && (
                    <div className="text-sm text-red-500 dark:text-red-400 mb-2">
                      {clusterValidationError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowClusterModal(false);
                        setSelectedUserForClusters(null);
                        setClusterValidationError(null);
                      }}
                      className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!selectedUserForClusters) return;
                        
                        // Clear any previous validation error
                        setClusterValidationError(null);
                        
                        setIsSavingClusters(true);
                        try {
                          const success = await userService.updateUserClusters(
                            selectedUserForClusters.id, 
                            Array.from(selectedClusters)
                          );
                          
                          if (success) {
                            toast.success('User clusters updated successfully', { position: 'bottom-right' });
                            setShowClusterModal(false);
                            setSelectedUserForClusters(null);
                            setClusterValidationError(null);
                          } else {
                            toast.error('Failed to update user clusters', { position: 'bottom-right' });
                          }
                        } catch (error) {
                          toast.error('Failed to update user clusters', { position: 'bottom-right' });
                        } finally {
                          setIsSavingClusters(false);
                        }
                      }}
                      disabled={isSavingClusters}
                      className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                    >
                      {isSavingClusters ? (
                        <>
                          <LoadingSpinner size="sm" />
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

      {/* Subscription Management Modal (FinOps) */}
      {showSubscriptionModal && selectedUserForSubscriptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-xl relative max-h-[80vh] flex flex-col">
            <button
              onClick={() => {
                setShowSubscriptionModal(false);
                setSelectedUserForSubscriptions(null);
                setSubscriptionValidationError(null);
              }}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                       transition-colors duration-200 text-gray-500 dark:text-gray-400"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              Edit User Subscriptions — {selectedUserForSubscriptions.username}
            </h3>
            <p className="text-sm dark:text-gray-400 text-gray-600 mb-4">
              Subscriptions are loaded from FinOps analysis runs. Assign which subscriptions this user may access.
            </p>

            {isLoadingSubscriptions ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="flex justify-end gap-2 mb-4">
                    <button
                      type="button"
                      onClick={handleSelectAllSubscriptions}
                      className="px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors flex items-center gap-1.5"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveAllSubscriptions}
                      className="px-2.5 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors flex items-center gap-1.5"
                    >
                      Remove All
                    </button>
                  </div>

                  {sortedSubscriptions.length === 0 ? (
                    <p className="text-sm dark:text-gray-400 text-gray-600 py-4 text-center">
                      No subscriptions returned from FinOps. Run an analysis or check the FinOps API connection.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {sortedSubscriptions.map(sub => {
                        const isChecked = selectedSubscriptionIds.has(sub.subscriptionId);
                        const toggleSub = () => {
                          setSelectedSubscriptionIds(prev => {
                            const next = new Set(prev);
                            if (isChecked) next.delete(sub.subscriptionId);
                            else next.add(sub.subscriptionId);
                            return next;
                          });
                        };

                        return (
                          <div
                            key={sub.subscriptionId}
                            onClick={toggleSub}
                            className="flex items-center justify-between p-3 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-900 cursor-pointer transition-colors"
                          >
                            <div className="min-w-0 pr-3">
                              <h4 className="font-medium dark:text-white text-gray-900 truncate">
                                {sub.subscriptionName || sub.subscriptionId}
                              </h4>
                              <p className="text-xs dark:text-gray-400 text-gray-500 font-mono truncate mt-0.5">
                                {sub.subscriptionId}
                              </p>
                            </div>
                            <div className="flex items-center shrink-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={toggleSub}
                                onClick={e => {
                                  e.stopPropagation();
                                  toggleSub();
                                }}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500
                                         cursor-pointer"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                  {subscriptionValidationError && (
                    <div className="text-sm text-red-500 dark:text-red-400 mb-2">
                      {subscriptionValidationError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowSubscriptionModal(false);
                        setSelectedUserForSubscriptions(null);
                        setSubscriptionValidationError(null);
                      }}
                      className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!selectedUserForSubscriptions) return;

                        setSubscriptionValidationError(null);
                        setIsSavingSubscriptions(true);
                        try {
                          const success = await userService.updateUserSubscriptions(
                            selectedUserForSubscriptions.id,
                            Array.from(selectedSubscriptionIds)
                          );

                          if (success) {
                            toast.success('User subscriptions updated successfully', {
                              position: 'bottom-right'
                            });
                            setShowSubscriptionModal(false);
                            setSelectedUserForSubscriptions(null);
                            setSubscriptionValidationError(null);
                          } else {
                            toast.error('Failed to update user subscriptions', { position: 'bottom-right' });
                          }
                        } catch {
                          toast.error('Failed to update user subscriptions', { position: 'bottom-right' });
                        } finally {
                          setIsSavingSubscriptions(false);
                        }
                      }}
                      disabled={isSavingSubscriptions}
                      className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                    >
                      {isSavingSubscriptions ? (
                        <>
                          <LoadingSpinner size="sm" />
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