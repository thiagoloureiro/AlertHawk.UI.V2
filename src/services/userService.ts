import { authHttp } from './httpClient';

export interface UserListItem {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
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
}

export default UserService.getInstance(); 