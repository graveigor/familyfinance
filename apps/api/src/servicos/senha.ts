import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

// `promisify` só enxerga a sobrecarga de 3 argumentos; declaramos a que recebe
// as opções de custo.
const scryptAsync = promisify(scrypt) as (
  senha: string | Buffer,
  salt: string | Buffer,
  tamanho: number,
  opcoes: ScryptOptions,
) => Promise<Buffer>;

/**
 * Hash de senha com scrypt (nativo do Node, sem dependência externa).
 * Formato guardado: `scrypt$N$r$p$saltHex$hashHex` — os parâmetros ficam no
 * próprio registro, então dá para aumentar o custo no futuro sem invalidar as
 * senhas já existentes.
 */
const N = 16_384;
const r = 8;
const p = 1;
const TAMANHO_CHAVE = 64;

export async function gerarHashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const derivada = await scryptAsync(senha.normalize('NFKC'), salt, TAMANHO_CHAVE, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${derivada.toString('hex')}`;
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const partes = guardado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, nTexto, rTexto, pTexto, saltHex, hashHex] = partes;
  if (!nTexto || !rTexto || !pTexto || !saltHex || !hashHex) return false;

  const esperado = Buffer.from(hashHex, 'hex');
  const derivada = await scryptAsync(
    senha.normalize('NFKC'),
    Buffer.from(saltHex, 'hex'),
    esperado.length,
    { N: Number(nTexto), r: Number(rTexto), p: Number(pTexto) },
  );

  // Comparação de tempo constante evita vazar informação pelo tempo de resposta.
  return derivada.length === esperado.length && timingSafeEqual(derivada, esperado);
}
