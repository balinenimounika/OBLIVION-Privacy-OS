import { apiClient } from './client';
import { ApiResponse, RemovalRequest, CreateRemovalRequestDTO, UpdateRemovalRequestDTO, RequestHistory } from '../types';

export const removalRequestApi = {
  async list(params?: {
    page?: number;
    limit?: number;
    websiteId?: string;
    requestStatus?: string;
    requestType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<RemovalRequest[]>> {
    const res = await apiClient.get<ApiResponse<RemovalRequest[]>>('/removal-requests', { params });
    return res.data;
  },

  async getById(id: string): Promise<ApiResponse<RemovalRequest>> {
    const res = await apiClient.get<ApiResponse<RemovalRequest>>(`/removal-requests/${id}`);
    return res.data;
  },

  async create(data: CreateRemovalRequestDTO): Promise<ApiResponse<RemovalRequest>> {
    const res = await apiClient.post<ApiResponse<RemovalRequest>>('/removal-requests', data);
    return res.data;
  },

  async updateStatus(id: string, data: UpdateRemovalRequestDTO): Promise<ApiResponse<RemovalRequest>> {
    const res = await apiClient.patch<ApiResponse<RemovalRequest>>(`/removal-requests/${id}`, data);
    return res.data;
  },

  async getHistory(id: string): Promise<ApiResponse<RequestHistory[]>> {
    const res = await apiClient.get<ApiResponse<RequestHistory[]>>(`/removal-requests/${id}/history`);
    return res.data;
  },
};
