# OBLIVION – Core Privacy API Modules Documentation (Phase 4)

**Platform:** OBLIVION – The Internet's Forget Button  
**Engine:** Node.js 24 + Express 5 + TypeScript  
**Database:** PostgreSQL 18.6 via Prisma ORM 6.19.3  
**Status:** Implemented & Verified  

---

## 1. Architectural & Security Foundations

The OBLIVION Core Privacy API implements personal data tracking, privacy exposure scoring, right-to-be-forgotten removal requests, reminder scheduling, user notifications, and dashboard analytics.

### Global Security Standard
1. **Bearer JWT Authentication**: All private routes require `Authorization: Bearer <token>`.
2. **Strict Multi-Tenant Isolation (IDOR Defense)**: The user identity is extracted strictly from `req.user.id`. Any attempt by Tenant A to access or modify records of Tenant B results in `404 Not Found` (never 403 or existence disclosure).
3. **Anti-Injection / Mass-Assignment Defense**: Specifying `userId` or `user_id` in request bodies or query parameters is rejected with `422 Unprocessable Entity`.
4. **Relational Graph Verification**: Nested entities (e.g. associating an exposure record to a website, or a removal request to an exposure record) require verifying that all referenced parent entities belong to the calling user.
5. **Standard Response Envelopes**:
   - Success: `{ "success": true, "message": "...", "data": { ... }, "meta": { ... } }`
   - Error: `{ "success": false, "message": "...", "errors": [ ... ] }`

---

## 2. Module 1: Websites API (`/api/v1/websites`)

Tracks external platforms, websites, and data brokers where personal data is stored or exposed.

| Method | Endpoint | Description | Request Body / Query | Success Status |
|:---|:---|:---|:---|:---:|
| `POST` | `/api/v1/websites` | Register new platform | `{ websiteName, websiteUrl, websiteCategory? }` | `201 Created` |
| `GET` | `/api/v1/websites` | List owned platforms | `?page=1&limit=20&search=...&category=...` | `200 OK` |
| `GET` | `/api/v1/websites/:id` | Get single platform | None | `200 OK` |
| `PATCH` | `/api/v1/websites/:id` | Update platform | `{ websiteName?, websiteUrl?, websiteCategory? }` | `200 OK` |
| `DELETE` | `/api/v1/websites/:id` | Delete platform | None | `200 OK` |

**Features**:
- Prevents duplicate URLs for the same user (`409 Conflict`), while permitting different users to register identical URLs.
- Supports categories: `SOCIAL_MEDIA`, `E_COMMERCE`, `FINANCIAL_SERVICES`, `HEALTHCARE`, `EMPLOYMENT`, `EDUCATION`, `ENTERTAINMENT`, `GOVERNMENT`, `TELECOMMUNICATIONS`, `UTILITIES`, `OTHER`.

---

## 3. Module 2: Exposure Records API (`/api/v1/exposures`)

Tracks specific personal data records exposed or entrusted to external websites.

| Method | Endpoint | Description | Request Body / Query | Success Status |
|:---|:---|:---|:---|:---:|
| `POST` | `/api/v1/exposures` | Log personal data exposure | `{ websiteId, purpose, sensitivityLevel?, dateShared, reviewDate?, expiryDate?, notes?, categoryIds? }` | `201 Created` |
| `GET` | `/api/v1/exposures` | List exposure records | `?page=1&limit=20&websiteId=...&sensitivityLevel=...&recordStatus=...` | `200 OK` |
| `GET` | `/api/v1/exposures/:id` | Get single exposure record | None | `200 OK` |
| `PATCH` | `/api/v1/exposures/:id` | Update exposure record | `{ purpose?, sensitivityLevel?, dateShared?, reviewDate?, expiryDate?, recordStatus?, notes?, categoryIds? }` | `200 OK` |
| `DELETE` | `/api/v1/exposures/:id` | Delete exposure record | None | `200 OK` |

**Dynamic Privacy Risk Calculation**:
- Automatically aggregates risk weights from attached reference categories (`data_categories.risk_weight`).
- Multiplied by sensitivity factor: `LOW (1.0x)`, `MEDIUM (1.5x)`, `HIGH (2.0x)`, `CRITICAL (3.0x)`.
- Returns `calculatedRiskScore` and `calculatedRiskRating` in API responses without altering database schema.

---

## 4. Module 3: Data Categories API (`/api/v1/categories`)

Global reference data classifying categories of personal information and their risk weights.

| Method | Endpoint | Description | Query Parameters | Success Status |
|:---|:---|:---|:---|:---:|
| `GET` | `/api/v1/categories` | List 12 reference categories | `?search=...&sensitivity=...&minRiskWeight=...` | `200 OK` |
| `GET` | `/api/v1/categories/:id` | Get single reference category | None | `200 OK` |

**Reference Categories Catalog**:
- Read-only for authenticated tenants. Includes Email address, Phone number, Resume, Personal photograph, Home address, Government identification, Financial information, and more.

---

## 5. Module 4 & 5: Removal Requests & History API (`/api/v1/removal-requests`)

Manages formal privacy erasure requests (GDPR Article 17 Right to be Forgotten, CCPA Deletion, Account Closure).

