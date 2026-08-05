-- Drops the apps/route-assignments example models. That app has been
-- retired in favor of apps/rounds; these statements are safe to run
-- whether or not this database ever had the tables created.
ALTER TABLE IF EXISTS "ServiceRecord" DROP CONSTRAINT IF EXISTS "ServiceRecord_authorId_fkey";
ALTER TABLE IF EXISTS "Interaction" DROP CONSTRAINT IF EXISTS "Interaction_userId_fkey";
ALTER TABLE IF EXISTS "Interaction" DROP CONSTRAINT IF EXISTS "Interaction_recordId_fkey";

DROP TABLE IF EXISTS "ServiceRecord";
DROP TABLE IF EXISTS "Interaction";
