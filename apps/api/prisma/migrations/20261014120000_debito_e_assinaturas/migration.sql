-- Débito como forma de pagamento própria.
--
-- Até aqui "débito" só existia como TIPO DE CARTÃO, então quem pagou no débito
-- sem cadastrar o cartão caía em "Outro". `ADD VALUE` é aditivo: nenhuma linha
-- existente muda de valor.
ALTER TYPE "FormaPagamento" ADD VALUE IF NOT EXISTS 'DEBITO' AFTER 'CARTAO';

-- Categoria "Assinaturas" nos grupos que já existem.
--
-- Ela entrou em CATEGORIAS_PADRAO, mas isso só vale para grupo novo — quem já
-- usa o app continuaria jogando Netflix e Spotify em "Outros", que é
-- justamente a categoria inchada que se quer aliviar.
--
-- `NOT EXISTS` em vez de `ON CONFLICT`: a unicidade é (householdId, nome), e
-- assim a migração pode rodar de novo sem erro se for reaplicada.
INSERT INTO "Categoria" ("id", "nome", "icone", "cor", "householdId")
SELECT gen_random_uuid(), 'Assinaturas', 'repetir', '#9333EA', h."id"
FROM "Household" h
WHERE NOT EXISTS (
  SELECT 1 FROM "Categoria" c
  WHERE c."householdId" = h."id" AND c."nome" = 'Assinaturas'
);
