import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { Idioma } from '@gastos/core';
import { Dialogo } from './Dialogo';
import { Icone } from './Icone';
import { Botao, useAviso } from './ui';
import { useIdioma, useT } from '../i18n';

/**
 * Calculadora de bolso, para a conta que aparece antes do lançamento: dividir
 * a fatura por três, somar o que cada um pôs, tirar 10% do garçom.
 *
 * Fica num atalho flutuante porque a conta acontece no meio de outra tarefa —
 * olhando a lista de gastos, conferindo o resumo. Mandar a pessoa sair da tela
 * para calcular é o que faz ela ir buscar o celular do lado.
 *
 * A aritmética é de calculadora, não de dinheiro: o app guarda valor em
 * centavos inteiros justamente para não somar em ponto flutuante, mas aqui
 * dividir por 3 é a razão de existir. Por isso a conta é em `number`, e o
 * resultado passa por `arredondar` antes de aparecer.
 */

export type Operacao = '+' | '-' | '×' | '÷';

export interface EstadoDaCalculadora {
  /** O que está na tela, sempre com `.` como separador — a tela traduz. */
  digitado: string;
  /** Operando da esquerda, à espera do segundo. */
  acumulado: number | null;
  operacao: Operacao | null;
  /** O próximo dígito começa um número novo (depois de `=` ou de um operador). */
  recomecar: boolean;
  /** Divisão por zero ou resultado fora de conta. */
  erro: boolean;
}

export const INICIAL: EstadoDaCalculadora = {
  digitado: '0',
  acumulado: null,
  operacao: null,
  recomecar: true,
  erro: false,
};

/** Teto de dígitos: acima disso a conta não cabe na tela nem no `double`. */
const MAXIMO_DE_DIGITOS = 14;

/**
 * Mata o pó do ponto flutuante: `0.1 + 0.2` vale `0.30000000000000004` em
 * JavaScript, e ninguém quer ver isso numa calculadora. Doze casas
 * significativas descartam o lixo sem comer precisão de nenhum valor que caiba
 * na tela.
 */
function arredondar(valor: number): number {
  return Number(valor.toPrecision(12));
}

/** Número -> texto canônico (separador `.`, sem zero à direita). */
export function paraTexto(valor: number): string {
  if (valor === 0) return '0';
  if (!Number.isFinite(valor)) return '0';
  // Acima de 1e21 o JavaScript escreve em notação científica, e é melhor assim:
  // ver `1e+21` é mais honesto que 21 zeros estourando a caixa.
  if (Math.abs(valor) >= 1e21) return String(valor);
  const texto = valor.toFixed(10);
  return texto.includes('.') ? texto.replace(/0+$/, '').replace(/\.$/, '') : texto;
}

function aplicar(esquerda: number, operacao: Operacao, direita: number): number | null {
  switch (operacao) {
    case '+':
      return arredondar(esquerda + direita);
    case '-':
      return arredondar(esquerda - direita);
    case '×':
      return arredondar(esquerda * direita);
    case '÷':
      // Dividir por zero daria `Infinity`, que não é resposta: a calculadora
      // diz que não dá, em vez de mostrar um símbolo que ninguém entende.
      return direita === 0 ? null : arredondar(esquerda / direita);
  }
}

/** Resolve a operação pendente, se houver. `null` quando a conta não existe. */
function resolver(estado: EstadoDaCalculadora): number | null {
  const atual = Number(estado.digitado);
  if (estado.acumulado === null || estado.operacao === null) return atual;
  return aplicar(estado.acumulado, estado.operacao, atual);
}

// --- Ações -------------------------------------------------------------------
// Funções puras: recebem o estado, devolvem o próximo. É o que deixa a conta
// testável sem montar a tela.

export function digitar(estado: EstadoDaCalculadora, tecla: string): EstadoDaCalculadora {
  if (estado.erro) estado = INICIAL;

  if (estado.recomecar) {
    return { ...estado, digitado: tecla === '0' ? '0' : tecla, recomecar: false };
  }
  // Zeros à esquerda não somam nada: `007` é `7`.
  const base = estado.digitado === '0' ? '' : estado.digitado;
  const digitos = base.replace(/[-.]/g, '').length;
  if (digitos >= MAXIMO_DE_DIGITOS) return estado;
  return { ...estado, digitado: base + tecla };
}

export function digitarSeparador(estado: EstadoDaCalculadora): EstadoDaCalculadora {
  if (estado.erro) estado = INICIAL;
  if (estado.recomecar) return { ...estado, digitado: '0.', recomecar: false };
  if (estado.digitado.includes('.')) return estado;
  return { ...estado, digitado: `${estado.digitado}.` };
}

