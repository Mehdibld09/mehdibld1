# Steam Family Admin Console

An admin-only control panel for managing the Steam Family platform. The public marketplace, member pages, registration, and community UI are intentionally not exposed by the web application; administrators sign in through `/login` and manage the platform from `/admin`.

## Run & Operate

- Two workflows are configured and run automatically in this Repl: `API Server` (Express API, port 8080) and `Start application` (Vite frontend, port 5000).
- The frontend intentionally exposes only `/admin` and the admin authentication/reset screens. Unknown and public paths redirect to `/admin`.
- `pnpm --filter @workspace/api-server run dev` — run the API server directly
- `pnpm --filter @workspace/steamshare run dev` — run the frontend directly
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (Replit-managed Postgres is already provisioned and set)
- For deployments where the main site and admin console are on different subdomains, set `SESSION_COOKIE_DOMAIN` to their shared parent domain (for example, `.steamfamily.gg`) so the login session is available on both hosts.

### Vercel database setup

The frontend calls the API through same-origin `/api/*` routes. Vercel therefore needs `DATABASE_URL` and `SESSION_SECRET` in the Vercel project environment, and the database referenced by `DATABASE_URL` must have this project's schema. A reachable but empty database returns `accounts: []`; a database URL that cannot be reached causes the web page's data requests to return 500 errors.

For Supabase on Vercel, use Supabase's connection pooler URL (session or transaction pooler) rather than an IPv6-only direct database host. The API enables TLS automatically for Supabase hosts and uses one pooled connection per Vercel function.

Before the first Vercel deployment, apply the schema using the Vercel database connection in a secure shell or CI environment:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push
```

Do not add `db:push` to the Vercel build or server startup command. Schema changes should be applied separately, then the Vercel deployment can be rebuilt. The Replit development database is separate from an external Vercel database.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/steamshare` — Vite/React web application
- `artifacts/api-server` — Express API and Vercel serverless app bundle
- `lib/db/src/schema` — Drizzle/PostgreSQL schema source of truth
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
