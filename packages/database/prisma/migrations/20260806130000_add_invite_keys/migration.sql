-- Phase 5 (SPEC.md §5): InviteKey + KeyRedemption. Purely additive.

CREATE TABLE "InviteKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT,
    "codeHash" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL,
    "grantsRole" "Role" NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InviteKey_codeHash_key" ON "InviteKey"("codeHash");

CREATE TABLE "KeyRedemption" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KeyRedemption_keyId_userId_key" ON "KeyRedemption"("keyId", "userId");

ALTER TABLE "InviteKey" ADD CONSTRAINT "InviteKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InviteKey" ADD CONSTRAINT "InviteKey_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KeyRedemption" ADD CONSTRAINT "KeyRedemption_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "InviteKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KeyRedemption" ADD CONSTRAINT "KeyRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
