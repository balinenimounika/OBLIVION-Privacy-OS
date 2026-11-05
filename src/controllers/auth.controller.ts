/**
 * OBLIVION - Authentication Controller
 *
 * Handles HTTP requests for user registration, authentication, and profile retrieval.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../utils/api-response';
import { AuthenticatedRequest } from '../types';

export class AuthController {
  /**
   * POST /api/v1/auth/register
   * Registers a new user account.
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.register(req.body);
      ApiResponse.created(res, 'User registered successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   * Authenticates user and issues access token.
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.login(req.body);
      ApiResponse.success(res, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Retrieves profile for currently authenticated user.
   */
  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await AuthService.getCurrentUser(req.user!.id);
      ApiResponse.success(res, 'Current user profile retrieved', user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   * Logs out authenticated user, records audit event, and requests client-side token discard.
   */
  static async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.id) {
        await AuthService.logout(req.user.id);
      }
      ApiResponse.success(res, 'Successfully logged out. Please discard your access token.');
    } catch (error) {
      next(error);
    }
  }
}
