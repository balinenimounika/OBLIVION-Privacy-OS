import { apiClient } from './client';
import { ApiResponse, Reminder, CreateReminderDTO, UpdateReminderDTO } from '../types';

export const reminderApi = {
  async list(params?: {
    page?: number;
    limit?: number;
    reminderType?: string;
    reminderStatus?: string;
  }): Promise<ApiResponse<Reminder[]>> {
    const res = await apiClient.get<ApiResponse<Reminder[]>>('/reminders', { params });
    return res.data;
  },

  async getById(id: string): Promise<ApiResponse<Reminder>> {
    const res = await apiClient.get<ApiResponse<Reminder>>(`/reminders/${id}`);
    return res.data;
  },

  async create(data: CreateReminderDTO): Promise<ApiResponse<Reminder>> {
    const res = await apiClient.post<ApiResponse<Reminder>>('/reminders', data);
    return res.data;
  },

  async update(id: string, data: UpdateReminderDTO): Promise<ApiResponse<Reminder>> {
    const res = await apiClient.patch<ApiResponse<Reminder>>(`/reminders/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<ApiResponse<null>> {
    const res = await apiClient.delete<ApiResponse<null>>(`/reminders/${id}`);
    return res.data;
  },
};
