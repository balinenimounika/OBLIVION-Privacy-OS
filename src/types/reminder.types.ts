/**
 * OBLIVION - Reminder Module Types
 */

import { Reminder, ReminderType, ReminderStatus, ExposureRecord } from '@prisma/client';
import { PaginationParams } from './index';

export interface CreateReminderInput {
  exposureRecordId: string;
  reminderType?: ReminderType;
  reminderDate: string | Date;
}

export interface UpdateReminderInput {
  reminderDate?: string | Date;
  reminderType?: ReminderType;
  reminderStatus?: ReminderStatus;
}

export interface ReminderQueryFilters extends Partial<PaginationParams> {
  reminderStatus?: ReminderStatus;
  reminderType?: ReminderType;
  exposureRecordId?: string;
  upcomingOnly?: boolean;
  sortBy?: 'reminderDate' | 'createdAt' | 'reminderStatus';
  sortOrder?: 'asc' | 'desc';
}

export interface ReminderWithDetails extends Reminder {
  exposureRecord?: ExposureRecord;
}
