import { apiClient } from './client';
import { ApiResponse, AuditLog, AuditSummary, AuditExport } from '../types';

export const auditApi = {
  async list(params?: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<AuditLog[]>> {
    const res = await apiClient.get<ApiResponse<AuditLog[]>>('/audit-logs', { params });
    return res.data;
  },

  async getSummary(): Promise<ApiResponse<AuditSummary>> {
    const res = await apiClient.get<ApiResponse<AuditSummary>>('/audit-logs/summary');
    return res.data;
  },

  async exportLogs(): Promise<ApiResponse<AuditExport>> {
    const res = await apiClient.get<ApiResponse<AuditExport>>('/audit-logs/export');
    return res.data;
  },
};
