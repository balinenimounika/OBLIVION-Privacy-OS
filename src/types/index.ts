/**
 * OBLIVION - Common TypeScript Type Definitions
 */

import { Request } from 'express';
import { AccountStatus } from '@prisma/client';

export * from './auth.types';
export * from './website.types';
export * from './exposure.types';
export * from './category.types';
export * from './removal-request.types';
export * from './reminder.types';
export * from './notification.types';
export * from './dashboard.types';
export * from './audit-log.types';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  accountStatus: AccountStatus;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}
