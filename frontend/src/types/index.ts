/**
 * OBLIVION – Frontend TypeScript Definitions
 * Aligned with backend Prisma models and API schemas.
 */

// ============================================================================
// API Response Wrappers
// ============================================================================

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
  errors?: Array<{ field?: string; message: string }>;
}

// ============================================================================
// Authentication & User
// ============================================================================

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'PENDING_VERIFICATION';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role?: string;
  accountStatus: AccountStatus;
  isEmailVerified?: boolean;
  createdAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
}

export interface AuthData {
  tokens?: AuthTokens;
  token?: string;
  tokenType?: string;
  expiresIn?: string;
  user: User;
}

// ============================================================================
// Websites
// ============================================================================

export type WebsiteCategory =
  | 'SOCIAL_MEDIA'
  | 'E_COMMERCE'
  | 'FINANCIAL_SERVICES'
  | 'HEALTHCARE'
  | 'EMPLOYMENT'
  | 'EDUCATION'
  | 'ENTERTAINMENT'
  | 'GOVERNMENT'
  | 'TELECOMMUNICATIONS'
  | 'UTILITIES'
  | 'OTHER';

export interface Website {
  id: string;
  userId: string;
  websiteName: string;
  websiteUrl: string;
  websiteCategory: WebsiteCategory;
  createdAt: string;
  updatedAt: string;
  _count?: {
    exposureRecords?: number;
    removalRequests?: number;
  };
}

export interface CreateWebsiteDTO {
  websiteName: string;
  websiteUrl: string;
  websiteCategory?: WebsiteCategory;
}

export interface UpdateWebsiteDTO {
  websiteName?: string;
  websiteUrl?: string;
  websiteCategory?: WebsiteCategory;
}

// ============================================================================
// Data Categories
// ============================================================================

export interface DataCategory {
  id: string;
  name?: string;
  categoryName?: string;
  description: string;
  sensitivityLevel?: SensitivityLevel;
  defaultSensitivity?: SensitivityLevel;
  riskWeight: number;
  createdAt?: string;
}

// ============================================================================
// Exposure Records
// ============================================================================

export type SensitivityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RecordStatus = 'ACTIVE' | 'PENDING_REVIEW' | 'REMOVAL_REQUESTED' | 'REMOVED' | 'ARCHIVED';

export type ExposureSource =
  | 'ACCOUNT_REGISTRATION'
  | 'JOB_APPLICATION'
  | 'SOCIAL_MEDIA'
  | 'PUBLIC_WEBSITE'
  | 'ONLINE_PURCHASE'
  | 'OTHER';

export type ExposureVisibility = 'PRIVATE' | 'RESTRICTED' | 'PUBLIC' | 'UNKNOWN';

export type DataSharingStatus = 'ACTIVE' | 'NO_LONGER_SHARED' | 'UNKNOWN';

export type RemediationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'RESOLVED';

export interface RiskBreakdown {
  baseCategoryWeight: number;
  categoryCount: number;
  categoryVolumeFactor: number;
  platformSensitivityMultiplier: number;
  visibilityMultiplier: number;
  sharingStatusMultiplier: number;
  remediationMultiplier: number;
  rawScore: number;
  normalizedScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  keyFactors: string[];
}

export interface ExposureCategoryJoin {
  dataCategory: DataCategory;
}

