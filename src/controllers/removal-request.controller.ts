/**
 * OBLIVION - Removal Request Controller
 */

import { Response, NextFunction } from 'express';
import { RemovalRequestService } from '../services/removal-request.service';
import { ApiResponse } from '../utils/api-response';
import { AuthenticatedRequest } from '../types';

export class RemovalRequestController {
  /**
   * POST /api/v1/removal-requests
   * Creates a removal request.
   */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await RemovalRequestService.createRemovalRequest(req.user!.id, req.body);
      ApiResponse.created(res, 'Removal request created successfully', request);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/removal-requests
   * Lists removal requests.
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as any).validatedQuery || req.query;
      const { requests, meta } = await RemovalRequestService.getRemovalRequests(req.user!.id, query);
      ApiResponse.success(res, 'Removal requests retrieved successfully', requests, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/removal-requests/:id
   * Retrieves single removal request by ID.
   */
  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const request = await RemovalRequestService.getRemovalRequestById(req.user!.id, id);
      ApiResponse.success(res, 'Removal request retrieved successfully', request);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/removal-requests/:id
   * Updates removal request status or details.
   */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const request = await RemovalRequestService.updateRemovalRequest(req.user!.id, id, req.body);
      ApiResponse.success(res, 'Removal request updated successfully', request);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/removal-requests/:id/history
   * Retrieves append-only status transition history.
   */
  static async getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const history = await RemovalRequestService.getRequestHistory(req.user!.id, id);
      ApiResponse.success(res, 'Request history retrieved successfully', history, 200, {
        total: history.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/removal-requests/:id/preview-demand
   * Previews a formal statutory erasure demand notice without sending emails.
   */
  static async previewDemand(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const preview = await RemovalRequestService.previewStatutoryDemand(req.user!.id, id, req.body);
      ApiResponse.success(res, 'Statutory demand notice generated successfully', preview);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/removal-requests/:id/dispatch-demand
   * Securely dispatches a formal statutory legal notice via Resend with explicit user confirmation.
   */
  static async dispatchDemand(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await RemovalRequestService.dispatchStatutoryDemand(req.user!.id, id, req.body);
      ApiResponse.success(
        res,
        'Statutory legal demand dispatched and tracking reminder scheduled',
        result,
        200
      );
    } catch (error) {
      next(error);
    }
  }
}
