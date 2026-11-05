/**
 * OBLIVION - Authentication Service
 *
 * Encapsulates core identity logic:
 * - Password hashing using bcryptjs (cost factor 12)
 * - Safe user creation & duplicate email protection
 * - Generic error messages to prevent account enumeration
 * - JWT access token generation
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AccountStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { ApiError } from '../utils/api-error';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { AuthResponse, UserResponse, JwtUserPayload } from '../types/auth.types';
import { AuditLogService } from './audit-log.service';
import { AuditAction, AuditEntityType } from '../types/audit-log.types';
import { UserEmailNotificationService } from './user-email-notification.service';
import { logger } from '../utils/logger';

const BCRYPT_SALT_ROUNDS = 12;

export class AuthService {
  /**
   * Registers a new user account with strict field sanitization.
   */
  static async register(input: RegisterInput): Promise<AuthResponse> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // 1. Check for duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw ApiError.conflict('An account with this email address already exists');
    }

    // 2. Hash password securely
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

    // 3. Create user in database (always default to ACTIVE, never accept privileged fields)
    const user = await prisma.user.create({
      data: {
        fullName: input.fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        accountStatus: AccountStatus.ACTIVE,
        isEmailVerified: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        accountStatus: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 4. Generate JWT access token
    const accessToken = this.generateToken(user);

    // 5. Asynchronously record audit log for new user registration
    await AuditLogService.record({
      userId: user.id,
      action: AuditAction.AUTH_REGISTER,
      entityType: AuditEntityType.USER,
      entityId: user.id,
    });

    // 6. Asynchronously trigger welcome email notification (sent exactly once upon registration)
    try {
      await UserEmailNotificationService.sendWelcomeEmail(user.id);
    } catch (err: any) {
      logger.warn(`Failed to dispatch welcome email for user ${user.id}: ${err.message}`);
    }

    return {
      user,
      tokens: {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: env.JWT_EXPIRES_IN,
      },
    };
  }

  /**
   * Authenticates user credentials and returns an access token.
   */
  static async login(input: LoginInput): Promise<AuthResponse> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // 1. Lookup user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // 2. Generic error if user not found (prevents user enumeration)
    // Note: To preserve relational integrity and avoid leaking existence, unknown emails log to system logger only
    if (!user) {
      logger.warn('Failed login attempt for unregistered email address');
      throw ApiError.unauthorized('Invalid email or password');
    }

    // 3. Enforce account status policies and record security audit events
    if (user.accountStatus === AccountStatus.SUSPENDED) {
      await AuditLogService.record({
        userId: user.id,
        action: AuditAction.SECURITY_ACCOUNT_SUSPENDED,
        entityType: AuditEntityType.USER,
        entityId: user.id,
      });
      throw ApiError.forbidden('Your account has been suspended. Please contact support.');
    }
    if (user.accountStatus === AccountStatus.DEACTIVATED) {
      await AuditLogService.record({
        userId: user.id,
        action: AuditAction.SECURITY_ACCOUNT_DEACTIVATED,
        entityType: AuditEntityType.USER,
        entityId: user.id,
      });
      throw ApiError.forbidden('Your account has been deactivated.');
    }

    // 4. Verify password hash
    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      // Record failed authentication attempt without recording the password
      await AuditLogService.record({
        userId: user.id,
        action: AuditAction.AUTH_LOGIN_FAILED,
        entityType: AuditEntityType.USER,
        entityId: user.id,
      });
      throw ApiError.unauthorized('Invalid email or password');
    }

    // 5. Construct safe user profile (excluding passwordHash)
    const safeUser: UserResponse = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      accountStatus: user.accountStatus,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // 6. Generate JWT access token
    const accessToken = this.generateToken(safeUser);

    // 7. Record successful login event
    await AuditLogService.record({
      userId: user.id,
      action: AuditAction.AUTH_LOGIN_SUCCESS,
      entityType: AuditEntityType.USER,
      entityId: user.id,
    });

    return {
      user: safeUser,
      tokens: {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: env.JWT_EXPIRES_IN,
      },
    };
  }

  /**
   * Retrieves current authenticated user profile by ID.
   */
  static async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        accountStatus: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw ApiError.notFound('User profile not found');
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw ApiError.forbidden('Your account has been suspended');
    }
    if (user.accountStatus === AccountStatus.DEACTIVATED) {
      throw ApiError.forbidden('Your account has been deactivated');
    }

    return user;
  }

  /**
   * Records user logout audit event.
   */
  static async logout(userId: string): Promise<void> {
    await AuditLogService.record({
      userId,
      action: AuditAction.AUTH_LOGOUT,
      entityType: AuditEntityType.USER,
      entityId: userId,
    });
  }

  /**
   * Generates signed JWT access token for a user.
   */
  private static generateToken(user: { id: string; email: string }): string {
    const payload: JwtUserPayload = {
      sub: user.id,
      email: user.email,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });
  }
}
