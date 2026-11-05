/**
 * OBLIVION - Exposure Record Validators
 */

import { z } from 'zod';
import { SensitivityLevel, RecordStatus } from '@prisma/client';

const sensitivityValues = Object.values(SensitivityLevel) as [string, ...string[]];
const recordStatusValues = Object.values(RecordStatus) as [string, ...string[]];

export const createExposureSchema = z
  .object({
    websiteId: z
      .string()
      .uuid('websiteId must be a valid UUID'),
    purpose: z
      .string()
      .trim()
      .min(1, 'Purpose is required')
      .max(255, 'Purpose cannot exceed 255 characters'),
    sensitivityLevel: z
      .enum(sensitivityValues as any)
      .optional()
      .default(SensitivityLevel.MEDIUM),
    dateShared: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), 'dateShared must be a valid date format')
      .transform((val) => new Date(val)),
    reviewDate: z
      .string()
      .optional()
      .nullable()
      .refine((val) => val === null || val === undefined || !isNaN(Date.parse(val)), 'reviewDate must be a valid date')
      .transform((val) => (val ? new Date(val) : null)),
    expiryDate: z
      .string()
      .optional()
      .nullable()
      .refine((val) => val === null || val === undefined || !isNaN(Date.parse(val)), 'expiryDate must be a valid date')
      .transform((val) => (val ? new Date(val) : null)),
    recordStatus: z
      .enum(recordStatusValues as any)
      .optional()
      .default(RecordStatus.ACTIVE),
    notes: z
      .string()
      .max(5000, 'Notes cannot exceed 5000 characters')
      .optional()
      .nullable(),
    categoryIds: z
      .array(z.string().uuid('Each category ID must be a valid UUID'))
      .optional()
      .default([]),
  })
  .strict();

export const updateExposureSchema = z
  .object({
    websiteId: z
      .string()
      .uuid('websiteId must be a valid UUID')
      .optional(),
    purpose: z
      .string()
      .trim()
      .min(1, 'Purpose cannot be empty')
      .max(255, 'Purpose cannot exceed 255 characters')
      .optional(),
    sensitivityLevel: z
      .enum(sensitivityValues as any)
      .optional(),
    dateShared: z
      .string()
      .optional()
      .refine((val) => val === undefined || !isNaN(Date.parse(val)), 'dateShared must be a valid date')
      .transform((val) => (val ? new Date(val) : undefined)),
    reviewDate: z
      .string()
      .optional()
      .nullable()
      .refine((val) => val === null || val === undefined || !isNaN(Date.parse(val)), 'reviewDate must be a valid date')
      .transform((val) => (val ? new Date(val) : null)),
    expiryDate: z
      .string()
      .optional()
      .nullable()
      .refine((val) => val === null || val === undefined || !isNaN(Date.parse(val)), 'expiryDate must be a valid date')
      .transform((val) => (val ? new Date(val) : null)),
    recordStatus: z
      .enum(recordStatusValues as any)
      .optional(),
    notes: z
      .string()
      .max(5000, 'Notes cannot exceed 5000 characters')
      .optional()
      .nullable(),
    categoryIds: z
      .array(z.string().uuid('Each category ID must be a valid UUID'))
      .optional(),
  })
  .strict();

export const exposureQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  websiteId: z.string().uuid().optional(),
  sensitivityLevel: z.enum(sensitivityValues as any).optional(),
  recordStatus: z.enum(recordStatusValues as any).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['dateShared', 'createdAt', 'sensitivityLevel', 'purpose', 'reviewDate']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateExposureDTO = z.infer<typeof createExposureSchema>;
export type UpdateExposureDTO = z.infer<typeof updateExposureSchema>;
export type ExposureQueryDTO = z.infer<typeof exposureQuerySchema>;
