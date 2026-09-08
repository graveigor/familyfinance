-- Nome, e-mail e comprovantes passam a ser guardados cifrados.
-- O conteúdo das linhas que já existem é cifrado depois, pelo
-- `scripts/cifrar-dados.mjs` — SQL não tem a chave, que mora no ambiente.

-- O login deixa de procurar pelo e-mail e passa a procurar por um HMAC dele:
-- o e-mail cifrado muda a cada escrita (IV novo) e não serve para busca.
ALTER TABLE "User" ADD COLUMN "emailIndice" TEXT;

-- Valor de partida único por linha, só para a coluna poder nascer NOT NULL e
-- UNIQUE nesta mesma migração. O backfill troca cada um pelo HMAC de verdade;
-- "pendente:" nunca colide com um HMAC, que é sempre 64 caracteres hex.
UPDATE "User" SET "emailIndice" = 'pendente:' || "id" WHERE "emailIndice" IS NULL;

ALTER TABLE "User" ALTER COLUMN "emailIndice" SET NOT NULL;
CREATE UNIQUE INDEX "User_emailIndice_key" ON "User"("emailIndice");

-- A unicidade muda de coluna: duas cifras do mesmo e-mail são bytes
-- diferentes, então o índice antigo deixaria passar contas repetidas.
DROP INDEX "User_email_key";
