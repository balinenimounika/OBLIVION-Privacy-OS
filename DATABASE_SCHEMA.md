# OBLIVION – Complete Database Schema Specification

**System:** OBLIVION – The Internet's Forget Button  
**Engine:** PostgreSQL 15+ / 16+  
**ORM / Migration Management:** Prisma ORM  
**Target Database:** `oblivion_db`  
**Schema Version:** `1.0.0` (Migration `20261103000000_init`)

---

## 1. Architectural Principles & Security Design

1. **Strict Metadata Isolation (Privacy-by-Design):**  
   OBLIVION never stores actual passwords, government identification numbers (e.g. Aadhaar, SSN), credit card credentials, raw identity documents, or plain sensitive personal data in the exposure diary. Only exposure metadata, classifications, dates, and status records are stored.
2. **UUID Primary Keys (`UUIDv4` / `gen_random_uuid()`):**  
   Every table employs globally unique, non-sequential 128-bit UUID identifiers. This prevents enumeration attacks, facilitates horizontal data distribution, and ensures reference safety.
3. **Timezone-Aware Timestamps (`TIMESTAMPTZ`):**  
   All temporal attributes use `TIMESTAMP WITH TIME ZONE` (`TIMESTAMPTZ`) in UTC to prevent timezone skew across international data controllers and distributed clients.
4. **Relational Constraints & Data Integrity:**  
   Foreign-key cascades and restrictions are enforced strictly at the database engine level. Enum types ensure domain validity for status transitions, categories, and sensitivity classifications.
5. **Strict Multi-Tenant User Isolation:**  
   Every user-owned record explicitly links to `user_id` with cascading referential integrity, ensuring complete partition boundaries and eliminating cross-tenant leakage.

---

## 2. PostgreSQL Enumerated Types (Enums)

### `AccountStatus`
Status of user accounts on the OBLIVION privacy platform.
- `ACTIVE`: Fully active and operational account.
- `SUSPENDED`: Access temporarily restricted due to policy or security trigger.
- `DEACTIVATED`: Account deactivated by user; scheduled for retention expiration.
- `PENDING_VERIFICATION`: Registered user awaiting email/identity ownership verification.

### `WebsiteCategory`
Platform classifications for cataloging external digital service providers.
- `SOCIAL_MEDIA`: Social networking, forums, user-generated content networks.
- `E_COMMERCE`: Online retailers, marketplaces, subscription sellers.
- `FINANCIAL_SERVICES`: Banking, investment, payment processors, fintech.
- `HEALTHCARE`: Medical portals, telemetry services, fitness applications.
- `EMPLOYMENT`: Job portals, recruitment agencies, career registries.
- `EDUCATION`: Universities, online course platforms, certification bodies.
- `ENTERTAINMENT`: Streaming platforms, gaming networks, digital media.
- `GOVERNMENT`: Civic portals, tax authorities, municipal registries.
- `TELECOMMUNICATIONS`: ISPs, cellular carriers, messaging gateways.
- `UTILITIES`: Energy, water, internet utilities, smart home infrastructure.
- `OTHER`: Uncategorized digital platforms.

### `SensitivityLevel`
Risk-weighted sensitivity taxonomy for personal data categories and exposure entries.
- `LOW`: Public or low-impact data (e.g., public profile name, business email).
- `MEDIUM`: Semi-private personal data (e.g., personal phone number, resume).
- `HIGH`: Confidential personal data (e.g., residential home address, private media).
- `CRITICAL`: Regulated or high-harm data (e.g., national ID, banking metadata, biometric profile).

### `RecordStatus`
Operational lifecycle state of an exposure entry in the user's privacy ledger.
- `ACTIVE`: Personal data remains retained on the external website.
- `PENDING_REVIEW`: Scheduled for periodic user review or consent revalidation.
- `REMOVAL_REQUESTED`: An active removal/erasure request has been dispatched.
- `REMOVED`: Confirmed deleted or scrubbed by the external service provider.
- `ARCHIVED`: Retained in user history for legal or audit purposes.

