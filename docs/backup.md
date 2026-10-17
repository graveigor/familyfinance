# Cópia de segurança do banco

O plano gratuito do Neon restaura só algumas horas para trás, e o log de
operações dele nem registra SQL. Para um banco com dado financeiro de pessoas
reais, isso significa que **um apagão de dados percebido no dia seguinte é
perda definitiva**. Este backup existe para cobrir esse buraco.

## Ligar (uma vez só)

**1. Pegue a string de conexão direta no Neon.**
No painel do projeto `neon-teal-feather`, em *Connection string*, escolha a
opção **sem pool** (aparece como "direct connection" ou "unpooled"). A com pool
derruba dump longo no meio.

**2. Guarde-a num arquivo fora do git.**

Crie o arquivo vazio e **cole a URL dentro dele, no editor** — passar a URL num
comando deixaria a senha do banco guardada no histórico do shell:

```bash
touch apps/api/.env.backup.local && chmod 600 apps/api/.env.backup.local
```

Conteúdo, uma linha só:

```
DATABASE_URL_BACKUP=postgresql://...
```

O arquivo cai no `.env.*.local` do `.gitignore`, junto com o
`.env.producao.local` que guarda a chave de criptografia. Confira com
`git check-ignore -v apps/api/.env.backup.local` se tiver dúvida.

**3. Teste à mão antes de agendar.**

```bash
node apps/api/scripts/backup.mjs
```

Ele diz o tamanho, quantas tabelas vieram com dados e se o arquivo abre. Um
dump que não abre é pior que dump nenhum, então essa conferência é parte do
backup, não um extra.

**4. Agende.**

```bash
bash apps/api/scripts/agendar-backup.sh
```

Todo dia às 21h, com log em `~/Backups/family-finance/backup.log`. É `launchd`
e não `cron` porque ele recupera a execução perdida enquanto o Mac **dorme**:
acordou, roda.

O limite, que vale saber: com o Mac **desligado** na hora marcada, nem o
`launchd` recupera — aquele dia fica sem backup. Por isso o script avisa na
tela quando falha, em vez de confiar que alguém vai ler o log.

Outro horário: `--hora 9`. Desligar: `--desligar`. Rodar agora, para ver
funcionando: `launchctl kickstart -p gui/$(id -u)/com.graveigor.familyfinance.backup`.

## Restaurar

```bash
pg_restore --clean --if-exists --no-owner -d "<URL do banco destino>" ~/Backups/family-finance/family-finance_AAAA-MM-DD_HHMM.dump
```

Restaure sempre num banco **vazio ou descartável** primeiro, confira, e só
então decida sobre o de produção.

## O que o backup NÃO resolve sozinho

O dump sai como está no banco, ou seja, **nome, e-mail e comprovantes continuam
cifrados** pela `CHAVE_CRIPTOGRAFIA`. Isso é bom (um dump roubado não entrega
os dados de ninguém) e é perigoso: **restaurar sem a chave devolve um banco
ilegível**. A chave precisa estar no gerenciador de senhas, não só no
`apps/api/.env.producao.local` deste Mac.

Os dois juntos são o backup. Separados, cada um sozinho não vale nada.

## O que o script confere sozinho

Ele não se dá por satisfeito com "o `pg_dump` não deu erro":

- abre o arquivo gerado (`pg_restore --list`) — dump que não abre é apagado na
  hora, para não ocupar vaga na rotação fingindo ser backup;
- exige encontrar dados de `User`, `Household`, `Gasto`, `Receita`, `Orcamento`
  e `Meta`. Um dump do banco errado também abre; sem essa checagem, apontar a
  URL para o banco errado passaria despercebido;
- deixa pasta em `700` e arquivo em `600`. Nome, e-mail e comprovante estão
  cifrados, mas valor, data, categoria e quem gastou estão em claro;
- carimba a origem no nome (`family-finance_local_...` x
  `family-finance_ep-xxx_...`), para um teste contra o banco local nunca empurrar
  um backup de produção para fora da rotação.

## Onde isso costuma falhar

- **"não achei o pg_dump"** no agendamento, mas funciona à mão: o `launchd`
  roda com um PATH mínimo, sem Homebrew. O script procura nos caminhos usuais e
  aceita a variável `PG_DUMP`; o `agendar-backup.sh` grava o caminho absoluto do
  `node` pelo mesmo motivo.
- **conexão que não completa**: o banco gratuito suspende por inatividade e
  demora a acordar. O script espera 30 segundos e desiste — rodar de novo
  costuma resolver.
- **a senha mudou**: rotacionar o papel no Neon invalida a URL guardada. Refaça
  o passo 2.
