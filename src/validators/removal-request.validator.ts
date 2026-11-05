/**
 * OBLIVION - Removal Request Validators
 */

import { z } from 'zod';
import { RemovalRequestType, RequestStatus } from '@prisma/client';

const removalRequestTypes = Object.values(RemovalRequestType) as [string, ...string[]];
const requestStatuses = Object.values(RequestStatus) as [string, ...string[]];

export const createRemovalRequestSchema = z
  .object({
    websiteId: z.string().uuid('websiteId must be a valid UUID'),
    exposureRecordId: z.string().uuid('exposureRecordId must be a valid UUID').optional(),
    exposedDataDescription: z
      .string()
      .trim()
      .min(3, 'Exposed personal information description must be at least 3 characters')
      .max(5000, 'Exposed personal information description cannot exceed 5000 characters')
      .optional(),
    requestType: z
      .enum(removalRequestTypes as any)
      .optional()
      .default(RemovalRequestType.GDPR_ERASURE),
    requestReason: z
      .string()
      .trim()
      .min(5, 'requestReason must be at least 5 characters')
      .max(5000, 'requestReason cannot exceed 5000 characters'),
    externalReference: z
      .string()
      .max(255, 'externalReference cannot exceed 255 characters')
      .optional()
      .nullable(),
    requestStatus: z
      .enum(['DRAFT', 'SUBMITTED'] as any)
      .optional()
      .default('DRAFT'),
  })
  .strict()
  .refine((data) => data.exposureRecordId || data.exposedDataDescription, {
    message: 'Please provide either exposureRecordId or describe the exposed personal information',
    path: ['exposedDataDescription'],
  });

export const updateRemovalRequestSchema = z
  .object({
    requestStatus: z
      .enum(requestStatuses as any)
      .optional(),
    requestReason: z
      .string()
      .trim()
      .min(5, 'requestReason must be at least 5 characters')
      .max(5000)
      .optional(),
    externalReference: z
      .string()
      .max(255)
      .optional()
      .nullable(),
    remarks: z
      .string()
      .max(2000, 'remarks cannot exceed 2000 characters')
      .optional()
      .nullable(),
  })
  .strict();

export const removalRequestQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  requestStatus: z.enum(requestStatuses as any).optional(),
  requestType: z.enum(removalRequestTypes as any).optional(),
  websiteId: z.string().uuid().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'submittedAt', 'requestStatus', 'requestType']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateRemovalRequestDTO = z.infer<typeof createRemovalRequestSchema>;
export type UpdateRemovalRequestDTO = z.infer<typeof updateRemovalRequestSchema>;
export type RemovalRequestQueryDTO = z.infer<typeof removalRequestQuerySchema>;
