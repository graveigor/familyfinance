/**
 * Cópia de segurança do banco de produção.
 *
 * Existe porque o plano gratuito do Neon restaura só algumas horas para trás,
 * e este banco guarda nome, e-mail e a vida financeira de pessoas reais. Um
 * `DELETE` errado percebido no dia seguinte, sem isto aqui, é perda definitiva.
 *
 * O que ele faz, nesta ordem:
 *  1. lê a URL do banco de um arquivo FORA do git (o mesmo padrão do
 *     `.env.producao.local`, que já guarda a chave de criptografia);
 *  2. roda `pg_dump` no formato `custom`, que é comprimido e restaura com
 *     `pg_restore` — inclusive tabela por tabela, se o estrago for pontual;
 *  3. confere que o arquivo gerado ABRE (`pg_restore --list`). Dump que não
 *     abre é pior que dump nenhum: dá a sensação de estar protegido;
 *  4. apaga os mais antigos, guardando os últimos N.
 *
 * O dump sai do jeito que está no banco — ou seja, **nome, e-mail e
 * comprovantes continuam cifrados** pela `CHAVE_CRIPTOGRAFIA`. Um backup
 * sozinho não serve para ler os dados de ninguém; para restaurar de verdade é
 * preciso ter também a chave. É por isso que ela precisa estar no gerenciador
 * de senhas, e não só aqui no Mac.
 *
 * Uso:
 *   node apps/api/scripts/backup.mjs
 *   node apps/api/scripts/backup.mjs --destino ~/Backups/family-finance
 *
 * Variáveis (do `.env.backup.local`, na raiz de `apps/api`):
 *   DATABASE_URL_BACKUP  URL do banco a copiar. Use a DIRETA (unpooled) do
 *                        Neon: o endereço com pool derruba dump longo.
 *   BACKUP_DESTINO       pasta de saída (padrão: ~/Backups/family-finance)
 *   BACKUP_MANTER        quantos arquivos manter (padrão: 14)
 */

import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_DA_API = resolve(AQUI, '..');
const ARQUIVO_DE_SEGREDOS = join(RAIZ_DA_API, '.env.backup.local');
const MANTER_PADRAO = 14;

/**
 * Sai com uma explicação de gente, não com um rastro de pilha — e avisa na
 * tela.
 *
 * O aviso não é enfeite: rodando pelo agendamento, a única saída é um log que
 * ninguém lê justamente porque a coisa "funciona". Banco suspenso, senha
 * rotacionada, versão do node trocada — qualquer um desses deixaria o backup
 * falhando calado por semanas, e a descoberta seria no dia de restaurar.
 */
function desistir(mensagem, comoResolver) {
  console.error(`\n✖ ${mensagem}\n`);
  if (comoResolver) console.error(`${comoResolver}\n`);
  try {
    execFileSync('/usr/bin/osascript', [
      '-e',
      `display notification "${mensagem.replace(/["\\]/g, '')}" ` +
        'with title "O backup do Family Finance falhou"',
    ]);
  } catch {
    // Sem interface (ssh, ninguém logado): o log é o que dá.
  }
  process.exit(1);
}

/**
 * Lê `CHAVE=valor` de um arquivo .env simples. Não vale a pena uma dependência
 * para isto: não há aspas nem interpolação neste arquivo, que é escrito à mão.
 */
function lerSegredos(caminho) {
  if (!existsSync(caminho)) return {};
  const valores = {};
  for (const linha of readFileSync(caminho, 'utf8').split('\n')) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const corte = limpa.indexOf('=');
    if (corte === -1) continue;
    valores[limpa.slice(0, corte).trim()] = limpa.slice(corte + 1).trim();
  }
  return valores;
}