### `RemovalRequestType`
Legal and operational frameworks governing personal data erasure requests.
- `GDPR_ERASURE`: Article 17 "Right to be Forgotten" (EU/UK GDPR).
- `CCPA_DELETION`: Section 1798.105 "Right to Delete Personal Information" (CCPA/CPRA).
- `DATA_ERASURE_GENERAL`: Platform-specific privacy policy data removal request.
- `ACCOUNT_CLOSURE`: Permanent profile termination and associated data purge.
- `MARKETING_OPT_OUT`: Direct marketing opt-out, data broker unlisting request.
- `CUSTOM`: Bespoke user-formulated legal/privacy demand.

### `RequestStatus`
Progress workflow stages for removal requests.
- `DRAFT`: Prepared by user, not yet transmitted to the external controller.
- `SUBMITTED`: Formally dispatched to privacy contact or API endpoint.
- `ACKNOWLEDGED`: External entity acknowledged receipt of request.
- `IN_PROGRESS`: Service provider actively processing deletion.
- `FOLLOW_UP_REQUIRED`: Statutory response window elapsed; reminder issued.
- `COMPLETED`: Erasure successfully verified and completed.
- `REJECTED`: Request rejected or denied by external entity (with remarks).
- `APPEALED`: Rejection formally appealed to data protection officer (DPO) or regulator.

### `ReminderType`
Categorization of privacy follow-up alerts.
- `EXPIRY_CHECK`: Scheduled verification of expected data retention expiry.
- `ANNUAL_PRIVACY_REVIEW`: Recurring yearly check-in for dormant accounts.
- `FOLLOW_UP_REMOVAL`: Follow-up ping after non-responsive removal request.
- `CONSENT_REVALIDATION`: Periodic re-evaluation of consent granted to a third party.
- `CUSTOM`: User-defined reminder.

### `ReminderStatus`
- `PENDING`: Scheduled and awaiting trigger date.
- `DISMISSED`: Dismissed by user without action.
- `SNOOZED`: Rescheduled to a future timestamp.
- `COMPLETED`: Fulfilled and completed by user.

### `NotificationType`
System notification categories.
- `SECURITY_ALERT`: Critical security event (e.g., account lock, unverified sign-in).
- `REMINDER_DUE`: Scheduled privacy review or follow-up is due.
- `REQUEST_STATUS_UPDATE`: Removal request status changed by system or controller.
- `SYSTEM_NOTICE`: Maintenance or general platform announcement.
- `EXPOSURE_EXPIRING`: Retention expiry date reached for an exposure record.

---

## 3. Detailed Table Definitions

### 3.1 `users`
Core user identity and authentication credentials table.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Immutable unique user identifier. |
| `full_name` | `VARCHAR(255)` | `NOT NULL` | User's full legal or preferred name. |
| `email` | `VARCHAR(255)` | `NOT NULL`, `UNIQUE` | User login email address (case-insensitive lookup). |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Cryptographic hash (Argon2id / bcrypt). |
| `account_status` | `AccountStatus` | `NOT NULL`, Default `'ACTIVE'` | Current status of user platform account. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `CURRENT_TIMESTAMP` | Account creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `CURRENT_TIMESTAMP` | Last profile update timestamp. |

**Indexes & Constraints:**
- `users_pkey`: `PRIMARY KEY (id)`
- `users_email_key`: `UNIQUE INDEX (email)`
- `users_email_idx`: `INDEX (email)`
- `users_account_status_idx`: `INDEX (account_status)`

---

### 3.2 `websites`
Registry of digital platforms, mobile apps, and data controllers where user personal information has been shared.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique website registry entry identifier. |
| `user_id` | `UUID` | `NOT NULL`, `FK -> users(id) ON DELETE CASCADE` | Owner user identifier. |
| `website_name` | `VARCHAR(255)` | `NOT NULL` | Common name (e.g. "LinkedIn", "Amazon", "Old Forum"). |
| `website_url` | `VARCHAR(1024)`| `NOT NULL` | Canonical base domain or profile URL. |
| `website_category`| `WebsiteCategory` | `NOT NULL`, Default `'OTHER'` | Industry/service classification. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `CURRENT_TIMESTAMP` | Entry creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `CURRENT_TIMESTAMP` | Entry update timestamp. |

