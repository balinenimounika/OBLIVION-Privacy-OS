/**
 * OBLIVION - Authentication Type Definitions
 */

import { AccountStatus } from '@prisma/client';

export interface UserResponse {
  id: string;
  fullName: string;
  email: string;
  accountStatus: AccountStatus;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface AuthResponse {
  user: UserResponse;
  tokens: AuthTokens;
}

export interface JwtUserPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}
