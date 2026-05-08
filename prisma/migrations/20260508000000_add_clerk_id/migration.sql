-- AlterTable: add clerkId to User (idempotent)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clerkId" TEXT;

-- CreateIndex: unique index on clerkId
CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkId_key" ON "User"("clerkId");
