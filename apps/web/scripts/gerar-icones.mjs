/**
 * Gera os ícones PNG do Family Finance sem depender de biblioteca de imagem:
 * escreve o PNG na mão com zlib.
 *
 *   node scripts/gerar-icones.mjs
 *
 * O desenho é o "FF" da marca: dois F entrelaçados sob um telhado. O traço
 * horizontal do primeiro F se estende e vira o braço do segundo — daí o
 * entrelaçamento. O telhado, em verde menta, fecha a ideia de casa; o azul
 * escuro do fundo é a parte de confiança.
 *
 * Tudo é geometria simples de propósito: o ícone precisa continuar legível a
 * 48px na tela inicial do celular.
 */
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'public');
// Mesmo desenho para o app nativo, para a marca ser a mesma nos dois.
const DESTINO_MOBILE = join(RAIZ, '..', 'mobile', 'assets');

/** Azul escuro: confiança. Verde menta: dinheiro que cresce. */
const AZUL = [15, 58, 95];
const MENTA = [45, 212, 167];
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

/** Quanto do ponto (x, y) cai dentro de um traço grosso de A até B. */
function coberturaSegmento(x, y, ax, ay, bx, by, espessura) {
  const dx = bx - ax;
  const dy = by - ay;
  const comprimentoQuadrado = dx * dx + dy * dy;
  const t =
    comprimentoQuadrado === 0
      ? 0
      : Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / comprimentoQuadrado));
  const distancia = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
  return distancia <= espessura / 2 ? 1 : 0;
}

/**
 * `margemSegura` reserva a borda que o Android recorta em ícones "maskable":
 * o desenho fica dentro dos 80% centrais.
 */
function desenharIcone(tamanho, { margemSegura = false, fundoTransparente = false } = {}) {
  const pixels = Buffer.alloc(tamanho * tamanho * 4, 0);
  const AMOSTRAS = 3; // supersampling: bordas sem serrilhado

  const margem = margemSegura ? tamanho * 0.1 : 0;
  const lado = tamanho - margem * 2;
  const raioFundo = lado * (margemSegura ? 0.5 : 0.22);

  // Grade do monograma, em fração do lado.
  const u = lado / 100;
  const px0 = margem + 22 * u; // haste do primeiro F
  const px1 = margem + 55 * u; // haste do segundo F
  const topo = margem + 40 * u;
  const base = margem + 78 * u;
  const traco = 9 * u;

  // Telhado: duas diagonais que se encontram no alto, sobre os dois F.
  const cumeeiraX = margem + 50 * u;
  const cumeeiraY = margem + 20 * u;
  const beiralEsquerdoX = margem + 16 * u;
  const beiralDireitoX = margem + 84 * u;
  const beiralY = margem + 33 * u;

  for (let y = 0; y < tamanho; y += 1) {
    for (let x = 0; x < tamanho; x += 1) {
      const indice = (y * tamanho + x) * 4;

      let fundo = 0;
      let telhado = 0;
      let letras = 0;

      for (let sy = 0; sy < AMOSTRAS; sy += 1) {
        for (let sx = 0; sx < AMOSTRAS; sx += 1) {
          const ax = x + (sx + 0.5) / AMOSTRAS;
          const ay = y + (sy + 0.5) / AMOSTRAS;

          fundo += coberturaRetanguloArredondado(ax, ay, margem, margem, lado, lado, raioFundo);

          telhado += Math.min(
            1,
            coberturaSegmento(ax, ay, beiralEsquerdoX, beiralY, cumeeiraX, cumeeiraY, traco) +
              coberturaSegmento(ax, ay, cumeeiraX, cumeeiraY, beiralDireitoX, beiralY, traco),
          );

          // Hastes verticais dos dois F.
          let letra =
            coberturaRetanguloArredondado(ax, ay, px0, topo, traco, base - topo, traco / 2) +
            coberturaRetanguloArredondado(ax, ay, px1, topo, traco, base - topo, traco / 2);

          // Braço de cima: sai do primeiro F e atravessa até o segundo — é o
          // traço que entrelaça as duas letras.
          letra += coberturaRetanguloArredondado(
            ax,
            ay,
            px0,
            topo,
            margem + 78 * u - px0,
            traco,
            traco / 2,
          );

          // Braço do meio de cada F, mais curto.
          letra += coberturaRetanguloArredondado(ax, ay, px0, topo + 15 * u, 18 * u, traco, traco / 2);
          letra += coberturaRetanguloArredondado(ax, ay, px1, topo + 15 * u, 18 * u, traco, traco / 2);

          letras += Math.min(1, letra);
        }
      }

      const total = AMOSTRAS * AMOSTRAS;
      if (!fundoTransparente && fundo > 0) misturar(pixels, indice, AZUL, fundo / total);
      if (telhado > 0) misturar(pixels, indice, MENTA, Math.min(1, telhado / total));
      // As letras entram depois: onde encostam no telhado, quem manda é o F.
      if (letras > 0) {
        misturar(pixels, indice, fundoTransparente ? MENTA : BRANCO, Math.min(1, letras / total));
      }
    }
  }

  return escreverPng(tamanho, tamanho, pixels);
}

/** Quadrado inteiro na cor da marca, para a camada de fundo do Android. */
function fundoChapado(tamanho) {
  const pixels = Buffer.alloc(tamanho * tamanho * 4);
  for (let i = 0; i < tamanho * tamanho; i += 1) {
    pixels[i * 4] = AZUL[0];
    pixels[i * 4 + 1] = AZUL[1];
    pixels[i * 4 + 2] = AZUL[2];
    pixels[i * 4 + 3] = 255;
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
  console.log(`web/public/${nome} — ${(conteudo.length / 1024).toFixed(1)} KB`);
}

// Expo pede 1024×1024. O ícone adaptativo do Android é montado em duas camadas:
// fundo chapado e desenho com margem de recorte.
if (existsSync(DESTINO_MOBILE)) {
  const doApp = [
    ['icon.png', desenharIcone(1024)],
    ['splash-icon.png', desenharIcone(1024, { margemSegura: true })],
    ['favicon.png', desenharIcone(48)],
    ['android-icon-foreground.png', desenharIcone(512, { margemSegura: true, fundoTransparente: true })],
    ['android-icon-monochrome.png', desenharIcone(432, { margemSegura: true, fundoTransparente: true })],
  ];
  for (const [nome, conteudo] of doApp) {
    writeFileSync(join(DESTINO_MOBILE, nome), conteudo);
    console.log(`mobile/assets/${nome} — ${(conteudo.length / 1024).toFixed(1)} KB`);
  }
  // Fundo do ícone adaptativo: verde chapado, sem desenho.
  writeFileSync(join(DESTINO_MOBILE, 'android-icon-background.png'), fundoChapado(512));
  console.log('mobile/assets/android-icon-background.png');
}
