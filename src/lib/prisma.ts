/**
 * OBLIVION - Prisma Client Singleton
 *
 * Establishes a single PrismaClient instance across the application life-cycle.
 * Prevents multiple instance leaks during development hot-reloading.
 */

import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export default prisma;
