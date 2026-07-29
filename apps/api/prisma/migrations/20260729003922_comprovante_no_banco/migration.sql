/*
  Warnings:

  - You are about to drop the column `comprovante` on the `Gasto` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Gasto" DROP COLUMN "comprovante";

-- CreateTable
CREATE TABLE "Comprovante" (
    "id" TEXT NOT NULL,
    "gastoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dados" BYTEA NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comprovante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Comprovante_gastoId_key" ON "Comprovante"("gastoId");

-- AddForeignKey
ALTER TABLE "Comprovante" ADD CONSTRAINT "Comprovante_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
