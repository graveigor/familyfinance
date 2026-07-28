import { erroValidacao } from '@gastos/core';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Comprovantes ficam em disco, não no banco: imagem em coluna incha o backup e
 * deixa toda consulta mais lenta. O banco guarda só o nome do arquivo.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
export const PASTA_DE_COMPROVANTES = resolve(AQUI, '../../arquivos/comprovantes');

const TIPOS_ACEITOS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'application/pdf': '.pdf',
};

export const TAMANHO_MAXIMO_COMPROVANTE = 8 * 1024 * 1024;

export function extensaoDoTipo(tipo: string): string {
  const extensao = TIPOS_ACEITOS[tipo.toLowerCase()];
  if (!extensao) {
    throw erroValidacao(
      'Esse tipo de arquivo não serve como comprovante. Envie uma foto (JPG, PNG) ou um PDF.',
    );
  }
  return extensao;
}

/**
 * O arquivo é gravado dentro da pasta do household e o nome é sorteado — nada
 * do que o usuário digitou vira caminho, então não há como escapar da pasta.
 */
export async function guardarComprovante(
  householdId: string,
  conteudo: Buffer,
  tipo: string,
): Promise<string> {
  const extensao = extensaoDoTipo(tipo);
  const nome = `${randomUUID()}${extensao}`;
  const pasta = join(PASTA_DE_COMPROVANTES, householdId);

  await mkdir(pasta, { recursive: true });
  await writeFile(join(pasta, nome), conteudo);

  return nome;
}

/** Caminho absoluto de um comprovante, já conferido contra travessia de pasta. */
export function caminhoDoComprovante(householdId: string, nome: string): string {
  const alvo = resolve(PASTA_DE_COMPROVANTES, householdId, nome);
  const raizDoHousehold = resolve(PASTA_DE_COMPROVANTES, householdId);
  if (!alvo.startsWith(`${raizDoHousehold}/`)) {
    throw erroValidacao('Comprovante inválido.');
  }
  return alvo;
}

export async function apagarComprovante(householdId: string, nome: string): Promise<void> {
  try {
    await unlink(caminhoDoComprovante(householdId, nome));
  } catch {
    // Já não existe: o objetivo (não existir mais) está cumprido.
  }
}

export function tipoDoArquivo(nome: string): string {
  const extensao = extname(nome).toLowerCase();
  const par = Object.entries(TIPOS_ACEITOS).find(([, ext]) => ext === extensao);
  return par?.[0] ?? 'application/octet-stream';
}
