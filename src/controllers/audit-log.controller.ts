/**
 * OBLIVION - Audit Log Controller
 *
 * Exposes compliance reporting and audit inspection endpoints.
 */

import { Response, NextFunction } from 'express';
import { AuditLogService } from '../services/audit-log.service';
import { ApiResponse } from '../utils/api-response';
import { AuthenticatedRequest } from '../types';

export class AuditLogController {
  /**
   * GET /api/v1/audit-logs
   * Retrieves paginated audit logs for the authenticated tenant.
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as any).validatedQuery || req.query;
      const { auditLogs, meta } = await AuditLogService.getAuditLogs(req.user!.id, query);
      ApiResponse.success(res, 'Audit logs retrieved successfully', auditLogs, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/audit-logs/summary
   * Returns aggregated compliance activity metrics.
   */
  static async getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await AuditLogService.getSummary(req.user!.id);
      ApiResponse.success(res, 'Audit log compliance summary retrieved successfully', summary);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/audit-logs/export
   * Exports full audit history for GDPR Art. 15 Right of Access.
   */
  static async exportLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const exportData = await AuditLogService.exportLogs(req.user!.id);
      ApiResponse.success(res, 'Compliance audit report generated successfully', exportData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/audit-logs/:id
   * Retrieves a single audit log entry by ID.
   */
  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const log = await AuditLogService.getAuditLogById(req.user!.id, id);
      ApiResponse.success(res, 'Audit log entry retrieved successfully', log);
    } catch (error) {
      next(error);
    }
  }
}
