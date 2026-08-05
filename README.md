# Service Projects

A monorepo for multiple internal projects that share one authentication and
data layer. Administrators create/manage data; regular users log in to view
and interact with it.

## Layout

```
apps/                  Independently deployable projects (each a Next.js app)
  example-app/          Reference app: /admin (admin-only) and /dashboard (users)

packages/
  core-auth/            Shared NextAuth config, session/role helpers (requireRole)
  database/             Shared Prisma schema + client (User, ServiceRecord, Interaction)
  ui/                    Shared React components
  config/                Shared tsconfig/lint base config

docs/                   Architecture and onboarding docs
```

## Adding a new project

1. Copy `apps/example-app` to `apps/<your-project>` (or `npx create-next-app`
   inside `apps/` and wire up the shared packages).
2. Depend on `@service-projects/core-auth` and `@service-projects/database`
   in its `package.json` to reuse login and the shared data model.
3. Extend `packages/database/prisma/schema.prisma` with any project-specific
   tables, related back to `User`/`ServiceRecord` as needed.

## Access model

- `User.role` is `ADMIN` or `USER`.
- Admins create `ServiceRecord`s (or your domain equivalent).
- Users view records and create `Interaction`s (comments, requests, etc.)
  against them.
- Use `requireRole(session, "ADMIN")` from `@service-projects/core-auth` in
  server actions/route handlers to gate admin-only operations.

## Getting started

```bash
npm install
cp .env.example .env      # set DATABASE_URL
npm run db:migrate
npm run dev
```
