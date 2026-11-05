/**
 * OBLIVION - 404 Route Not Found Middleware
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';

export function notFoundHandler(req: Request, res: Response): void {
  ApiResponse.error(
    res,
    `Cannot ${req.method} ${req.originalUrl} - Route not found`,
    404
  );
}
