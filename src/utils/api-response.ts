/**
 * OBLIVION - Standardized API Response Helper
 */

import { Response } from 'express';

export interface ApiResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: any;
}

export class ApiResponse {
  static success<T>(
    res: Response,
    message = 'Operation successful',
    data?: T,
    statusCode = 200,
    meta?: ApiResponseMeta
  ): Response {
    return res.status(statusCode).json({
      success: true,
      message,
      ...(data !== undefined ? { data } : {}),
      ...(meta ? { meta } : {}),
    });
  }

  static created<T>(
    res: Response,
    message = 'Resource created successfully',
    data?: T
  ): Response {
    return this.success(res, message, data, 201);
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  static error(
    res: Response,
    message = 'An error occurred',
    statusCode = 500,
    errors?: any[]
  ): Response {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(errors && errors.length > 0 ? { errors } : {}),
    });
  }
}
