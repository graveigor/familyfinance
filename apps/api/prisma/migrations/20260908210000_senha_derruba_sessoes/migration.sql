-- Trocar a senha passa a invalidar os tokens emitidos antes.
--
-- Sem isto, o refresh token (30 dias) sobrevivia à troca de senha: quem trocava
-- a senha para se livrar de um invasor continuava com ele dentro da conta.
--
-- Nas linhas que já existem o padrão é agora, e não a criação do usuário: usar
-- a data de criação valeria como "senha trocada lá atrás" e não mudaria nada,
-- mas deixa o campo mentindo. Como efeito, as sessões abertas hoje caem uma
-- vez, na subida — é uma entrada a mais para quem estiver usando o app.
ALTER TABLE "User" ADD COLUMN "senhaAlteradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
