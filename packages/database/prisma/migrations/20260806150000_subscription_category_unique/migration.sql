-- Closes a race the Season removal left open: two concurrent requests
-- for the same household + category (e.g. two rapid CSV imports, or a
-- signup submitted twice) could each find no existing Subscription and
-- both create one, silently duplicating the household's bundle.
-- Enforced only for a real (non-null) category -- a household is
-- allowed several separate uncategorized Subscriptions by design, and
-- Postgres partial unique indexes are the standard way to exclude NULL
-- from a uniqueness rule that Prisma's schema-level @@unique can't
-- express directly.
CREATE UNIQUE INDEX "Subscription_householdId_categoryId_notnull_key"
  ON "Subscription"("householdId", "categoryId")
  WHERE "categoryId" IS NOT NULL;
