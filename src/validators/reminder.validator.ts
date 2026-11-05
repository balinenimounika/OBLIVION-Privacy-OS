/**
 * OBLIVION - Reminder Module Validators
 */

import { z } from 'zod';
import { ReminderType, ReminderStatus } from '@prisma/client';

const reminderTypes = Object.values(ReminderType) as [string, ...string[]];
const reminderStatuses = Object.values(ReminderStatus) as [string, ...string[]];

export const createReminderSchema = z
  .preprocess((raw: any) => {
    if (raw && typeof raw === 'object') {
      const copy = { ...raw };
      // Support dueDate alias for reminderDate
      if (!copy.reminderDate && copy.dueDate) {
        copy.reminderDate = copy.dueDate;
      }
      // Support category alias for reminderType
      if (!copy.reminderType && copy.category) {
        copy.reminderType = copy.category;
      }
      // Normalize empty strings and nulls
      if (copy.exposureRecordId === '' || copy.exposureRecordId === null) {
        delete copy.exposureRecordId;
      }
      if (copy.notes === null) {
        copy.notes = undefined;
      }
      return copy;
    }
    return raw;
  }, z.object({
    exposureRecordId: z.string().uuid('exposureRecordId must be a valid UUID').optional(),
    title: z.string().trim().min(1, 'Reminder title is required').max(255).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    reminderType: z
      .enum(reminderTypes as any)
      .optional()
      .default(ReminderType.ANNUAL_PRIVACY_REVIEW),
    reminderDate: z
      .union([
        z.string().refine((val) => !isNaN(Date.parse(val)), 'reminderDate must be a valid date format'),
        z.date(),
      ])
      .transform((val) => (val instanceof Date ? val : new Date(val))),
    dueDate: z.any().optional(),
    category: z.any().optional(),
  }));

export const updateReminderSchema = z
  .preprocess((raw: any) => {
    if (raw && typeof raw === 'object') {
      const copy = { ...raw };
      if (!copy.reminderDate && copy.dueDate) {
        copy.reminderDate = copy.dueDate;
      }
      if (!copy.reminderType && copy.category) {
        copy.reminderType = copy.category;
      }
      if (copy.notes === null) {
        copy.notes = undefined;
      }
      return copy;
    }
    return raw;
  }, z.object({
    reminderDate: z
      .union([
        z.string().refine((val) => !isNaN(Date.parse(val)), 'reminderDate must be a valid date format'),
        z.date(),
      ])
      .optional()
      .transform((val) => (val ? (val instanceof Date ? val : new Date(val)) : undefined)),
    reminderType: z
      .enum(reminderTypes as any)
      .optional(),
    reminderStatus: z
      .enum(reminderStatuses as any)
      .optional(),
    title: z.string().trim().max(255).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    dueDate: z.any().optional(),
    category: z.any().optional(),
  }));

export const reminderQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  reminderStatus: z.enum(reminderStatuses as any).optional(),
  reminderType: z.enum(reminderTypes as any).optional(),
  exposureRecordId: z.string().uuid().optional(),
  upcomingOnly: z.string().optional().transform((val) => val === 'true'),
  sortBy: z.enum(['reminderDate', 'createdAt', 'reminderStatus']).optional().default('reminderDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export type CreateReminderDTO = z.infer<typeof createReminderSchema>;
export type UpdateReminderDTO = z.infer<typeof updateReminderSchema>;
export type ReminderQueryDTO = z.infer<typeof reminderQuerySchema>;
