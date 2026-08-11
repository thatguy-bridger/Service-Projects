-- SPEC.md §11.1/§21 Phase 8: UiCopyOverride, the storage half of the
-- copy editor. Purely additive.

CREATE TABLE "UiCopyOverride" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "UiCopyOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UiCopyOverride_orgId_key_key" ON "UiCopyOverride"("orgId", "key");

ALTER TABLE "UiCopyOverride" ADD CONSTRAINT "UiCopyOverride_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
