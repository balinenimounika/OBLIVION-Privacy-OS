/**
 * OBLIVION - Express Application Setup
 */

import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { requestLogger } from './middleware/request-logger.middleware';
import { notFoundHandler } from './middleware/not-found.middleware';
import { errorHandler } from './middleware/error.middleware';
import { HealthController } from './controllers/health.controller';
import apiRouter from './routes';

export function createApp(): Application {
  const app = express();

  // 1. Security HTTP Headers
  app.use(helmet());

  // 2. Cross-Origin Resource Sharing (CORS) - explicit origin reflection for credentialed requests
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        // Allow non-browser requests (e.g. curl, server-to-server, mobile native)
        if (!requestOrigin) return callback(null, true);
        // Explicit origin matching or wildcard reflection (never returns literal '*' with credentials)
        if (allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin)) {
          return callback(null, requestOrigin);
        }
        return callback(new Error(`Blocked by CORS policy: Origin ${requestOrigin} not permitted`));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
    })
  );

  // 3. Body Parsing Middleware (with rawBody retention for webhook signature verification)
  app.use(
    express.json({
      limit: '1mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf-8');
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 4. Request Logging Middleware
  app.use(requestLogger);

  // 5. Direct Root Health Endpoint
  app.get('/health', HealthController.check);

  // 6. Root API Welcome Endpoint
  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome to OBLIVION - The Internet's Forget Button",
      data: {
        application: 'OBLIVION',
        description: 'Privacy Management Platform',
        status: 'operational',
        environment: process.env.NODE_ENV,
        health: '/health',
        api: '/api/v1',
      },
    });
  });

  // 7. Master API Router (/api/v1)
  app.use('/api/v1', apiRouter);

  // 8. 404 Route Not Found Middleware
  app.use(notFoundHandler);

  // 9. Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
