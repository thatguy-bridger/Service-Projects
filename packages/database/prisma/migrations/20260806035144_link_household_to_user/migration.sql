-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Household_userId_idx" ON "Household"("userId");

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

