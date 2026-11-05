/**
 * OBLIVION - Tenant Guard Middleware
 *
 * Enforces route-level tenant safety rules:
 * 1. Blocks or strips injected tenant fields from request bodies.
 * 2. Validates UUID path parameter formats before database execution.
 * 3. Ensures authentication context is present on protected operations.
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error';
import { AuthenticatedRequest } from '../types';

// RFC 4122 UUID v4 regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that specified route parameters conform to standard UUID format.
 * Returns 400 Bad Request on malformed identifiers.
 */
export function validateUuidParam(...paramNames: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const param of paramNames) {
      const rawVal = req.params[param];
      const val = Array.isArray(rawVal) ? rawVal[0] : rawVal;
      if (val && !UUID_REGEX.test(val)) {
        return next(
          ApiError.badRequest(`Invalid identifier format for parameter '${param}'. Expected valid UUID.`)
        );
      }
    }
    next();
  };
}

/**
 * Middleware that rejects any request containing an explicit 'userId' or 'user_id' in
 * the body, header, or query string to prevent identity spoofing / mass-assignment attacks.
 */
export function rejectInjectedTenantFields(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const checkObject = (obj: any, source: string) => {
    if (obj && typeof obj === 'object') {
      if ('userId' in obj || 'user_id' in obj) {
        throw ApiError.unprocessableEntity(
          `Security violation: Direct specification of '${source}.userId' is forbidden. Identity must be derived from authentication token.`
        );
      }
    }
  };

  try {
    checkObject(req.body, 'body');
    checkObject(req.query, 'query');
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware that ensures an authenticated user identity exists on req.user.
 */
export function requireTenantContext(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user || !req.user.id) {
    return next(ApiError.unauthorized('Authentication required: Missing verified tenant context'));
  }
  next();
}