| Method | Endpoint | Description | Request Body / Query | Success Status |
|:---|:---|:---|:---|:---:|
| `POST` | `/api/v1/removal-requests` | Initiate removal request | `{ websiteId, exposureRecordId, requestType?, requestReason, externalReference?, requestStatus? }` | `201 Created` |
| `GET` | `/api/v1/removal-requests` | List removal requests | `?page=1&limit=20&requestStatus=...&requestType=...` | `200 OK` |
| `GET` | `/api/v1/removal-requests/:id` | Get single removal request | None | `200 OK` |
| `PATCH` | `/api/v1/removal-requests/:id` | Transition request status | `{ requestStatus?, requestReason?, externalReference?, remarks? }` | `200 OK` |
| `GET` | `/api/v1/removal-requests/:id/history` | Audit trail of status changes | None | `200 OK` |

**Deterministic State Machine**:
- `DRAFT` ➔ `SUBMITTED`, `REJECTED`
- `SUBMITTED` ➔ `ACKNOWLEDGED`, `IN_PROGRESS`, `REJECTED`
- `ACKNOWLEDGED` ➔ `IN_PROGRESS`, `FOLLOW_UP_REQUIRED`, `COMPLETED`, `REJECTED`
- `IN_PROGRESS` ➔ `FOLLOW_UP_REQUIRED`, `COMPLETED`, `REJECTED`
- `FOLLOW_UP_REQUIRED` ➔ `IN_PROGRESS`, `COMPLETED`, `REJECTED`
- `COMPLETED` ➔ Terminal (no further transitions)
- `REJECTED` ➔ `APPEALED`
- `APPEALED` ➔ `IN_PROGRESS`, `COMPLETED`, `REJECTED`

**Automatic Cascades & Audit**:
- Transition to `SUBMITTED` automatically stamps `submittedAt` and updates related exposure to `REMOVAL_REQUESTED`.
- Transition to `COMPLETED` automatically stamps `resolvedAt` and updates related exposure to `REMOVED`.
- Every transition appends an immutable entry to `request_history`.

---

## 6. Module 6: Reminders API (`/api/v1/reminders`)

Schedules automated reviews, consent revalidations, and expiry checks for exposures.

| Method | Endpoint | Description | Request Body / Query | Success Status |
|:---|:---|:---|:---|:---:|
| `POST` | `/api/v1/reminders` | Schedule reminder | `{ exposureRecordId, reminderType?, reminderDate }` | `201 Created` |
| `GET` | `/api/v1/reminders` | List reminders | `?page=1&limit=20&reminderStatus=...&upcomingOnly=true` | `200 OK` |
| `GET` | `/api/v1/reminders/:id` | Get single reminder | None | `200 OK` |
| `PATCH` | `/api/v1/reminders/:id` | Update reminder | `{ reminderDate?, reminderType?, reminderStatus? }` | `200 OK` |
| `DELETE` | `/api/v1/reminders/:id` | Delete reminder | None | `200 OK` |

**Features**:
- Prevents duplicate reminders of the same type on the same date for an exposure record (`409 Conflict`).
- Updating status to `COMPLETED` records `completedAt` timestamp.

---

## 7. Module 7: Notifications API (`/api/v1/notifications`)

In-app alerts for security incidents, reminder due dates, and removal request progress.

| Method | Endpoint | Description | Query / Body | Success Status |
|:---|:---|:---|:---|:---:|
| `GET` | `/api/v1/notifications` | List user notifications | `?page=1&limit=20&isRead=...` | `200 OK` (includes `unreadCount`) |
| `GET` | `/api/v1/notifications/:id` | Get single notification | None | `200 OK` |
| `PATCH` | `/api/v1/notifications/:id/read` | Mark notification read | None | `200 OK` |
| `PATCH` | `/api/v1/notifications/read-all` | Mark all notifications read | None | `200 OK` (returns `updatedCount`) |

---

## 8. Module 8: Dashboard Analytics API (`/api/v1/dashboard`)

Real-time aggregated privacy intelligence calculated strictly from PostgreSQL records.

| Method | Endpoint | Description | Key Response Metrics |
|:---|:---|:---|:---|
| `GET` | `/api/v1/dashboard/overview` | Privacy health overview | `totalWebsites`, `totalExposures`, `activeRemovalRequests`, `completedRemovalRequests`, `pendingReminders`, `unreadNotifications`, `privacyRiskIndex` (0–100), `privacyRiskRating` |
| `GET` | `/api/v1/dashboard/exposure-breakdown` | Exposure distributions | `bySensitivity`, `byStatus`, `byWebsiteCategory`, `topCategories` |
| `GET` | `/api/v1/dashboard/removal-progress` | Erasure performance | `totalRequests`, `byStatus`, `byType`, `successRatePercentage` |
| `GET` | `/api/v1/dashboard/recent-activity` | Chronological activity log | Latest 10 unified events across audit logs, status changes, and notifications |

---

## 9. Error Reference

| Status Code | Meaning | Typical Trigger |
|:---:|:---|:---|
| **400 Bad Request** | Malformed parameters / Invalid state jump | Non-UUID parameter format, invalid status transition, non-existent category ID |
| **401 Unauthorized** | Missing or invalid authentication token | Absent `Authorization` header, invalid JWT signature, expired token |
| **403 Forbidden** | Account inactive | User account status is `DEACTIVATED` or `SUSPENDED` |
| **404 Not Found** | Record not found / IDOR barrier | Record does not exist OR belongs to another tenant (zero existence disclosure) |
| **409 Conflict** | Unique constraint collision | Duplicate website URL for user, duplicate reminder scheduled for same date |
| **422 Unprocessable Entity** | Schema validation failure / injection | Invalid URL, empty purpose, password rules, injected `userId` in request body |
