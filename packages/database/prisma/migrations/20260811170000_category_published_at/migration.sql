-- Publishing moves from the Event level to the Category level.
-- Additive: existing categories default to unpublished (null), so
-- nothing appears on public signup until an admin explicitly publishes
-- a category, even if some of its events already have status = OPEN.

ALTER TABLE "Category" ADD COLUMN "publishedAt" TIMESTAMP(3);
