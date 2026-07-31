-- Conserta lançamentos que ficaram apontando para categoria ou cartão de OUTRO
-- grupo.
--
-- Vinha de quando mudar de grupo levava os lançamentos junto: o `householdId`
-- do gasto mudava, mas o `categoriaId` continuava no da casa antiga. A lista de
-- Gastos não mostrava o problema, porque lê a categoria pela relação; já o
-- Resumo procura a categoria entre as do grupo atual, não achava, e exibia
-- tudo como "Sem categoria".
--
-- Regra do reparo: aponta para a categoria de mesmo nome no grupo do próprio
-- lançamento; não havendo, deixa sem categoria. Nenhum valor é alterado.

UPDATE "Gasto" g
SET "categoriaId" = (
  SELECT c2."id" FROM "Categoria" c2
  WHERE c2."householdId" = g."householdId"
    AND lower(c2."nome") = lower(c1."nome")
  LIMIT 1
)
FROM "Categoria" c1
WHERE g."categoriaId" = c1."id"
  AND c1."householdId" <> g."householdId";

UPDATE "Gasto" g
SET "cartaoId" = (
  SELECT k2."id" FROM "Cartao" k2
  WHERE k2."householdId" = g."householdId"
    AND lower(k2."nome") = lower(k1."nome")
    AND k2."tipo" = k1."tipo"
  LIMIT 1
)
FROM "Cartao" k1
WHERE g."cartaoId" = k1."id"
  AND k1."householdId" <> g."householdId";

UPDATE "Recorrencia" r
SET "categoriaId" = (
  SELECT c2."id" FROM "Categoria" c2
  WHERE c2."householdId" = r."householdId"
    AND lower(c2."nome") = lower(c1."nome")
  LIMIT 1
)
FROM "Categoria" c1
WHERE r."categoriaId" = c1."id"
  AND c1."householdId" <> r."householdId";

UPDATE "Recorrencia" r
SET "cartaoId" = (
  SELECT k2."id" FROM "Cartao" k2
  WHERE k2."householdId" = r."householdId"
    AND lower(k2."nome") = lower(k1."nome")
    AND k2."tipo" = k1."tipo"
  LIMIT 1
)
FROM "Cartao" k1
WHERE r."cartaoId" = k1."id"
  AND k1."householdId" <> r."householdId";
