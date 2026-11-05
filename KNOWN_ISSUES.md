# OBLIVION – Known Issues, Architectural Trade-offs & Limitations

**Platform:** OBLIVION – The Internet's Forget Button  
**Version:** Phase 6 Integration Baseline  
**Scope:** Backend Services, Authentication, Multi-Tenancy, Audit Logging & Database Layer  
**Document Status:** Production Transparency & Technical Debt Inventory

---

## 1. Overview

This document provides a transparent, honest assessment of the known architectural trade-offs, operational limits, and intentional design choices present in the OBLIVION backend as of Phase 6. None of these items represent security vulnerabilities or broken functionality under the current single-instance design, but they are critical to document for future production scaling.

---

## 2. Inventory of Architectural Trade-offs & Limitations

### 2.1. Stateless JWT Token Revocation Boundary
- **Current Behavior:**  
  The authentication system utilizes stateless JSON Web Tokens (HS256) signed with `JWT_SECRET` and set to expire based on `JWT_EXPIRES_IN` (default 7 days). When a user logs out via `POST /api/v1/auth/logout`, the server records an `AUTH_LOGOUT` audit log event and returns instructions for client-side token discard.
- **Architectural Trade-off:**  
  Because the backend does not maintain a server-side token revocation blacklist (e.g. in Redis), a previously issued JWT token remains cryptographically valid until its expiration timestamp unless the user account is explicitly deactivated in the database (`status = DEACTIVATED`, which is checked on every authenticated request).
- **Impact:**  
  If a valid JWT is exfiltrated from a client device before logout, an attacker with the token could continue making API requests until token expiration, even after the legitimate user has clicked "Logout".
- **Recommended Future Enhancement:**  
  1. Add a `tokenVersion: Int @default(0)` field to the `User` model, incremented upon password change or logout, and validated during JWT verification.
  2. Or, introduce a Redis-backed token blacklist with TTL matching the remaining token lifetime.

---

### 2.2. Audit Log Delivery Guarantees Under Database Outages
- **Current Behavior:**  
  `AuditLogService.record` asynchronously inserts audit events into the PostgreSQL `audit_logs` table. To adhere to the requirement that audit logging failures must never disrupt or abort primary user transactions, exceptions during audit writes are caught, recorded to `logger.error` (`[Audit Failure]`), and suppressed.
- **Architectural Trade-off:**  
  The audit subsystem operates under a **best-effort delivery model** with direct-to-database writes. There is no transactional outbox table or durable message queue (such as Apache Kafka, RabbitMQ, or AWS SQS) buffering audit events.
- **Impact:**  
  If the PostgreSQL database experiences a momentary connection timeout, network partition, or storage quota failure specifically during an audit log insertion, the audit record will be logged to server console/file logs, but will not be retried or persisted to the relational database table.
- **Recommended Future Enhancement:**  
  Implement the Transactional Outbox Pattern:
  - Write audit events to an `audit_outbox` table within the same database transaction as the primary entity mutation.
  - A background worker polls and dispatches outbox events to the permanent compliance store, ensuring guaranteed at-least-once delivery.

---

### 2.3. In-Memory Sliding Window Rate Limiting (Horizontal Scaling Boundary)
- **Current Behavior:**  
  Rate limiting on `/api/v1/auth/register` and `/api/v1/auth/login` is implemented using an in-process sliding-window memory store (`src/middleware/rate-limiter.middleware.ts`).
- **Architectural Trade-off:**  
  In-memory rate limiting requires no external infrastructure dependencies (such as Redis or Memcached), keeping local deployment, testing, and single-instance servers lightweight and reliable.
- **Impact:**  
  If the backend application is deployed in a horizontally scaled cluster (e.g. multiple Kubernetes pods or multiple AWS ECS tasks behind a load balancer), each node maintains its own independent memory counter. An attacker distributing requests across multiple nodes could exceed the intended 10 req/min threshold.
- **Recommended Future Enhancement:**  
  Migrate the rate-limiting storage adapter to a distributed Redis cluster using standard algorithms (token bucket or sliding log via `ioredis` / `rate-limiter-flexible`).

---

### 2.4. Audit Log Cryptographic Tamper-Evidence & Regulatory Certification Scope
- **Current Behavior:**  
  The audit logging system stores records in an append-only relational table in PostgreSQL. The public API exposes only read, filter, and export endpoints (`/api/v1/audit-logs`, `/export`, `/summary`), preventing regular users from updating or deleting logs.
- **Architectural Scope & Limitations:**  
  1. *No Cryptographic Hashing or Merkle Trees:* Audit logs are not cryptographically sealed, hashed into a blockchain, or chained via digital signatures. Direct database administrators with privileged credentials can modify or delete database rows directly in PostgreSQL.
  2. *Regulatory Certification:* The export endpoint `/api/v1/audit-logs/export` provides a structured, machine-readable JSON representation of user data events to support operational compliance with GDPR Article 15 (Right of Access) and CCPA Section 1798.100. It is a technical integration feature and does not constitute certified legal accreditation or an independent privacy compliance seal.
- **Guidance:**  
  In production environments requiring non-repudiation and forensic-grade tamper-evidence, configure PostgreSQL Write-Ahead Log (WAL) shipping or continuous log streaming to an immutable write-once-read-many (WORM) cloud storage service (e.g. AWS S3 Glacier with Object Lock).

---

### 2.5. Test Suite Concurrency & Shared Local Database
- **Current Behavior:**  
  All 12 automated test suites connect to the same local PostgreSQL database instance (`oblivion_db` on port 5432). Each suite generates uniquely timestamped user accounts (e.g. `test-${Date.now()}-e2e@example.com`) and cleans up its data via cascading deletes upon completion.
- **Operational Constraint:**  
  If multiple test suites are launched simultaneously in parallel processes (e.g. running `npm run test:phase4` and `npm run test:phase6` at the exact same instant), PostgreSQL row locks or duplicate timestamp collisions may occasionally cause transient race conditions.
- **Guidance:**  
  Run test suites sequentially using the provided master harnesses (`npm run test:phase4`, `npm run test:phase6`, or individual test scripts). For continuous integration (CI) pipelines, assign an isolated ephemeral database container per parallel runner.

---

## 3. Summary of Mitigations in Place

| Identified Item | Current Risk Level | Active Mitigation in Place |
| :--- | :--- | :--- |
| **Stateless JWT Lifetime** | Low - Medium | Account deactivation checks immediately invalidate sessions; tokens expire automatically after configured `JWT_EXPIRES_IN`. |
| **Audit Delivery During Outages**| Low | All write errors captured in system logs with full event payload; primary database transactions remain healthy. |
| **Audit Cryptographic Proof** | Informational | API enforces read-only access for users; WORM storage recommended for enterprise forensic requirements. |
| **In-Memory Rate Limiting** | Low | Provides full brute-force protection for single-node and local deployments. |
| **Test Concurrency** | Negligible | Master runners execute test suites in deterministic serial order. |
