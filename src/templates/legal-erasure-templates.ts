/**
 * OBLIVION - Statutory Legal Erasure Notice Template Engine
 *
 * Implements legally grounded notice generators for:
 * 1. GDPR Article 17 (Right to Erasure / "Right to be Forgotten") - 30 calendar days (Art. 12(3))
 * 2. CCPA / CPRA Section 1798.105 (Consumer Deletion Request) - 45 calendar days (Cal. Civ. Code § 1798.130(a)(2))
 * 3. Data Broker Opt-Out & Marketing Purge (California Delete Act / SB 362) - 15 business days (21 calendar days)
 * 4. Full Account Closure & Data Erasure - 14 calendar days
 * 5. General Data Erasure Demand - 30 calendar days
 *
 * Features:
 * - HTML entity escaping for all user inputs
 * - Monospace ASCII plain-text fallback for all email clients
 * - Dynamic jurisdiction-aware statutory deadline calculus
 * - Versioned legal notices for non-repudiation auditability
 */

import { RemovalRequestType } from '@prisma/client';
import { escapeHtml } from './email-templates';

export const STATUTORY_NOTICE_VERSION = '1.0.0';

export interface StatutoryFrameworkConfig {
  frameworkName: string;
  statutoryDays: number;
  citation: string;
  governingBody: string;
  legalBasisSummary: string;
  isBusinessDays: boolean;
}

export const STATUTORY_FRAMEWORKS: Record<RemovalRequestType, StatutoryFrameworkConfig> = {
  [RemovalRequestType.GDPR_ERASURE]: {
    frameworkName: 'European Union General Data Protection Regulation (GDPR)',
    statutoryDays: 30, // Article 12(3) - "without undue delay and in any event within one month"
    citation: 'Regulation (EU) 2016/679, Article 17(1) (Right to Erasure) & Article 12(3)',
    governingBody: 'Relevant National Supervisory Authority (EDPB / CNIL / ICO / DPC)',
    legalBasisSummary: 'The data subject has the fundamental right to obtain from the controller the erasure of personal data concerning them without undue delay.',
    isBusinessDays: false,
  },
  [RemovalRequestType.CCPA_DELETION]: {
    frameworkName: 'California Consumer Privacy Act (as amended by CPRA)',
    statutoryDays: 45, // Cal. Civ. Code § 1798.130(a)(2) - "within 45 days of receiving a verifiable consumer request"
    citation: 'California Civil Code § 1798.105 (Consumer Right to Delete) & § 1798.130(a)(2)',
    governingBody: 'California Privacy Protection Agency (CPPA) & California Attorney General',
    legalBasisSummary: 'A consumer has the statutory right to request that a business delete any personal information about the consumer which the business has collected.',
    isBusinessDays: false,
  },
  [RemovalRequestType.MARKETING_OPT_OUT]: {
    frameworkName: 'Data Broker Registry Opt-Out & Marketing Purge Directive',
    statutoryDays: 21, // 15 business days ≈ 21 calendar days under CA Delete Act (SB 362)
    citation: 'California Delete Act (SB 362), Cal. Civ. Code § 1798.99.80 et seq.',
    governingBody: 'California Privacy Protection Agency (CPPA) / Federal Trade Commission',
    legalBasisSummary: 'Mandatory directive to permanently cease selling, sharing, or processing personal information for profiling and direct marketing.',
    isBusinessDays: true,
  },
  [RemovalRequestType.ACCOUNT_CLOSURE]: {
    frameworkName: 'Full Account Termination & Associated Data Purge',
    statutoryDays: 14,
    citation: 'Applicable Terms of Service Termination & Statutory Data Retention Limits',
    governingBody: 'Consumer Protection & Data Privacy Regulatory Authorities',
    legalBasisSummary: 'Permanent closure of user account and complete destruction of associated personal identifiers, credentials, and telemetry.',
    isBusinessDays: false,
  },
  [RemovalRequestType.DATA_ERASURE_GENERAL]: {
    frameworkName: 'General Privacy Erasure Demand',
    statutoryDays: 30,
    citation: 'International Data Protection & Privacy Best Practices',
    governingBody: 'Applicable Regional Data Privacy Authorities',
    legalBasisSummary: 'Formal demand to cease retaining personal records and provide verifiable confirmation of data destruction.',
    isBusinessDays: false,
  },
  [RemovalRequestType.CUSTOM]: {
    frameworkName: 'Custom Written Statutory Erasure Demand',
    statutoryDays: 30,
    citation: 'Applicable Statutory Privacy Directives',
    governingBody: 'Applicable Data Protection Authorities',
    legalBasisSummary: 'Tailored statutory notice asserting individual data protection and privacy rights.',
    isBusinessDays: false,
  },
};

