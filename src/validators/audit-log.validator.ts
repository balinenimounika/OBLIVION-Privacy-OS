/**
 * OBLIVION - Audit Log Module Validators
 */

import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  startDate: z.string().datetime({ message: 'startDate must be a valid ISO 8601 date string' }).optional(),
  endDate: z.string().datetime({ message: 'endDate must be a valid ISO 8601 date string' }).optional(),
  sortBy: z.enum(['createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type AuditLogQueryDTO = z.infer<typeof auditLogQuerySchema>;
