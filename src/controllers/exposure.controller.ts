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
   * Lists exposure records owned by current user.
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
   * GET /api/v1/exposures/:id
   * Retrieves single exposure record by ID.
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
