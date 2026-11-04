-- CreateEnum
CREATE TYPE "SplitType" AS ENUM ('EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'EXPENSE_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'EXPENSE_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'EXPENSE_DELETED';

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "amount" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "paidById" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "splitType" "SplitType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestKey" UUID NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_splits" (
    "groupId" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "inputUnits" BIGINT,

    CONSTRAINT "expense_splits_pkey" PRIMARY KEY ("expenseId","userId")
);

-- CreateIndex
CREATE INDEX "expenses_groupId_deletedAt_date_id_idx" ON "expenses"("groupId", "deletedAt", "date", "id");

-- CreateIndex
CREATE INDEX "expenses_groupId_paidById_idx" ON "expenses"("groupId", "paidById");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_groupId_id_key" ON "expenses"("groupId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_groupId_createdById_requestKey_key" ON "expenses"("groupId", "createdById", "requestKey");

-- CreateIndex
CREATE INDEX "expense_splits_groupId_userId_idx" ON "expense_splits"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_groupId_paidById_fkey" FOREIGN KEY ("groupId", "paidById") REFERENCES "group_members"("groupId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_groupId_createdById_fkey" FOREIGN KEY ("groupId", "createdById") REFERENCES "group_members"("groupId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_groupId_expenseId_fkey" FOREIGN KEY ("groupId", "expenseId") REFERENCES "expenses"("groupId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_groupId_userId_fkey" FOREIGN KEY ("groupId", "userId") REFERENCES "group_members"("groupId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE expenses ADD CONSTRAINT expense_positive_amount CHECK (amount BETWEEN 1 AND 100000000);
ALTER TABLE expenses ADD CONSTRAINT expense_positive_version CHECK (version > 0);
ALTER TABLE expense_splits ADD CONSTRAINT split_nonnegative_amount CHECK (amount BETWEEN 0 AND 100000000);
ALTER TABLE expense_splits ADD CONSTRAINT split_nonnegative_input CHECK ("inputUnits" IS NULL OR "inputUnits" BETWEEN 0 AND 100000000);
