-- CreateEnum
CREATE TYPE "PasswordChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "password_change_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newPasswordHash" TEXT NOT NULL,
    "status" "PasswordChangeStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_change_requests_status_idx" ON "password_change_requests"("status");

-- CreateIndex
CREATE INDEX "password_change_requests_userId_status_idx" ON "password_change_requests"("userId", "status");

-- AddForeignKey
ALTER TABLE "password_change_requests" ADD CONSTRAINT "password_change_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_change_requests" ADD CONSTRAINT "password_change_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
