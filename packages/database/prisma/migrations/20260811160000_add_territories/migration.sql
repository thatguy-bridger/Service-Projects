-- Phase 6 (SPEC.md §5.1, §9.2): Territory. Purely additive -- a saved,
-- reusable polygon drawn on the map. addressPointCount/lastFilledAt stay
-- null until the UGRC-backed fill step lands.

CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "polygon" JSONB NOT NULL,
    "addressPointCount" INTEGER,
    "lastFilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Territory_orgId_idx" ON "Territory"("orgId");

ALTER TABLE "Territory" ADD CONSTRAINT "Territory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
