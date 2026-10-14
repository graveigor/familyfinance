-- Marcar conta fixa como paga.
--
-- Nulo em tudo o que já existe, de propósito: "em aberto" é a verdade sobre um
-- lançamento que ninguém conferiu ainda. Inventar uma data de pagamento para o
-- histórico seria afirmar algo que não aconteceu.
ALTER TABLE "Gasto" ADD COLUMN "pagoEm" TIMESTAMP(3);
