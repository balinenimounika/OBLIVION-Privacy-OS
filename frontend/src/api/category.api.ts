import { apiClient } from './client';
import { ApiResponse, DataCategory } from '../types';

export const categoryApi = {
  async list(params?: {
    search?: string;
    sensitivity?: string;
    minRiskWeight?: number;
  }): Promise<ApiResponse<DataCategory[]>> {
    const res = await apiClient.get<ApiResponse<DataCategory[]>>('/categories', { params });
    return res.data;
  },

  async getById(id: string): Promise<ApiResponse<DataCategory>> {
    const res = await apiClient.get<ApiResponse<DataCategory>>(`/categories/${id}`);
    return res.data;
  },
};
