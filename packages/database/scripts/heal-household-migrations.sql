DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Household' AND column_name = 'userId'
  ) THEN
    ALTER TABLE "Household" ADD COLUMN "userId" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'Household' AND indexname = 'Household_userId_idx'
  ) THEN
    CREATE INDEX "Household_userId_idx" ON "Household"("userId");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Household_userId_fkey'
  ) THEN
    ALTER TABLE "Household" ADD CONSTRAINT "Household_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Household' AND column_name = 'needsReviewReason'
  ) THEN
    ALTER TABLE "Household" ADD COLUMN "needsReviewReason" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Household' AND column_name = 'selfServiceTokenExpiresAt'
  ) THEN
    ALTER TABLE "Household" ADD COLUMN "selfServiceTokenExpiresAt" TIMESTAMP(3);
  END IF;
END $$;