function argumento(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

/** `~/Backups/x` → `/Users/alguem/Backups/x`. O shell expande; o Node, não. */
function comHome(caminho) {
  return caminho.startsWith('~') ? join(homedir(), caminho.slice(1)) : caminho;
}

/**
 * Caminho do `pg_dump`. O PATH do `launchd` é mínimo e não tem o Homebrew, e
 * foi exatamente assim que o agendamento falhou calado da primeira vez.
 */
function acharPgDump() {
  const candidatos = [
    process.env.PG_DUMP,
    '/opt/homebrew/bin/pg_dump',
    '/opt/homebrew/opt/postgresql@17/bin/pg_dump',
    '/usr/local/bin/pg_dump',
    '/usr/bin/pg_dump',
  ].filter(Boolean);

  for (const caminho of candidatos) {
    if (existsSync(caminho)) return caminho;
  }
  try {
    return execFileSync('which', ['pg_dump'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Quebra a URL do banco nas variáveis que o libpq entende.
 *
 * Não é frescura: a URL inteira não pode ir como argumento do `pg_dump`,
 * porque argumento de processo é legível por qualquer `ps` — e esta URL tem a
 * senha do banco de produção dentro. `PGDATABASE` sozinha também não serve:
 * ela espera o NOME do banco, não uma URL, e o erro que ela dá ("database
 * postgresql://... does not exist") manda procurar no lugar errado.
 */
function ambienteDaConexao(url) {
  let endereco;
  try {
    endereco = new URL(url);
  } catch {
    desistir(
      'A DATABASE_URL_BACKUP não parece uma URL.',
      'Ela começa com postgresql:// e termina com o nome do banco.',
    );
  }

  const parametro = (nome) => endereco.searchParams.get(nome);
  const local = ['localhost', '127.0.0.1', '::1'].includes(endereco.hostname);

  return {
    PGHOST: endereco.hostname,
    PGPORT: endereco.port || '5432',
    PGUSER: decodeURIComponent(endereco.username),
    PGPASSWORD: decodeURIComponent(endereco.password),
    PGDATABASE: decodeURIComponent(endereco.pathname.slice(1)),
    // O Neon só aceita conexão cifrada; em banco local, exigir TLS quebraria.
    // `verify-full` e não `require`: `require` garante que a conexão é
    // cifrada, não COM QUEM. Numa cópia do banco de produção, a diferença
    // importa. (A URL do Neon normalmente já traz o `sslmode`, e aí ela manda.)
    PGSSLMODE: parametro('sslmode') ?? (local ? 'prefer' : 'verify-full'),
    ...(parametro('channel_binding') ? { PGCHANNELBINDING: parametro('channel_binding') } : {}),
    // Banco suspenso por inatividade demora a acordar; sem teto, o script
    // ficaria pendurado para sempre dentro de um agendamento.
    PGCONNECT_TIMEOUT: '30',
  };
}

/**
 * Prefixo do arquivo, com a origem no nome.
 *
 * Sem isso, um dump de teste contra o banco local entra na mesma fila da
 * rotação e **empurra um backup de produção para fora** — e, na hora do
 * aperto, nada no nome diria qual é qual.
 */
function prefixo(endereco) {
  const local = ['localhost', '127.0.0.1', '::1'].includes(endereco.hostname);
  const origem = local ? 'local' : (endereco.hostname.split('.')[0] ?? 'remoto');
  return `family-finance_${origem}`;
}

function carimbo() {
  // `2026-10-17_1432` — ordena sozinho e cabe no nome do arquivo.
  const agora = new Date();
  const d = (n) => String(n).padStart(2, '0');
  return (
    `${agora.getFullYear()}-${d(agora.getMonth() + 1)}-${d(agora.getDate())}` +
    `_${d(agora.getHours())}${d(agora.getMinutes())}`
  );
}

function apagarAntigos(pasta, inicioDoNome, manter) {
  const dumps = readdirSync(pasta)
    .filter((nome) => nome.startsWith(inicioDoNome) && nome.endsWith('.dump'))
    // Um arquivo pode sumir entre o `readdir` e o `stat` (outro backup
    // rodando). Perder a rotação é chato; morrer DEPOIS de um backup bom e
    // fazer parecer que ele falhou é pior.
    .flatMap((nome) => {
      try {
        return [{ nome, em: statSync(join(pasta, nome)).mtimeMs }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.em - a.em);

  for (const velho of dumps.slice(manter)) {
    try {
      unlinkSync(join(pasta, velho.nome));
      console.log(`  apagado ${velho.nome}`);
    } catch {
      /* já saiu da frente */
    }
  }
}

function principal() {
  const segredos = { ...lerSegredos(ARQUIVO_DE_SEGREDOS), ...process.env };

  const url = segredos.DATABASE_URL_BACKUP;
  if (!url) {
    desistir(
      'Não achei a URL do banco.',
      `Crie ${ARQUIVO_DE_SEGREDOS} com uma linha:\n\n` +
        '  DATABASE_URL_BACKUP=postgresql://...\n\n' +
        'Pegue a string de conexão DIRETA (unpooled) no painel do Neon. Esse\n' +
        'arquivo é ignorado pelo git — e tem que continuar sendo.',
    );
  }

  const pgDump = acharPgDump();
  if (!pgDump) {
    desistir(
      'Não achei o pg_dump.',
      'Instale com: brew install postgresql@17\n' +
        'Ou aponte o caminho na variável PG_DUMP.',
    );
  }

  const pasta = comHome(
    argumento('destino') ?? segredos.BACKUP_DESTINO ?? join(homedir(), 'Backups', 'family-finance'),
  );
  mkdirSync(pasta, { recursive: true });
  // `chmod` à parte, e não o `mode` do `mkdir`: o `mode` só vale quando a
  // pasta é CRIADA, e aqui ela quase sempre já existe (o agendador cria antes
  // para o log). O dump não é inofensivo: nome, e-mail e comprovante estão
  // cifrados, mas valor, data, categoria e quem gastou estão em claro.
  chmodSync(pasta, 0o700);

  const conexao = ambienteDaConexao(url);
  const arquivo = join(pasta, `${prefixo(new URL(url))}_${carimbo()}.dump`);

  // Mesmo minuto, mesmo nome: dois `pg_dump --file` no mesmo caminho produzem
  // lixo que ainda assim abre. Melhor flagrar a corrida que escondê-la.
  if (existsSync(arquivo)) {
    desistir(
      'Já existe um backup deste minuto.',
      'Outro backup está rodando agora? Espere ele terminar e tente de novo.',
    );
  }

  console.log(`Copiando o banco para ${arquivo}`);

  const dump = spawnSync(pgDump, ['--format=custom', '--no-owner', '--no-acl', `--file=${arquivo}`], {
    env: { ...process.env, ...conexao },
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  if (dump.status !== 0) {
    // Arquivo pela metade não pode sobreviver: ele teria o carimbo mais novo
    // de todos e ocuparia a vaga de um backup bom na próxima rotação.
    if (existsSync(arquivo)) unlinkSync(arquivo);
    desistir(
      `O pg_dump falhou (código ${dump.status}).`,
      'Causas comuns: a URL é a COM POOL (use a direta/unpooled), o banco está\n' +
        'suspenso por inatividade (abra o painel do Neon e espere acordar), ou a\n' +
        'senha mudou desde que você colou a URL.',
    );
  }

  // Dump que não abre não é backup. Esta conferência é o motivo de o formato
  // ser `custom`: `pg_restore --list` lê o índice sem restaurar nada.
  const pgRestore = pgDump.replace(/pg_dump$/, 'pg_restore');
  if (!existsSync(pgRestore)) {
    unlinkSync(arquivo);
    desistir(
      `Achei o pg_dump em ${pgDump}, mas nenhum pg_restore ao lado dele.`,
      'Sem o pg_restore não dá para conferir se o dump abre — e dump não\n' +
        'conferido não é backup. Instale o pacote completo do Postgres.',
    );
  }

  const conferencia = spawnSync(pgRestore, ['--list', arquivo], { encoding: 'utf8' });
  const comDados = new Set(
    (conferencia.stdout ?? '')
      .split('\n')
      .map((linha) => / TABLE DATA \S+ (\S+) /.exec(linha)?.[1])
      .filter(Boolean),
  );

  // Não basta "o arquivo abre": um dump do banco errado também abre. Estas
  // seis tabelas são o coração do app — se alguma faltar, isto não é a cópia
  // que se pensa que é.
  const ESPERADAS = ['User', 'Household', 'Gasto', 'Receita', 'Orcamento', 'Meta'];
  const faltando = ESPERADAS.filter((tabela) => !comDados.has(tabela));
  if (conferencia.status !== 0 || faltando.length > 0) {
    unlinkSync(arquivo);
    desistir(
      conferencia.status !== 0
        ? 'O arquivo foi gerado mas não abre — não conte com ele.'
        : `O dump abre, mas está sem dados de: ${faltando.join(', ')}.`,
      'Confira se a DATABASE_URL_BACKUP aponta mesmo para o banco certo.',
    );
  }

  chmodSync(arquivo, 0o600);
  const tamanho = (statSync(arquivo).size / 1024 / 1024).toFixed(1);
  console.log(`✓ ${tamanho} MB, ${comDados.size} tabelas com dados, e o arquivo abre.`);

  const manter = Number(segredos.BACKUP_MANTER ?? MANTER_PADRAO);
  if (Number.isFinite(manter) && manter > 0) {
    apagarAntigos(pasta, `${prefixo(new URL(url))}_`, manter);
  }

  console.log(
    '\nPara restaurar num banco vazio:\n' +
      `  pg_restore --clean --if-exists --no-owner -d "<URL>" "${arquivo}"\n` +
      'Lembre que nome, e-mail e comprovantes voltam CIFRADOS: sem a\n' +
      'CHAVE_CRIPTOGRAFIA o banco restaurado não serve para nada.',
  );
}

principal();
