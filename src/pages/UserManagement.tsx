import React, { useState, useMemo, useEffect } from 'react';
import { Search, AlertCircle, Check, Loader2 } from 'lucide-react';
import userService, { UserListItem } from '../services/userService';

export function UserManagement() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [adminFilter, setAdminFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  // Calculate pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, adminFilter]);

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
        <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm overflow-hidden flex-1">
          <div className="overflow-y-auto h-full">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="dark:bg-gray-700 bg-gray-50 border-b dark:border-gray-600">
                  <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">User</th>
                  <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Role</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map(user => (
                  <tr key={user.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 dark:text-white text-gray-900">{user.username}</td>
                    <td className="px-4 py-3 dark:text-gray-300 text-gray-700">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                    ${user.isAdmin 
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {user.isAdmin ? 'Admin' : 'User'}
                      </span>
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
            Showing {Math.min(itemsPerPage * (currentPage - 1) + 1, filteredUsers.length)} to{' '}
            {Math.min(itemsPerPage * currentPage, filteredUsers.length)} of {filteredUsers.length} users
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
    </div>
  );
}