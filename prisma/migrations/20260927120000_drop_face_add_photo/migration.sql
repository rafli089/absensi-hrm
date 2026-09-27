-- AlterEnum
BEGIN;
CREATE TYPE "SecurityEventType_new" AS ENUM ('GPS_OUTSIDE_OFFICE', 'UNUSUAL_LOGIN', 'MULTIPLE_DEVICE_LOGIN', 'SUSPICIOUS_ATTENDANCE', 'IP_CHANGE', 'IMPOSSIBLE_LOCATION', 'REPEATED_ATTEMPTS', 'RATE_LIMIT_EXCEEDED');
ALTER TABLE "security_events" ALTER COLUMN "eventType" TYPE "SecurityEventType_new" USING ("eventType"::text::"SecurityEventType_new");
ALTER TYPE "SecurityEventType" RENAME TO "SecurityEventType_old";
ALTER TYPE "SecurityEventType_new" RENAME TO "SecurityEventType";
DROP TYPE "public"."SecurityEventType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "face_profiles" DROP CONSTRAINT "face_profiles_employeeId_fkey";

-- AlterTable
ALTER TABLE "attendance" DROP COLUMN "faceScore",
DROP COLUMN "faceVerified",
ADD COLUMN     "photo" TEXT;

-- AlterTable
ALTER TABLE "attendance_events" ADD COLUMN     "photo" TEXT;

-- DropTable
DROP TABLE "face_profiles";

-- DropEnum
DROP TYPE "FaceStatus";

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

