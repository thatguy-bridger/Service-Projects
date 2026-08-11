-- SPEC.md §9.2: local, refreshable address-point import for territory
-- fill, replacing a live per-request UGRC call. Purely additive.

CREATE TABLE "AddressPoint" (
    "id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "fullAddress" TEXT NOT NULL,
    "city" TEXT,
    "zip" TEXT,
    "source" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddressPoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AddressPoint_source_idx" ON "AddressPoint"("source");
CREATE INDEX "AddressPoint_lat_lng_idx" ON "AddressPoint"("lat", "lng");
