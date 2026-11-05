# OBLIVION – Centralized Audit Logging & Compliance Architecture (Phase 5)

**Project:** OBLIVION – The Internet's Forget Button  
**Engine:** Node.js 24 + Express 5 + TypeScript  
**Database:** PostgreSQL 18.6 (`oblivion_db`)  
**ORM:** Prisma ORM 6.19.3  
**Security Framework:** Centralized Multi-Tenant Boundary + Zero-Leak Audit Engine  
**Compliance Standards:** GDPR Article 15 (Right of Access), GDPR Article 17 (Right to Erasure), CCPA § 1798.100

---

## 1. Executive Summary

Phase 5 establishes a tamper-evident, centralized audit logging and compliance reporting system for the OBLIVION privacy management platform. Every security-critical user event—including authentication, credential verification, resource modifications (websites, exposures, removal requests, reminders, notifications), and account security state transitions—is recorded in PostgreSQL with strict tenant boundary enforcement.

The audit subsystem is engineered with two non-negotiable principles:
1. **Fault-Tolerant & Non-Disruptive Execution:** An audit write failure or transient database anomaly will **never** roll back, disrupt, or abort a user's primary business transaction.
2. **Zero Sensitive Credential Ingestion:** Passwords, password hashes, JWT access tokens, and sensitive personal identifiers are strictly forbidden from appearing in audit log entries or log output.

---

## 2. PostgreSQL Database Schema

The audit log system maps to the production PostgreSQL `audit_logs` table managed by Prisma ORM:

```prisma
model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  action     String   @db.VarChar(100)
  entityType String   @map("entity_type") @db.VarChar(100)
  entityId   String   @map("entity_id") @db.VarChar(64)
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  // Cascade deletion with tenant user lifecycle
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([action])
  @@index([entityType])
  @@index([createdAt])
  @@map("audit_logs")
}
```

### Relational Schema Properties:
- **`id` (`UUID`):** Primary key generated via RFC 4122 v4 UUID.
- **`user_id` (`UUID`, Foreign Key):** References `users.id` with `ON DELETE CASCADE`. If a tenant user deletes their account (GDPR Art. 17 right to erasure), all associated audit logs are purged in the same transaction.
- **`action` (`VarChar(100)`):** Standardized, machine-readable event classification (indexed for high-throughput compliance queries).
- **`entity_type` (`VarChar(100)`):** The target domain model (e.g. `User`, `Website`, `ExposureRecord`, `RemovalRequest`, `Reminder`, `Notification`).
- **`entity_id` (`VarChar(64)`):** The identifier of the entity affected by the event.
- **`created_at` (`Timestamptz`):** Monotonically advancing UTC timestamp representing when the event was recorded.

---

## 3. Standardized Event Action Catalog

