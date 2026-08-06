-- Fully removes the Season model. Pricing moves onto Event directly
-- (each Event carries its own priceCents); Category gains an optional
-- priceCents for a flat bundle price across its Events, replacing what
-- Season.pricingMode used to do at the year level. Existing Subscriptions
-- keep their already-computed amountCents unchanged -- only the grouping
-- FK moves from Season to an optional Category.

ALTER TABLE "Event" ADD COLUMN "priceCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "Event" e SET "priceCents" = s."priceCents" FROM "Season" s WHERE e."seasonId" = s."id";

ALTER TABLE "Category" ADD COLUMN "priceCents" INTEGER;

ALTER TABLE "Subscription" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Subscription_householdId_categoryId_idx" ON "Subscription"("householdId", "categoryId");

DROP INDEX "Subscription_householdId_seasonId_key";
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_seasonId_fkey";
ALTER TABLE "Subscription" DROP COLUMN "seasonId";

ALTER TABLE "Event" DROP CONSTRAINT "Event_seasonId_fkey";
ALTER TABLE "Event" DROP COLUMN "seasonId";

DROP TABLE "Season";
