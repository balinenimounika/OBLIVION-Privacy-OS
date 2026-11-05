/**
 * OBLIVION - Exposure Record Validators
 */

import { z } from 'zod';
import {
  SensitivityLevel,
  RecordStatus,
  ExposureSource,
  ExposureVisibility,
  DataSharingStatus,
  RemediationStatus,
} from '@prisma/client';

const sensitivityValues = Object.values(SensitivityLevel) as [string, ...string[]];
const recordStatusValues = Object.values(RecordStatus) as [string, ...string[]];
const exposureSourceValues = Object.values(ExposureSource) as [string, ...string[]];
const visibilityValues = Object.values(ExposureVisibility) as [string, ...string[]];
const sharingStatusValues = Object.values(DataSharingStatus) as [string, ...string[]];
const remediationStatusValues = Object.values(RemediationStatus) as [string, ...string[]];

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

    // Enhanced Exposure Management Fields
    platformUrl: z
      .string()
      .max(1024, 'Platform URL cannot exceed 1024 characters')
      .optional()
      .nullable(),
    dataDescription: z
      .string()
      .max(5000, 'Data description cannot exceed 5000 characters')
      .optional()
      .nullable(),
    exposureSource: z
      .enum(exposureSourceValues as any)
      .optional()
      .default(ExposureSource.OTHER),
    visibility: z
      .enum(visibilityValues as any)
      .optional()
      .default(ExposureVisibility.UNKNOWN),
    sharingStatus: z
      .enum(sharingStatusValues as any)
      .optional()
      .default(DataSharingStatus.ACTIVE),
    lastVerifiedDate: z
      .string()
      .optional()
      .nullable()
      .refine((val) => val === null || val === undefined || !isNaN(Date.parse(val)), 'lastVerifiedDate must be a valid date')
      .transform((val) => (val ? new Date(val) : null)),
    remediationStatus: z
      .enum(remediationStatusValues as any)
      .optional()
      .default(RemediationStatus.NOT_STARTED),
    evidenceAttachment: z
      .string()
      .max(1024, 'Evidence attachment reference cannot exceed 1024 characters')
      .optional()
      .nullable(),
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
      .refine((val) => !isNaN(Date.parse(val)), 'dateShared must be a valid date')
      .transform((val) => new Date(val))
      .optional(),
    reviewDate: z
      .string()
      .refine((val) => val === null || val === undefined || !isNaN(Date.parse(val)), 'reviewDate must be a valid date')
      .transform((val) => (val ? new Date(val) : null))
      .optional()
      .nullable(),
    expiryDate: z
      .string()
      .refine((val) => val === null || val === undefined || !isNaN(Date.parse(val)), 'expiryDate must be a valid date')
      .transform((val) => (val ? new Date(val) : null))
      .optional()
      .nullable(),
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

    // Enhanced Exposure Management Fields
    platformUrl: z
      .string()
      .max(1024, 'Platform URL cannot exceed 1024 characters')
      .optional()
      .nullable(),
    dataDescription: z
      .string()
      .max(5000, 'Data description cannot exceed 5000 characters')
      .optional()
      .nullable(),
    exposureSource: z
      .enum(exposureSourceValues as any)
      .optional(),
    visibility: z
      .enum(visibilityValues as any)
      .optional(),
    sharingStatus: z
      .enum(sharingStatusValues as any)
      .optional(),
    lastVerifiedDate: z
      .string()
      .refine((val) => val === null || val === undefined || !isNaN(Date.parse(val)), 'lastVerifiedDate must be a valid date')
      .transform((val) => (val ? new Date(val) : null))
      .optional()
      .nullable(),
    remediationStatus: z
      .enum(remediationStatusValues as any)
      .optional(),
    evidenceAttachment: z
      .string()
      .max(1024, 'Evidence attachment reference cannot exceed 1024 characters')
      .optional()
      .nullable(),
  })
  .strict();

export const exposureQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  websiteId: z.string().uuid().optional(),
  sensitivityLevel: z.enum(sensitivityValues as any).optional(),
  recordStatus: z.enum(recordStatusValues as any).optional(),
  visibility: z.enum(visibilityValues as any).optional(),
  remediationStatus: z.enum(remediationStatusValues as any).optional(),
  exposureSource: z.enum(exposureSourceValues as any).optional(),
  sharingStatus: z.enum(sharingStatusValues as any).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['dateShared', 'createdAt', 'sensitivityLevel', 'purpose', 'reviewDate', 'riskScore']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createExposureRemovalSchema = z.object({
  requestType: z.enum([
    'GDPR_ERASURE',
    'CCPA_DELETION',
    'DATA_ERASURE_GENERAL',
    'ACCOUNT_CLOSURE',
    'MARKETING_OPT_OUT',
    'CUSTOM',
  ]).optional().default('GDPR_ERASURE'),
  requestReason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(2000),
  externalReference: z.string().max(255).optional().nullable(),
});

export type CreateExposureDTO = z.infer<typeof createExposureSchema>;
export type UpdateExposureDTO = z.infer<typeof updateExposureSchema>;
export type ExposureQueryDTO = z.infer<typeof exposureQuerySchema>;
export type CreateExposureRemovalDTO = z.infer<typeof createExposureRemovalSchema>;
