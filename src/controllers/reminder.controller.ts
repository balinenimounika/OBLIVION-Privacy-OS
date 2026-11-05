/**
 * OBLIVION - Reminder Controller
 */

import { Response, NextFunction } from 'express';
import { ReminderService } from '../services/reminder.service';
import { ApiResponse } from '../utils/api-response';
import { AuthenticatedRequest } from '../types';

export class ReminderController {
  /**
   * POST /api/v1/reminders
   * Creates a reminder.
   */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const reminder = await ReminderService.createReminder(req.user!.id, req.body);
      ApiResponse.created(res, 'Reminder created successfully', reminder);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/reminders
   * Lists reminders.
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as any).validatedQuery || req.query;
      const { reminders, meta } = await ReminderService.getReminders(req.user!.id, query);
      ApiResponse.success(res, 'Reminders retrieved successfully', reminders, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/reminders/:id
   * Retrieves single reminder by ID.
   */
  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const reminder = await ReminderService.getReminderById(req.user!.id, id);
      ApiResponse.success(res, 'Reminder retrieved successfully', reminder);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/reminders/:id
   * Updates reminder.
   */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const reminder = await ReminderService.updateReminder(req.user!.id, id, req.body);
      ApiResponse.success(res, 'Reminder updated successfully', reminder);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/reminders/:id
   * Deletes reminder.
   */
  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const reminder = await ReminderService.deleteReminder(req.user!.id, id);
      ApiResponse.success(res, 'Reminder deleted successfully', reminder);
    } catch (error) {
      next(error);
    }
  }
}
