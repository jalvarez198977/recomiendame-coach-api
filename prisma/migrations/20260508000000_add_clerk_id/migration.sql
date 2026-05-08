-- AlterTable: add clerkId to User
ALTER TABLE "User" ADD COLUMN "clerkId" TEXT;

-- CreateIndex: unique index on clerkId (nullable, so partial)
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");
