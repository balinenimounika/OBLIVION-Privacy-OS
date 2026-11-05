
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
    logger.info('Connecting to PostgreSQL database...');

    await prisma.$connect();

    logger.info('Database connection established successfully');

    const PORT = process.env.PORT
      ? Number(process.env.PORT)
      : env.PORT;

    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info('=======================================================');
      logger.info(`OBLIVION Backend API running on port ${PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info(`Health check: /health`);
      logger.info(`API Base URL: /api/v1`);
      logger.info('=======================================================');

      ReminderSchedulerService.start();
    });

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);

      ReminderSchedulerService.stop();

      server.close(async () => {
        logger.info('HTTP server closed.');

        try {
          await prisma.$disconnect();
          logger.info('Database disconnected.');
          process.exit(0);
        } catch (err) {
          logger.error('Error during database disconnect:', err);
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000).unref();
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start OBLIVION Backend Server:', error);

    await prisma.$disconnect();

    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}
