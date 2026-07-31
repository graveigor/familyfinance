-- CreateEnum
CREATE TYPE "TipoCartao" AS ENUM ('CREDITO', 'DEBITO');

-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN     "cartaoId" TEXT;

-- AlterTable
ALTER TABLE "Recorrencia" ADD COLUMN     "cartaoId" TEXT;

-- CreateTable
CREATE TABLE "Cartao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoCartao" NOT NULL DEFAULT 'CREDITO',
    "cor" TEXT NOT NULL DEFAULT '#334155',
    "householdId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cartao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cartao_householdId_idx" ON "Cartao"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Cartao_householdId_nome_tipo_key" ON "Cartao"("householdId", "nome", "tipo");

-- CreateIndex
CREATE INDEX "Gasto_cartaoId_idx" ON "Gasto"("cartaoId");

-- AddForeignKey
ALTER TABLE "Cartao" ADD CONSTRAINT "Cartao_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_cartaoId_fkey" FOREIGN KEY ("cartaoId") REFERENCES "Cartao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recorrencia" ADD CONSTRAINT "Recorrencia_cartaoId_fkey" FOREIGN KEY ("cartaoId") REFERENCES "Cartao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
