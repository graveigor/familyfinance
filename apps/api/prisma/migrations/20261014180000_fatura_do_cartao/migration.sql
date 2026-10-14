-- Fechamento e vencimento da fatura.
--
-- Nulos em tudo o que já existe, e isso é a resposta certa: não dá para
-- adivinhar o fechamento de um cartão cadastrado antes do campo existir, e
-- chutar um dia faria o app mostrar uma previsão errada com cara de certa.
-- Sem os dois, a tela pede que a pessoa preencha.
ALTER TABLE "Cartao" ADD COLUMN "diaFechamento" INTEGER;
ALTER TABLE "Cartao" ADD COLUMN "diaVencimento" INTEGER;
