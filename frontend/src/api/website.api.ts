import { apiClient } from './client';
import { ApiResponse, Website, CreateWebsiteDTO, UpdateWebsiteDTO } from '../types';

export const websiteApi = {
  async list(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<Website[]>> {
    const res = await apiClient.get<ApiResponse<Website[]>>('/websites', { params });
    return res.data;
  },

  async getById(id: string): Promise<ApiResponse<Website>> {
    const res = await apiClient.get<ApiResponse<Website>>(`/websites/${id}`);
    return res.data;
  },

  async create(data: CreateWebsiteDTO): Promise<ApiResponse<Website>> {
    const res = await apiClient.post<ApiResponse<Website>>('/websites', data);
    return res.data;
  },

  async update(id: string, data: UpdateWebsiteDTO): Promise<ApiResponse<Website>> {
    const res = await apiClient.patch<ApiResponse<Website>>(`/websites/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<ApiResponse<null>> {
    const res = await apiClient.delete<ApiResponse<null>>(`/websites/${id}`);
    return res.data;
  },
};
