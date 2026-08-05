# Service Projects

A monorepo for multiple internal projects that share one authentication and
data layer. Administrators create/manage data; regular users log in to view
and interact with it.

## Layout

```
apps/                  Independently deployable projects (each a Next.js app)
  rounds/                Flag/route service app — see SPEC.md and docs/rounds/

packages/
  core-auth/            Shared NextAuth config, session/role + permission helpers
  database/             Shared Prisma schema + client, scoped query helpers
  ui/                    Shared React components
  geo/                   Geocoding helpers (UGRC + mock)
  config/                Shared tsconfig/lint base config

docs/                   Architecture and onboarding docs
  design-language.md    Design system: color, type, spacing, components — read before styling anything
  deployment.md          How each app deploys to its own bridgerjones.com subdomain
  rounds/                 Phase-by-phase build notes for apps/rounds

SPEC.md                 Full product spec for Rounds
```

## Design language

Every app shares one visual language, defined in
[`docs/design-language.md`](./docs/design-language.md) and implemented as
real code in `packages/ui` (`tokens.css`, `tokens.ts`, `components.css`,
and base components `Button`/`Card`/`Badge`). Import the tokens and base
components rather than styling one-off — see that doc for the full rules.

## Adding a new project

1. Copy `apps/rounds` to `apps/<your-project>` (or `npx create-next-app`
   inside `apps/` and wire up the shared packages).
2. Depend on `@service-projects/core-auth` and `@service-projects/database`
   in its `package.json` to reuse login and the shared data model.
3. Extend `packages/database/prisma/schema.prisma` with any project-specific
   tables.
4. Deploy it to its own subdomain — see
   [`docs/deployment.md`](./docs/deployment.md).

## Access model

- `User.role` is one of five values: `OWNER`, `ADMIN`, `COORDINATOR`,
  `VOLUNTEER`, `PREVIEWER` — see `packages/database/prisma/schema.prisma`
  and `packages/core-auth/src/permissions.ts`.
- Roles can be org-wide or scoped to a single `Event` via `Membership`.
- Use `requireRole(session, roles, { eventId })` from
  `@service-projects/core-auth` in server actions/route handlers to gate
  access.

## Getting started

```bash
npm install
cp .env.example .env      # set DATABASE_URL, DATABASE_URL_UNPOOLED
npm run db:migrate
npm run dev --workspace=apps/rounds
```