export function escolherOperacao(
  estado: EstadoDaCalculadora,
  operacao: Operacao,
): EstadoDaCalculadora {
  if (estado.erro) return estado;

  // Trocar de operador sem ter digitado nada só troca o operador — não repete
  // a conta. É o que a pessoa quer quando erra a tecla.
  if (estado.recomecar && estado.acumulado !== null) {
    return { ...estado, operacao };
  }

  const resultado = resolver(estado);
  if (resultado === null) return { ...INICIAL, erro: true };

  return {
    digitado: paraTexto(resultado),
    acumulado: resultado,
    operacao,
    recomecar: true,
    erro: false,
  };
}

export function igualar(estado: EstadoDaCalculadora): EstadoDaCalculadora {
  if (estado.erro) return estado;
  if (estado.operacao === null) return { ...estado, recomecar: true };

  const resultado = resolver(estado);
  if (resultado === null) return { ...INICIAL, erro: true };

  return {
    digitado: paraTexto(resultado),
    acumulado: null,
    operacao: null,
    recomecar: true,
    erro: false,
  };
}

/**
 * Porcentagem como a pessoa espera, não como `valor / 100`.
 *
 * Com uma soma ou subtração pendente, `200 + 10 %` é "10% de 200" — que é a
 * conta da gorjeta e a do desconto, o motivo de existir um `%` num app de
 * gastos. Sozinho ou multiplicando, vira a fração mesmo.
 */
export function porcentagem(estado: EstadoDaCalculadora): EstadoDaCalculadora {
  if (estado.erro) return estado;

  const atual = Number(estado.digitado);
  const relativa =
    estado.acumulado !== null && (estado.operacao === '+' || estado.operacao === '-');
  const valor = relativa
    ? arredondar((estado.acumulado! * atual) / 100)
    : arredondar(atual / 100);

  return { ...estado, digitado: paraTexto(valor), recomecar: false };
}

export function inverterSinal(estado: EstadoDaCalculadora): EstadoDaCalculadora {
  if (estado.erro) return estado;
  if (estado.digitado === '0') return estado;
  return {
    ...estado,
    digitado: estado.digitado.startsWith('-')
      ? estado.digitado.slice(1)
      : `-${estado.digitado}`,
  };
}

export function apagar(estado: EstadoDaCalculadora): EstadoDaCalculadora {
  if (estado.erro) return INICIAL;
  // Depois de um `=` ou de um operador, apagar limpa a entrada em vez de
  // comer o resultado dígito por dígito.
  if (estado.recomecar) return { ...estado, digitado: '0' };

  const curto = estado.digitado.slice(0, -1);
  if (curto === '' || curto === '-') return { ...estado, digitado: '0', recomecar: true };
  return { ...estado, digitado: curto };
}

// --- Tela --------------------------------------------------------------------

/**
 * Separadores por idioma. São dois idiomas e dois jeitos de escrever número;
 * uma tabela diz isso em duas linhas e não tem caso de borda, enquanto montar
 * o texto com `Intl` obrigaria a remendar a vírgula que a pessoa acabou de
 * digitar e que o formatador apaga.
 */
const SEPARADORES: Record<Idioma, { milhar: string; decimal: string }> = {
  pt: { milhar: '.', decimal: ',' },
  en: { milhar: ',', decimal: '.' },
};

/** `"-1234.5"` -> `"-1.234,5"` em português. Preserva a vírgula recém-digitada. */
export function formatarParaTela(digitado: string, idioma: Idioma): string {
  const { milhar, decimal } = SEPARADORES[idioma];
  const negativo = digitado.startsWith('-');
  const [inteiro = '', fracao] = (negativo ? digitado.slice(1) : digitado).split('.');

  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, milhar);
  const sinal = negativo ? '-' : '';
  // `fracao` existe e vazia quando a pessoa acabou de tocar na vírgula: o
  // separador precisa aparecer, senão a tecla parece não ter funcionado.
  return fracao === undefined ? sinal + agrupado : `${sinal}${agrupado}${decimal}${fracao}`;
}

type Tecla =
  | { tipo: 'digito'; rotulo: string }
  | { tipo: 'separador' }
  | { tipo: 'operacao'; operacao: Operacao }
  | { tipo: 'igual' }
  | { tipo: 'limpar' }
  | { tipo: 'apagar' }
  | { tipo: 'sinal' }
  | { tipo: 'porcento' };

