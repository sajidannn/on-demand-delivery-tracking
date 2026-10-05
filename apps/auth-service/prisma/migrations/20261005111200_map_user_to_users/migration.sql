-- AlterTable
ALTER TABLE "User" RENAME TO "users";

-- AlterIndex
ALTER INDEX IF EXISTS "User_pkey" RENAME TO "users_pkey";
ALTER INDEX IF EXISTS "User_email_key" RENAME TO "users_email_key";
