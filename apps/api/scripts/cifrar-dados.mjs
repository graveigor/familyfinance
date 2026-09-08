/**
 * Cifra o que já estava no banco em texto puro, e preenche o índice do e-mail.
 *
 * Roda depois das migrações, na publicação. Precisa existir como script
 * separado porque a chave mora no ambiente, e não no banco: SQL não alcança.
 *
 * É idempotente — reler o que já está cifrado não faz nada. Pode rodar em toda
 * publicação sem medo, e é o que acontece: é assim que uma linha que tenha
 * escapado é pega na vez seguinte.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_DA_API = resolve(AQUI, '..');

// O `ambiente.js` procura o .env a partir do diretório de trabalho, e este
// script é chamado da raiz do monorepo (como o migrar.mjs).
process.chdir(RAIZ_DA_API);

const CRIPTOGRAFIA = join(RAIZ_DA_API, 'dist', 'servicos', 'criptografia.js');
if (!existsSync(CRIPTOGRAFIA)) {
  console.error(
    `Não achei ${CRIPTOGRAFIA}. Este script usa o código já compilado — ` +
      'rode "npm run build -w @gastos/api" antes.',
  );
  process.exit(1);
}

const { cifrar, decifrar, cifrarBytes, bytesEstaoCifrados, indiceDeEmail } =
  await import(CRIPTOGRAFIA);
const { PrismaClient } = await import('@prisma/client');

const prisma = new PrismaClient();

/**
 * Quantos comprovantes por vez. Cada um pode ter 3 MB (ver
 * `TAMANHO_MAXIMO_COMPROVANTE`), e cada um vira três buffers em memória — o
 * lido, o cifrado e a cópia do meio. Cinco é o que cabe com folga no container
 * de build; cinquenta chegava perto de 300 MB no pior caso.
 */
const LOTE = 5;

/** Os ids que falharam, para o relatório do fim. Uma linha ruim não para tudo. */
const falhas = [];

async function cifrarUsuarios() {
  const usuarios = await prisma.user.findMany({
    select: { id: true, nome: true, email: true, emailIndice: true },
  });

  let mexidos = 0;
  for (const usuario of usuarios) {
    try {
      // `decifrar` devolve o texto puro intacto quando a linha é antiga, então
      // isto funciona tanto para migrar quanto para reparar um índice errado.
      const email = decifrar(usuario.email);
      const nome = decifrar(usuario.nome);
      const indice = indiceDeEmail(email);

      // `decifrar` só devolve o mesmo texto que entrou quando a linha ainda
      // está em claro. É esse o teste de "falta cifrar" — e é o que impede
      // recifrar a cada execução, o que geraria escrita sem fim (IV novo toda
      // vez).
      const dados = {};
      if (usuario.email === email) dados.email = cifrar(email);
      if (usuario.nome === nome) dados.nome = cifrar(nome);
      if (usuario.emailIndice !== indice) dados.emailIndice = indice;

      if (Object.keys(dados).length === 0) continue;
      await prisma.user.update({ where: { id: usuario.id }, data: dados });
      mexidos += 1;
    } catch (falha) {
      // Seguir em frente: parar na primeira linha ruim deixaria os
      // comprovantes sem cifrar e não diria qual linha é o problema.
      const motivo =
        falha?.code === 'P2002'
          ? 'já existe outra conta com este mesmo e-mail (índice duplicado)'
          : (falha?.message ?? String(falha));
      falhas.push(`User ${usuario.id}: ${motivo}`);
    }
  }
  return { total: usuarios.length, mexidos };
}

async function cifrarComprovantes() {
  const ids = await prisma.comprovante.findMany({ select: { id: true } });

  let mexidos = 0;
  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = await prisma.comprovante.findMany({
      where: { id: { in: ids.slice(i, i + LOTE).map((c) => c.id) } },
      select: { id: true, dados: true },
    });

    for (const comprovante of lote) {
      try {
        const bytes = Buffer.from(comprovante.dados);
        // A mesma checagem que o `decifrarBytes` usa — não uma cópia dela.
        if (bytesEstaoCifrados(bytes)) continue;
        await prisma.comprovante.update({
          where: { id: comprovante.id },
          data: { dados: cifrarBytes(bytes) },
        });
        mexidos += 1;
      } catch (falha) {
        falhas.push(`Comprovante ${comprovante.id}: ${falha?.message ?? String(falha)}`);
      }
    }
  }
  return { total: ids.length, mexidos };
}

try {
  const usuarios = await cifrarUsuarios();
  console.log(`Usuários: ${usuarios.mexidos} de ${usuarios.total} atualizados.`);

  const comprovantes = await cifrarComprovantes();
  console.log(`Comprovantes: ${comprovantes.mexidos} de ${comprovantes.total} cifrados.`);

  // A migração deixa `pendente:<id>` no índice até o backfill passar. Uma linha
  // que fique assim com o código novo no ar não é achada pelo login — e um
  // novo cadastro com o mesmo e-mail criaria uma segunda conta, deixando a
  // original inalcançável. Melhor reprovar o build aqui.
  const pendentes = await prisma.user.count({
    where: { emailIndice: { startsWith: 'pendente:' } },
  });
  if (pendentes > 0) {
    falhas.push(`${pendentes} usuário(s) continuam sem índice de e-mail.`);
  }

  if (falhas.length > 0) {
    console.error(`\nNão foi possível cifrar ${falhas.length} registro(s):`);
    for (const falha of falhas) console.error(`  - ${falha}`);
    process.exit(1);
  }
} catch (falha) {
  console.error('Falha ao cifrar os dados existentes:', falha);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
