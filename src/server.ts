/**
 * OBLIVION - Server Entrypoint
 */

import { app } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { logger } from './utils/logger';
import { ReminderSchedulerService } from './services/reminder-scheduler.service';

async function bootstrap() {
  try {
    // 1. Verify PostgreSQL Database Connection
    logger.info('Connecting to PostgreSQL database...');
    await prisma.$connect();
    logger.info('Database connection established successfully (oblivion_db)');

    // 2. Start HTTP Server
    const server = app.listen(env.PORT, () => {
      logger.info(`=======================================================`);
      logger.info(`OBLIVION Backend API Server running on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info(`Health check: http://localhost:${env.PORT}/health`);
      logger.info(`API Base URL: http://localhost:${env.PORT}/api/v1`);
      logger.info(`=======================================================`);

      // 3. Start Intelligent Reminder Scheduler
      ReminderSchedulerService.start();
    });

    // 4. Graceful Shutdown Handlers
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      ReminderSchedulerService.stop();
      server.close(async () => {
        logger.info('HTTP server closed.');
        try {
          await prisma.$disconnect();
          logger.info('Database disconnected.');
          process.exit(0);
        } catch (err: any) {
          logger.error('Error during database disconnect:', err);
          process.exit(1);
        }
      });

      // Force exit after 10s if hung
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error: any) {
    logger.error('Failed to start OBLIVION Backend Server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}
