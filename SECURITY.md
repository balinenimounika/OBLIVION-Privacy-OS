# OBLIVION – Security, Privacy & Vulnerability Posture

**Platform:** OBLIVION – The Internet's Forget Button  
**Engine:** Node.js 24 + Express 5 + TypeScript 5.7  
**Database:** PostgreSQL 18.6 via Prisma ORM 6.19.3  
**Status:** Baseline Audited & Verified (20/20 Security Tests Passing)

---

## 1. Authentication & Identity Management

### 1.1. Password Hashing & Salt Rounds
- User passwords are never stored in plaintext.
- Passwords are hashed using `bcryptjs` with a work factor of **12 salt rounds** (`$2b$12$...`).
- Passwords must meet strict minimum complexity requirements validated via Zod:
  - Minimum 8 characters.
  - At least one uppercase letter.
  - At least one lowercase letter.
  - At least one numerical digit.
- Password hashes are strictly omitted from Prisma `select` projections and stripped from all JSON responses.

### 1.2. JSON Web Token (JWT) Security
- Authentication tokens are cryptographically signed using **HMAC SHA-256 (HS256)** via `jsonwebtoken`.
- Token payload contains minimal non-sensitive identity claims:
  - `sub`: User UUID
  - `email`: Normalized user email address
  - `iat` / `exp`: Issued-at and expiration timestamps (configured via `JWT_EXPIRES_IN`, default: `7d`).
- **Cryptographic Verification:** Every private endpoint validates token signature against `JWT_SECRET`. Tampered or forged signatures are rejected with `HTTP 401 Unauthorized`.
- **Account State Verification:** Each authenticated request performs a lightweight query against the database to confirm the user account is not `SUSPENDED` or `DEACTIVATED`. Deactivated accounts are blocked with `HTTP 403 Forbidden`.

### 1.3. Token Revocation Boundary & Limitation (Honest Disclosure)
- Tokens operate statelessly. When a user calls `POST /api/v1/auth/logout`, the server records an `AUTH_LOGOUT` audit log and directs the client to discard its token.
- **Architectural Limitation:** Because the platform does not currently deploy a centralized Redis-backed token blacklist, an exfiltrated token remains cryptographically valid until its expiration timestamp unless the account is explicitly deactivated in the database.
- **Production Recommendation:** For enterprise environments requiring immediate token invalidation, deploy a Redis token blacklist or implement a `tokenVersion` integer column on the `User` model.

---

## 2. Multi-Tenant Isolation & IDOR Defenses

### 2.1. Insecure Direct Object Reference (IDOR) Mitigation
- In a privacy management platform, confirming whether a resource exists can leak sensitive personal information.
- All database lookups across websites, exposures, removal requests, reminders, notifications, and audit logs enforce composite filtering:
  ```typescript
  where: { id: resourceId, userId: req.user.id }
  ```
- If a resource does not exist OR belongs to another tenant, the system returns **`HTTP 404 Not Found`**.
- This uniform 404 response eliminates resource existence enumeration.

### 2.2. Anti-Injection / Mass-Assignment Defense
- The middleware `rejectInjectedTenantFields` intercepts all incoming requests.
- Specifying `userId` or `user_id` in request bodies or query parameters is rejected with `HTTP 422 Unprocessable Entity`.
- Zod schemas explicitly define allowed input attributes, stripping or rejecting unrecognized keys.

---

## 3. Injection Defenses & Input Sanitization

### 3.1. SQL Injection Immunity
- All relational database interactions are routed through **Prisma ORM 6.19.3**, which compiles database operations into parameterized SQL statements with positional placeholders (`$1`, `$2`).
- SQL injection vectors (e.g. `' OR '1'='1`, `'; DROP TABLE users; --`) are treated as literal strings and cannot escape query parameters.
- Path parameters are validated against standard RFC 4122 UUID v4 regular expressions (`validateUuidParam`) before executing database queries, blocking malformed inputs with `HTTP 400 Bad Request`.

