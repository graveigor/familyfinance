-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN     "comprovante" TEXT,
ADD COLUMN     "recorrenciaId" TEXT;

-- CreateTable
CREATE TABLE "Recorrencia" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "diaDoMes" INTEGER NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL DEFAULT 'OUTRO',
    "observacao" TEXT,
    "categoriaId" TEXT,
    "userId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "inicioEm" DATE NOT NULL,
    "fimEm" DATE,
    "ultimoMesGerado" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recorrencia_householdId_ativa_idx" ON "Recorrencia"("householdId", "ativa");

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_recorrenciaId_fkey" FOREIGN KEY ("recorrenciaId") REFERENCES "Recorrencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recorrencia" ADD CONSTRAINT "Recorrencia_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recorrencia" ADD CONSTRAINT "Recorrencia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recorrencia" ADD CONSTRAINT "Recorrencia_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
