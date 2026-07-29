import { randomBytes } from 'node:crypto';
import { ambiente } from '../ambiente.js';
import { prisma } from '../prisma.js';

/**
 * Os segredos que assinam o login.
 *
 * Podem vir do ambiente (`JWT_SEGREDO` e `JWT_SEGREDO_REFRESH`) — é o que se
 * espera de uma instalação controlada. Quando não vêm, o servidor gera os seus
 * na primeira vez e guarda no banco.
 *
 * Isso existe para publicar o app não depender de alguém criar e colar chaves
 * num painel: é o passo que mais dá errado, e o que mais leva gente a repetir
 * a mesma senha em tudo. O segredo guardado fica tão protegido quanto os dados
 * que ele protege — quem alcança o banco já alcançou os lançamentos.
 *
 * A chave gerada é estável: precisa continuar a mesma entre publicações, senão
 * todo mundo é desconectado a cada deploy.
 */

const CHAVE_ACESSO = 'jwt.segredo';
const CHAVE_REFRESH = 'jwt.segredoRefresh';

interface Segredos {
  acesso: string;
  refresh: string;
}

let emMemoria: Segredos | null = null;
let carregando: Promise<Segredos> | null = null;

async function obterOuCriar(chave: string): Promise<string> {
  const existente = await prisma.configuracao.findUnique({ where: { chave } });
  if (existente) return existente.valor;

  const valor = randomBytes(32).toString('hex');
  // Duas instâncias podem subir ao mesmo tempo e tentar criar a mesma chave.
  // Quem perder a corrida relê o que o outro gravou, em vez de sobrescrever —
  // sobrescrever invalidaria as sessões abertas.
  const gravado = await prisma.configuracao.upsert({
    where: { chave },
    create: { chave, valor },
    update: {},
  });
  return gravado.valor;
}

export async function obterSegredos(): Promise<Segredos> {
  if (emMemoria) return emMemoria;

  carregando ??= (async () => {
    const [acesso, refresh] = await Promise.all([
      ambiente.JWT_SEGREDO ?? obterOuCriar(CHAVE_ACESSO),
      ambiente.JWT_SEGREDO_REFRESH ?? obterOuCriar(CHAVE_REFRESH),
    ]);
    emMemoria = { acesso, refresh };
    return emMemoria;
  })();

  return carregando;
}

/** Só para os testes, que trocam de banco entre casos. */
export function esquecerSegredos(): void {
  emMemoria = null;
  carregando = null;
}
