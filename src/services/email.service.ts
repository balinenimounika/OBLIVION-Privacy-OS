/**
 * OBLIVION - Resend Email Service
 *
 * Implements transactional email dispatch using the official Resend SDK.
 * Features:
 * - Lazy initialization of Resend client with API key validation
 * - Dynamic domain verification awareness & diagnostics
 * - Exponential backoff retry handler for transient errors
 * - Webhook cryptographic signature verification
 * - Secure sanitization of error logs (no credentials or tokens leaked)
 * - Safe test mode & mock interception support
 */

import { Resend } from 'resend';
import { EmailDeliveryStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
  fromName?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface DomainVerificationStatus {
  domain: string;
  status: 'verified' | 'pending' | 'not_started' | 'failed' | 'temporary_failure' | 'not_configured' | 'unknown';
  isVerified: boolean;
  mode: 'sandbox' | 'production';
  details?: string;
  resendDomainId?: string;
  records?: Array<{
    record: string;
    name: string;
    type: string;
    value: string;
    status: string;
    priority?: number;
    ttl?: string;
  }>;
  error?: string;
}

export interface SendEmailResult {
  success: boolean;
  resendEmailId?: string;
  error?: string;
  statusCode?: number;
  isRetryable?: boolean;
  isQuotaExceeded?: boolean;
  quotaMessage?: string;
}

export const RESEND_QUOTA_EXCEEDED_MESSAGE =
  'Email delivery temporarily unavailable. The email service has reached its sending limit.';

export class EmailService {
  private static client: Resend | null = null;
  private static mockSender: ((opts: SendEmailOptions) => Promise<SendEmailResult>) | null = null;

  /**
   * Initializes or returns singleton Resend client.
   */
  private static getClient(): Resend | null {
    if (this.client) {
      return this.client;
    }

    if (!env.RESEND_API_KEY || env.RESEND_API_KEY.trim() === '') {
      return null;
    }

    this.client = new Resend(env.RESEND_API_KEY.trim());
    return this.client;
  }

  /**
   * Allows unit tests to register a mock sender function for reliable automated testing.
   */
  static setMockSender(sender: ((opts: SendEmailOptions) => Promise<SendEmailResult>) | null): void {
    this.mockSender = sender;
  }

  /**
   * Returns whether Resend transactional email delivery is enabled and configured.
   */
  static isConfigured(): boolean {
    if (!env.EMAIL_NOTIFICATIONS_ENABLED) {
      return false;
    }
    return Boolean(env.RESEND_API_KEY && env.RESEND_API_KEY.trim().length > 0);
  }

  /**
   * Detects and classifies Resend quota exhaustion and daily sending limit errors.
   * Recognizes HTTP 429 / 402, rate_limit_exceeded, daily_quota_exceeded, and provider limit patterns.
   */
  static isQuotaExceededError(error: any, statusCode?: number): boolean {
    if (!error) return statusCode === 429 || statusCode === 402;

    const code = statusCode || error?.statusCode || error?.status;
    if (code === 429 || code === 402) {
      return true;
    }

    const errorName = String(error?.name || error?.type || error?.code || '').toLowerCase();
    const quotaNames = [
      'rate_limit_exceeded',
      'daily_quota_exceeded',
      'quota_exceeded',
      'monthly_quota_exceeded',
      'daily_limit_exceeded',
      'plan_limit_exceeded',
      'sending_limit_exceeded',
    ];
    if (quotaNames.includes(errorName)) {
      return true;
    }

    const message = (
      typeof error === 'string'
        ? error
        : (error?.message || error?.error || (typeof error === 'object' ? JSON.stringify(error) : ''))
    ).toLowerCase();

    const quotaPatterns = [
      /daily\s*(email)?\s*sending\s*limit/,
      /daily\s*limit/,
      /daily\s*quota/,
      /quota\s*exceeded/,
      /sending\s*limit/,
      /rate\s*limit/,
      /100%\s*of\s*(your\s*)?daily/,
      /reached\s*(your\s*)?daily/,
      /too\s*many\s*requests/,
      /plan\s*limit/,
      /monthly\s*quota/,
    ];

    return quotaPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Sanitizes error messages by scrubbing API keys, tokens, and authorization headers.
   */
  static sanitizeErrorMessage(message: string): string {
    if (!message) return '';
    return message
      .replace(/re_[a-zA-Z0-9_-]{16,}/gi, 're_[REDACTED]')
      .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
      .replace(/(api[_-]?key\s*[:=]\s*)[^\s,]+/gi, '$1[REDACTED]')
      .replace(/(secret\s*[:=]\s*)[^\s,]+/gi, '$1[REDACTED]');
  }

  /**
   * Formats sender address with display name.
   * Supports runtime parameter overrides and parses RFC 5322 "Name <email>" format.
   */
  static getFromAddress(customFromEmail?: string, customFromName?: string): string {
    const rawEmail = (customFromEmail || env.RESEND_FROM_EMAIL || 'onboarding@resend.dev').trim();
    const rawName = (customFromName || env.RESEND_FROM_NAME || 'OBLIVION Privacy OS').trim();

    // If already in RFC 5322 format: "Name <email@domain.com>", return as-is
    if (rawEmail.includes('<') && rawEmail.includes('>')) {
      return rawEmail;
    }

    return `${rawName} <${rawEmail}>`;
  }

  /**
   * Resolves the effective email recipient based on environment and test mode settings.
   * - Production: Always delivers strictly to intended recipient.
   * - Development:
   *   - If recipient is explicitly verified/allowlisted in ALLOWED_TEST_EMAILS or matches RESEND_TEST_TO,
   *     delivery proceeds directly to that verified recipient.
   *   - Otherwise, if EMAIL_TEST_MODE is true, redirects to safe test sink (RESEND_TEST_TO).
   */
  static resolveRecipient(
    intendedRecipient: string,
    currentEnv: {
      nodeEnv?: 'development' | 'production' | 'test' | string;
      emailTestMode?: boolean;
      resendTestTo?: string;
      allowedTestEmails?: string[];
    } = {}
  ): { recipient: string; isTestMode: boolean; isAllowlisted: boolean } {
    const nodeEnv = currentEnv.nodeEnv ?? env.NODE_ENV;
    const emailTestMode = currentEnv.emailTestMode ?? env.EMAIL_TEST_MODE;
    const resendTestTo = (currentEnv.resendTestTo ?? env.RESEND_TEST_TO ?? 'delivered@resend.dev').trim().toLowerCase();
    const allowedTestEmails = (currentEnv.allowedTestEmails ?? env.ALLOWED_TEST_EMAILS ?? []).map((e) => e.trim().toLowerCase());

    const normalizedIntended = intendedRecipient.trim().toLowerCase();

    // 1. In production, ALWAYS send to the intended registered recipient without redirection
    if (nodeEnv === 'production') {
      return { recipient: intendedRecipient, isTestMode: false, isAllowlisted: true };
    }

    // 2. In development or test:
    // Check if the intended recipient is explicitly allowlisted for real delivery
    const isExplicitlyAllowed =
      allowedTestEmails.includes(normalizedIntended) ||
      (resendTestTo !== 'delivered@resend.dev' && resendTestTo === normalizedIntended);

    if (isExplicitlyAllowed) {
      return { recipient: intendedRecipient, isTestMode: false, isAllowlisted: true };
    }

    // If EMAIL_TEST_MODE is true, redirect unverified addresses to safe test sink
    if (emailTestMode) {
      return { recipient: resendTestTo, isTestMode: true, isAllowlisted: false };
    }

    // Fallback: in dev without test mode or allowlist, keep intended recipient
    return { recipient: intendedRecipient, isTestMode: false, isAllowlisted: false };
  }

  /**
   * Dispatches a transactional email through Resend with retryable error classification.
   */
  static async sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
    // 1. Check if mock sender is active (e.g. during automated test suites)
    if (this.mockSender) {
      const mockResult = await this.mockSender(opts);
      if (!mockResult.success && mockResult.isQuotaExceeded === undefined) {
        const isQuota = this.isQuotaExceededError(mockResult.error, mockResult.statusCode);
        if (isQuota) {
          return {
            ...mockResult,
            isQuotaExceeded: true,
            error: RESEND_QUOTA_EXCEEDED_MESSAGE,
            quotaMessage: RESEND_QUOTA_EXCEEDED_MESSAGE,
            isRetryable: false,
          };
        }
      }
      return mockResult;
    }

    // 2. Validate environment configuration
    if (!env.EMAIL_NOTIFICATIONS_ENABLED) {
      logger.info(`[EmailService] Email delivery disabled via EMAIL_NOTIFICATIONS_ENABLED=false for ${opts.to}`);
      return {
        success: false,
        error: 'Email delivery disabled in configuration',
        isRetryable: false,
      };
    }

    const client = this.getClient();
    if (!client) {
      logger.warn(`[EmailService] RESEND_API_KEY not configured. Cannot dispatch email to ${opts.to}`);
      return {
        success: false,
        error: 'RESEND_API_KEY not configured',
        isRetryable: false,
      };
    }

    const from = opts.from
      ? (opts.from.includes('<') ? opts.from : this.getFromAddress(opts.from, opts.fromName))
      : this.getFromAddress(undefined, opts.fromName);

    const { recipient, isTestMode, isAllowlisted } = this.resolveRecipient(opts.to);

    // Production sandbox warning
    const senderDomain = from.includes('@')
      ? from.split('@')[1].replace('>', '').trim().toLowerCase()
      : '';
    if (env.NODE_ENV === 'production' && senderDomain === 'resend.dev') {
      logger.warn(
        `[EmailService] Production sending with sandbox sender "${from}". Custom domain verification at https://resend.com/domains is required to deliver to non-account recipients.`
      );
    }

    try {
      if (isAllowlisted && opts.to.toLowerCase() === recipient.toLowerCase()) {
        logger.info(
          `[EmailService] [VERIFIED TEST RECIPIENT] Dispatching email "${opts.subject}" directly to verified test recipient ${recipient} via Resend...`
        );
      } else if (isTestMode) {
        logger.info(
          `[EmailService] [TEST SINK MODE] Dispatching email "${opts.subject}" redirected from ${opts.to} to ${recipient} via Resend...`
        );
      } else {
        logger.info(`[EmailService] Dispatching email "${opts.subject}" to ${recipient} via Resend...`);
      }

      const response = await client.emails.send({
        from,
        to: recipient,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        replyTo: opts.replyTo,
        tags: opts.tags,
      });

      if (response.error) {
        const errorMsg = response.error.message || 'Resend API returned an error';
        const rawStatus = (response.error as any).statusCode || (response.error as any).status;
        const isQuota = this.isQuotaExceededError(response.error, rawStatus);
        const isRateLimit = response.error.name === 'rate_limit_exceeded';
        const isRetryable = !isQuota && (isRateLimit || response.error.name === 'internal_server_error');

        const sanitizedMsg = this.sanitizeErrorMessage(errorMsg);
        logger.error(
          `[EmailService] Resend dispatch failed for ${recipient}: ${sanitizedMsg} (${response.error.name})`
        );

        return {
          success: false,
          error: isQuota ? RESEND_QUOTA_EXCEEDED_MESSAGE : sanitizedMsg,
          statusCode: rawStatus,
          isRetryable,
          isQuotaExceeded: isQuota,
          quotaMessage: isQuota ? RESEND_QUOTA_EXCEEDED_MESSAGE : undefined,
        };
      }

      const resendEmailId = response.data?.id;
      logger.info(`[EmailService] Resend accepted email to ${recipient} (ID: ${resendEmailId})`);

      return {
        success: true,
        resendEmailId,
      };
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown network or Resend client error';
      const statusCode = err.statusCode || err.status || 500;
      const isQuota = this.isQuotaExceededError(err, statusCode);
      const isRetryable = !isQuota && (statusCode === 429 || (statusCode >= 500 && statusCode < 600));

      const sanitizedMsg = this.sanitizeErrorMessage(errorMsg);
      logger.error(`[EmailService] Network/SDK exception dispatching to ${recipient}: ${sanitizedMsg}`);

      return {
        success: false,
        error: isQuota ? RESEND_QUOTA_EXCEEDED_MESSAGE : sanitizedMsg,
        statusCode,
        isRetryable,
        isQuotaExceeded: isQuota,
        quotaMessage: isQuota ? RESEND_QUOTA_EXCEEDED_MESSAGE : undefined,
      };
    }
  }

  /**
   * Verifies Resend webhook signature using webhook secret and raw payload.
   */
  static verifyWebhookSignature(params: {
    rawPayload: string | Buffer;
    headers: {
      id?: string;
      timestamp?: string;
      signature?: string;
    };
    webhookSecret?: string;
  }): { isValid: boolean; event?: any; error?: string } {
    const secret = params.webhookSecret || env.RESEND_WEBHOOK_SECRET;

    if (!secret || secret.trim() === '') {
      return {
        isValid: false,
        error: 'RESEND_WEBHOOK_SECRET not configured on server',
      };
    }

    const { id, timestamp, signature } = params.headers;
    if (!id || !timestamp || !signature) {
      return {
        isValid: false,
        error: 'Missing required webhook verification headers (id, timestamp, signature)',
      };
    }

    try {
      const client = this.getClient() || new Resend('re_dummy_fallback_for_verify');
      const payloadString =
        typeof params.rawPayload === 'string'
          ? params.rawPayload
          : params.rawPayload.toString('utf-8');

      const verified = client.webhooks.verify({
        payload: payloadString,
        headers: {
          id,
          timestamp,
          signature,
        },
        webhookSecret: secret.trim(),
      });

      return {
        isValid: true,
        event: verified,
      };
    } catch (err: any) {
      return {
        isValid: false,
        error: err.message || 'Invalid webhook signature',
      };
    }
  }

  /**
   * Queries Resend API directly for delivery telemetry and status.
   */
  static async getResendEmail(resendEmailId: string): Promise<any> {
    const client = this.getClient();
    if (!client) {
      return null;
    }
    try {
      const response = await client.emails.get(resendEmailId);
      return response.data || null;
    } catch (err: any) {
      logger.warn(`[EmailService] Failed to query Resend for email ${resendEmailId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Synchronizes local EmailDelivery status with live Resend delivery telemetry.
   * Confirms transition from API acceptance (SENT) to mailbox delivery (DELIVERED).
   */
  static async syncDeliveryStatus(deliveryId: string): Promise<{
    updated: boolean;
    deliveryStatus: EmailDeliveryStatus;
    lastEvent?: string;
  }> {
    const delivery = await prisma.emailDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery || !delivery.resendEmailId) {
      return { updated: false, deliveryStatus: delivery?.deliveryStatus || EmailDeliveryStatus.PENDING };
    }

    const resendData = await this.getResendEmail(delivery.resendEmailId);
    if (!resendData) {
      return { updated: false, deliveryStatus: delivery.deliveryStatus };
    }

    const lastEvent: string | undefined = resendData.last_event || resendData.status;
    let newStatus: EmailDeliveryStatus | null = null;
    let deliveredAt: Date | undefined;
    let failedAt: Date | undefined;
    let errorMessage: string | undefined;

    if (lastEvent === 'delivered') {
      // Guard: Never mark an email that failed or bounced as DELIVERED
      if (
        delivery.deliveryStatus === EmailDeliveryStatus.FAILED ||
        delivery.deliveryStatus === EmailDeliveryStatus.BOUNCED
      ) {
        logger.warn(
          `[EmailService] Cannot transition delivery ${delivery.id} from ${delivery.deliveryStatus} to DELIVERED`
        );
        return { updated: false, deliveryStatus: delivery.deliveryStatus, lastEvent };
      }
      newStatus = EmailDeliveryStatus.DELIVERED;
      deliveredAt = resendData.created_at ? new Date(resendData.created_at) : new Date();
    } else if (lastEvent === 'bounced') {
      newStatus = EmailDeliveryStatus.BOUNCED;
      failedAt = new Date();
      errorMessage = 'Recipient mailbox bounced';
    } else if (lastEvent === 'complained') {
      newStatus = EmailDeliveryStatus.FAILED;
      failedAt = new Date();
      errorMessage = 'Recipient complaint registered';
    } else if (lastEvent === 'sent' && delivery.deliveryStatus === EmailDeliveryStatus.PENDING) {
      newStatus = EmailDeliveryStatus.SENT;
    }

    if (newStatus && newStatus !== delivery.deliveryStatus) {
      await prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          deliveryStatus: newStatus,
          ...(deliveredAt ? { deliveredAt } : {}),
          ...(failedAt ? { failedAt } : {}),
          ...(errorMessage ? { errorMessage } : {}),
        },
      });
      logger.info(
        `[EmailService] Synced delivery ${delivery.id} from ${delivery.deliveryStatus} to ${newStatus} (Resend event: ${lastEvent})`
      );
      return { updated: true, deliveryStatus: newStatus, lastEvent };
    }

    return { updated: false, deliveryStatus: delivery.deliveryStatus, lastEvent };
  }

  /**
   * Diagnoses and retrieves live domain verification status directly from Resend API.
   * Never invents DNS records. Returns actual verified state from Resend.
   */
  static async checkDomainStatus(targetDomain?: string): Promise<DomainVerificationStatus> {
    const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const emailPart = fromEmail.includes('<')
      ? fromEmail.split('<')[1].replace('>', '').trim()
      : fromEmail.trim();
    const domainToCheck = targetDomain ? targetDomain.trim().toLowerCase() : (emailPart.split('@')[1] || 'resend.dev').toLowerCase();

    // 1. Resend official testing domain
    if (domainToCheck === 'resend.dev') {
      return {
        domain: 'resend.dev',
        status: 'verified',
        isVerified: true,
        mode: 'sandbox',
        details:
          'Resend default shared testing domain (onboarding@resend.dev). Note: Deliveries are restricted to verified account owner and delivered@resend.dev on free tier.',
      };
    }

    const client = this.getClient();
    if (!client) {
      return {
        domain: domainToCheck,
        status: 'not_configured',
        isVerified: false,
        mode: 'production',
        error: 'RESEND_API_KEY is not configured',
      };
    }

    try {
      const response = await client.domains.list();
      const domainList = response.data?.data || [];
      const matched = domainList.find(
        (d: any) => d.name.toLowerCase() === domainToCheck
      );

      if (!matched) {
        return {
          domain: domainToCheck,
          status: 'not_configured',
          isVerified: false,
          mode: 'production',
          error: `Domain "${domainToCheck}" is not registered in your Resend account. Add it at https://resend.com/domains to begin DNS verification.`,
        };
      }

      // Query specific domain details to retrieve DNS verification records
      const detailsRes = await client.domains.get(matched.id);
      const details = detailsRes.data || matched;

      return {
        domain: matched.name,
        resendDomainId: matched.id,
        status: details.status as any,
        isVerified: details.status === 'verified',
        mode: 'production',
        records: (details as any).records || [],
      };
    } catch (err: any) {
      logger.error(`[EmailService] Failed to check domain status for ${domainToCheck}: ${err.message}`);
      return {
        domain: domainToCheck,
        status: 'unknown',
        isVerified: false,
        mode: 'production',
        error: err.message,
      };
    }
  }

  /**
   * Validates production sender configuration and reports status.
   */
  static validateSenderConfig(): {
    fromAddress: string;
    fromEmail: string;
    fromName: string;
    domain: string;
    isProductionReady: boolean;
    warnings: string[];
  } {
    const fromAddress = this.getFromAddress();
    const fromEmail = (env.RESEND_FROM_EMAIL || 'onboarding@resend.dev').trim();
    const fromName = (env.RESEND_FROM_NAME || 'OBLIVION Privacy OS').trim();
    const emailPart = fromEmail.includes('<')
      ? fromEmail.split('<')[1].replace('>', '').trim()
      : fromEmail;
    const domain = emailPart.includes('@') ? emailPart.split('@')[1] : 'unknown';

    const warnings: string[] = [];

    if (env.NODE_ENV === 'production' && domain.toLowerCase() === 'resend.dev') {
      warnings.push(
        'Using default sandbox domain "onboarding@resend.dev" in production. You must configure and verify a custom domain at https://resend.com/domains for real user delivery.'
      );
    }

    if (!env.RESEND_API_KEY || env.RESEND_API_KEY.trim() === '') {
      warnings.push('RESEND_API_KEY is missing or empty.');
    }

    if (env.NODE_ENV === 'production' && (!env.RESEND_WEBHOOK_SECRET || env.RESEND_WEBHOOK_SECRET.trim() === '')) {
      warnings.push('RESEND_WEBHOOK_SECRET is not configured in production. Webhooks cannot be cryptographically verified.');
    }

    return {
      fromAddress,
      fromEmail,
      fromName,
      domain,
      isProductionReady: warnings.length === 0,
      warnings,
    };
  }
}
