-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "criadoPorId" TEXT;

-- CreateTable
CREATE TABLE "Participacao" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'MEMBRO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Participacao_householdId_idx" ON "Participacao"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Participacao_userId_householdId_key" ON "Participacao"("userId", "householdId");

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participacao" ADD CONSTRAINT "Participacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participacao" ADD CONSTRAINT "Participacao_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quem já usava o app participa do grupo em que estava, com o mesmo papel.
-- Sem isto, todo mundo abriria o app sem nenhum grupo.
INSERT INTO "Participacao" ("id", "userId", "householdId", "papel", "criadoEm")
SELECT gen_random_uuid()::text, u."id", u."householdId", u."papel", u."criadoEm"
FROM "User" u;

-- Dono dos grupos antigos: a pessoa ADMIN mais antiga de cada um. É a melhor
-- aproximação de "quem criou" para o que já existe.
UPDATE "Household" h
SET "criadoPorId" = (
  SELECT u."id" FROM "User" u
  WHERE u."householdId" = h."id" AND u."papel" = 'ADMIN'
  ORDER BY u."criadoEm" ASC
  LIMIT 1
)
WHERE h."criadoPorId" IS NULL;
