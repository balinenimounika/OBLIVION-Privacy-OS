/**
 * OBLIVION - Dashboard Analytics Controller
 */

import { Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { ApiResponse } from '../utils/api-response';
import { AuthenticatedRequest } from '../types';

export class DashboardController {
  /**
   * GET /api/v1/dashboard/overview
   */
  static async getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await DashboardService.getOverview(req.user!.id);
      ApiResponse.success(res, 'Dashboard overview calculated successfully', overview);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/dashboard/exposure-breakdown
   */
  static async getExposureBreakdown(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const breakdown = await DashboardService.getExposureBreakdown(req.user!.id);
      ApiResponse.success(res, 'Exposure breakdown calculated successfully', breakdown);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/dashboard/removal-progress
   */
  static async getRemovalProgress(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const progress = await DashboardService.getRemovalProgress(req.user!.id);
      ApiResponse.success(res, 'Removal progress calculated successfully', progress);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/dashboard/recent-activity
   */
  static async getRecentActivity(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const activity = await DashboardService.getRecentActivity(req.user!.id);
      ApiResponse.success(res, 'Recent activity retrieved successfully', activity);
    } catch (error) {
      next(error);
    }
  }
}
