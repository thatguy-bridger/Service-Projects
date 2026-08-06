-- Phase 4 (SPEC.md §9.4/16): Visit -- one recorded outcome at one stop
-- by one volunteer. Purely additive.

CREATE TYPE "Disposition" AS ENUM ('SUCCESS', 'NEUTRAL', 'FAILED');

CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "disposition" "Disposition" NOT NULL,
    "note" TEXT,
    "photoUrl" TEXT,
    "itemCount" INTEGER,
    "amountCents" INTEGER,
    "minutesSpent" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),
    "recordedOffline" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Visit_clientId_key" ON "Visit"("clientId");

ALTER TABLE "Visit" ADD CONSTRAINT "Visit_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
