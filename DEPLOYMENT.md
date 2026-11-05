# OBLIVION – Production Deployment & Infrastructure Guide

**Platform:** OBLIVION – The Internet's Forget Button  
**Target Architecture:** Node.js 24 + Express 5 + PostgreSQL 18.6  
**Document Status:** Production Deployment Baseline & Infrastructure Requirements

---

## 1. Production Prerequisites

Before deploying OBLIVION to a production staging or live environment, verify the following infrastructure dependencies:

| Component | Minimum Specification | Recommended Production Standard |
| :--- | :--- | :--- |
| **Node.js** | v24.x LTS | v24.16+ LTS in container (Docker / Alpine / Debian Slim) |
| **PostgreSQL** | v18.x | Managed PostgreSQL 18+ (AWS RDS, Google Cloud SQL, Azure Database) |
| **Memory** | 1 GB RAM | 2–4 GB RAM per instance |
| **Compute** | 1 vCPU | 2+ vCPUs with horizontal scaling |
| **Network** | Port 5000 (Internal) | Ingress terminated via HTTPS (Port 443) behind reverse proxy / CDN |

---

## 2. Environment Configuration Checklist

Create the production `.env` file from `.env.example` and set production values:

```bash
# 1. Environment & Port
NODE_ENV="production"
PORT="5000"

# 2. Production PostgreSQL Connection (Use SSL in production)
DATABASE_URL="postgresql://db_user:SUPER_SECURE_PASSWORD@db-prod.internal:5432/oblivion_db?schema=public&sslmode=require"

# 3. Connection Pooling
DB_POOL_MIN="4"
DB_POOL_MAX="20"
DB_TIMEOUT_MS="15000"

# 4. Cryptographic JWT Secret (Minimum 32 random characters)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET="GENERATE_A_64_CHAR_RANDOM_HEX_STRING_FOR_PRODUCTION_USE"
JWT_EXPIRES_IN="7d"

# 5. Production CORS Origin (Lock down to exact frontend origin)
CORS_ORIGIN="https://app.oblivion.privacy"
```

> [!WARNING]
> **NEVER USE WILDCARD `*` FOR `CORS_ORIGIN` IN PRODUCTION.**  
> Wildcard origins permit unauthorized websites to make credentialed API requests against the backend.

---

## 3. Database Migration & Initialization Procedure

Execute migrations safely using Prisma's non-destructive deployment command:

```bash
# 1. Verify connection and current migration status:
npx prisma migrate status

# 2. Apply pending migrations (non-destructive):
npx prisma migrate deploy

# 3. (First deployment only) Seed reference data categories:
npm run db:seed
```

> [!CAUTION]
> **DO NOT RUN `prisma migrate dev` OR `prisma migrate reset` IN PRODUCTION.**  
> Only use `prisma migrate deploy`, which strictly applies committed migrations without modifying or resetting data.

---

## 4. Build & Process Startup

Compile TypeScript to JavaScript and launch the production cluster/process:

```bash
# 1. Install production dependencies:
npm ci --only=production

# 2. Generate Prisma Client:
npx prisma generate

# 3. Compile TypeScript:
npm run build

# 4. Start production server:
npm start
# (Runs: node dist/src/server.js)
```

### Process Management with PM2
For single-server VM deployments, run under PM2:
```bash
pm2 start dist/src/server.js --name "oblivion-api" -i max
pm2 save
pm2 startup
```

---

## 5. Required Infrastructure Additions for High-Scale Production

The Phase 6 backend achieves complete self-contained functionality. However, scaling across horizontally distributed container clusters requires the following additional infrastructure services:

```mermaid
graph TD
    LB[Cloud Load Balancer / Ingress / Cloudflare] -->|HTTPS 443| Node1[OBLIVION Container 1]
    LB -->|HTTPS 443| Node2[OBLIVION Container 2]
    
    Node1 & Node2 --> DB[(Managed PostgreSQL 18+)]
    Node1 & Node2 --> Redis[(Shared Redis Cluster)]
    Node1 & Node2 -.-> Broker[(Kafka / RabbitMQ Outbox)]
    
    subgraph Infrastructure Enhancements
        Redis --- R1[Distributed Rate Limiting]
        Redis --- R2[JWT Revocation Blacklist]
        Broker --- B1[Reliable Audit Log Delivery]
    end
```

### 1. Distributed Rate Limiting (Redis)
- **Current State:** In-memory sliding window per Node.js process.
- **Production Need:** Multiple container instances (e.g. AWS ECS, Kubernetes) each maintain isolated memory. Deploy `rate-limiter-flexible` with a Redis backend to enforce global rate limits across all cluster nodes.

### 2. Immediate Token Invalidation (Redis / Token Version)
- **Current State:** Stateless JWT with 7-day expiration; logout is client-side discard.
- **Production Need:** Instant revocation on password change or security breach requires maintaining a Redis token blocklist or a `tokenVersion` counter on the `User` record.

### 3. Guaranteed Audit Event Delivery (Transactional Outbox / Broker)
- **Current State:** Direct-to-database writes; errors logged to console during PostgreSQL downtime.
- **Production Need:** For legal non-repudiation during database outages, write audit records to an `audit_outbox` table within the same transaction or push to a message broker (RabbitMQ, Kafka, AWS SQS) for retried delivery.

### 4. Immutable Log Shipping & Monitoring
- Forward structured logs (`stdout`/`stderr`) to an aggregator (Datadog, Grafana Loki, AWS CloudWatch).
- Forward audit logs to WORM storage (AWS S3 Glacier with Object Lock) for compliance archiving.

---

## 6. Pre-Flight Deployment Verification Checklist

Before opening network ingress to end users, verify each step:

- [ ] Environment variables configured in `.env` or container secret manager.
- [ ] PostgreSQL 18.6 accepts connections over SSL.
- [ ] Database migrations applied cleanly via `npx prisma migrate deploy`.
- [ ] 12 reference data categories present in `data_categories` (`SELECT count(*) FROM data_categories` returns `12`).
- [ ] TypeScript compilation (`npm run build`) succeeded with exit code 0.
- [ ] Health endpoint (`GET /health`) returns `HTTP 200 OK` with `"database": "connected"`.
- [ ] `CORS_ORIGIN` matches production frontend domain.
- [ ] HTTPS termination active on reverse proxy.
- [ ] Rate limiting actively responds on `/api/v1/auth/login`.
