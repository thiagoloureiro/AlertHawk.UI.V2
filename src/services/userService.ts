import { authHttp } from './httpClient';

export interface UserListItem {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
}

export interface UserGroup {
  id: string;
  userId: string;
  groupMonitorId: number;
}

export interface UserCluster {
  userId: string;
  clusterName: string;
}

export class UserService {
  private static instance: UserService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = '/api/user';
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  async getAllUsers(): Promise<UserListItem[]> {
    const response = await authHttp.get<UserListItem[]>(`${this.baseUrl}/getAll`);
    return response.data;
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      await authHttp.delete(`${this.baseUrl}/delete/${userId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete user:', error);
      return false;
    }
  }

  async getUserGroups(userId: string): Promise<UserGroup[]> {
    try {
      const response = await authHttp.get<UserGroup[]>(`/api/usersMonitorGroup/GetAllByUserId/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user groups:', error);
      return [];
    }
  }

  async updateUserGroups(userId: string, groupIds: number[]): Promise<boolean> {
    try {
      const payload = groupIds.map(groupId => ({
        userId,
        groupMonitorId: groupId
      }));
      
      await authHttp.post('/api/usersMonitorGroup/create', payload);
      return true;
    } catch (error) {
      console.error('Failed to update user groups:', error);
      return false;
    }
  }

  async updateUser(user: UserListItem): Promise<boolean> {
    try {
      await authHttp.put(`${this.baseUrl}/update`, user);
      return true;
    } catch (error) {
      console.error('Failed to update user:', error);
      return false;
    }
  }

  async getUserClusters(userId: string): Promise<UserCluster[]> {
    try {
      const response = await authHttp.get<UserCluster[]>(`/api/UserClusters/GetAllByUserId/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user clusters:', error);
      return [];
    }
  }

  async updateUserClusters(userId: string, clusters: string[]): Promise<boolean> {
    try {
      await authHttp.post('/api/UserClusters/CreateOrUpdate', {
        userId,
        clusters
      });
      return true;
    } catch (error) {
      console.error('Failed to update user clusters:', error);
      return false;
    }
  }
}

export default UserService.getInstance(); 