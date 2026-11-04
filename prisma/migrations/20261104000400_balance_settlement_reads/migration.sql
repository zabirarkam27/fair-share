-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BKASH', 'CASH', 'BANK');

-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "requestKey" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "settlements_groupId_createdAt_id_idx" ON "settlements"("groupId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "settlements_groupId_fromId_idx" ON "settlements"("groupId", "fromId");

-- CreateIndex
CREATE INDEX "settlements_groupId_toId_idx" ON "settlements"("groupId", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_groupId_id_key" ON "settlements"("groupId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_groupId_createdById_requestKey_key" ON "settlements"("groupId", "createdById", "requestKey");

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_groupId_fromId_fkey" FOREIGN KEY ("groupId", "fromId") REFERENCES "group_members"("groupId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_groupId_toId_fkey" FOREIGN KEY ("groupId", "toId") REFERENCES "group_members"("groupId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_groupId_createdById_fkey" FOREIGN KEY ("groupId", "createdById") REFERENCES "group_members"("groupId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE settlements ADD CONSTRAINT settlement_positive_amount CHECK (amount BETWEEN 1 AND 100000000);
ALTER TABLE settlements ADD CONSTRAINT settlement_distinct_parties CHECK ("fromId" <> "toId");
