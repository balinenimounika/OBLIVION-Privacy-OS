import { apiClient } from './client';
import { ApiResponse, AuthData, User } from '../types';

export const authApi = {
  async register(data: { fullName: string; email: string; password: string }): Promise<ApiResponse<{ user: User }>> {
    const res = await apiClient.post<ApiResponse<{ user: User }>>('/auth/register', data);
    return res.data;
  },

  async login(data: { email: string; password: string }): Promise<ApiResponse<AuthData>> {
    const res = await apiClient.post<ApiResponse<AuthData>>('/auth/login', data);
    return res.data;
  },

  async me(): Promise<ApiResponse<User>> {
    const res = await apiClient.get<ApiResponse<User>>('/auth/me');
    return res.data;
  },

  async logout(): Promise<ApiResponse<null>> {
    const res = await apiClient.post<ApiResponse<null>>('/auth/logout');
    return res.data;
  },
};
