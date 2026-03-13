-- CreateIndex: GIN index on PeptideCompound.goals for array containment queries
-- Required for efficient { has: goal } filtering via Prisma
CREATE INDEX "PeptideCompound_goals_gin" ON "PeptideCompound" USING GIN ("goals");
