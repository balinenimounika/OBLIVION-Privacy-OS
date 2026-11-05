import { apiClient } from './client';
import {
  ApiResponse,
  DashboardOverview,
  ExposureBreakdown,
  RemovalProgress,
  RecentActivityItem,
} from '../types';

export const dashboardApi = {
  async getOverview(): Promise<ApiResponse<DashboardOverview>> {
    const res = await apiClient.get<ApiResponse<DashboardOverview>>('/dashboard/overview');
    return res.data;
  },

  async getExposureBreakdown(): Promise<ApiResponse<ExposureBreakdown>> {
    const res = await apiClient.get<ApiResponse<ExposureBreakdown>>('/dashboard/exposure-breakdown');
    return res.data;
  },

  async getRemovalProgress(): Promise<ApiResponse<RemovalProgress>> {
    const res = await apiClient.get<ApiResponse<RemovalProgress>>('/dashboard/removal-progress');
    return res.data;
  },

  async getRecentActivity(): Promise<ApiResponse<RecentActivityItem[]>> {
    const res = await apiClient.get<ApiResponse<RecentActivityItem[]>>('/dashboard/recent-activity');
    return res.data;
  },
};