export interface ExposureRecord {
  id: string;
  userId: string;
  websiteId: string;
  purpose: string;
  sensitivityLevel: SensitivityLevel;
  dateShared: string;
  reviewDate?: string | null;
  expiryDate?: string | null;
  recordStatus: RecordStatus;
  notes?: string | null;
  platformUrl?: string | null;
  dataDescription?: string | null;
  exposureSource?: ExposureSource;
  visibility?: ExposureVisibility;
  sharingStatus?: DataSharingStatus;
  lastVerifiedDate?: string | null;
  remediationStatus?: RemediationStatus;
  evidenceAttachment?: string | null;
  calculatedRiskScore?: number;
  calculatedRiskRating?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskBreakdown?: RiskBreakdown;
  website?: Website;
  categories?: ExposureCategoryJoin[];
  removalRequests?: RemovalRequest[];
  activityTimeline?: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExposureDTO {
  websiteId: string;
  purpose: string;
  sensitivityLevel?: SensitivityLevel;
  dateShared: string;
  reviewDate?: string | null;
  expiryDate?: string | null;
  recordStatus?: RecordStatus;
  notes?: string | null;
  categoryIds?: string[];
  platformUrl?: string | null;
  dataDescription?: string | null;
  exposureSource?: ExposureSource;
  visibility?: ExposureVisibility;
  sharingStatus?: DataSharingStatus;
  lastVerifiedDate?: string | null;
  remediationStatus?: RemediationStatus;
  evidenceAttachment?: string | null;
}

export interface UpdateExposureDTO {
  websiteId?: string;
  purpose?: string;
  sensitivityLevel?: SensitivityLevel;
  dateShared?: string;
  reviewDate?: string | null;
  expiryDate?: string | null;
  recordStatus?: RecordStatus;
  notes?: string | null;
  categoryIds?: string[];
  platformUrl?: string | null;
  dataDescription?: string | null;
  exposureSource?: ExposureSource;
  visibility?: ExposureVisibility;
  sharingStatus?: DataSharingStatus;
  lastVerifiedDate?: string | null;
  remediationStatus?: RemediationStatus;
  evidenceAttachment?: string | null;
}

export interface ExposureSummaryResponse {
  totalExposures: number;
  activeExposures: number;
  criticalExposures: number;
  resolvedExposures: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  byPlatform: Array<{
    platformId: string;
    platformName: string;
    platformUrl: string;
    exposureCount: number;
    highestRisk: number;
    hasCritical: boolean;
  }>;
}

export interface CreateExposureRemovalDTO {
  requestType?: RemovalRequestType;
  requestReason: string;
  externalReference?: string | null;
}

// ============================================================================
// Removal Requests & History
// ============================================================================

export type RemovalRequestType =
  | 'GDPR_ERASURE'
  | 'CCPA_DELETION'
  | 'DATA_ERASURE_GENERAL'
  | 'ACCOUNT_CLOSURE'
  | 'MARKETING_OPT_OUT'
  | 'CUSTOM';

export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'FOLLOW_UP_REQUIRED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'APPEALED';

export interface RequestHistory {
  id: string;
  removalRequestId: string;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  remarks?: string | null;
  createdAt: string;
}

export interface RemovalRequest {
  id: string;
  userId: string;
  websiteId: string;
  exposureRecordId: string;
  requestType: RemovalRequestType;
  requestStatus: RequestStatus;
  requestReason: string;
  externalReference?: string | null;
  trackingToken: string;
  submittedAt?: string | null;
  resolvedAt?: string | null;
  website?: Website;
  exposureRecord?: ExposureRecord;
  requestHistory?: RequestHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRemovalRequestDTO {
  websiteId: string;
  exposureRecordId?: string;
  exposedDataDescription?: string;
  requestType?: RemovalRequestType;
  requestReason: string;
  externalReference?: string | null;
  requestStatus?: RequestStatus;
}

export interface UpdateRemovalRequestDTO {
  requestStatus?: RequestStatus;
  requestReason?: string;
  externalReference?: string | null;
  remarks?: string;
}

// ============================================================================
// Reminders
// ============================================================================

export type ReminderType =
  | 'EXPIRY_CHECK'
  | 'ANNUAL_PRIVACY_REVIEW'
  | 'FOLLOW_UP_REMOVAL'
  | 'CONSENT_REVALIDATION'
  | 'CUSTOM';

export type ReminderStatus = 'PENDING' | 'DISMISSED' | 'SNOOZED' | 'COMPLETED';

export interface Reminder {
  id: string;
  userId: string;
  removalRequestId?: string | null;
  exposureRecordId?: string | null;
  title: string;
  notes?: string | null;
  reminderType: ReminderType;
  reminderStatus: ReminderStatus;
  reminderDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderDTO {
  removalRequestId?: string;
  exposureRecordId?: string;
  reminderDate: string;
  reminderType?: ReminderType;
  title: string;
  notes?: string;
}

export interface UpdateReminderDTO {
  title?: string;
  notes?: string;
  reminderDate?: string;
  reminderType?: ReminderType;
  reminderStatus?: ReminderStatus;
}

// ============================================================================
// Notifications
// ============================================================================

export type NotificationType =
  | 'SECURITY_ALERT'
  | 'REMINDER_DUE'
  | 'REQUEST_STATUS_UPDATE'
  | 'SYSTEM_NOTICE'
  | 'EXPOSURE_EXPIRING';

export type EmailDeliveryStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'BOUNCED'
  | 'FAILED'
  | 'CANCELLED';

export type OverdueFrequency = 'DAILY' | 'THREE_DAYS' | 'WEEKLY' | 'NONE';

export interface UserNotificationPreference {
  id: string;
  userId: string;
  emailNotificationsEnabled: boolean;
  notifyOnCreated: boolean;
  notify7DaysBefore: boolean;
  notify3DaysBefore: boolean;
  notify1DayBefore: boolean;
  notifyDueToday: boolean;
  notifyOverdue: boolean;
  overdueFrequency: OverdueFrequency;
  notifyCompleted?: boolean;
  notifyOnCompleted?: boolean;
  notifyRemovalUpdates?: boolean;
  notifyAccountSecurity?: boolean;
  welcomeEmailSent?: boolean;
  registeredEmail?: string;
  isEmailVerified?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDeliveryItem {
  id: string;
  notificationStage: string;
  recipientEmail: string;
  subject: string;
  deliveryStatus: EmailDeliveryStatus;
  attemptCount: number;
  sentAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface NotificationEmailDeliverySummary {
  id: string;
  deliveryStatus: EmailDeliveryStatus;
  recipientEmail?: string;
  resendEmailId?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  notificationType: NotificationType;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  emailDeliveries?: NotificationEmailDeliverySummary[];
}

// ============================================================================
// Dashboard Analytics
// ============================================================================

export interface DashboardOverview {
  totalWebsites: number;
  totalExposures: number;
  activeExposures?: number;
  resolvedExposures?: number;
  totalRemovals?: number;
  activeRemovalRequests?: number;
  completedRemovalRequests?: number;
  pendingReminders?: number;
  unreadNotifications?: number;
  privacyRiskIndex?: number;
  privacyRiskRating?: string;
  privacyExposureIndex?: number;
  privacyHealthRating?: string;
}

export interface ExposureBreakdown {
  sensitivityDistribution?: Record<string, number>;
  categoryDistribution?: Record<string, number>;
  bySensitivity?: Record<string, number>;
  byStatus?: Record<string, number>;
  byWebsiteCategory?: Record<string, number>;
  topCategories?: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
    riskWeight: number;
  }>;
}

export interface RemovalProgress {
  totalRequests: number;
  statusDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
}

export interface RecentActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

// ============================================================================
// Audit Logs
// ============================================================================

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface AuditSummary {
  totalEvents: number;
  uniqueActions: number;
  actionBreakdown: Record<string, number>;
}

export interface AuditExport {
  exportedAt: string;
  userId: string;
  complianceFrameworks: string[];
  totalEvents: number;
  events: AuditLog[];
}
