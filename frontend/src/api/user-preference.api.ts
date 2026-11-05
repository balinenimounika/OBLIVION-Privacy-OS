import { apiClient } from './client';
import { ApiResponse, UserNotificationPreference, EmailDeliveryItem } from '../types';

export interface UpdateUserPreferenceDTO {
  emailNotificationsEnabled?: boolean;
  notifyOnCreated?: boolean;
  notify7DaysBefore?: boolean;
  notify3DaysBefore?: boolean;
  notify1DayBefore?: boolean;
  notifyDueToday?: boolean;
  notifyOverdue?: boolean;
  overdueFrequency?: 'DAILY' | 'THREE_DAYS' | 'WEEKLY' | 'NONE';
  notifyOnCompleted?: boolean;
  notifyRemovalUpdates?: boolean;
  notifyAccountSecurity?: boolean;
}

export const userPreferenceApi = {
  /**
   * Retrieves notification preferences for the authenticated user,
   * including registered email and verification status.
   */
  async getPreferences(): Promise<ApiResponse<UserNotificationPreference>> {
    const res = await apiClient.get<ApiResponse<UserNotificationPreference>>('/users/preferences');
    return res.data;
  },

  /**
   * Updates notification preferences for the authenticated user.
   */
  async updatePreferences(
    data: UpdateUserPreferenceDTO
  ): Promise<ApiResponse<UserNotificationPreference>> {
    const res = await apiClient.put<ApiResponse<UserNotificationPreference>>('/users/preferences', data);
    return res.data;
  },

  /**
   * Retrieves transactional email delivery history for the authenticated user.
   */
  async getEmailDeliveries(): Promise<ApiResponse<EmailDeliveryItem[]>> {
    const res = await apiClient.get<ApiResponse<EmailDeliveryItem[]>>('/users/preferences/deliveries');
    return res.data;
  },

  /**
   * Dispatches email verification link to user's registered email address.
   */
  async resendVerification(): Promise<ApiResponse<void>> {
    const res = await apiClient.post<ApiResponse<void>>('/users/preferences/resend-verification');
    return res.data;
  },

  /**
   * Confirms email address verification using verification token.
   */
  async verifyEmail(token: string): Promise<ApiResponse<{ isEmailVerified: boolean }>> {
    const res = await apiClient.post<ApiResponse<{ isEmailVerified: boolean }>>(
      '/users/preferences/verify-email',
      { token }
    );
    return res.data;
  },
};
