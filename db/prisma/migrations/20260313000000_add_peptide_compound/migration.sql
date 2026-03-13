-- Add PeptideCompound table for the peptide reference database

-- CreateTable
CREATE TABLE "PeptideCompound" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL,
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "typicalDoseMin" DOUBLE PRECISION NOT NULL,
    "typicalDoseMax" DOUBLE PRECISION NOT NULL,
    "typicalDoseUnit" TEXT NOT NULL,
    "halfLife" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "cycleProtocol" TEXT NOT NULL,
    "stackingNotes" TEXT NOT NULL,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "iuConversion" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeptideCompound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PeptideCompound_name_key" ON "PeptideCompound"("name");

-- CreateIndex
CREATE INDEX "PeptideCompound_category_idx" ON "PeptideCompound"("category");

-- CreateIndex
CREATE INDEX "PeptideCompound_name_idx" ON "PeptideCompound"("name");
