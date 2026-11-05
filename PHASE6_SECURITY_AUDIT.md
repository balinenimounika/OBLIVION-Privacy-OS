# OBLIVION – Phase 6 Security & Vulnerability Audit

**Platform:** OBLIVION – The Internet's Forget Button  
**Target:** Live Node.js 24 + Express 5 Backend + PostgreSQL 18.6 Database  
**Audit Scope:** Authentication, Authorization, Multi-Tenant Isolation, Input Validation, Injection Defenses, Rate Limiting, Credential Hygiene  
**Verification Date:** November 2026  
**Auditor:** Senior Security Architect & Backend Engineering Specialist  
**Status:** ✅ ALL 20 DEDICATED SECURITY TESTS PASSED (100% DEFENSE RATE)

---

## 1. Executive Summary

This Security Audit document details the penetration testing, vulnerability assessment, and threat modeling conducted during Phase 6 of the OBLIVION platform. All tests were executed against the live application connected to PostgreSQL 18.6 (`oblivion_db`).

The OBLIVION backend enforces a defense-in-depth posture:
1. **Network & Protocol Layer:** Strict Helmet security headers, CORS origin locking, and request payload size boundaries.
2. **Authentication Layer:** HS256-signed JWTs with expiration checking, bcrypt password hashing (work factor 12), and sliding-window rate limiting.
3. **Authorization & Tenant Layer:** Reusable `TenantGuard` architecture ensuring user-scoped queries across all relational tables. Non-existent and cross-tenant entities return identical HTTP 404 responses to eliminate enumeration risks.
4. **Data & Persistence Layer:** Fully parameterized database queries via Prisma ORM 6.19.3 (resolved from package.json `^6.4.0`), zero-leakage credential policies, and automated audit trails.

---

## 2. Threat Modeling & Security Matrix

