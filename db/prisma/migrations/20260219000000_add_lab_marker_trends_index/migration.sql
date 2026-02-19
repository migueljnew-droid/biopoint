-- CreateIndex: userId range scan (eliminates full table scan on LabMarker queries)
CREATE INDEX "LabMarker_userId_idx" ON "LabMarker"("userId");

-- CreateIndex: compound index for sorted trends query (WHERE userId ORDER BY recordedAt)
CREATE INDEX "LabMarker_userId_recordedAt_idx" ON "LabMarker"("userId", "recordedAt");
