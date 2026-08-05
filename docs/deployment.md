# Deployment

Reference: `docs/deployment.md`

Each app in `apps/*` deploys as its own **Vercel project** (free Hobby
tier), bound to its own subdomain of `bridgerjones.com` (e.g.
`example.bridgerjones.com`). DNS is managed in Namecheap. Unlike static
hosting, Vercel runs the Next.js server, so API routes, NextAuth, and
Prisma/database queries from `packages/core-auth` and `packages/database`
all work in production — nothing about the app architecture has to change.

```
Service-Projects (this repo, monorepo source)
  apps/example-app/  ──▶  Vercel project "example-app"  ──▶  example.bridgerjones.com
  apps/next-app/      ──▶  Vercel project "next-app"      ──▶  next-app.bridgerjones.com
```

Vercel natively supports monorepos: each app gets its own Vercel project
pointed at the same GitHub repo with a different **Root Directory**, so
one repo serves all subdomains and each app deploys independently on
every push.

## One-time setup per new app

1. **Create the app** under `apps/<app-name>` (see root `README.md`),
   with its own `package.json` and `vercel.json` (copy from
   `apps/example-app` — an empty `vercel.json` is enough; Vercel
   auto-detects Next.js).
2. **In the Vercel dashboard:** "Add New Project" → import
   `thatguy-bridger/Service-Projects` → set **Root Directory** to
   `apps/<app-name>` → deploy. This creates an independent Vercel project
   for that app, deployed from the same repo.
3. **Environment variables:** in that Vercel project's Settings →
   Environment Variables, add `DATABASE_URL`, `NEXTAUTH_SECRET`, and
   `NEXTAUTH_URL` (set to `https://<app-name>.bridgerjones.com`). Shared
   values (like `DATABASE_URL` if all apps use one database) can be
   copy-pasted across projects or managed with Vercel's team-level
   environment variables.
4. **Add the custom domain:** in that project's Settings → Domains, add
   `<app-name>.bridgerjones.com`. Vercel will show the DNS record to add.
5. **DNS in Namecheap:** add a `CNAME` record:
   - Host: `app-name`
   - Value: `cname.vercel-dns.com`
   - TTL: Automatic

   (Vercel's Domains screen shows the exact value if it ever differs.)
6. Push to `main` (or merge a PR) — Vercel builds and deploys that app
   automatically going forward. Preview deployments are created
   automatically for pull requests.

## Database

Free options that work well with Prisma + Vercel: **Neon** or **Supabase**
(both have a free Postgres tier). Point `DATABASE_URL` at it and run
`npm run db:migrate` once locally (or via a one-off script) to apply the
schema in `packages/database/prisma/schema.prisma`. All apps can share one
database instance since they share the same `User`/`ServiceRecord` model,
or you can give each app its own if the data shouldn't be shared.

## Local development

```bash
npm install
cp .env.example .env      # set DATABASE_URL, NEXTAUTH_SECRET
npm run db:migrate
npm run dev --workspace=apps/<app-name>
```

## Root domain (bridgerjones.com itself)

If you want a landing page at the bare `bridgerjones.com` (not a
subdomain), add an `apps/www` app the same way and add an `A`/`ALIAS`
record (or Namecheap's Vercel integration) pointing the root domain to
that project, per Vercel's apex-domain instructions shown on its Domains
screen.
