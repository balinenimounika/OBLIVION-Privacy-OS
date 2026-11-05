/**
 * OBLIVION - Data Category Validators
 */

import { z } from 'zod';
import { SensitivityLevel } from '@prisma/client';

const sensitivityValues = Object.values(SensitivityLevel) as [string, ...string[]];

export const categoryQuerySchema = z.object({
  search: z.string().optional(),
  sensitivity: z.enum(sensitivityValues as any).optional(),
  minRiskWeight: z.string().optional().transform((v) => (v ? parseInt(v, 10) : undefined)),
  maxRiskWeight: z.string().optional().transform((v) => (v ? parseInt(v, 10) : undefined)),
  sortBy: z.enum(['categoryName', 'riskWeight', 'defaultSensitivity', 'createdAt']).optional().default('riskWeight'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CategoryQueryDTO = z.infer<typeof categoryQuerySchema>;
