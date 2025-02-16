import React, { useState, useMemo } from 'react';
import { Search, Plus, X, Check, AlertCircle } from 'lucide-react';
import type { User, Group } from '../types';

// Demo data
const demoUsers: User[] = [
  {
    id: '1',
    fullName: 'Alerthawk',
    email: 'alerthawk@outlook.com',
    isAdmin: true,
    groups: ['AlertHawk', 'Solver'],
    initials: 'A'
  },
  {
    id: '2',
    fullName: 'Altughan Ozengi',
    email: 'altughan.ozengi@outlook.com',
    isAdmin: true,
    groups: ['Tools', 'MySite'],
    initials: 'AO'
  },
  {
    id: '3',
    fullName: 'Thiago Loureiro',
    email: 'thiagoguru@outlook.com',
    isAdmin: true,
    groups: ['test1', 'test2'],
    initials: 'TL'
  }
];

const demoGroups: Group[] = [
  { id: '1', name: 'AlertHawk', description: 'Main monitoring team' },
  { id: '2', name: 'Solver', description: 'Issue resolution team' },
  { id: '3', name: 'Tools', description: 'Tools management' },
  { id: '4', name: 'MySite', description: 'Website management' },
  { id: '5', name: 'test1', description: 'Test group 1' },
  { id: '6', name: 'test2', description: 'Test group 2' },
  { id: '7', name: 'test3', description: 'Test group 3' },
  { id: '8', name: 'test4', description: 'Test group 4' }
];

export function UserManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [adminFilter, setAdminFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const filteredUsers = useMemo(() => {
    return demoUsers.filter(user => {
      const matchesSearch = 
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesAdminFilter = 
        adminFilter === 'all' ||
        (adminFilter === 'admin' && user.isAdmin) ||
        (adminFilter === 'user' && !user.isAdmin);

      return matchesSearch && matchesAdminFilter;
    });
  }, [searchTerm, adminFilter]);

  const handleAdminToggle = (userId: string) => {
    // In a real application, this would be an API call
    setNotification({
      type: 'success',
      message: 'Admin status updated successfully'
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleGroupToggle = (groupName: string) => {
    if (!selectedUser) return;

    // In a real application, this would be an API call
    setNotification({
      type: 'success',
      message: `Group ${selectedUser.groups.includes(groupName) ? 'removed from' : 'assigned to'} user`
    });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="p-6 dark:bg-gray-900 bg-gray-50 min-h-screen transition-colors duration-200">
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

      <div className="flex gap-6">
        {/* Users List */}
        <div className="flex-1">
          <div className="dark:bg-gray-800 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="dark:bg-gray-700 bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Admin</th>
                    <th className="px-4 py-3 text-left text-sm font-medium dark:text-gray-300 text-gray-700">Groups</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr 
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`dark:hover:bg-gray-700 hover:bg-gray-50 cursor-pointer
                                border-t dark:border-gray-700 border-gray-200
                                transition-colors duration-200
                                ${selectedUser?.id === user.id ? 'dark:bg-gray-700 bg-gray-100' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full dark:bg-gray-600 bg-gray-200 flex items-center justify-center
                                      text-sm font-medium dark:text-white text-gray-700">
                            {user.initials}
                          </div>
                          <span className="dark:text-gray-300 text-gray-900">{user.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 dark:text-gray-300 text-gray-900">{user.email}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdminToggle(user.id);
                          }}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full 
                                   border-2 border-transparent transition-colors duration-200 ease-in-out 
                                   ${user.isAdmin ? 'dark:bg-green-600 bg-green-500' : 'dark:bg-gray-600 bg-gray-300'}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full 
                                     bg-white shadow ring-0 transition duration-200 ease-in-out
                                     ${user.isAdmin ? 'translate-x-5' : 'translate-x-0'}`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {user.groups.map(group => (
                            <span
                              key={group}
                              className="px-2 py-1 text-xs rounded-full dark:bg-gray-700 bg-gray-100
                                       dark:text-gray-300 text-gray-700"
                            >
                              {group}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Group Management Panel */}
        {selectedUser && (
          <div className="w-80 dark:bg-gray-800 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full dark:bg-gray-600 bg-gray-200 flex items-center justify-center
                            text-2xl font-medium dark:text-white text-gray-700">
                {selectedUser.initials}
              </div>
              <div>
                <h3 className="text-lg font-medium dark:text-white text-gray-900">{selectedUser.fullName}</h3>
                <p className="text-sm dark:text-gray-400 text-gray-600">{selectedUser.email}</p>
              </div>
            </div>

            <h4 className="text-sm font-medium dark:text-gray-300 text-gray-700 mb-4">Monitor Groups</h4>
            <div className="space-y-2">
              {demoGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => handleGroupToggle(group.name)}
                  className="w-full flex items-center justify-between p-2 rounded-lg
                           dark:hover:bg-gray-700 hover:bg-gray-100
                           transition-colors duration-200"
                >
                  <span className="dark:text-gray-300 text-gray-900">{group.name}</span>
                  {selectedUser.groups.includes(group.name) ? (
                    <X className="w-5 h-5 dark:text-gray-400 text-gray-500" />
                  ) : (
                    <Plus className="w-5 h-5 dark:text-gray-400 text-gray-500" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-lg dark:bg-gray-700 bg-gray-100
                         dark:text-white text-gray-900 dark:hover:bg-gray-600 hover:bg-gray-200
                         transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg dark:bg-blue-600 bg-blue-500
                         text-white dark:hover:bg-blue-500 hover:bg-blue-600
                         transition-colors duration-200"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}