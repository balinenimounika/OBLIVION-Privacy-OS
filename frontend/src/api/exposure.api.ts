import { apiClient } from './client';
import { ApiResponse, ExposureRecord, CreateExposureDTO, UpdateExposureDTO } from '../types';

export const exposureApi = {
  async list(params?: {
    page?: number;
    limit?: number;
    websiteId?: string;
    sensitivityLevel?: string;
    recordStatus?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<ExposureRecord[]>> {
    const res = await apiClient.get<ApiResponse<ExposureRecord[]>>('/exposures', { params });
    return res.data;
  },

  async getById(id: string): Promise<ApiResponse<ExposureRecord>> {
    const res = await apiClient.get<ApiResponse<ExposureRecord>>(`/exposures/${id}`);
    return res.data;
  },

  async create(data: CreateExposureDTO): Promise<ApiResponse<ExposureRecord>> {
    const res = await apiClient.post<ApiResponse<ExposureRecord>>('/exposures', data);
    return res.data;
  },

  async update(id: string, data: UpdateExposureDTO): Promise<ApiResponse<ExposureRecord>> {
    const res = await apiClient.patch<ApiResponse<ExposureRecord>>(`/exposures/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<ApiResponse<null>> {
    const res = await apiClient.delete<ApiResponse<null>>(`/exposures/${id}`);
    return res.data;
  },

  async associateCategories(id: string, categoryIds: string[]): Promise<ApiResponse<ExposureRecord>> {
    const res = await apiClient.post<ApiResponse<ExposureRecord>>(`/exposures/${id}/categories`, { categoryIds });
    return res.data;
  },
};
