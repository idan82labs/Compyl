# Validation — Live-Integration Readiness (Phase H.4)

## Real vs Mocked Inventory

| Component | Current State | Live Requirement | Status |
|-----------|--------------|------------------|--------|
| DB Schema | 14 tables, 13 enums defined | Migration executed against Neon | Ready (SQL exists) |
| DB Connection | Neon serverless client configured | DATABASE_URL env var | Ready (code complete) |
| DB Migrations | `drizzle/0000_tan_maximus.sql` exists | `pnpm db:push` with DATABASE_URL | Ready (scripts implemented) |
| API Routes | Real Fastify + Drizzle queries | Neon connection string | Ready |
| Worker Transport | HTTP client with retry/timeout/idempotency | Python server on :8001 | Ready |
| Worker Jobs | Stubbed (mock results) | Claude API integration | NOT READY |
| Auth (Agent) | SHA-256 token hash against agentTokens | Real DB | Ready |
| Auth (Reporter) | X-Review-Token validated against invites | Real DB | Ready |
| Auth (Session) | Auth.js TODO | Auth.js integration | NOT READY |
| Boundary Enforcement | Column selection at query time | Same in production | Ready |
| Error Rate Tracking | In-memory sliding window | Same (singleton per instance) | Ready |
| Figma Ranking | Stub FigmaClient | Real Figma API client | NOT READY |
| MCP Server | Contract + tools defined | Live API connection | Ready |
| CLI | Commands defined | Live API connection | Ready |
| CORS | origin: true (permissive) | Origin whitelist | NOT READY |
| Rate Limiting | None | @fastify/rate-limit | NOT READY |
| Object Storage | Not integrated | Cloudflare R2 | NOT READY |
| Cache | In-memory | Upstash Redis | NOT READY |

## Environment Setup Checklist

- [x] `.env.example` exists with all 6 vars documented
- [x] `validateEnv()` fails fast on missing required vars (DATABASE_URL, AUTH_SECRET)
- [x] Defaults applied for optional vars (WORKER_AI_URL, NODE_ENV, PORT, HOST)
- [x] env-sanity.test.ts proves validation logic (8 tests)

## Database Readiness

- [x] Schema: 14 tables with full provenance separation (`exact_source` / `resolved_component_stack`)
- [x] Drizzle config reads DATABASE_URL from env
- [x] Migration SQL exists: `packages/db/drizzle/0000_tan_maximus.sql`
- [x] Scripts implemented: `db:push`, `db:generate`, `db:migrate`, `db:reset`, `db:studio`
- [ ] Migration executed against Neon (requires DATABASE_URL)

## Steps to First Live Run

```bash
# 1. Create Neon PostgreSQL database
#    → Copy connection string

# 2. Configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL and AUTH_SECRET

# 3. Push schema to database
pnpm --filter @compyl/db db:push

# 4. Start services
pnpm dev  # Starts web (:3000) + api (:3001) + worker (:8001)

# 5. Verify health
curl http://localhost:3001/health
# → { "status": "ok", "service": "compyl-api" }

# 6. Create first organization + project via API
# (requires Auth.js session or agent token in DB)
```

## What Blocks Live Integration

1. **Auth.js session validation** — team member login flow not wired
2. **Worker AI logic** — all job handlers return stub results
3. **Figma API client** — ranking service uses stub client
4. **CORS whitelist** — currently accepts all origins
5. **Rate limiting** — no request throttling

## Evidence

- env-sanity.test.ts (8 tests): fail-fast validation, defaults, schema matching
- packages/db/package.json: db:push, db:generate, db:migrate, db:reset, db:studio scripts
- .env.example: all 6 env vars documented with defaults
- drizzle.config.ts: reads DATABASE_URL from process.env
- packages/config/src/env.ts: validateEnv() with fail-fast pattern
