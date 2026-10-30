ALTER TABLE "Invitation" ADD COLUMN "recipientId" TEXT;
CREATE INDEX "Invitation_recipientId_status_idx" ON "Invitation"("recipientId", "status");
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
