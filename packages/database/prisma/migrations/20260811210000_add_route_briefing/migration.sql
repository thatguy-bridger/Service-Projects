-- SPEC.md §11.3's volunteer route screen wants a "route briefing"
-- block; there was nowhere to store one. Purely additive.

ALTER TABLE "Route" ADD COLUMN "briefingMd" TEXT;