### 3.2. Cross-Site Scripting (XSS) & Content Handling
- **API Transport:** The API returns structured JSON with `Content-Type: application/json; charset=utf-8`. Browsers do not parse JSON responses as HTML or execute embedded scripts.
- **Security Headers:** `helmet` applies strict security headers:
  - `Content-Security-Policy`: Default restrictive policy.
  - `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
  - `X-Frame-Options: SAMEORIGIN`: Defends against clickjacking.
- **Limitation & Frontend Contract:** The backend stores user text as submitted without mutating characters into HTML entities (e.g. `<` is stored as `<`). Frontend applications rendering these strings must use standard framework escaping (e.g. React JSX `{variable}`) and must **never** inject raw text into `dangerouslySetInnerHTML`.

---

## 4. Rate Limiting & Denial-of-Service (DoS) Defenses

### 4.1. Authentication Rate Limiter
- An in-memory sliding window rate limiter protects `POST /api/v1/auth/register` and `POST /api/v1/auth/login`.
- Configured threshold: 100 requests per 15-minute sliding window per client IP.
- Emits standard compliance headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After`.
- Exceeding the threshold returns `HTTP 429 Too Many Requests`.
- **Limitation:** In-memory storage is per-process. Horizontally scaled instances behind a load balancer will track requests independently. Deploying Redis-backed rate limiting (`rate-limiter-flexible`) is recommended for multi-node deployments.

### 4.2. Payload Size Boundaries
- Body parsers enforce a strict 1MB size threshold:
  ```typescript
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  ```
- Payloads exceeding 1MB are intercepted by error handling middleware and rejected with `HTTP 413 Payload Too Large`.
- Malformed JSON payloads are intercepted and rejected with `HTTP 400 Bad Request`.

---

## 5. Audit Logging Reliability & Compliance Scope

### 5.1. Non-Blocking Delivery Architecture
- The centralized `AuditLogService` persists audit events to the PostgreSQL `audit_logs` table asynchronously.
- Write exceptions are caught and recorded to `logger.error('[Audit Failure]')` without throwing uncaught exceptions.
- **Core Guarantee:** Failures in audit logging will never abort or roll back primary user business flows.

### 5.2. Honest Architectural Assessment: Outages & Compliance Scope
- **Database Outage Behavior:** In the event of a total PostgreSQL outage, audit records cannot be written to the database. Because the application currently does not feature a persistent transactional outbox table or durable message broker (Kafka/RabbitMQ), these failed write attempts are logged to server output but are not retried to PostgreSQL.
- **Non-Cryptographic Storage:** The `audit_logs` table is an append-only relational table at the application layer (no update/delete endpoints exist), but does **not** employ cryptographic hashing, Merkle trees, or digital signatures. Database administrators with direct SQL credentials can modify rows.
- **Compliance Scope:** The `/api/v1/audit-logs/export` endpoint provides structured JSON exports to assist in operational data access requests aligned with GDPR Article 15 (Right of Access) and CCPA Section 1798.100. It is a technical utility and does **not** constitute an official legal certification or independent regulatory accreditation.

---

## 6. Production Security Checklist

When deploying OBLIVION to a production cloud environment, implement the following infrastructure safeguards:

1. **Enforce HTTPS / TLS 1.3:** Place the application behind a reverse proxy (Nginx, AWS ALB, Cloudflare) that terminates TLS and redirects all HTTP traffic to HTTPS.
2. **Rotate Secrets:** Generate a cryptographically random `JWT_SECRET` of at least 32 characters and store it in a secure secret manager (AWS Secrets Manager, HashiCorp Vault).
3. **Explicit CORS:** Replace any wildcard or development CORS origins in `CORS_ORIGIN` with the exact fully qualified production web domain.
4. **Distributed Cache (Redis):** Add Redis to back the rate-limiting middleware and implement an active JWT revocation blacklist.
5. **Transactional Outbox:** Migrate audit event publishing to an outbox pattern for guaranteed at-least-once delivery during database failures.
6. **Immutable Log Shipping:** Stream application and PostgreSQL logs to a WORM (Write-Once-Read-Many) compliance repository (e.g. AWS S3 Glacier with Object Lock).
