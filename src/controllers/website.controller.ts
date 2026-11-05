/**
 * OBLIVION - Website Controller
 */

import { Response, NextFunction } from 'express';
import { WebsiteService } from '../services/website.service';
import { ApiResponse } from '../utils/api-response';
import { AuthenticatedRequest } from '../types';

export class WebsiteController {
  /**
   * POST /api/v1/websites
   * Adds a new website.
   */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const website = await WebsiteService.createWebsite(req.user!.id, req.body);
      ApiResponse.created(res, 'Website registered successfully', website);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/websites
   * Lists websites owned by current user with pagination and filtering.
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as any).validatedQuery || req.query;
      const { websites, meta } = await WebsiteService.getWebsites(req.user!.id, query);
      ApiResponse.success(res, 'Websites retrieved successfully', websites, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/websites/:id
   * Retrieves single website by ID.
   */
  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const website = await WebsiteService.getWebsiteById(req.user!.id, id);
      ApiResponse.success(res, 'Website retrieved successfully', website);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/websites/:id
   * Updates an existing website.
   */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const website = await WebsiteService.updateWebsite(req.user!.id, id, req.body);
      ApiResponse.success(res, 'Website updated successfully', website);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/websites/:id
   * Deletes a website.
   */
  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const website = await WebsiteService.deleteWebsite(req.user!.id, id);
      ApiResponse.success(res, 'Website deleted successfully', website);
    } catch (error) {
      next(error);
    }
  }
}
