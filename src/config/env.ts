/**
 * OBLIVION - Environment Configuration & Validation
 *
 * Validates environment variables using Zod at startup.
 * Never prints secret values to console or logs.
 */

import * as dotenv from 'dotenv';
import { z } from 'zod';

// Load .env
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('oblivion_default_super_secret_jwt_key_2026_change_in_production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('*'),
  DB_POOL_MIN: z.string().default('2').transform(Number),
  DB_POOL_MAX: z.string().default('10').transform(Number),
  DB_TIMEOUT_MS: z.string().default('30000').transform(Number),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('onboarding@resend.dev'),
  RESEND_FROM_NAME: z.string().default('OBLIVION Privacy OS'),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  EMAIL_NOTIFICATIONS_ENABLED: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),
  EMAIL_TEST_MODE: z
    .string()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),
  RESEND_TEST_TO: z
    .string()
    .email()
    .default('delivered@resend.dev'),
  ALLOWED_TEST_EMAILS: z
    .string()
    .default('')
    .transform((val) =>
      val
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0)
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment validation failed:');
  parsed.error.issues.forEach((issue) => {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  });
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
