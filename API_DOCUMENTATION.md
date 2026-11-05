# OBLIVION – Complete REST API Reference Manual

**Platform:** OBLIVION – The Internet's Forget Button  
**Engine:** Node.js 24 + Express 5 + TypeScript 5.7  
**Database:** PostgreSQL 18.6 via Prisma ORM 6.19.3  
**Base URL:** `http://localhost:5000/api/v1`  
**Root Health Check:** `http://localhost:5000/health`  
**Authentication Standard:** RFC 6750 Bearer JSON Web Token (HS256)

---

## 1. Global Architectural & API Standards

### Standard Response Envelopes
All endpoints emit consistent, structured JSON responses.

#### Success Response Envelope (HTTP 200 / 201)
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

#### Error Response Envelope (HTTP 4xx / 5xx)
```json
{
  "success": false,
  "message": "Human-readable summary of error",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address format"
    }
  ]
}
```

### Common HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource created successfully.
- `400 Bad Request`: Malformed syntax, invalid JSON, or invalid UUID parameter.
- `401 Unauthorized`: Missing, invalid, or expired Bearer token.
- `403 Forbidden`: Account is `SUSPENDED` or `DEACTIVATED`.
- `404 Not Found`: Entity not found or belongs to another tenant (IDOR prevention).
- `409 Conflict`: Unique constraint violation (e.g. duplicate email, duplicate URL).
- `413 Payload Too Large`: Request body exceeds 1MB threshold.
- `422 Unprocessable Entity`: Zod schema validation failed, or injected `userId` detected.
- `429 Too Many Requests`: Rate limit exceeded on authentication endpoints.
- `500 Internal Server Error`: Unhandled server exception.

---

## 2. Authentication Endpoints (`/api/v1/auth`)

### 2.1. Register Account
- **Method & Path:** `POST /api/v1/auth/register`
- **Authentication:** None (Public). Guarded by rate limiting (100 req / 15 min).
- **Validation Rules:**
  - `email`: Required, valid email string, normalized to lowercase.
  - `password`: Required, string, min 8 characters. Must contain at least one uppercase letter, one lowercase letter, and one number.
  - `fullName`: Required, string, 2–100 characters.
  - Specifying `role` or `accountStatus` is rejected with `422 Unprocessable Entity`.
- **Request Body:**
```json
{
  "fullName": "Alice Walker",
  "email": "alice@oblivion.internal",
  "password": "SecurePassword123!"
}
```
- **Success Response (HTTP 201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "e81c35a7-5774-4a0e-bf9d-17075e79fcdc",
      "email": "alice@oblivion.internal",
      "fullName": "Alice Walker",
      "role": "USER",
      "accountStatus": "ACTIVE",
      "createdAt": "2026-11-03T09:38:13.444Z"
    }
  }
}
```
- **Error Responses:**
  - `409 Conflict`: `"An account with this email address already exists"`
  - `422 Unprocessable Entity`: Input validation errors.

---

### 2.2. Login & Token Issuance
- **Method & Path:** `POST /api/v1/auth/login`
- **Authentication:** None (Public). Guarded by sliding-window rate limiting.
- **Request Body:**
```json
{
  "email": "alice@oblivion.internal",
  "password": "SecurePassword123!"
}
```
- **Success Response (HTTP 200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": "7d",
    "user": {
      "id": "e81c35a7-5774-4a0e-bf9d-17075e79fcdc",
      "email": "alice@oblivion.internal",
      "fullName": "Alice Walker",
      "role": "USER",
      "accountStatus": "ACTIVE"
    }
  }
}
```
- **Error Responses:**
  - `401 Unauthorized`: `"Invalid email or password"` (Generic error prevents account enumeration).
  - `429 Too Many Requests`: `"Too many authentication attempts. Please try again after 15 minutes."`

---