const TECLADO: Tecla[] = [
  { tipo: 'limpar' },
  { tipo: 'sinal' },
  { tipo: 'porcento' },
  { tipo: 'operacao', operacao: '÷' },
  { tipo: 'digito', rotulo: '7' },
  { tipo: 'digito', rotulo: '8' },
  { tipo: 'digito', rotulo: '9' },
  { tipo: 'operacao', operacao: '×' },
  { tipo: 'digito', rotulo: '4' },
  { tipo: 'digito', rotulo: '5' },
  { tipo: 'digito', rotulo: '6' },
  { tipo: 'operacao', operacao: '-' },
  { tipo: 'digito', rotulo: '1' },
  { tipo: 'digito', rotulo: '2' },
  { tipo: 'digito', rotulo: '3' },
  { tipo: 'operacao', operacao: '+' },
  { tipo: 'apagar' },
  { tipo: 'digito', rotulo: '0' },
  { tipo: 'separador' },
  { tipo: 'igual' },
];

/** Classes por família de tecla. Dígito é o padrão; operador e `=` são ação. */
const ESTILO_DE_TECLA: Record<string, string> = {
  digito: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300',
  separador: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300',
  apagar: 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300',
  sinal: 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300',
  porcento: 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300',
  limpar: 'bg-slate-100 font-semibold text-marca-700 hover:bg-slate-200 active:bg-slate-300',
  operacao: 'bg-marca-50 font-semibold text-marca-700 hover:bg-marca-100 active:bg-marca-200',
  igual: 'bg-marca-600 font-semibold text-white hover:bg-marca-700 active:bg-marca-800',
};

export function Calculadora({
  aberta,
  aoFechar,
}: {
  aberta: boolean;
  aoFechar: () => void;
}): ReactElement {
  const t = useT();
  const { idioma } = useIdioma();
  const { mostrar } = useAviso();
  const [estado, setEstado] = useState<EstadoDaCalculadora>(INICIAL);

  const acionar = useCallback((tecla: Tecla) => {
    setEstado((atual) => {
      switch (tecla.tipo) {
        case 'digito':
          return digitar(atual, tecla.rotulo);
        case 'separador':
          return digitarSeparador(atual);
        case 'operacao':
          return escolherOperacao(atual, tecla.operacao);
        case 'igual':
          return igualar(atual);
        case 'limpar':
          return INICIAL;
        case 'apagar':
          return apagar(atual);
        case 'sinal':
          return inverterSinal(atual);
        case 'porcento':
          return porcentagem(atual);
      }
    });
  }, []);

  // Teclado físico: quem está no computador digita a conta, não clica nela.
  // Só enquanto aberta, e sem prender o Esc — fechar é do `Dialogo`.
  useEffect(() => {
    if (!aberta) return;

    const aoTeclar = (evento: KeyboardEvent): void => {
      const { key } = evento;
      if (evento.ctrlKey || evento.metaKey || evento.altKey) return;

      if (key >= '0' && key <= '9') acionar({ tipo: 'digito', rotulo: key });
      else if (key === ',' || key === '.') acionar({ tipo: 'separador' });
      else if (key === '+') acionar({ tipo: 'operacao', operacao: '+' });
      else if (key === '-') acionar({ tipo: 'operacao', operacao: '-' });
      else if (key === '*' || key === 'x') acionar({ tipo: 'operacao', operacao: '×' });
      else if (key === '/') acionar({ tipo: 'operacao', operacao: '÷' });
      else if (key === '%') acionar({ tipo: 'porcento' });
      else if (key === '=' || key === 'Enter') acionar({ tipo: 'igual' });
      else if (key === 'Backspace') acionar({ tipo: 'apagar' });
      else if (key === 'Delete') acionar({ tipo: 'limpar' });
      else return;

      // Só depois de reconhecer a tecla: `/` abre a busca em alguns
      // navegadores, e `Enter` acionaria o botão com foco.
      evento.preventDefault();
    };

    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberta, acionar]);

  const copiar = async (): Promise<void> => {
    const texto = formatarParaTela(estado.digitado, idioma);
    try {
      await navigator.clipboard.writeText(texto);
      mostrar(t('Resultado copiado: {valor}', { valor: texto }));
    } catch {
      // Sem permissão de área de transferência (ou contexto não seguro): o
      // número está na tela, dizer o que falhou é mais útil que fingir.
      mostrar(t('Não foi possível copiar. Anote o valor da tela.'));
    }
  };

  const naTela = estado.erro
    ? t('Não dá para dividir por zero')
    : formatarParaTela(estado.digitado, idioma);

  // O que está pendente, para a conta não virar adivinhação a cada toque.
  const pendente =
    estado.acumulado !== null && estado.operacao !== null
      ? `${formatarParaTela(paraTexto(estado.acumulado), idioma)} ${estado.operacao}`
      : '';

  return (
    <Dialogo
      aberto={aberta}
      aoFechar={aoFechar}
      titulo={t('Calculadora')}
      rodape={
        <Botao
          variante="secundario"
          larguraTotal
          icone="copiar"
          onClick={copiar}
          disabled={estado.erro}
        >
          {t('Copiar resultado')}
        </Botao>
      }
    >
      <div className="rounded-2xl bg-marca-800 px-5 py-4">
        {/* Altura fixa: sem ela a caixa pula de tamanho quando a conta começa. */}
        <p className="flex h-6 items-center justify-end text-base text-marca-200 tabular-nums">
          {pendente}
        </p>
        {/* `<output>` já é região viva (papel `status`): quem usa leitor de tela
            ouve o resultado sem precisar caçá-lo. Declarar `aria-live` de novo
            faria alguns leitores anunciarem duas vezes. */}
        <output
          className={`block overflow-x-auto whitespace-nowrap text-right font-semibold
            text-white tabular-nums ${estado.erro ? 'text-xl' : 'text-4xl'}`}
        >
          {naTela}
        </output>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {TECLADO.map((tecla) => {
          const ativa =
            tecla.tipo === 'operacao' &&
            estado.operacao === tecla.operacao &&
            estado.recomecar;

          return (
            <button
              key={chaveDaTecla(tecla)}
              type="button"
              onClick={() => acionar(tecla)}
              aria-label={descricaoDaTecla(tecla, t)}
              aria-pressed={tecla.tipo === 'operacao' ? ativa : undefined}
              className={`flex h-14 items-center justify-center rounded-xl text-xl
                transition-colors ${
                  // O operador escolhido fica aceso: é a única pista de que a
                  // calculadora está esperando o segundo número.
                  ativa
                    ? 'bg-marca-600 font-semibold text-white'
                    : ESTILO_DE_TECLA[tecla.tipo]
                }`}
            >
              {tecla.tipo === 'apagar' ? (
                <Icone nome="retrocesso" tamanho={24} />
              ) : (
                rotuloDaTecla(tecla, t, idioma)
              )}
            </button>
          );
        })}
      </div>
    </Dialogo>
  );
}

