import { apiClient } from './client';
import { ApiResponse, Notification } from '../types';

export const notificationApi = {
  async list(params?: {
    page?: number;
    limit?: number;
    isRead?: boolean;
  }): Promise<ApiResponse<Notification[]>> {
    const res = await apiClient.get<ApiResponse<Notification[]>>('/notifications', { params });
    return res.data;
  },

  async markAsRead(id: string): Promise<ApiResponse<Notification>> {
    const res = await apiClient.patch<ApiResponse<Notification>>(`/notifications/${id}/read`);
    return res.data;
  },

  async markAllAsRead(): Promise<ApiResponse<{ count: number }>> {
    const res = await apiClient.patch<ApiResponse<{ count: number }>>('/notifications/read-all');
    return res.data;
  },
};
