/**
 * OBLIVION - Professional Responsive HTML & Plain-Text Email Templates
 *
 * Designed for Resend transactional email delivery.
 * Features:
 * - HTML entity escaping for user inputs to prevent injection
 * - Accessible high-contrast typography and subtle blue branding
 * - Mobile-responsive layout (600px max-width)
 * - Plain-text fallback for all templates
 * - Clear action-oriented CTA buttons linked to APP_BASE_URL
 */

import { ReminderAlertStage } from '../services/reminder-scheduler.service';
import { env } from '../config/env';

export interface EmailTemplateData {
  userName: string;
  reminderTitle: string;
  reminderDescription?: string | null;
  formattedDeadline: string;
  stage: ReminderAlertStage;
  priority?: string;
  daysRemaining?: number;
  customNotes?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Escapes unsafe HTML characters in user-provided content.
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface StageMetadata {
  subjectPrefix: string;
  badgeLabel: string;
  badgeBg: string;
  badgeColor: string;
  headline: string;
  subheadline: string;
  actionCallout: string;
}

const STAGE_META: Record<ReminderAlertStage, StageMetadata> = {
  SCHEDULED: {
    subjectPrefix: 'Reminder Scheduled',
    badgeLabel: 'SCHEDULED',
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
    headline: 'Privacy Reminder Scheduled',
    subheadline: 'Your privacy reminder has been scheduled in your OBLIVION Privacy OS account.',
    actionCallout: 'You will receive advance notifications as this deadline approaches.',
  },
  '7_DAYS_BEFORE': {
    subjectPrefix: 'Upcoming Deadline (7 Days Remaining)',
    badgeLabel: '7 DAYS REMAINING',
    badgeBg: '#eff6ff',
    badgeColor: '#2563eb',
    headline: 'Upcoming Privacy Deadline in 7 Days',
    subheadline: 'A scheduled privacy review or statutory response window is due in 7 days.',
    actionCallout: 'Please begin gathering required documentation or review pending requests.',
  },
  '3_DAYS_BEFORE': {
    subjectPrefix: 'Important Warning (3 Days Remaining)',
    badgeLabel: '3 DAYS REMAINING',
    badgeBg: '#fffbeb',
    badgeColor: '#b45309',
    headline: 'Privacy Deadline Approaching in 3 Days',
    subheadline: 'Your privacy compliance deadline is nearing.',
    actionCallout: 'Action may be required shortly to preserve your statutory erasure rights.',
  },
  '1_DAY_BEFORE': {
    subjectPrefix: 'Urgent: Deadline Due Tomorrow',
    badgeLabel: 'DUE TOMORROW',
    badgeBg: '#fef2f2',
    badgeColor: '#b91c1c',
    headline: 'Urgent: Privacy Deadline Due Tomorrow',
    subheadline: 'This is an urgent reminder that your privacy deadline matures tomorrow.',
    actionCallout: 'Review your privacy action now to avoid missing the compliance window.',
  },
  DUE_TODAY: {
    subjectPrefix: 'Action Required: Deadline Due Today',
    badgeLabel: 'DUE TODAY',
    badgeBg: '#fef2f2',
    badgeColor: '#dc2626',
    headline: 'Action Required: Deadline Due Today',
    subheadline: 'Your scheduled privacy review or removal request requires attention today.',
    actionCallout: 'Please complete your privacy review and update your record before midnight.',
  },
  OVERDUE: {
    subjectPrefix: 'Overdue Reminder: Immediate Action Required',
    badgeLabel: 'OVERDUE',
    badgeBg: '#fff1f2',
    badgeColor: '#be123c',
    headline: 'Overdue Privacy Action: Immediate Action Required',
    subheadline: 'Your scheduled privacy deadline has passed and remains incomplete in your workspace.',
    actionCallout: 'Immediate follow-up or statutory escalation is strongly recommended.',
  },
  COMPLETED: {
    subjectPrefix: 'Reminder Completed',
    badgeLabel: 'COMPLETED',
    badgeBg: '#f0fdf4',
    badgeColor: '#15803d',
    headline: 'Privacy Reminder Completed',
    subheadline: 'Great work! You have successfully resolved this privacy action.',
    actionCallout: 'This reminder is marked complete. All subsequent deadline alerts for this action are dismissed.',
  },
};

/**
 * Builds the responsive HTML and plain-text email representation for a specific reminder stage.
 */
export function buildReminderEmail(data: EmailTemplateData): RenderedEmail {
  const meta = STAGE_META[data.stage] || STAGE_META.SCHEDULED;
  const safeUserName = escapeHtml(data.userName || 'Privacy Advocate');
  const safeTitle = escapeHtml(data.reminderTitle);
  const safeDescription = escapeHtml(data.reminderDescription || 'Scheduled Privacy Action');
  const safeDeadline = escapeHtml(data.formattedDeadline);
  const safeNotes = data.customNotes ? escapeHtml(data.customNotes) : null;

  const appBaseUrl = (env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const remindersUrl = `${appBaseUrl}/app/reminders`;

  const subject = `${meta.subjectPrefix}: ${data.reminderTitle}`;

  // Responsive HTML template
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: 600px;
      margin: 32px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: #0f172a;
      padding: 24px 32px;
      border-bottom: 3px solid #2563eb;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: 0.05em;
      margin: 0;
      text-transform: uppercase;
    }
    .brand-subtitle {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 4px;
      letter-spacing: 0.02em;
    }
    .content {
      padding: 32px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background-color: ${meta.badgeBg};
      color: ${meta.badgeColor};
      margin-bottom: 16px;
    }
    .headline {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 8px 0;
      line-height: 1.3;
    }
    .subheadline {
      font-size: 14px;
      color: #64748b;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .details-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .detail-row {
      margin-bottom: 12px;
    }
    .detail-row:last-child {
      margin-bottom: 0;
    }
    .detail-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.03em;
      margin-bottom: 2px;
    }
    .detail-value {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }
    .action-note {
      font-size: 13px;
      color: #334155;
      background: #f1f5f9;
      border-left: 3px solid #2563eb;
      padding: 12px 16px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 28px;
      line-height: 1.5;
    }
    .button-container {
      text-align: center;
      margin-bottom: 32px;
    }
    .btn {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 12px 28px;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
    }
    .footer {
      background: #f8fafc;
      padding: 20px 32px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
      line-height: 1.5;
    }
    .footer a {
      color: #64748b;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="brand-title">OBLIVION</div>
      <div class="brand-subtitle">The Internet's Forget Button &bull; Privacy OS</div>
    </div>
    <div class="content">
      <span class="badge">${meta.badgeLabel}</span>
      <h1 class="headline">${meta.headline}</h1>
      <p class="subheadline">Hello ${safeUserName}, ${meta.subheadline}</p>

      <div class="details-box">
        <div class="detail-row">
          <div class="detail-label">Privacy Reminder</div>
          <div class="detail-value">${safeTitle}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Description / Purpose</div>
          <div class="detail-value">${safeDescription}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Deadline Date</div>
          <div class="detail-value">${safeDeadline}</div>
        </div>
        ${
          safeNotes
            ? `<div class="detail-row">
                <div class="detail-label">Notes</div>
                <div class="detail-value" style="font-weight: 400; color: #475569;">${safeNotes}</div>
              </div>`
            : ''
        }
      </div>

      <div class="action-note">
        <strong>Status Directive:</strong> ${meta.actionCallout}
      </div>

      <div class="button-container">
        <a href="${remindersUrl}" class="btn" target="_blank" rel="noopener noreferrer">
          Review My Reminder &rarr;
        </a>
      </div>
    </div>
    <div class="footer">
      <p>This automated transactional notification was delivered by <strong>OBLIVION Privacy OS</strong> to safeguard your personal data rights.</p>
      <p>Manage notification frequency in your <a href="${appBaseUrl}/app/settings">Account Settings</a>.</p>
    </div>
  </div>
</body>
</html>`;

  // Clean plain-text fallback
  const text = `OBLIVION - Privacy OS
${meta.headline.toUpperCase()}
Status: ${meta.badgeLabel}

Hello ${data.userName},

${meta.subheadline}

REMINDER DETAILS:
- Title: ${data.reminderTitle}
- Description: ${data.reminderDescription || 'Scheduled Privacy Action'}
- Deadline Date: ${data.formattedDeadline}
${data.customNotes ? `- Notes: ${data.customNotes}\n` : ''}
DIRECTIVE:
${meta.actionCallout}

Review and manage this reminder in your OBLIVION workspace:
${remindersUrl}

---
OBLIVION Privacy OS - The Internet's Forget Button
Manage your email notification preferences at ${appBaseUrl}/app/settings
`;

  return { subject, html, text };
}

/**
 * Builds the official Welcome Email dispatched upon successful user account registration.
 */
export function buildWelcomeEmail(data: { userName: string; userEmail: string }): RenderedEmail {
  const safeName = escapeHtml(data.userName || 'Privacy Advocate');
  const safeEmail = escapeHtml(data.userEmail);
  const appBaseUrl = (env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const dashboardUrl = `${appBaseUrl}/app`;

  const subject = `Welcome to OBLIVION — The Internet's Forget Button`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; }
    .email-container { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #0f172a; padding: 24px 32px; border-bottom: 3px solid #2563eb; }
    .brand-title { font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 0.05em; margin: 0; }
    .brand-subtitle { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .content { padding: 32px; }
    .badge { display: inline-block; padding: 4px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; text-transform: uppercase; background-color: #eff6ff; color: #1d4ed8; margin-bottom: 16px; }
    .headline { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 6px; }
    .footer { background: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="brand-title">OBLIVION</div>
      <div class="brand-subtitle">The Internet's Forget Button &bull; Privacy OS</div>
    </div>
    <div class="content">
      <span class="badge">Account Activated</span>
      <h1 class="headline">Welcome to Your Personal Privacy Vault</h1>
      <p>Hello ${safeName},</p>
      <p>Your OBLIVION Privacy OS account has been created for <code>${safeEmail}</code>. You are now equipped with the tools to take command of your digital footprint, enforce statutory erasure rights (GDPR Article 17 / CCPA), and monitor critical compliance deadlines.</p>
      <p><strong>What you can do right now:</strong></p>
      <ul>
        <li><strong>Track Exposed Data:</strong> Catalog personal records and sensitive exposures across online platforms.</li>
        <li><strong>Automate Removal Demands:</strong> Generate and dispatch legally grounded erasure demands with statutory compliance tracking.</li>
        <li><strong>Proactive Reminders:</strong> Receive advance notifications before legal response windows mature.</li>
      </ul>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${dashboardUrl}" class="btn" target="_blank" rel="noopener noreferrer">Launch Privacy Dashboard &rarr;</a>
      </div>
    </div>
    <div class="footer">
      <p>Delivered by <strong>OBLIVION Privacy OS</strong> to ${safeEmail}. Manage preferences in your <a href="${appBaseUrl}/app/settings">Account Settings</a>.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `OBLIVION - Privacy OS
WELCOME TO YOUR PERSONAL PRIVACY VAULT

Hello ${data.userName},

Your OBLIVION Privacy OS account has been created for ${data.userEmail}. You are now equipped to take command of your digital footprint and enforce statutory erasure rights.

Launch your privacy dashboard:
${dashboardUrl}

---
OBLIVION Privacy OS - The Internet's Forget Button
`;

  return { subject, html, text };
}

/**
 * Builds an Account Security Notification Email (Essential, cannot be disabled).
 */
export function buildAccountSecurityEmail(data: {
  userName: string;
  userEmail: string;
  securityEvent: string;
  details: string;
  timestamp: Date;
}): RenderedEmail {
  const safeName = escapeHtml(data.userName || 'Account Owner');
  const safeEvent = escapeHtml(data.securityEvent);
  const safeDetails = escapeHtml(data.details);
  const appBaseUrl = (env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const settingsUrl = `${appBaseUrl}/app/settings`;

  const subject = `[SECURITY ALERT] ${data.securityEvent} - OBLIVION Privacy OS`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #0f172a; padding: 24px 32px; border-bottom: 3px solid #dc2626; color: #ffffff; }
    .badge { display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 6px; background: #fef2f2; color: #dc2626; }
    .content { padding: 32px; font-size: 14px; line-height: 1.6; color: #334155; }
    .alert-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 14px 18px; margin: 20px 0; border-radius: 0 6px 6px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size: 18px; font-weight: 800;">OBLIVION &bull; SECURITY NOTIFICATION</div>
    </div>
    <div class="content">
      <span class="badge">Security Event</span>
      <h2 style="color: #0f172a; margin-top: 12px;">${safeEvent}</h2>
      <p>Hello ${safeName},</p>
      <div class="alert-box">
        <strong>Event:</strong> ${safeEvent}<br>
        <strong>Details:</strong> ${safeDetails}<br>
        <strong>Timestamp:</strong> ${data.timestamp.toISOString()}
      </div>
      <p>If you authorized this change, no further action is required. If you did not initiate this event, please contact system administration or review your account credentials immediately.</p>
      <p style="margin-top: 24px;"><a href="${settingsUrl}">Review Account Settings &rarr;</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `OBLIVION - SECURITY ALERT
Event: ${data.securityEvent}
Timestamp: ${data.timestamp.toISOString()}

Hello ${data.userName},

${data.details}

If you did not authorize this action, inspect your account immediately:
${settingsUrl}
`;

  return { subject, html, text };
}

/**
 * Builds a Removal Request Created Email.
 */
export function buildRemovalRequestCreatedEmail(data: {
  userName: string;
  websiteName: string;
  websiteUrl: string;
  requestType: string;
  requestReason: string;
  requestId: string;
}): RenderedEmail {
  const safeName = escapeHtml(data.userName || 'Account Owner');
  const safeSite = escapeHtml(data.websiteName);
  const safeUrl = escapeHtml(data.websiteUrl);
  const safeType = escapeHtml(data.requestType);
  const appBaseUrl = (env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const subject = `Removal Request Initiated: ${data.websiteName} (${data.requestType})`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family: sans-serif; background: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <div style="background: #0f172a; padding: 20px; color: #fff;">
      <h2 style="margin: 0;">OBLIVION &bull; Removal Request Initiated</h2>
    </div>
    <div style="padding: 24px;">
      <p>Hello ${safeName},</p>
      <p>A new data removal request has been created in your OBLIVION workspace:</p>
      <ul>
        <li><strong>Target Platform:</strong> ${safeSite} (${safeUrl})</li>
        <li><strong>Framework:</strong> ${safeType}</li>
        <li><strong>Reason / Scope:</strong> ${escapeHtml(data.requestReason)}</li>
        <li><strong>Status:</strong> DRAFT (Ready for statutory dispatch)</li>
      </ul>
      <p><a href="${appBaseUrl}/app/removal-requests" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Manage Removal Request &rarr;</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `OBLIVION - Removal Request Initiated
Platform: ${data.websiteName} (${data.websiteUrl})
Type: ${data.requestType}

A removal request has been recorded in your workspace. You can review and dispatch it at:
${appBaseUrl}/app/removal-requests
`;

  return { subject, html, text };
}

/**
 * Builds a Removal Request Status Updated Email.
 */
export function buildRemovalStatusUpdatedEmail(data: {
  userName: string;
  websiteName: string;
  previousStatus: string;
  newStatus: string;
  remarks?: string | null;
  requestId: string;
}): RenderedEmail {
  const safeName = escapeHtml(data.userName || 'Account Owner');
  const safeSite = escapeHtml(data.websiteName);
  const appBaseUrl = (env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const subject = `Removal Status Update: ${data.websiteName} transitioned to ${data.newStatus}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family: sans-serif; background: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <div style="background: #0f172a; padding: 20px; color: #fff;">
      <h2 style="margin: 0;">OBLIVION &bull; Status Update</h2>
    </div>
    <div style="padding: 24px;">
      <p>Hello ${safeName},</p>
      <p>The status of your removal request for <strong>${safeSite}</strong> has been updated:</p>
      <div style="background: #eff6ff; padding: 16px; border-radius: 6px; margin: 16px 0;">
        <strong>Previous Status:</strong> ${escapeHtml(data.previousStatus)}<br>
        <strong>New Status:</strong> <span style="color: #2563eb; font-weight: bold;">${escapeHtml(data.newStatus)}</span><br>
        ${data.remarks ? `<strong>Remarks:</strong> ${escapeHtml(data.remarks)}` : ''}
      </div>
      <p><a href="${appBaseUrl}/app/removal-requests" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View Request History &rarr;</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `OBLIVION - Status Update
Platform: ${data.websiteName}
Status Changed: ${data.previousStatus} -> ${data.newStatus}
${data.remarks ? `Remarks: ${data.remarks}\n` : ''}
Review in your workspace: ${appBaseUrl}/app/removal-requests
`;

  return { subject, html, text };
}

/**
 * Builds a Removal Request Completed Confirmation Email.
 */
export function buildRemovalCompletedEmail(data: {
  userName: string;
  websiteName: string;
  requestId: string;
  resolvedAt: Date;
}): RenderedEmail {
  const safeName = escapeHtml(data.userName || 'Account Owner');
  const safeSite = escapeHtml(data.websiteName);
  const appBaseUrl = (env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const subject = `[COMPLETED] Personal Data Removal Confirmed for ${data.websiteName}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family: sans-serif; background: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <div style="background: #0f172a; padding: 20px; color: #fff; border-bottom: 4px solid #16a34a;">
      <h2 style="margin: 0;">OBLIVION &bull; Erasure Completed</h2>
    </div>
    <div style="padding: 24px;">
      <p>Hello ${safeName},</p>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 16px; border-radius: 6px; margin: 16px 0;">
        <strong style="font-size: 16px;">Success: Data Removal Resolved</strong><br>
        Your personal data removal request for <strong>${safeSite}</strong> is marked as complete as of ${data.resolvedAt.toISOString().split('T')[0]}.
      </div>
      <p>Outstanding deadline reminders for this action have been dismissed. The exposure status has transitioned to <strong>REMOVED</strong> in your privacy catalog.</p>
      <p><a href="${appBaseUrl}/app/removal-requests" style="display: inline-block; background: #16a34a; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View Resolved Request &rarr;</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `OBLIVION - Data Removal Completed
Platform: ${data.websiteName}
Resolved Date: ${data.resolvedAt.toISOString().split('T')[0]}

Your removal request is completed and the record is marked REMOVED.
Review at: ${appBaseUrl}/app/removal-requests
`;

  return { subject, html, text };
}

/**
 * Builds a Removal Request Failed / Rejected Notification Email.
 */
export function buildRemovalFailedEmail(data: {
  userName: string;
  websiteName: string;
  requestId: string;
  rejectionReason?: string | null;
}): RenderedEmail {
  const safeName = escapeHtml(data.userName || 'Account Owner');
  const safeSite = escapeHtml(data.websiteName);
  const appBaseUrl = (env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const subject = `[ACTION REQUIRED] Removal Request Rejected for ${data.websiteName}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family: sans-serif; background: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <div style="background: #0f172a; padding: 20px; color: #fff; border-bottom: 4px solid #dc2626;">
      <h2 style="margin: 0;">OBLIVION &bull; Removal Request Rejected</h2>
    </div>
    <div style="padding: 24px;">
      <p>Hello ${safeName},</p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 16px; border-radius: 6px; margin: 16px 0;">
        <strong style="font-size: 15px;">Target Platform Refused or Rejected Removal</strong><br>
        Your removal request for <strong>${safeSite}</strong> was rejected or requires escalation.
        ${data.rejectionReason ? `<br><br><strong>Stated Reason:</strong> ${escapeHtml(data.rejectionReason)}` : ''}
      </div>
      <p>Under statutory frameworks such as GDPR Article 17(3) and CCPA, platforms may only refuse deletion under narrow statutory exceptions. You can submit an appeal or escalate to regulatory authorities.</p>
      <p><a href="${appBaseUrl}/app/removal-requests" style="display: inline-block; background: #dc2626; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Review Rejection & Appeal &rarr;</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `OBLIVION - Removal Request Rejected
Platform: ${data.websiteName}
${data.rejectionReason ? `Reason: ${data.rejectionReason}\n` : ''}

You can appeal this refusal or escalate to supervisory authorities at:
${appBaseUrl}/app/removal-requests
`;

  return { subject, html, text };
}

/**
 * Builds an Email Verification Email.
 */
export function buildVerificationEmail(data: {
  userName: string;
  verificationLink: string;
}): RenderedEmail {
  const safeName = escapeHtml(data.userName || 'Account Owner');
  const safeLink = escapeHtml(data.verificationLink);

  const subject = `Verify Your Email Address - OBLIVION Privacy OS`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family: sans-serif; background: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <div style="background: #0f172a; padding: 20px; color: #fff;">
      <h2 style="margin: 0;">OBLIVION &bull; Verify Your Email</h2>
    </div>
    <div style="padding: 24px;">
      <p>Hello ${safeName},</p>
      <p>Please confirm your registered email address to ensure your account security and enable full notification delivery:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${safeLink}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email Address &rarr;</a>
      </p>
      <p style="font-size: 12px; color: #64748b;">If the button above does not work, copy and paste this URL into your browser:<br><code>${safeLink}</code></p>
    </div>
  </div>
</body>
</html>`;

  const text = `OBLIVION - Verify Your Email
Hello ${data.userName},

Confirm your email address:
${data.verificationLink}
`;

  return { subject, html, text };
}
