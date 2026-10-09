import { describe, expect, it } from 'vitest';
import {
  INICIAL,
  apagar,
  digitar,
  digitarSeparador,
  escolherOperacao,
  formatarParaTela,
  igualar,
  inverterSinal,
  paraTexto,
  porcentagem,
  type EstadoDaCalculadora,
  type Operacao,
} from './Calculadora';

/**
 * A conta da calculadora, sem montar a tela.
 *
 * O que mais importa aqui é o pó do ponto flutuante: o app inteiro guarda
 * dinheiro em centavos inteiros para nunca somar em `double`, e a calculadora
 * é o único lugar que precisa dividir. Se `0,1 + 0,2` aparecer como
 * `0,30000000000000004`, é aqui que se descobre.
 */

/** Digita uma sequência como quem aperta as teclas: `'0.1 + 0.2 ='`. */
function teclar(sequencia: string): EstadoDaCalculadora {
  let estado = INICIAL;
  for (const tecla of sequencia.replace(/\s/g, '')) {
    if (tecla >= '0' && tecla <= '9') estado = digitar(estado, tecla);
    else if (tecla === '.') estado = digitarSeparador(estado);
    else if (tecla === '=') estado = igualar(estado);
    else if (tecla === '%') estado = porcentagem(estado);
    else if (tecla === '~') estado = inverterSinal(estado);
    else if (tecla === '<') estado = apagar(estado);
    else estado = escolherOperacao(estado, tecla as Operacao);
  }
  return estado;
}

const naTela = (sequencia: string): string => teclar(sequencia).digitado;

describe('as quatro operações', () => {
  it('soma, subtrai, multiplica e divide', () => {
    expect(naTela('2+3=')).toBe('5');
    expect(naTela('9-4=')).toBe('5');
    expect(naTela('6×7=')).toBe('42');
    expect(naTela('84÷2=')).toBe('42');
  });

  it('divide a conta do restaurante por três', () => {
    // O caso que existe de verdade: 127,80 entre três pessoas.
    expect(naTela('127.80÷3=')).toBe('42.6');
  });

  it('encadeia operações sem precisar de igual a cada passo', () => {
    // Cada operador fecha a conta anterior, como numa calculadora de bolso.
    expect(naTela('2+3+4=')).toBe('9');
    expect(naTela('10-2-3=')).toBe('5');
  });
});

describe('pó do ponto flutuante', () => {
  it('soma centavos sem lixo decimal', () => {
    // Em JavaScript puro isto dá 0.30000000000000004.
    expect(naTela('0.1+0.2=')).toBe('0.3');
    expect(naTela('1.1+2.2=')).toBe('3.3');
    expect(naTela('4.56-1.23=')).toBe('3.33');
  });

  it('multiplica preço por quantidade sem sobra', () => {
    expect(naTela('19.99×3=')).toBe('59.97');
    expect(naTela('0.07×100=')).toBe('7');
  });

  it('mantém a dízima legível em vez de encher a tela', () => {
    expect(naTela('1÷3=')).toBe('0.3333333333');
  });
});

describe('divisão por zero', () => {
  it('diz que não dá, em vez de mostrar infinito', () => {
    const estado = teclar('5÷0=');
    expect(estado.erro).toBe(true);
  });

  it('o próximo dígito começa limpo depois do erro', () => {
    let estado = teclar('5÷0=');
    estado = digitar(estado, '7');
    expect(estado.erro).toBe(false);
    expect(estado.digitado).toBe('7');
  });

  it('apagar também sai do erro', () => {
    expect(apagar(teclar('5÷0=')).erro).toBe(false);
  });
});

describe('porcentagem', () => {
  it('com soma pendente, é a fração do primeiro número', () => {
    // A conta da gorjeta: 200 + 10% = 220, não 200,1.
    expect(naTela('200+10%=')).toBe('220');
    // E a do desconto.
    expect(naTela('80-25%=')).toBe('60');
  });

  it('sozinha, é dividir por cem', () => {
    expect(naTela('50%')).toBe('0.5');
  });

  it('multiplicando, também é a fração', () => {
    expect(naTela('50×10%=')).toBe('5');
  });
});

describe('teclas de correção', () => {
  it('apagar come um dígito por vez', () => {
    expect(naTela('123<')).toBe('12');
    expect(naTela('123<<')).toBe('1');
  });

  it('apagar o último dígito volta para zero, não para vazio', () => {
    expect(naTela('7<')).toBe('0');
  });

  it('depois do igual, apagar limpa a entrada em vez de comer o resultado', () => {
    expect(naTela('2+3=<')).toBe('0');
  });

  it('troca o sinal e desfaz', () => {
    expect(naTela('5~')).toBe('-5');
    expect(naTela('5~~')).toBe('5');
    // Zero com sinal não existe na tela.
    expect(naTela('~')).toBe('0');
  });

  it('subtrai número negativo', () => {
    expect(naTela('10+5~=')).toBe('5');
  });
});

describe('digitação', () => {
  it('não acumula zero à esquerda', () => {
    expect(naTela('007')).toBe('7');
    expect(naTela('0')).toBe('0');
  });

  it('aceita um separador decimal só', () => {
    expect(naTela('1.5')).toBe('1.5');
    expect(naTela('1.5.5')).toBe('1.55');
  });

  it('o separador no começo vira zero vírgula', () => {
    expect(naTela('.5')).toBe('0.5');
  });

  it('para de aceitar dígito depois do teto', () => {
    const muitos = '1234567890123456789';
    // Catorze dígitos é o que cabe na tela e no `double` sem arredondar.
    expect(naTela(muitos).replace(/[-.]/g, '')).toHaveLength(14);
  });

  it('trocar o operador não repete a conta', () => {
    // Quem erra a tecla e corrige espera 2 × 3, não (2+3) × 3.
    expect(naTela('2+×3=')).toBe('6');
  });
});

describe('escrita do número na tela', () => {
  it('agrupa milhar conforme o idioma', () => {
    expect(formatarParaTela('1234567.89', 'pt')).toBe('1.234.567,89');
    expect(formatarParaTela('1234567.89', 'en')).toBe('1,234,567.89');
  });

  it('mantém o separador que a pessoa acabou de digitar', () => {
    // Sem isto a vírgula desaparece ao ser tocada e a tecla parece quebrada.
    expect(formatarParaTela('12.', 'pt')).toBe('12,');
    expect(formatarParaTela('12.', 'en')).toBe('12.');
  });

  it('preserva zero à direita enquanto se digita centavos', () => {
    expect(formatarParaTela('3.10', 'pt')).toBe('3,10');
  });

  it('escreve negativo com o sinal antes do agrupamento', () => {
    expect(formatarParaTela('-1234', 'pt')).toBe('-1.234');
  });

  it('zero é zero, nunca "-0"', () => {
    expect(paraTexto(0)).toBe('0');
    expect(paraTexto(-0)).toBe('0');
  });
});
