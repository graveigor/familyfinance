-- Orçamento: teto mensal por categoria, de cada pessoa.
--
-- Não passa pelo filtro de "quem compartilha": orçamento é meta pessoal, e
-- ver o teto do outro não ajuda ninguém a cumprir o seu.

-- CreateTable
CREATE TABLE "Orcamento" (
    "id" TEXT NOT NULL,
    "limiteCentavos" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Orcamento_userId_idx" ON "Orcamento"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Orcamento_userId_categoriaId_key" ON "Orcamento"("userId", "categoriaId");

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