**Indexes & Constraints:**
- `websites_pkey`: `PRIMARY KEY (id)`
- `websites_user_id_website_url_key`: `UNIQUE (user_id, website_url)` (Prevents duplicate entries per user)
- `websites_user_id_idx`: `INDEX (user_id)`
- `websites_website_name_idx`: `INDEX (website_name)`
- `websites_website_category_idx`: `INDEX (website_category)`

---

### 3.3 `exposure_records`
Central privacy ledger tracking individual instances where personal information was shared with an external party.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique exposure record identifier. |
| `user_id` | `UUID` | `NOT NULL`, `FK -> users(id) ON DELETE CASCADE` | Owner user identifier. |
| `website_id` | `UUID` | `NOT NULL`, `FK -> websites(id) ON DELETE RESTRICT` | Associated target website. |
| `purpose` | `VARCHAR(255)` | `NOT NULL` | Purpose of data sharing (e.g., "Account Signup", "Job Application"). |
| `sensitivity_level` | `SensitivityLevel` | `NOT NULL`, Default `'MEDIUM'` | Aggregate sensitivity classification. |
| `date_shared` | `TIMESTAMPTZ` | `NOT NULL` | Date when personal data was initially transmitted. |
| `review_date` | `TIMESTAMPTZ` | `NULLABLE` | Scheduled date for user review or consent check. |
| `expiry_date` | `TIMESTAMPTZ` | `NULLABLE` | Expected statutory or contractual retention expiry. |
| `record_status` | `RecordStatus` | `NOT NULL`, Default `'ACTIVE'` | Current status of the exposure entry. |
| `notes` | `TEXT` | `NULLABLE` | High-level context notes (strictly metadata; NO raw PII). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `CURRENT_TIMESTAMP` | Entry creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `CURRENT_TIMESTAMP` | Last update timestamp. |

**Indexes & Constraints:**
- `exposure_records_pkey`: `PRIMARY KEY (id)`
- `exposure_records_user_id_idx`: `INDEX (user_id)`
- `exposure_records_website_id_idx`: `INDEX (website_id)`
- `exposure_records_record_status_idx`: `INDEX (record_status)`
- `exposure_records_sensitivity_level_idx`: `INDEX (sensitivity_level)`
- `exposure_records_review_date_idx`: `INDEX (review_date)`
- `exposure_records_user_id_record_status_idx`: `INDEX (user_id, record_status)` (Fast dashboard queries)

---

### 3.4 `data_categories` (Reference Data)
Standardized reference taxonomy classifying types of personal information, their inherent sensitivity, and baseline risk weights.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique category reference identifier. |
| `category_name` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | Distinct category name (e.g., "Email Address", "Home Address"). |
| `description` | `TEXT` | `NOT NULL` | Comprehensive description of what data belongs here. |
| `default_sensitivity` | `SensitivityLevel` | `NOT NULL`, Default `'MEDIUM'` | Default baseline sensitivity level. |
| `risk_weight` | `INTEGER` | `NOT NULL`, Default `5`, `CHECK (risk_weight BETWEEN 1 AND 100)` | Quantitative privacy risk factor (1-100). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `CURRENT_TIMESTAMP` | System catalog registration timestamp. |

**Indexes & Constraints:**
- `data_categories_pkey`: `PRIMARY KEY (id)`
- `data_categories_category_name_key`: `UNIQUE INDEX (category_name)`
- `data_categories_category_name_idx`: `INDEX (category_name)`
- `data_categories_default_sensitivity_idx`: `INDEX (default_sensitivity)`
- `check_risk_weight_positive`: `CHECK (risk_weight >= 1 AND risk_weight <= 100)`

