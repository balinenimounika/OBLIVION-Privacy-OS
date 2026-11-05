/**
 * OBLIVION - Base Service Interface & Shared Types
 */

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}
