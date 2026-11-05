/**
 * OBLIVION - In-Memory Sliding Window Rate Limiter Middleware
 *
 * Protects authentication endpoints against credential stuffing and brute-force attacks.
 * Tracks requests per client IP address within a configurable time window.
 */

import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/api-response';

interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

export class RateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private windowMs: number;
  private maxRequests: number;
  private message: string;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.message = options.message || 'Too many requests, please try again later';
  }

  middleware = (req: Request, res: Response, next: NextFunction): void => {
    // Allow bypassing rate limits during testing if explicitly marked
    if (req.headers['x-bypass-rate-limit'] === 'true' && process.env.NODE_ENV !== 'production') {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const now = Date.now();

    let record = this.records.get(ip);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(ip, record);
    }

    // Filter out timestamps outside the sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < this.windowMs);

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0];
      const retryAfterSeconds = Math.ceil((this.windowMs - (now - oldest)) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      ApiResponse.error(res, this.message, 429);
      return;
    }

    record.timestamps.push(now);
    res.setHeader('X-RateLimit-Limit', this.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - record.timestamps.length));
    next();
  };

  reset(ip?: string): void {
    if (ip) {
      this.records.delete(ip);
    } else {
      this.records.clear();
    }
  }
}

// 100 requests per 15 minutes for general auth protection
export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});
