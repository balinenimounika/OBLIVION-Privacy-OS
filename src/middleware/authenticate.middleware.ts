/**
 * OBLIVION - JWT Authentication Guard Middleware
 *
 * Verifies the incoming Bearer token, enforces expiry, and injects
 * the verified user identity onto req.user.
 */

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AccountStatus } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { AuthenticatedRequest } from '../types';
import { JwtUserPayload } from '../types/auth.types';

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw ApiError.unauthorized('Authentication required: Missing Authorization header');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      throw ApiError.unauthorized('Invalid Authorization format. Expected: Bearer <token>');
    }

    const token = parts[1];

    let decoded: JwtUserPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as JwtUserPayload;
    } catch (err: any) {
      if (err instanceof jwt.TokenExpiredError) {
        throw ApiError.unauthorized('Authentication failed: Access token has expired');
      }
      throw ApiError.unauthorized('Authentication failed: Invalid access token');
    }

    if (!decoded.sub) {
      throw ApiError.unauthorized('Authentication failed: Malformed token payload');
    }

    // Verify user exists in database and account is in good standing
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        accountStatus: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('User associated with this token no longer exists');
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw ApiError.forbidden('Your account has been suspended');
    }

    if (user.accountStatus === AccountStatus.DEACTIVATED) {
      throw ApiError.forbidden('Your account has been deactivated');
    }

    // Attach verified user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
