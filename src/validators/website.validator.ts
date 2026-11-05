/**
 * OBLIVION - Website Module Validators
 */

import { z } from 'zod';
import { WebsiteCategory } from '@prisma/client';

const websiteCategoryValues = Object.values(WebsiteCategory) as [string, ...string[]];

export const createWebsiteSchema = z
  .object({
    websiteName: z
      .string()
      .trim()
      .min(1, 'Website name is required')
      .max(255, 'Website name cannot exceed 255 characters'),
    websiteUrl: z
      .string()
      .trim()
      .min(1, 'Website URL is required')
      .max(1024, 'Website URL cannot exceed 1024 characters')
      .url('Website URL must be a valid URL (e.g., https://example.com)'),
    websiteCategory: z
      .enum(websiteCategoryValues as any)
      .optional()
      .default(WebsiteCategory.OTHER),
  })
  .strict();

export const updateWebsiteSchema = z
  .object({
    websiteName: z
      .string()
      .trim()
      .min(1, 'Website name cannot be empty')
      .max(255, 'Website name cannot exceed 255 characters')
      .optional(),
    websiteUrl: z
      .string()
      .trim()
      .min(1, 'Website URL cannot be empty')
      .max(1024, 'Website URL cannot exceed 1024 characters')
      .url('Website URL must be a valid URL')
      .optional(),
    websiteCategory: z
      .enum(websiteCategoryValues as any)
      .optional(),
  })
  .strict();

export const websiteQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  search: z.string().optional(),
  category: z.enum(websiteCategoryValues as any).optional(),
  sortBy: z.enum(['websiteName', 'createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateWebsiteDTO = z.infer<typeof createWebsiteSchema>;
export type UpdateWebsiteDTO = z.infer<typeof updateWebsiteSchema>;
export type WebsiteQueryDTO = z.infer<typeof websiteQuerySchema>;