/** Identidade estável para o `key` do React — nada a ver com o rótulo. */
function chaveDaTecla(tecla: Tecla): string {
  if (tecla.tipo === 'digito') return `digito-${tecla.rotulo}`;
  if (tecla.tipo === 'operacao') return `operacao-${tecla.operacao}`;
  return tecla.tipo;
}

function rotuloDaTecla(
  tecla: Tecla,
  t: (chave: string) => string,
  idioma: Idioma,
): string {
  switch (tecla.tipo) {
    case 'digito':
      return tecla.rotulo;
    case 'separador':
      return SEPARADORES[idioma].decimal;
    case 'operacao':
      return tecla.operacao === '-' ? '−' : tecla.operacao;
    case 'igual':
      return '=';
    case 'limpar':
      return t('AC');
    case 'sinal':
      return '±';
    case 'porcento':
      return '%';
    case 'apagar':
      return t('Apagar');
  }
}

/** Nome falado de cada tecla: `±` e `AC` não querem dizer nada em voz alta. */
function descricaoDaTecla(tecla: Tecla, t: (chave: string) => string): string {
  switch (tecla.tipo) {
    case 'operacao':
      return {
        '+': t('Somar'),
        '-': t('Subtrair'),
        '×': t('Multiplicar'),
        '÷': t('Dividir'),
      }[tecla.operacao];
    case 'igual':
      return t('Calcular');
    case 'limpar':
      return t('Limpar tudo');
    case 'sinal':
      return t('Trocar o sinal');
    case 'porcento':
      return t('Porcentagem');
    case 'apagar':
      return t('Apagar o último dígito');
    case 'separador':
      return t('Separador decimal');
    case 'digito':
      return tecla.rotulo;
  }
}

/**
 * O atalho flutuante que abre a calculadora. Mora na coluna de atalhos do
 * `Layout`, que cuida de onde ela fica.
 */
export function BotaoDaCalculadora(): ReactElement {
  const t = useT();
  const [aberta, setAberta] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        aria-label={t('Abrir a calculadora')}
        title={t('Calculadora')}
        className="flex h-11 w-11 items-center justify-center rounded-full border
          border-slate-200 bg-white text-marca-700 shadow-sm transition-colors
          hover:bg-marca-50 active:bg-marca-100"
      >
        <Icone nome="calculadora" tamanho={22} />
      </button>

      <Calculadora aberta={aberta} aoFechar={() => setAberta(false)} />
    </>
  );
}