---

### 3.5 `exposure_record_categories`
Normalized associative table supporting many-to-many relationships between exposure records and data categories.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique join row identifier. |
| `exposure_record_id`| `UUID` | `NOT NULL`, `FK -> exposure_records(id) ON DELETE CASCADE` | Associated exposure record. |
| `data_category_id` | `UUID` | `NOT NULL`, `FK -> data_categories(id) ON DELETE RESTRICT` | Referenced reference category. |

**Indexes & Constraints:**
- `exposure_record_categories_pkey`: `PRIMARY KEY (id)`
- `exposure_record_categories_exposure_record_id_data_category_id_key`: `UNIQUE (exposure_record_id, data_category_id)`
- `exposure_record_categories_exposure_record_id_idx`: `INDEX (exposure_record_id)`
- `exposure_record_categories_data_category_id_idx`: `INDEX (data_category_id)`

---

### 3.6 `removal_requests`
Formal erasure demands dispatched to external data controllers invoking privacy rights (e.g., GDPR Art. 17, CCPA).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique removal request identifier. |
| `user_id` | `UUID` | `NOT NULL`, `FK -> users(id) ON DELETE CASCADE` | Requesting user. |
| `website_id` | `UUID` | `NOT NULL`, `FK -> websites(id) ON DELETE RESTRICT` | Target data controller website. |
| `exposure_record_id` | `UUID` | `NOT NULL`, `FK -> exposure_records(id) ON DELETE CASCADE` | Exposure entry to be scrubbed. |
| `request_type` | `RemovalRequestType` | `NOT NULL`, Default `'GDPR_ERASURE'` | Legal or procedural request framework. |
| `request_reason` | `TEXT` | `NOT NULL` | Formal justification provided to data controller. |
| `request_status` | `RequestStatus` | `NOT NULL`, Default `'DRAFT'` | Current workflow status. |
| `submitted_at` | `TIMESTAMPTZ` | `NULLABLE` | Timestamp when request was dispatched. |
| `resolved_at` | `TIMESTAMPTZ` | `NULLABLE` | Timestamp when deletion was completed or rejected. |
| `external_reference` | `VARCHAR(255)` | `NULLABLE` | Third-party ticket/confirmation reference. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `CURRENT_TIMESTAMP` | Request draft created timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `CURRENT_TIMESTAMP` | Last status/content modification. |

**Indexes & Constraints:**
- `removal_requests_pkey`: `PRIMARY KEY (id)`
- `removal_requests_user_id_idx`: `INDEX (user_id)`
- `removal_requests_website_id_idx`: `INDEX (website_id)`
- `removal_requests_exposure_record_id_idx`: `INDEX (exposure_record_id)`
- `removal_requests_request_status_idx`: `INDEX (request_status)`
- `removal_requests_submitted_at_idx`: `INDEX (submitted_at)`
- `removal_requests_user_id_request_status_idx`: `INDEX (user_id, request_status)`

---

