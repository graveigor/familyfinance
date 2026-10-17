-- Metas pessoais.
--
-- `householdId` nulo passa a significar "meta de uma pessoa só". Nulo em vez
-- de uma coluna nova porque a meta pessoal não pertence a grupo nenhum:
-- amarrada a um, ela sumiria quando a pessoa trocasse de grupo.
--
-- Nenhuma linha existente muda: todas continuam com o grupo preenchido, ou
-- seja, continuam sendo metas da família.

-- AlterTable
ALTER TABLE "Meta" ALTER COLUMN "householdId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Meta_criadoPorId_idx" ON "Meta"("criadoPorId");

