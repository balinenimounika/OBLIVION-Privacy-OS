/**
 * OBLIVION - Centralized Error Handling Middleware
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error';
import { ApiResponse } from '../utils/api-response';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  // 1. ApiError
  if (err instanceof ApiError) {
    ApiResponse.error(res, err.message, err.statusCode, err.errors);
    return;
  }

  // 2. Payload size & JSON syntax errors (from express.json / body-parser)
  if (err.type === 'entity.too.large' || err.status === 413) {
    ApiResponse.error(res, 'Payload too large. Maximum size allowed is 1MB', 413);
    return;
  }

  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    ApiResponse.error(res, 'Malformed JSON in request body', 400);
    return;
  }

  // 3. Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    ApiResponse.error(res, 'Request validation failed', 422, formattedErrors);
    return;
  }

  // 3. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[]) || [];
      const field = target.join(', ');
      ApiResponse.error(
        res,
        `Duplicate value error: A record with this ${field || 'value'} already exists`,
        409
      );
      return;
    }

    if (err.code === 'P2025') {
      ApiResponse.error(
        res,
        (err.meta?.cause as string) || 'Requested record not found in database',
        404
      );
      return;
    }

    if (err.code === 'P2003') {
      ApiResponse.error(
        res,
        'Foreign key constraint violation: Related entity does not exist or cannot be modified',
        400
      );
      return;
    }
  }

  // 4. Prisma Validation Errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.warn('Prisma validation error:', err.message);
    ApiResponse.error(res, 'Invalid data supplied for database operation', 400);
    return;
  }

  // 5. Unhandled / Internal Server Errors
  logger.error('Unhandled Server Error:', err);

  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected internal error occurred'
      : err.message || 'Internal Server Error';

  const errors = env.NODE_ENV === 'development' ? [{ stack: err.stack }] : undefined;

  ApiResponse.error(res, message, 500, errors);
};
