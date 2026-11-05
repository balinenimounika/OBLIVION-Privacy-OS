/**
 * OBLIVION - Exposure Record Controller
 */

import { Response, NextFunction } from 'express';
import { ExposureService } from '../services/exposure.service';
import { ApiResponse } from '../utils/api-response';
import { AuthenticatedRequest } from '../types';

export class ExposureController {
  /**
   * POST /api/v1/exposures
   * Creates an exposure record.
   */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await ExposureService.createExposure(req.user!.id, req.body);
      ApiResponse.created(res, 'Exposure record created successfully', record);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/exposures
   * Lists exposure records owned by current user with filters & sorting.
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as any).validatedQuery || req.query;
      const { records, meta } = await ExposureService.getExposures(req.user!.id, query);
      ApiResponse.success(res, 'Exposure records retrieved successfully', records, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/exposures/summary
   * Aggregates exposure dashboard metrics: summary counts, risk distribution, platforms.
   */
  static async getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await ExposureService.getSummary(req.user!.id);
      ApiResponse.success(res, 'Exposure summary metrics retrieved successfully', summary);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/exposures/:id
   * Retrieves single exposure record by ID with timeline and breakdown.
   */
  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const record = await ExposureService.getExposureById(req.user!.id, id);
      ApiResponse.success(res, 'Exposure record retrieved successfully', record);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/exposures/:id
   * Updates an existing exposure record.
   */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const record = await ExposureService.updateExposure(req.user!.id, id, req.body);
      ApiResponse.success(res, 'Exposure record updated successfully', record);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/exposures/:id/resolve
   * Explicitly marks an exposure record as RESOLVED.
   */
  static async markResolved(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const record = await ExposureService.markAsResolved(req.user!.id, id);
      ApiResponse.success(res, 'Exposure marked as resolved successfully', record);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/exposures/:id/removal-requests
   * Creates a removal request directly linked to this exposure.
   */
  static async createRemovalRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const removal = await ExposureService.createRemovalRequestForExposure(req.user!.id, id, req.body);
      ApiResponse.created(res, 'Removal request initiated from exposure successfully', removal);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/exposures/:id
   * Deletes an exposure record.
   */
  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const record = await ExposureService.deleteExposure(req.user!.id, id);
      ApiResponse.success(res, 'Exposure record deleted successfully', record);
    } catch (error) {
      next(error);
    }
  }
}
