/**
 * OBLIVION - Notification Controller
 */

import { Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import { ApiResponse } from '../utils/api-response';
import { AuthenticatedRequest } from '../types';

export class NotificationController {
  /**
   * GET /api/v1/notifications
   * Lists notifications for current user with unread counter.
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as any).validatedQuery || req.query;
      const { notifications, meta } = await NotificationService.getNotifications(req.user!.id, query);
      ApiResponse.success(res, 'Notifications retrieved successfully', notifications, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/notifications/:id
   * Retrieves single notification.
   */
  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const notification = await NotificationService.getNotificationById(req.user!.id, id);
      ApiResponse.success(res, 'Notification retrieved successfully', notification);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   * Marks single notification as read.
   */
  static async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const notification = await NotificationService.markAsRead(req.user!.id, id);
      ApiResponse.success(res, 'Notification marked as read', notification);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/read-all
   * Marks all notifications as read.
   */
  static async markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await NotificationService.markAllAsRead(req.user!.id);
      ApiResponse.success(res, 'All notifications marked as read', result);
    } catch (error) {
      next(error);
    }
  }
}
