/**
 * OBLIVION - Notification Module Validators
 */

import { z } from 'zod';
import { NotificationType } from '@prisma/client';

const notificationTypes = Object.values(NotificationType) as [string, ...string[]];

export const notificationQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  isRead: z.string().optional().transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  notificationType: z.enum(notificationTypes as any).optional(),
  sortBy: z.enum(['createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type NotificationQueryDTO = z.infer<typeof notificationQuerySchema>;