| Threat Category | Attack Vector Tested | Mitigation Mechanism | Test Verification Result | Risk Level |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication Bypass** | Unauthenticated requests, missing headers, invalid schemes (`Basic`, `Digest`) | `authenticateToken` middleware verifies Bearer format | Returned HTTP 401 Unauthorized | Critical ➔ **Mitigated** |
| **JWT Tampering** | Forged signature with incorrect secret key | `jwt.verify` cryptographic signature check | Returned HTTP 401 Unauthorized | Critical ➔ **Mitigated** |
| **Token Expiration** | Expired JWT token presented | Expiration claim `exp` checked by `jwt.verify` | Returned HTTP 401 Unauthorized | High ➔ **Mitigated** |
| **Deactivated Account Access**| Valid JWT presented by user marked `DEACTIVATED` | Middleware verifies `status !== 'DEACTIVATED'` against DB | Returned HTTP 403 Forbidden | High ➔ **Mitigated** |
| **IDOR (Websites)** | User B attempts to read/update/delete User A's website by UUID | `TenantGuard.findWebsiteForUser` scopes `userId` | Returned HTTP 404 Not Found | High ➔ **Mitigated** |
| **IDOR (Exposures)** | User B attempts to modify User A's exposure record | `TenantGuard.findExposureForUser` scopes `userId` | Returned HTTP 404 Not Found | High ➔ **Mitigated** |
| **IDOR (Removal Requests)** | User B attempts to inspect User A's removal request | `TenantGuard.findRemovalRequestForUser` scopes `userId` | Returned HTTP 404 Not Found | High ➔ **Mitigated** |
| **IDOR (Reminders)** | User B attempts to delete User A's reminder | `TenantGuard.findReminderForUser` scopes `userId` | Returned HTTP 404 Not Found | High ➔ **Mitigated** |
| **IDOR (Audit Logs)** | User B attempts to view User A's audit history | `TenantGuard.findAuditLogForUser` scopes `userId` | Returned HTTP 404 Not Found | High ➔ **Mitigated** |
| **Tenant Injection (Body)** | User submits malicious `userId` in POST body to reassign ownership | Zod schema whitelist strips or ignores unauthorized fields | Entity created with caller's authenticated `userId` | High ➔ **Mitigated** |
| **Tenant Injection (Query)** | User appends `?userId=<victim_id>` to query another user's list | Controller overrides query with authenticated `req.user.userId` | Returned caller's data only | High ➔ **Mitigated** |
| **Privilege Escalation** | User submits `role: "ADMIN"` or `accountStatus: "VIP"` during registration | Zod schemas strictly define allowed input shape | Injected fields stripped; default `USER` role applied | High ➔ **Mitigated** |
| **SQL Injection (Filter)** | Payload `' OR '1'='1` injected into query string parameters | Prisma ORM uses parameterized SQL queries | Payload interpreted as literal string; 0 injections | Critical ➔ **Mitigated** |
| **SQL Injection (Params)** | Malicious SQL command in URL path `/api/v1/websites/1;DROP...` | `validateUuidParam` regex check before DB invocation | Intercepted with HTTP 400 Bad Request | Critical ➔ **Mitigated** |
| **XSS Injection** | Stored script tags `<script>alert('xss')</script>` in text fields | HTML entities preserved without evaluation; strict CSP | Stored as text; safe JSON responses | Medium ➔ **Mitigated** |
| **Malformed JSON DoS** | Client sends invalid/corrupted JSON payloads | Centralized error handler intercepts `SyntaxError` | Returned HTTP 400 Bad Request | Medium ➔ **Mitigated** |
| **Oversized Payload DoS** | Client sends payloads exceeding 1MB | `express.json({ limit: '1mb' })` | Intercepted with HTTP 413 Payload Too Large | Medium ➔ **Mitigated** |
| **Pagination Clamping** | Client requests `limit=-5` or `limit=999999` to exhaust memory | Zod `.min(1).max(100).default(20)` clamps parameters | Coerced to 20 or rejected with HTTP 400 | Low ➔ **Mitigated** |
| **Brute-Force Auth** | Rapid repeated login/registration attacks | In-memory sliding window rate limiter | Intercepted with HTTP 429 Too Many Requests | High ➔ **Mitigated** |
| **Credential Leakage** | Responses or audit logs expose password hashes or JWTs | Response sanitizers explicitly delete `passwordHash` | 0 hashes or secrets found across responses and logs | High ➔ **Mitigated** |

---

## 3. Deep-Dive Security Domain Audits

### 3.1. Insecure Direct Object Reference (IDOR) & Information Disclosure
A common flaw in multi-tenant privacy applications is leaking the existence of another user's records by returning HTTP 403 Forbidden instead of HTTP 404 Not Found. If an attacker receives a 403 when querying a random UUID, they learn that the resource exists.

**OBLIVION Implementation:**
In `src/utils/tenant-guard.ts`, all lookup functions execute:
```typescript
const record = await prisma.website.findFirst({
  where: { id, userId },
});
if (!record) {
  throw new NotFoundError('Website not found');
}
```
Because the `where` clause filters on both `id` AND `userId`, an unauthorized user receives the exact same HTTP 404 response whether the record belongs to another user or does not exist at all. This guarantees total resource privacy.