### 3.7 `request_history`
Append-only historical audit ledger capturing all status transitions of a removal request.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique status transition log entry. |
| `removal_request_id`| `UUID` | `NOT NULL`, `FK -> removal_requests(id) ON DELETE CASCADE` | Associated removal request. |
| `previous_status` | `RequestStatus` | `NULLABLE` | Prior status before transition. |
| `new_status` | `RequestStatus` | `NOT NULL` | New updated status. |
| `remarks` | `TEXT` | `NULLABLE` | Notes explaining transition or controller response. |
| `changed_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `CURRENT_TIMESTAMP` | Timestamp when change occurred. |

**Indexes & Constraints:**
- `request_history_pkey`: `PRIMARY KEY (id)`
- `request_history_removal_request_id_idx`: `INDEX (removal_request_id)`
- `request_history_changed_at_idx`: `INDEX (changed_at)`

---

### 3.8 `reminders`
Automated calendar and notification triggers for upcoming privacy milestones, retention expirations, and follow-ups.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique reminder identifier. |
| `user_id` | `UUID` | `NOT NULL`, `FK -> users(id) ON DELETE CASCADE` | Recipient user identifier. |
| `exposure_record_id`| `UUID` | `NOT NULL`, `FK -> exposure_records(id) ON DELETE CASCADE` | Target exposure record. |
| `reminder_type` | `ReminderType` | `NOT NULL`, Default `'ANNUAL_PRIVACY_REVIEW'` | Classification of reminder trigger. |
| `reminder_date` | `TIMESTAMPTZ` | `NOT NULL` | Scheduled alert execution date and time. |
| `reminder_status` | `ReminderStatus` | `NOT NULL`, Default `'PENDING'` | Lifecycle state of reminder. |
| `completed_at` | `TIMESTAMPTZ` | `NULLABLE` | Timestamp when user marked reminder complete. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `CURRENT_TIMESTAMP` | Scheduling timestamp. |

**Indexes & Constraints:**
- `reminders_pkey`: `PRIMARY KEY (id)`
- `reminders_exposure_record_id_reminder_type_reminder_date_key`: `UNIQUE (exposure_record_id, reminder_type, reminder_date)`
- `reminders_user_id_idx`: `INDEX (user_id)`
- `reminders_exposure_record_id_idx`: `INDEX (exposure_record_id)`
- `reminders_reminder_status_idx`: `INDEX (reminder_status)`
- `reminders_reminder_date_idx`: `INDEX (reminder_date)`
- `reminders_user_id_reminder_status_idx`: `INDEX (user_id, reminder_status)`

---

### 3.9 `notifications`
In-app messaging center for alerts, statutory deadline expirations, and request progression.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique notification identifier. |
| `user_id` | `UUID` | `NOT NULL`, `FK -> users(id) ON DELETE CASCADE` | Recipient user identifier. |
| `title` | `VARCHAR(255)` | `NOT NULL` | Notification headline. |
| `message` | `TEXT` | `NOT NULL` | Body description of event or required action. |
| `notification_type`| `NotificationType`| `NOT NULL`, Default `'SYSTEM_NOTICE'` | Event categorization. |
| `is_read` | `BOOLEAN` | `NOT NULL`, Default `false` | Read receipt flag. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `CURRENT_TIMESTAMP` | Message dispatch timestamp. |

**Indexes & Constraints:**
- `notifications_pkey`: `PRIMARY KEY (id)`
- `notifications_user_id_idx`: `INDEX (user_id)`
- `notifications_is_read_idx`: `INDEX (is_read)`
- `notifications_created_at_idx`: `INDEX (created_at)`
- `notifications_user_id_is_read_idx`: `INDEX (user_id, is_read)`

---

### 3.10 `audit_logs`
Immutable regulatory compliance audit log tracking security-relevant actions.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, Default `gen_random_uuid()` | Unique audit event identifier. |
| `user_id` | `UUID` | `NOT NULL`, `FK -> users(id) ON DELETE CASCADE` | Initiating actor. |
| `action` | `VARCHAR(100)` | `NOT NULL` | Action performed (e.g., `USER_LOGIN`, `REQUEST_SUBMITTED`). |
| `entity_type` | `VARCHAR(100)` | `NOT NULL` | Target entity class (`User`, `ExposureRecord`, `RemovalRequest`). |
| `entity_id` | `VARCHAR(64)` | `NOT NULL` | Primary key of modified entity. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, Default `CURRENT_TIMESTAMP` | Audit log timestamp. |

**Indexes & Constraints:**
- `audit_logs_pkey`: `PRIMARY KEY (id)`
- `audit_logs_user_id_idx`: `INDEX (user_id)`
- `audit_logs_action_idx`: `INDEX (action)`
- `audit_logs_entity_type_idx`: `INDEX (entity_type)`
- `audit_logs_created_at_idx`: `INDEX (created_at)`
