/**
 * OBLIVION - Health Check Controller
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/api-response';
import { env } from '../config/env';

export class HealthController {
  static async check(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    let dbStatus = 'disconnected';
    let dbLatencyMs: number | null = null;

    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1;`;
      dbLatencyMs = Date.now() - dbStart;
      dbStatus = 'connected';
    } catch (err: any) {
      dbStatus = 'error';
    }

    const isHealthy = dbStatus === 'connected';
    const statusCode = isHealthy ? 200 : 503;

    ApiResponse.success(
      res,
      isHealthy ? 'OBLIVION Backend API is healthy and operational' : 'Database connectivity degraded',
      {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
          engine: 'PostgreSQL 18.6',
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        memory: {
          heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
        totalLatencyMs: Date.now() - startTime,
      },
      statusCode
    );
  }
}
