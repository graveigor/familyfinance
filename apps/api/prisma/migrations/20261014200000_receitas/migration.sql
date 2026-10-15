-- Receitas: o que entra.
--
-- Tabela própria, e não uma coluna de sinal no Gasto: todo aggregate de
-- resumo soma Gasto sem filtrar, e um campo de tipo faria receita entrar em
-- silêncio no "total de gastos" de cada tela.
--
-- Categoria e Recorrencia ganham tipo, com DESPESA como padrão — é o que
-- todas as linhas existentes são.

-- CreateEnum
CREATE TYPE "TipoDeLancamento" AS ENUM ('DESPESA', 'RECEITA');

-- DropIndex
DROP INDEX "Categoria_householdId_nome_key";

-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "tipo" "TipoDeLancamento" NOT NULL DEFAULT 'DESPESA';

-- AlterTable
ALTER TABLE "Recorrencia" ADD COLUMN     "tipo" "TipoDeLancamento" NOT NULL DEFAULT 'DESPESA';

-- CreateTable
CREATE TABLE "Receita" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "observacao" TEXT,
    "categoriaId" TEXT,
    "userId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "recorrenciaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receita_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Receita_householdId_data_idx" ON "Receita"("householdId", "data");

-- CreateIndex
CREATE INDEX "Receita_householdId_userId_idx" ON "Receita"("householdId", "userId");

-- CreateIndex
CREATE INDEX "Receita_categoriaId_idx" ON "Receita"("categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_householdId_nome_tipo_key" ON "Categoria"("householdId", "nome", "tipo");

-- AddForeignKey
ALTER TABLE "Receita" ADD CONSTRAINT "Receita_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receita" ADD CONSTRAINT "Receita_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receita" ADD CONSTRAINT "Receita_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receita" ADD CONSTRAINT "Receita_recorrenciaId_fkey" FOREIGN KEY ("recorrenciaId") REFERENCES "Recorrencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Categorias de receita nos grupos que já existem.
--
-- Só pôr na lista padrão valeria para grupo novo, e quem já usa o app abriria
-- a tela de receita sem nenhuma categoria para escolher.
INSERT INTO "Categoria" ("id", "nome", "icone", "cor", "tipo", "householdId")
SELECT gen_random_uuid(), p.nome, p.icone, p.cor, 'RECEITA'::"TipoDeLancamento", h."id"
FROM "Household" h
CROSS JOIN (VALUES
  ('Salário', 'cima', '#0E8F6D'),
  ('Freelance', 'lapis', '#14B88C'),
  ('Investimentos', 'grafico', '#0891B2'),
  ('Outras entradas', 'etiqueta', '#64748B')
) AS p(nome, icone, cor)
WHERE NOT EXISTS (
  SELECT 1 FROM "Categoria" c
  WHERE c."householdId" = h."id" AND c."nome" = p.nome AND c."tipo" = 'RECEITA'
);
