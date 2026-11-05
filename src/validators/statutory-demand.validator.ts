/**
 * OBLIVION - Statutory Legal Notice Validators
 *
 * Enforces strict email recipient verification, explicit user confirmation,
 * and security constraints against header injection and unauthorized recipient manipulation.
 */

import { z } from 'zod';

const PROHIBITED_DOMAINS = ['localhost', '127.0.0.1', '::1', '.local', '.internal', '.test'];

/**
 * Validates that recipient email does not target loopback or forbidden test TLDs in production
 * and prevents CRLF header injection.
 */
function isValidExternalRecipient(email: string): boolean {
  if (email.includes('\r') || email.includes('\n')) {
    return false;
  }
  const lower = email.toLowerCase().trim();
  const domainPart = lower.split('@')[1];
  if (!domainPart) return false;

  for (const prohibited of PROHIBITED_DOMAINS) {
    if (domainPart === prohibited || domainPart.endsWith(prohibited)) {
      return false;
    }
  }
  return true;
}

export const previewStatutoryDemandSchema = z
  .object({
    recipientEmail: z
      .string()
      .trim()
      .email('recipientEmail must be a valid email address')
      .max(255, 'recipientEmail cannot exceed 255 characters')
      .refine(isValidExternalRecipient, {
        message: 'Recipient email domain is invalid or disallowed for external legal dispatch',
      })
      .optional(),
    customNotes: z
      .string()
      .trim()
      .max(2000, 'customNotes cannot exceed 2000 characters')
      .optional()
      .nullable(),
  })
  .strict();

export const dispatchStatutoryDemandSchema = z
  .object({
    recipientEmail: z
      .string()
      .trim()
      .min(1, 'recipientEmail is required to dispatch a statutory notice')
      .email('recipientEmail must be a valid email address')
      .max(255, 'recipientEmail cannot exceed 255 characters')
      .refine(isValidExternalRecipient, {
        message: 'Recipient email domain is invalid or disallowed for external legal dispatch',
      }),
    confirmDispatch: z.boolean().refine((val) => val === true, {
      message: 'Explicit user confirmation (confirmDispatch: true) is required to legally dispatch a statutory demand',
    }),
    customNotes: z
      .string()
      .trim()
      .max(2000, 'customNotes cannot exceed 2000 characters')
      .optional()
      .nullable(),
  })
  .strict();

export type PreviewStatutoryDemandDTO = z.infer<typeof previewStatutoryDemandSchema>;
export type DispatchStatutoryDemandDTO = z.infer<typeof dispatchStatutoryDemandSchema>;