### 2.3. Get Authenticated User Profile
- **Method & Path:** `GET /api/v1/auth/me`
- **Authentication:** Required (`Authorization: Bearer <token>`).
- **Success Response (HTTP 200 OK):**
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "user": {
      "id": "e81c35a7-5774-4a0e-bf9d-17075e79fcdc",
      "email": "alice@oblivion.internal",
      "fullName": "Alice Walker",
      "accountStatus": "ACTIVE"
    }
  }
}
```
- **Error Responses:**
  - `401 Unauthorized`: Token missing, invalid, or expired.
  - `403 Forbidden`: Account is `DEACTIVATED` or `SUSPENDED`.

---

### 2.4. Logout User
- **Method & Path:** `POST /api/v1/auth/logout`
- **Authentication:** Required (`Authorization: Bearer <token>`).
- **Success Response (HTTP 200 OK):**
```json
{
  "success": true,
  "message": "Logout successful. Token invalidated on client."
}
```
- **Behavior:** Persists `AUTH_LOGOUT` audit log and directs client-side token discard.

---

## 3. Websites API (`/api/v1/websites`)

Tracks external platforms, websites, and data brokers where personal data is exposed.

### 3.1. Create Website
- **Method & Path:** `POST /api/v1/websites`
- **Authentication:** Required (`Authorization: Bearer <token>`).
- **Tenant Rules:** Automatically bound to authenticated user's ID. Injected `userId` in body is rejected with `422`.
- **Validation:** `websiteName` (1–100 chars), `websiteUrl` (valid URL), `websiteCategory` (valid `WebsiteCategory` enum).
- **Request Body:**
```json
{
  "websiteName": "PeopleSearch Broker",
  "websiteUrl": "https://peoplesearch-broker.com",
  "websiteCategory": "OTHER"
}
```
- **Success Response (HTTP 201 Created):**
```json
{
  "success": true,
  "message": "Website registered successfully",
  "data": {
    "id": "f18884f7-db3c-4e1f-8285-5acb7bb13134",
    "userId": "e81c35a7-5774-4a0e-bf9d-17075e79fcdc",
    "websiteName": "PeopleSearch Broker",
    "websiteUrl": "https://peoplesearch-broker.com",
    "websiteCategory": "OTHER",
    "createdAt": "2026-11-03T09:38:14.154Z",
    "updatedAt": "2026-11-03T09:38:14.154Z"
  }
}
```
- **Error Responses:**
  - `409 Conflict`: `"A website with this URL has already been registered in your account"`

---

### 3.2. List Websites
- **Method & Path:** `GET /api/v1/websites`
- **Authentication:** Required.
- **Query Parameters:**
  - `page`: Integer >= 1 (default: 1)
  - `limit`: Integer 1–100 (default: 20)
  - `search`: Substring search on name or URL
  - `category`: Filter by `WebsiteCategory` enum
  - `sortBy`: `websiteName` | `createdAt` (default: `createdAt`)
  - `sortOrder`: `asc` | `desc` (default: `desc`)
- **Success Response (HTTP 200 OK):**
```json
{
  "success": true,
  "message": "Websites retrieved successfully",
  "data": [
    {
      "id": "f18884f7-db3c-4e1f-8285-5acb7bb13134",
      "websiteName": "PeopleSearch Broker",
      "websiteUrl": "https://peoplesearch-broker.com",
      "websiteCategory": "OTHER",
      "createdAt": "2026-11-03T09:38:14.154Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 3.3. Get Single Website
- **Method & Path:** `GET /api/v1/websites/:id`
- **Authentication:** Required.
- **Tenant Rules:** Returns `404 Not Found` if the website does not exist OR belongs to another user (IDOR defense).
- **Success Response (HTTP 200 OK):** Single website object in `data`.

---

### 3.4. Update Website
- **Method & Path:** `PATCH /api/v1/websites/:id`
- **Authentication:** Required.
- **Request Body:** `{ "websiteName"?: string, "websiteUrl"?: string, "websiteCategory"?: enum }`
- **Success Response (HTTP 200 OK):** Updated website object.

---

### 3.5. Delete Website
- **Method & Path:** `DELETE /api/v1/websites/:id`
- **Authentication:** Required.
- **Behavior:** Cascades deletion to child exposures, removals, and reminders belonging to this website.
- **Success Response (HTTP 200 OK):**
```json
{
  "success": true,
  "message": "Website deleted successfully"
}
```

---

## 4. Exposure Records API (`/api/v1/exposures`)

Catalogs specific personal information records exposed to third-party platforms.

### 4.1. Create Exposure Record
- **Method & Path:** `POST /api/v1/exposures`
- **Authentication:** Required.
- **Tenant Rules:** `websiteId` must belong to the authenticated user. Injected `userId` is rejected.
- **Validation:** `websiteId` (UUID), `purpose` (string), `sensitivityLevel` (`LOW` | `MEDIUM` | `HIGH` | `CRITICAL`), `dateShared` (ISO date), `categoryIds` (array of UUIDs).
- **Request Body:**
```json
{
  "websiteId": "f18884f7-db3c-4e1f-8285-5acb7bb13134",
  "purpose": "Public Directory Listing",
  "sensitivityLevel": "HIGH",
  "dateShared": "2026-01-15T00:00:00.000Z",
  "notes": "Home address and phone publicly indexed",
  "categoryIds": ["071e626e-9418-4e19-a1b4-2dfebbc0a498"]
}
```
- **Success Response (HTTP 201 Created):**
```json
{
  "success": true,
  "message": "Exposure record created successfully",
  "data": {
    "id": "97c40aeb-b688-4292-ba08-b1b70c0ae216",
    "userId": "e81c35a7-5774-4a0e-bf9d-17075e79fcdc",
    "websiteId": "f18884f7-db3c-4e1f-8285-5acb7bb13134",
    "purpose": "Public Directory Listing",
    "sensitivityLevel": "HIGH",
    "recordStatus": "ACTIVE",
    "calculatedRiskScore": 25,
    "calculatedRiskRating": "HIGH",
    "categories": [ ... ]
  }
}
```

---

### 4.2. List Exposure Records
- **Method & Path:** `GET /api/v1/exposures`
- **Query Parameters:** `page`, `limit`, `websiteId`, `sensitivityLevel`, `recordStatus` (`ACTIVE` | `REMOVAL_REQUESTED` | `REMOVED` | `ARCHIVED`).
- **Success Response (HTTP 200 OK):** Paginated array with metadata.

---

### 4.3. Associate Categories to Exposure
- **Method & Path:** `POST /api/v1/exposures/:id/categories`
- **Request Body:**
```json
{
  "categoryIds": ["071e626e-9418-4e19-a1b4-2dfebbc0a498", "67b84db5-c0d1-447a-80bb-26466f2c0da4"]
}
```
- **Success Response (HTTP 200 OK):** Returns updated exposure with re-computed dynamic risk score.

---

## 5. Reference Data Categories API (`/api/v1/categories`)

Global, read-only reference data classifying categories of personal information and baseline risk weights.

### 5.1. List Categories
- **Method & Path:** `GET /api/v1/categories`
- **Authentication:** Required.
- **Query Parameters:** `search`, `sensitivity`, `minRiskWeight`.
- **Success Response (HTTP 200 OK):** Array of all 12 seeded categories (Email, Phone, Home Address, Financial, SSN/Govt ID, etc.).

---

### 5.2. Get Single Category
- **Method & Path:** `GET /api/v1/categories/:id`
- **Authentication:** Required.
- **Success Response (HTTP 200 OK):** Single category object with `name`, `riskWeight`, and `description`.

---

## 6. Removal Requests & History API (`/api/v1/removal-requests`)

Manages formal GDPR Article 17 (Right to be Forgotten) and CCPA deletion requests.

### 6.1. Initiate Removal Request
- **Method & Path:** `POST /api/v1/removal-requests`
- **Authentication:** Required.
- **Tenant Rules:** Both `websiteId` and `exposureRecordId` must belong to the calling user.
- **Request Body:**
```json
{
  "websiteId": "f18884f7-db3c-4e1f-8285-5acb7bb13134",
  "exposureRecordId": "97c40aeb-b688-4292-ba08-b1b70c0ae216",
  "requestType": "GDPR_ERASURE",
  "requestReason": "Exercise of Article 17 Right to be Forgotten",
  "externalReference": "TICKET-2026-9811"
}
```
- **Success Response (HTTP 201 Created):**
```json
{
  "success": true,
  "message": "Removal request created successfully",
  "data": {
    "id": "8a803af5-23c8-4b0b-bd16-69ebc68930fd",
    "requestStatus": "DRAFT",
    "trackingToken": "OB-REM-8A803AF5",
    "createdAt": "2026-11-03T09:38:14.406Z"
  }
}
```

---

### 6.2. Transition Request Status
- **Method & Path:** `PATCH /api/v1/removal-requests/:id`
- **Authentication:** Required.
- **State Machine Validation:**
  - Allowed transitions: `DRAFT` ➔ `SUBMITTED`, `ACKNOWLEDGED` ➔ `IN_PROGRESS` ➔ `COMPLETED`.
  - Illegal status jumps return `422 Unprocessable Entity`.
- **Request Body:**
```json
{
  "requestStatus": "SUBMITTED",
  "remarks": "Submitted formal email request to privacy officer"
}
```
- **Success Response (HTTP 200 OK):** Updated request with new status and atomic history log created.

---

### 6.3. Get Removal Request History
- **Method & Path:** `GET /api/v1/removal-requests/:id/history`
- **Authentication:** Required.
- **Success Response (HTTP 200 OK):** Chronological, immutable audit trail of all previous status transitions.

---

## 7. Reminders API (`/api/v1/reminders`)

Tracks follow-up deadlines for privacy removal requests.

### 7.1. Create Reminder
- **Method & Path:** `POST /api/v1/reminders`
- **Request Body:**
```json
{
  "removalRequestId": "8a803af5-23c8-4b0b-bd16-69ebc68930fd",
  "reminderDate": "2026-12-01T00:00:00.000Z",
  "reminderType": "STATUTORY_DEADLINE",
  "title": "GDPR 30-Day Response Deadline",
  "notes": "Follow up if data broker has not responded"
}
```
- **Success Response (HTTP 201 Created):** Returns created reminder.

---

## 8. Notifications API (`/api/v1/notifications`)

In-app alerts for status updates, reminder triggers, and system notices.

### 8.1. List Notifications
- **Method & Path:** `GET /api/v1/notifications`
- **Query Parameters:** `page`, `limit`, `isRead` (`true` | `false`).
- **Success Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "e2ba9c83-ff01-4475-8bf1-ef377c8e7ad4",
      "title": "Removal Request Submitted",
      "message": "Your GDPR erasure request has been submitted",
      "notificationType": "STATUS_UPDATE",
      "isRead": false,
      "createdAt": "2026-11-03T09:38:14.444Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "unreadCount": 1
  }
}
```

---

### 8.2. Mark Notification as Read
- **Method & Path:** `PATCH /api/v1/notifications/:id/read`
- **Success Response (HTTP 200 OK):** Updated notification with `isRead: true`.

---

### 8.3. Mark All Notifications as Read
- **Method & Path:** `PATCH /api/v1/notifications/read-all`
- **Success Response (HTTP 200 OK):** `{ "success": true, "message": "All notifications marked as read", "data": { "count": 3 } }`

---

## 9. Dashboard Analytics API (`/api/v1/dashboard`)

Real-time aggregated privacy posture metrics for the authenticated user.

### 9.1. Aggregated Overview
- **Method & Path:** `GET /api/v1/dashboard/overview`
- **Success Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": {
    "totalWebsites": 5,
    "totalExposures": 8,
    "activeExposures": 6,
    "resolvedExposures": 2,
    "totalRemovals": 4,
    "pendingRemovals": 2,
    "completedRemovals": 2,
    "privacyExposureIndex": 48,
    "privacyHealthRating": "MODERATE_RISK"
  }
}
```

---

## 10. Audit Logs & Compliance API (`/api/v1/audit-logs`)

Centralized audit log trail and user data portability export.

### 10.1. List Audit Logs
- **Method & Path:** `GET /api/v1/audit-logs`
- **Query Parameters:** `page`, `limit`, `action`, `entityType`, `startDate`, `endDate`, `sortBy`, `sortOrder`.
- **Success Response (HTTP 200 OK):** Paginated list of user's security and data lifecycle events.

---

### 10.2. Export Compliance Report (GDPR Art. 15 / CCPA)
- **Method & Path:** `GET /api/v1/audit-logs/export`
- **Success Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": {
    "exportedAt": "2026-11-03T09:38:15.000Z",
    "userId": "e81c35a7-5774-4a0e-bf9d-17075e79fcdc",
    "complianceFrameworks": ["GDPR Article 15 (Right of Access)", "CCPA Section 1798.100"],
    "totalEvents": 18,
    "events": [ ... ]
  }
}
```

---

## 11. Health & Readiness Endpoints

### 11.1. Root Health Check
- **Method & Path:** `GET /health`
- **Authentication:** None (Public).
- **Success Response (HTTP 200 OK):**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-11-03T09:43:12.019Z",
  "latencyMs": 4
}
```

### 11.2. API Subsystem Health Check
- **Method & Path:** `GET /api/v1/health`
- **Authentication:** None (Public).
- **Success Response (HTTP 200 OK):** Returns system uptime, environment, and version information.