| Action Identifier | Target Entity Type | Description | Trigger Location |
| :--- | :--- | :--- | :--- |
| `AUTH_REGISTER` | `User` | User account registration | `AuthService.register` |
| `AUTH_LOGIN_SUCCESS` | `User` | Successful authentication with valid credentials | `AuthService.login` |
| `AUTH_LOGIN_FAILED` | `User` | Failed login attempt (password mismatch) | `AuthService.login` |
| `SECURITY_ACCOUNT_SUSPENDED` | `User` | Login blocked due to suspended account | `AuthService.login` |
| `SECURITY_ACCOUNT_DEACTIVATED` | `User` | Login blocked due to deactivated account | `AuthService.login` |
| `WEBSITE_CREATED` | `Website` | Registration of a new tracked website | `WebsiteService.createWebsite` |
| `WEBSITE_UPDATED` | `Website` | Update to website URL, name, or category | `WebsiteService.updateWebsite` |
| `WEBSITE_DELETED` | `Website` | Deletion of a website record | `WebsiteService.deleteWebsite` |
| `EXPOSURE_CREATED` | `ExposureRecord` | Creation of a new exposure tracking record | `ExposureService.createExposure` |
| `EXPOSURE_UPDATED` | `ExposureRecord` | Update of sensitivity, dates, or notes | `ExposureService.updateExposure` |
| `EXPOSURE_DELETED` | `ExposureRecord` | Deletion of an exposure record | `ExposureService.deleteExposure` |
| `REMOVAL_REQUEST_CREATED` | `RemovalRequest` | Creation of privacy erasure request | `RemovalRequestService.createRemovalRequest` |
| `REMOVAL_STATUS_UPDATED` | `RemovalRequest` | Status lifecycle progression | `RemovalRequestService.updateRemovalRequest` |
| `REMINDER_CREATED` | `Reminder` | Creation of privacy review reminder | `ReminderService.createReminder` |
| `REMINDER_UPDATED` | `Reminder` | Update or completion of reminder | `ReminderService.updateReminder` |
| `REMINDER_DELETED` | `Reminder` | Removal of reminder | `ReminderService.deleteReminder` |
| `NOTIFICATION_READ` | `Notification` | Single notification marked as read | `NotificationService.markAsRead` |
| `NOTIFICATIONS_ALL_READ` | `Notification` | Bulk read-all of user notifications | `NotificationService.markAllAsRead` |

---

## 4. Architecture & Engineering Principles

### 4.1 Fault-Tolerant, Non-Blocking Execution
Audit logging is decoupled from user business transactions. In `AuditLogService.record(...)`:
```typescript
static async record(input: RecordAuditLogDTO): Promise<AuditLog | null> {
  try {
    const sanitizedAction = String(input.action).slice(0, 100);
    const sanitizedEntityType = String(input.entityType).slice(0, 100);
    const sanitizedEntityId = String(input.entityId).slice(0, 64);

    return await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: sanitizedAction,
        entityType: sanitizedEntityType,
        entityId: sanitizedEntityId,
      },
    });
  } catch (error: any) {
    logger.error(`[Audit Failure] Failed to record audit log: ${error.message}`, {
      userId: input.userId,
      action: input.action,
    });
    return null;
  }
}
```
If an error occurs during audit persistence (e.g. database connection timeout or foreign key constraint violation), the error is caught, securely recorded via `logger.error`, and `null` is returned without throwing an unhandled exception or aborting the primary user action.

### 4.2 Credential Protection & Sanitization
- **No Password Exposure:** In `AUTH_LOGIN_FAILED`, only the user ID, action, and entity type are recorded. The submitted invalid password is **never** passed to the audit service or logger.
- **Unknown Email Handling:** For login attempts with unknown/unregistered emails, no database insertion is performed (preventing foreign key constraint errors). The event is logged solely to the structured system logger with generic messaging.
- **Log Sanitizer:** All structured logger outputs pass through `src/utils/logger.ts`, which automatically redacts keys matching `password`, `passwordHash`, `token`, `authorization`, `secret`, and `jwt`.

---

## 5. API Reference & Endpoints

All audit log endpoints are mounted under `/api/v1/audit-logs` and require an authenticated tenant JWT:
`Authorization: Bearer <token>`

### 5.1 GET `/api/v1/audit-logs`
Retrieves a paginated list of audit records belonging strictly to the authenticated tenant.

**Query Parameters:**
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | Integer | `1` | Page number (1-based) |
| `limit` | Integer | `20` | Results per page (max 100) |
| `action` | String | `undefined` | Case-insensitive substring filter on event action |
| `entityType` | String | `undefined` | Filter by entity type (`User`, `Website`, etc.) |
| `startDate` | ISO 8601 String | `undefined` | Filter records on or after this timestamp (`gte`) |
| `endDate` | ISO 8601 String | `undefined` | Filter records on or before this timestamp (`lte`) |
| `sortBy` | String | `createdAt` | Sort attribute |
| `sortOrder` | String | `desc` | Sort direction (`asc` or `desc`) |

