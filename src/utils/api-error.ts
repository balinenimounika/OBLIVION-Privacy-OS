/**
 * OBLIVION - Custom Application Error Class
 */

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: any[];

  constructor(statusCode: number, message: string, errors?: any[], isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', errors?: any[]): ApiError {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden: Access denied'): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict: Resource already exists'): ApiError {
    return new ApiError(409, message);
  }

  static unprocessableEntity(message = 'Validation failed', errors?: any[]): ApiError {
    return new ApiError(422, message, errors);
  }

  static tooManyRequests(message = 'Too Many Requests'): ApiError {
    return new ApiError(429, message);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, message, undefined, false);
  }
}
