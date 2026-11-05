/**
 * OBLIVION - Authentication Request Validators
 *
 * Enforces strict input validation and mass assignment protection.
 */

import { z } from 'zod';

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .max(255, 'Full name cannot exceed 255 characters'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email address format')
      .max(255, 'Email cannot exceed 255 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(100, 'Password cannot exceed 100 characters')
      .regex(/[A-Za-z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email address format'),
    password: z
      .string()
      .min(1, 'Password is required'),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
