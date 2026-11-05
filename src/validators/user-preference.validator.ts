/**
 * OBLIVION - User Notification Preference Validators
 */

import { z } from 'zod';
import { OverdueFrequency } from '@prisma/client';

export const updateUserPreferenceSchema = z.object({
  emailNotificationsEnabled: z.boolean().optional(),
  notifyOnCreated: z.boolean().optional(),
  notify7DaysBefore: z.boolean().optional(),
  notify3DaysBefore: z.boolean().optional(),
  notify1DayBefore: z.boolean().optional(),
  notifyDueToday: z.boolean().optional(),
  notifyOverdue: z.boolean().optional(),
  notifyCompleted: z.boolean().optional(),
  notifyRemovalUpdates: z.boolean().optional(),
  notifyAccountSecurity: z.boolean().optional().refine((val) => val === undefined || val === true, {
    message: 'Essential account security notifications cannot be disabled',
  }),
  overdueFrequency: z.nativeEnum(OverdueFrequency).optional(),
});

export type UpdateUserPreferenceInput = z.infer<typeof updateUserPreferenceSchema>;
