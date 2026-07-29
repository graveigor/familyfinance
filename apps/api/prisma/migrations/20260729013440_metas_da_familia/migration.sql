-- CreateTable
CREATE TABLE "Meta" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valorAlvoCentavos" INTEGER,
    "householdId" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Meta_householdId_idx" ON "Meta"("householdId");

-- AddForeignKey
ALTER TABLE "Meta" ADD CONSTRAINT "Meta_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meta" ADD CONSTRAINT "Meta_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