**Sample Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Audit logs retrieved successfully",
  "data": [
    {
      "id": "24a70dc7-9ccf-4e92-9417-a3a1806d7349",
      "userId": "1c370b8b-899d-4f49-989f-87a935ccb731",
      "action": "WEBSITE_CREATED",
      "entityType": "Website",
      "entityId": "2245dda3-54fa-43c9-a097-902678a176ce",
      "createdAt": "2026-11-03T09:00:26.971Z"
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

### 5.2 GET `/api/v1/audit-logs/summary`
Returns aggregated compliance metrics and an event breakdown for the tenant.

**Sample Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Audit log compliance summary retrieved successfully",
  "data": {
    "totalEvents": 18,
    "actionBreakdown": {
      "AUTH_REGISTER": 1,
      "AUTH_LOGIN_SUCCESS": 1,
      "AUTH_LOGIN_FAILED": 1,
      "WEBSITE_CREATED": 2,
      "WEBSITE_UPDATED": 1,
      "WEBSITE_DELETED": 1,
      "EXPOSURE_CREATED": 2,
      "EXPOSURE_UPDATED": 1,
      "EXPOSURE_DELETED": 1,
      "REMOVAL_REQUEST_CREATED": 1,
      "REMOVAL_STATUS_UPDATED": 1,
      "REMINDER_CREATED": 1,
      "REMINDER_UPDATED": 1,
      "REMINDER_DELETED": 1,
      "NOTIFICATION_READ": 1,
      "NOTIFICATIONS_ALL_READ": 1
    },
    "entityBreakdown": {
      "User": 3,
      "Website": 4,
      "ExposureRecord": 4,
      "RemovalRequest": 2,
      "Reminder": 3,
      "Notification": 2
    },
    "firstActivity": "2026-11-03T09:00:23.923Z",
    "lastActivity": "2026-11-03T09:00:28.188Z"
  }
}
```

---

### 5.3 GET `/api/v1/audit-logs/export`
Generates a structured compliance export complying with **GDPR Article 15 (Right of Access)** and **CCPA § 1798.100**.

**Sample Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Compliance audit report generated successfully",
  "data": {
    "complianceReport": {
      "title": "OBLIVION Privacy Audit Trail - Right to Access (GDPR Art. 15 / CCPA)",
      "regulation": "GDPR Article 15 (Right of Access) & CCPA Section 1798.100",
      "generatedAt": "2026-11-03T09:00:28.195Z",
      "tenant": {
        "userId": "1c370b8b-899d-4f49-989f-87a935ccb731",
        "email": "alice_audit_1793696423902@oblivion.internal",
        "fullName": "Alice Audit Tenant"
      },
      "totalAuditEntries": 18,
      "auditLogs": [ ... ]
    }
  }
}
```

---

### 5.4 GET `/api/v1/audit-logs/:id`
Retrieves a single audit log entry by UUID.

- **Success (`200 OK`):** Returns the requested log entry if it belongs to the authenticated user.
- **IDOR Defense (`404 Not Found`):** If the requested `id` belongs to another tenant or does not exist, a uniform `404 Not Found` is returned.

---

## 6. Strict Multi-Tenant Security & Ownership Enforcement

Audit logs strictly follow the **Zero-Trust Multi-Tenant Architecture** established in Phase 3:
1. **No Injected User Identifiers:** The `userId` is never trusted from query parameters, request bodies, or route headers. It is derived exclusively from the verified JWT payload (`req.user.id`).
2. **PostgreSQL-Level Isolation:** All database read queries include `{ where: { userId } }`, ensuring physical tenant data separation.
3. **IDOR Defense (Information Disclosure Prevention):** Attempts to view another tenant's audit log entry by UUID return `404 Not Found` rather than `403 Forbidden`, preventing attackers from enumerating valid log identifiers.
4. **Cascade Deletion:** When a user account is deleted, foreign key constraints (`ON DELETE CASCADE`) ensure that all audit entries belonging to that user are cleanly deleted from PostgreSQL.
