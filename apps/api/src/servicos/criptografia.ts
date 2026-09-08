import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { ambiente } from '../ambiente.js';

/**
 * Criptografia dos dados pessoais guardados no banco.
 *
 * O que é cifrado: o nome e o e-mail de quem usa, e os bytes dos comprovantes.
 * O que NÃO é, de propósito: o valor dos gastos (os resumos somam no SQL, e
 * número cifrado não soma) e a descrição (a busca usa `contains` no banco).
 *
 * O ponto disto é o vazamento do banco — dump, backup, réplica, o painel da
 * hospedagem. Por isso a chave mora fora do banco, no ambiente: guardá-la numa
 * tabela ao lado dos dados (como fazemos com os segredos do JWT, onde faz
 * sentido) deixaria a chave viajar junto com o que ela protege.
 *
 * AES-256-GCM: além de cifrar, autentica. Byte trocado no banco vira erro na
 * leitura, e não texto silenciosamente errado.
 */

/**
 * Uma chave mestra, duas derivadas: a que cifra nunca é a que indexa. Sem essa
 * separação, o mesmo segredo faria dois trabalhos diferentes — e um problema
 * num deles contaminaria o outro.
 */
const MESTRA = Buffer.from(ambiente.CHAVE_CRIPTOGRAFIA, 'hex');

function derivar(uso: string): Buffer {
  return Buffer.from(hkdfSync('sha256', MESTRA, Buffer.alloc(0), uso, 32));
}

const CHAVE_AES = derivar('gastos:aes-256-gcm:v1');
const CHAVE_INDICE = derivar('gastos:indice-cego:v1');

const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;

/**
 * Marca de "isto está cifrado", e a versão do formato.
 *
 * Serve para conviver com as linhas que já existiam em texto puro: o que não
 * tem a marca é lido como está. Sem isso, ligar a criptografia num banco com
 * dados dentro exigiria migrar tudo no mesmo instante, de uma vez, sem erro.
 *
 * `GFE1` como marca dos bytes porque nenhum JPEG (`FF D8 FF`), PNG
 * (`89 50 4E 47`) ou PDF (`%PDF`) começa assim.
 */
const PREFIXO_TEXTO = 'v1$';
const MARCA_BYTES = Buffer.from('GFE1', 'ascii');

function selar(claro: Buffer): Buffer {
  // IV novo a cada escrita: em GCM, repetir IV com a mesma chave é o erro que
  // quebra a cifra de verdade.
  const iv = randomBytes(TAMANHO_IV);
  const cifra = createCipheriv('aes-256-gcm', CHAVE_AES, iv);
  const corpo = Buffer.concat([cifra.update(claro), cifra.final()]);
  return Buffer.concat([iv, cifra.getAuthTag(), corpo]);
}

function abrir(selado: Buffer): Buffer {
  const iv = selado.subarray(0, TAMANHO_IV);
  const tag = selado.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG);
  const decifra = createDecipheriv('aes-256-gcm', CHAVE_AES, iv);
  decifra.setAuthTag(tag);
  return Buffer.concat([
    decifra.update(selado.subarray(TAMANHO_IV + TAMANHO_TAG)),
    decifra.final(),
  ]);
}

export function cifrar(texto: string): string {
  return PREFIXO_TEXTO + selar(Buffer.from(texto, 'utf8')).toString('base64');
}

/** Texto sem a marca é linha anterior à criptografia: devolvido como está. */
export function decifrar(guardado: string): string {
  if (!guardado.startsWith(PREFIXO_TEXTO)) return guardado;
  return abrir(Buffer.from(guardado.slice(PREFIXO_TEXTO.length), 'base64')).toString('utf8');
}

export function cifrarBytes(dados: Buffer): Buffer {
  return Buffer.concat([MARCA_BYTES, selar(dados)]);
}

/**
 * Se estes bytes já passaram por `cifrarBytes`.
 *
 * Exportada porque o backfill precisa da mesma pergunta, e comparar a marca na
 * mão lá seria uma segunda cópia dela: divergindo as duas, o script recifraria
 * comprovantes já cifrados e o download passaria a devolver o envelope em vez
 * da foto — todos de uma vez.
 */
export function bytesEstaoCifrados(guardado: Buffer): boolean {
  return guardado.subarray(0, MARCA_BYTES.length).equals(MARCA_BYTES);
}

export function decifrarBytes(guardado: Buffer): Buffer {
  if (!bytesEstaoCifrados(guardado)) return guardado;
  return abrir(guardado.subarray(MARCA_BYTES.length));
}

/**
 * Índice cego do e-mail: é por ele que o login acha a conta.
 *
 * O e-mail cifrado muda a cada escrita (IV novo), então não dá para procurar
 * por ele. Este HMAC é estável para o mesmo e-mail e, sem a chave, não volta
 * ao endereço — quem lê o banco vê um hash, não uma lista de clientes.
 *
 * HMAC e não SHA-256 puro justamente por isso: sem chave, um dump de hashes de
 * e-mail se quebra testando endereços conhecidos.
 *
 * A normalização repete a do `zEmail` (trim + minúsculas), para o índice casar
 * com o que o schema entrega em qualquer caminho de entrada.
 */
export function indiceDeEmail(email: string): string {
  return createHmac('sha256', CHAVE_INDICE)
    .update(email.trim().toLowerCase().normalize('NFKC'))
    .digest('hex');
}