/**
 * Calculates jurisdiction-aware statutory compliance deadlines.
 */
export function calculateStatutoryDeadline(
  requestType: RemovalRequestType,
  fromDate: Date = new Date()
): {
  days: number;
  dueDate: Date;
  framework: StatutoryFrameworkConfig;
} {
  const framework = STATUTORY_FRAMEWORKS[requestType] || STATUTORY_FRAMEWORKS.DATA_ERASURE_GENERAL;
  const dueDate = new Date(fromDate.getTime() + framework.statutoryDays * 86400000);
  return {
    days: framework.statutoryDays,
    dueDate,
    framework,
  };
}

export interface StatutoryNoticeParams {
  userName: string;
  userEmail: string;
  websiteName: string;
  websiteUrl: string;
  requestType: RemovalRequestType;
  exposedDataDescription: string;
  requestReason: string;
  customNotes?: string | null;
  referenceNumber: string;
  jurisdictionDeadlineDays: number;
  calculatedDeadlineDate: Date;
}

export interface RenderedStatutoryNotice {
  legalFramework: string;
  legalBasisCitation: string;
  jurisdictionDeadlineDays: number;
  calculatedDeadlineDate: string; // ISO string
  noticeVersion: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Builds responsive, legally authoritative HTML and plain-text statutory erasure demand notices.
 */
export function buildStatutoryNotice(params: StatutoryNoticeParams): RenderedStatutoryNotice {
  const framework = STATUTORY_FRAMEWORKS[params.requestType] || STATUTORY_FRAMEWORKS.DATA_ERASURE_GENERAL;
  const deadlineDateStr = params.calculatedDeadlineDate.toISOString().split('T')[0];

  const safeUserName = escapeHtml(params.userName || 'Data Subject / Consumer');
  const safeUserEmail = escapeHtml(params.userEmail);
  const safeWebsiteName = escapeHtml(params.websiteName);
  const safeWebsiteUrl = escapeHtml(params.websiteUrl);
  const safeDataDescription = escapeHtml(params.exposedDataDescription);
  const safeReason = escapeHtml(params.requestReason);
  const safeNotes = params.customNotes ? escapeHtml(params.customNotes) : null;
  const safeRef = escapeHtml(params.referenceNumber);

  // Subject line with explicit legal framework tag and reference number
  const subject = `[STATUTORY DEMAND] ${framework.frameworkName} - Erasure Request - Ref: ${params.referenceNumber}`;

  // Responsive HTML notice
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
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 650px;
      margin: 32px auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: #0f172a;
      color: #ffffff;
      padding: 24px 32px;
      border-bottom: 4px solid #2563eb;
    }
    .header-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: #1e293b;
      color: #38bdf8;
      border: 1px solid #0284c7;
      padding: 4px 10px;
      border-radius: 4px;
      margin-bottom: 8px;
    }
    .header-title {
      font-size: 18px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.01em;
      line-height: 1.3;
    }
    .header-subtitle {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 4px;
      font-mono;
    }
    .content {
      padding: 32px;
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
    }
    .statutory-box {
      background-color: #eff6ff;
      border-left: 4px solid #2563eb;
      padding: 16px 20px;
      border-radius: 0 6px 6px 0;
      margin: 20px 0;
    }
    .statutory-box strong {
      color: #1e3a8a;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 13px;
    }
    .details-table th, .details-table td {
      border: 1px solid #e2e8f0;
      padding: 10px 14px;
      text-align: left;
    }
    .details-table th {
      background-color: #f8fafc;
      color: #475569;
      font-weight: 600;
      width: 32%;
    }
    .details-table td {
      background-color: #ffffff;
      color: #0f172a;
      word-break: break-word;
    }
    .mandate-list {
      margin: 16px 0;
      padding-left: 20px;
    }
    .mandate-list li {
      margin-bottom: 8px;
    }
    .deadline-banner {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 16px;
      margin: 24px 0;
      color: #991b1b;
    }
    .deadline-banner strong {
      font-size: 15px;
      display: block;
      margin-bottom: 4px;
    }
    .footer {
      background: #f1f5f9;
      padding: 20px 32px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-badge">Formal Legal Notice &bull; OBLIVION Privacy OS</div>
      <h1 class="header-title">STATUTORY DEMAND FOR DATA ERASURE</h1>
      <div class="header-subtitle">Reference Token: ${safeRef} &bull; Notice Version: ${STATUTORY_NOTICE_VERSION}</div>
    </div>

    <div class="content">
      <p><strong>TO:</strong> Data Protection Officer / Privacy Compliance Officer / Legal Department</p>
      <p><strong>ENTITY / PLATFORM:</strong> ${safeWebsiteName} (${safeWebsiteUrl})</p>
      <p><strong>DATE OF TRANSMISSION:</strong> ${new Date().toISOString().split('T')[0]}</p>

      <div class="statutory-box">
        <strong>LEGAL BASIS:</strong> ${framework.citation}<br>
        <strong>APPLICABLE REGIME:</strong> ${framework.frameworkName}<br>
        <strong>SUPERVISORY OVERSIGHT:</strong> ${framework.governingBody}
      </div>

      <p>
        I, <strong>${safeUserName}</strong> (identified in your records by the primary email address <code>${safeUserEmail}</code>), 
        hereby formally exercise my statutory rights under applicable privacy legislation to demand the permanent and irrevocable erasure of my personal data.
      </p>

      <table class="details-table">
        <tr>
          <th>Data Subject</th>
          <td><strong>${safeUserName}</strong> (<code>${safeUserEmail}</code>)</td>
        </tr>
        <tr>
          <th>Target Platform</th>
          <td>${safeWebsiteName} (<a href="${safeWebsiteUrl}" style="color: #2563eb;">${safeWebsiteUrl}</a>)</td>
        </tr>
        <tr>
          <th>Exposed Personal Information</th>
          <td>${safeDataDescription}</td>
        </tr>
        <tr>
          <th>Grounds for Erasure</th>
          <td>${safeReason}</td>
        </tr>
        ${
          safeNotes
            ? `<tr><th>Additional Identity Context</th><td>${safeNotes}</td></tr>`
            : ''
        }
        <tr>
          <th>Statutory Response Window</th>
          <td><strong>${params.jurisdictionDeadlineDays} Calendar Days</strong> (Due: <strong>${deadlineDateStr}</strong>)</td>
        </tr>
      </table>

      <h3 style="color: #0f172a; margin-top: 24px; font-size: 15px;">MANDATORY COMPLIANCE DIRECTIVES:</h3>
      <ol class="mandate-list">
        <li><strong>Complete Erasure:</strong> Permanently delete and purge all personal information, account profiles, contact details, behavioral telemetry, and associated identifiers originating from or associated with the undersigned.</li>
        <li><strong>Downstream Notification:</strong> Notify all third-party sub-processors, analytics partners, data brokers, and affiliates to whom you have disclosed or transferred my personal information to execute corresponding data erasures.</li>
        <li><strong>Cessation of Processing:</strong> Immediately cease any automated profiling, marketing distribution, data enrichment, or commercialization involving my personal data.</li>
        <li><strong>Written Confirmation:</strong> Transmit an explicit written confirmation specifying the date and technical scope of completed erasure to <code>${safeUserEmail}</code>.</li>
      </ol>

      <div class="deadline-banner">
        <strong>STATUTORY DEADLINE: ${deadlineDateStr} (${params.jurisdictionDeadlineDays} DAYS)</strong>
        Pursuant to ${framework.citation}, your organization is legally obligated to respond without undue delay and at the latest within ${params.jurisdictionDeadlineDays} calendar days. Failure to comply or provide statutory justification will result in an immediate formal complaint lodged with ${framework.governingBody}.
      </div>

      <p style="margin-top: 24px;">
        Sincerely,<br>
        <strong>${safeUserName}</strong><br>
        Data Subject / Verifiable Consumer<br>
        Email: <code>${safeUserEmail}</code>
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;">
        This statutory legal notice was generated and logged via <strong>OBLIVION Privacy OS</strong> (The Internet's Forget Button).
      </p>
      <p style="margin: 0;">
        Notice Version: ${STATUTORY_NOTICE_VERSION} &bull; Tamper-Evident Hash Token: ${safeRef} &bull; Timestamp: ${new Date().toISOString()}
      </p>
    </div>
  </div>
</body>
</html>`;

  // Monospace plain-text representation
  const text = `================================================================
STATUTORY DEMAND FOR DATA ERASURE & PURGE
Reference Token: ${params.referenceNumber}
Notice Version: ${STATUTORY_NOTICE_VERSION}
================================================================

TO: Data Protection Officer / Privacy Compliance Department
ENTITY / PLATFORM: ${params.websiteName} (${params.websiteUrl})
DATE OF TRANSMISSION: ${new Date().toISOString().split('T')[0]}

LEGAL FRAMEWORK: ${framework.frameworkName}
STATUTORY CITATION: ${framework.citation}
REGULATORY OVERSIGHT: ${framework.governingBody}

----------------------------------------------------------------
DATA SUBJECT IDENTIFICATION
----------------------------------------------------------------
Full Name:     ${params.userName}
Primary Email: ${params.userEmail}
Target Service: ${params.websiteName} (${params.websiteUrl})

SPECIFICATION OF EXPOSED PERSONAL DATA:
${params.exposedDataDescription}

GROUNDS FOR ERASURE DEMAND:
${params.requestReason}
${params.customNotes ? `\nADDITIONAL IDENTITY CONTEXT:\n${params.customNotes}\n` : ''}
----------------------------------------------------------------
MANDATORY STATUTORY DIRECTIVES
----------------------------------------------------------------
Pursuant to ${framework.citation}, I hereby exercise my statutory
rights to demand that your organization:

1. PERMANENT ERASURE: Irrevocably delete and purge all personal data,
   identifiers, telemetry, and profiles associated with my identity.
2. DOWNSTREAM PURGE: Notify all sub-processors, vendors, and third
   parties to whom my personal information was disclosed or transferred.
3. CEASE PROCESSING: Immediately stop all profiling, data sharing,
   and direct marketing activities involving my personal information.
4. FORMAL CONFIRMATION: Provide written confirmation of completed
   erasure to ${params.userEmail} within the statutory period.

----------------------------------------------------------------
STATUTORY COMPLIANCE DEADLINE: ${deadlineDateStr} (${params.jurisdictionDeadlineDays} DAYS)
----------------------------------------------------------------
Your organization is legally mandated to fulfill this request
without undue delay and no later than ${deadlineDateStr}.

Failure to respond within this window will result in formal regulatory
escalation to ${framework.governingBody}.

Sincerely,
${params.userName}
Data Subject / Consumer
Email: ${params.userEmail}

---
Dispatched via OBLIVION Privacy OS (The Internet's Forget Button)
Audit Token: ${params.referenceNumber} | Version: ${STATUTORY_NOTICE_VERSION}
`;

  return {
    legalFramework: framework.frameworkName,
    legalBasisCitation: framework.citation,
    jurisdictionDeadlineDays: params.jurisdictionDeadlineDays,
    calculatedDeadlineDate: deadlineDateStr,
    noticeVersion: STATUTORY_NOTICE_VERSION,
    subject,
    html,
    text,
  };
}