### 3.2. SQL Injection & XSS Defenses
The application uses Prisma ORM 6.19.3 as its data access layer.
- **SQL Parameterization:** All dynamic queries are converted into parameterized queries with positional parameters (`$1`, `$2`), neutralizing SQL injection attempts in query strings or filter values.
- **Path Parameter Validation:** Path parameters are strictly validated using RFC 4122 UUID v4 regex checks (`validateUuidParam`) before executing any database lookup, blocking invalid formats or injection strings at the routing layer with HTTP 400.
- **XSS Protections (Distinction):** The API returns structured JSON with `Content-Type: application/json; charset=utf-8` and enforces security headers via Helmet (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`). Note: The backend stores raw strings as submitted and does not perform active HTML entity transformation/sanitization on write. It relies on context-safe JSON serialization and client-side framework escaping (e.g. React default text node binding). Rich HTML rendering without escaping must be avoided.

### 3.3. Authentication Rate Limiting
To defend against automated credential stuffing and brute-force registration scripts, a sliding-window in-memory rate limiter was deployed on:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

**Configuration:**
- Window: 60,000 ms (1 minute)
- Max requests per window: 10
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`
- Rejection status: HTTP 429 Too Many Requests

### 3.4. Credential Sanitization & Audit Hygiene
The system adheres to a strict zero-retention policy for sensitive credentials:
1. **Model Layer:** The Prisma `User` schema stores only a bcrypt-hashed representation of the user's password (`passwordHash`). Plaintext passwords are never retained in memory longer than the hashing function execution.
2. **Controller Layer:** API serialization routines strip `passwordHash` before emitting HTTP responses.
3. **Audit Log Subsystem:** `AuditLogService` scrubs `password`, `token`, `jwt`, `authorization`, and `secret` fields from metadata payloads before writing to PostgreSQL `audit_logs`.

---

## 4. Security Verification Test Suite Execution

All 20 security tests were executed via `npm run test:security` (`tests/security.test.ts`):

```
================================================================
OBLIVION PHASE 6: SECURITY & PENETRATION TEST SUITE
Target: PostgreSQL 18.6 | Target Database: oblivion_db
================================================================
✅ Test 1: Rejection of unauthenticated requests (HTTP 401)
✅ Test 2: Rejection of forged/tampered JWT tokens (HTTP 401)
✅ Test 3: Rejection of expired JWT tokens (HTTP 401)
✅ Test 4: Rejection of deactivated user access (HTTP 403)
✅ Test 5: IDOR Protection: Website cross-tenant access returns 404
✅ Test 6: IDOR Protection: Exposure record cross-tenant access returns 404
✅ Test 7: IDOR Protection: Removal request cross-tenant access returns 404
✅ Test 8: IDOR Protection: Reminder cross-tenant access returns 404
✅ Test 9: IDOR Protection: Audit log cross-tenant access returns 404
✅ Test 10: Tenant Injection: Malicious userId in POST body is neutralized
✅ Test 11: Tenant Injection: Malicious ?userId query param is neutralized
✅ Test 12: Privilege Escalation: Malicious role injection is stripped
✅ Test 13: SQL Injection: ' OR '1'='1 in query parameter is neutralized
✅ Test 14: SQL Injection: Path parameter injection is intercepted (HTTP 400)
✅ Test 15: XSS Handling: Script tags stored safely without code execution
✅ Test 16: Malformed JSON payload returns HTTP 400 Bad Request
✅ Test 17: Oversized payload (>1MB) returns HTTP 413 Payload Too Large
✅ Test 18: Pagination parameter boundary enforcement & clamping
✅ Test 19: Rate Limiting: 11 rapid requests trigger HTTP 429
✅ Test 20: Credential Zero-Leakage: No password hashes in responses/logs
================================================================
TOTAL: 20 | PASSED: 20 | FAILED: 0 | DEFENSE SUCCESS: 100%
================================================================
```

---

## 5. Security Recommendations for Future Phases

While the current Phase 6 backend achieves a 100% defense rate against all tested attack vectors, the following hardening measures are recommended for future production infrastructure deployments:

1. **Distributed Rate Limiting:** Transition from in-memory rate limiting to Redis-backed sliding window rate limiting (e.g. `rate-limiter-flexible`) when scaling across multiple horizontal container instances.
2. **Centralized Token Revocation List:** For enterprise environments requiring immediate token revocation before expiration (e.g. password resets, security breaches), implement a Redis token blacklist or maintain a `tokenVersion` / `lastPasswordResetAt` column on the `User` table.
3. **Transport Layer Security (TLS):** Enforce strict HTTPS redirection and HSTS headers via reverse proxy (Nginx / Cloudflare) in production.
