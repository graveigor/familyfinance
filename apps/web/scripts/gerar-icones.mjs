/**
 * Gera os ícones PNG do app (instalação no celular e no computador) sem
 * depender de nenhuma biblioteca de imagem: escreve o PNG na mão com zlib.
 *
 *   node scripts/gerar-icones.mjs
 *
 * Desenho: quadrado arredondado verde com três barras brancas crescentes —
 * legível mesmo em 48px na tela inicial.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'public');

const VERDE = [22, 163, 74];
const BRANCO = [255, 255, 255];

// --- PNG mínimo (cor verdadeira com alfa, sem filtro) -----------------------

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

function escreverPng(largura, altura, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  // 10, 11, 12 = compressão, filtro e entrelaçamento padrão (zero)

  // Cada linha começa com o byte de filtro 0 ("nenhum").
  const linhas = Buffer.alloc(altura * (largura * 4 + 1));
  for (let y = 0; y < altura; y += 1) {
    const inicioLinha = y * (largura * 4 + 1);
    linhas[inicioLinha] = 0;
    pixels.copy(linhas, inicioLinha + 1, y * largura * 4, (y + 1) * largura * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(linhas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Desenho ----------------------------------------------------------------

/** Quanto do ponto (x, y) está dentro do retângulo arredondado: 0 a 1. */
function coberturaRetanguloArredondado(x, y, esquerda, topo, largura, altura, raio) {
  const direita = esquerda + largura;
  const base = topo + altura;
  if (x < esquerda || x > direita || y < topo || y > base) return 0;

  const cx = Math.min(Math.max(x, esquerda + raio), direita - raio);
  const cy = Math.min(Math.max(y, topo + raio), base - raio);
  const distancia = Math.hypot(x - cx, y - cy);
  return distancia <= raio ? 1 : 0;
}

function misturar(destino, indice, cor, alfa) {
  for (let canal = 0; canal < 3; canal += 1) {
    destino[indice + canal] = Math.round(
      destino[indice + canal] * (1 - alfa) + cor[canal] * alfa,
    );
  }
  destino[indice + 3] = Math.round(destino[indice + 3] * (1 - alfa) + 255 * alfa);
}

/**
 * `margemSegura` reserva a borda que o Android recorta em ícones "maskable":
 * o desenho fica dentro dos 80% centrais.
 */
function desenharIcone(tamanho, { margemSegura = false, fundoTransparente = false } = {}) {
  const pixels = Buffer.alloc(tamanho * tamanho * 4, 0);
  const AMOSTRAS = 3; // supersampling: bordas sem serrilhado

  const margem = margemSegura ? tamanho * 0.1 : 0;
  const ladoFundo = tamanho - margem * 2;
  const raioFundo = ladoFundo * (margemSegura ? 0.5 : 0.22);

  // Três barras crescentes, centralizadas no fundo.
  const larguraBarra = ladoFundo * 0.145;
  const espaco = ladoFundo * 0.075;
  const larguraTotal = larguraBarra * 3 + espaco * 2;
  const inicioBarras = margem + (ladoFundo - larguraTotal) / 2;
  const baseBarras = margem + ladoFundo * 0.74;
  const alturas = [0.2, 0.33, 0.46].map((fracao) => ladoFundo * fracao);
  const raioBarra = larguraBarra / 2;

  for (let y = 0; y < tamanho; y += 1) {
    for (let x = 0; x < tamanho; x += 1) {
      const indice = (y * tamanho + x) * 4;

      let coberturaFundo = 0;
      let coberturaBarras = 0;
      for (let sy = 0; sy < AMOSTRAS; sy += 1) {
        for (let sx = 0; sx < AMOSTRAS; sx += 1) {
          const px = x + (sx + 0.5) / AMOSTRAS;
          const py = y + (sy + 0.5) / AMOSTRAS;

          coberturaFundo += coberturaRetanguloArredondado(
            px,
            py,
            margem,
            margem,
            ladoFundo,
            ladoFundo,
            raioFundo,
          );

          for (let b = 0; b < 3; b += 1) {
            const altura = alturas[b];
            coberturaBarras += coberturaRetanguloArredondado(
              px,
              py,
              inicioBarras + b * (larguraBarra + espaco),
              baseBarras - altura,
              larguraBarra,
              altura,
              raioBarra,
            );
          }
        }
      }

      const total = AMOSTRAS * AMOSTRAS;
      if (!fundoTransparente && coberturaFundo > 0) {
        misturar(pixels, indice, VERDE, coberturaFundo / total);
      }
      if (coberturaBarras > 0) {
        misturar(pixels, indice, BRANCO, Math.min(1, coberturaBarras / total));
      }
    }
  }

  return escreverPng(tamanho, tamanho, pixels);
}

mkdirSync(DESTINO, { recursive: true });

const arquivos = [
  ['icone-192.png', desenharIcone(192)],
  ['icone-512.png', desenharIcone(512)],
  ['icone-maskable-512.png', desenharIcone(512, { margemSegura: true })],
  // iOS não aplica cantos arredondados por conta própria em Web Apps, mas o
  // ícone já vem com eles.
  ['apple-touch-icon.png', desenharIcone(180)],
  ['favicon-32.png', desenharIcone(32)],
];

for (const [nome, conteudo] of arquivos) {
  writeFileSync(join(DESTINO, nome), conteudo);
  console.log(`${nome} — ${(conteudo.length / 1024).toFixed(1)} KB`);
}
