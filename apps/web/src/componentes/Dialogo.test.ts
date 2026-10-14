import { beforeEach, describe, expect, it } from 'vitest';
import { travarRolagem, zerarTravaDeRolagem } from './Dialogo';

/**
 * O bug que isto guarda: a página parava de rolar e só voltava com F5.
 *
 * A trava é um estilo do documento — uma variável global. Cada painel guardava
 * o valor de antes e o devolvia ao fechar; com dois abertos, o segundo guardava
 * o "hidden" posto pelo primeiro, e fechar na ordem trocada deixava a trava
 * presa para sempre. Ordem de desmontagem não é coisa que dê para garantir no
 * React, então a correção não pode depender dela.
 *
 * O teste usa um objeto no lugar do `document.body.style` porque a suíte da web
 * roda em Node, sem DOM — e o que está sendo testado é a contagem, não o CSS.
 */

let estilo: { overflow: string };

beforeEach(() => {
  zerarTravaDeRolagem();
  estilo = { overflow: '' };
});

describe('trava de rolagem', () => {
  it('um painel tranca ao abrir e destranca ao fechar', () => {
    const destravar = travarRolagem(estilo);
    expect(estilo.overflow).toBe('hidden');
    destravar();
    expect(estilo.overflow).toBe('');
  });

  it('dois painéis fechando na ordem trocada não deixam a página presa', () => {
    // É o caso real: um `Confirmar` aberto por cima de um `Dialogo`.
    const destravarPrimeiro = travarRolagem(estilo);
    const destravarSegundo = travarRolagem(estilo);
    expect(estilo.overflow).toBe('hidden');

    destravarPrimeiro(); // o de baixo fecha antes
    expect(estilo.overflow, 'ainda há painel aberto: segue travado').toBe('hidden');

    destravarSegundo();
    expect(estilo.overflow, 'o último fechou: a página volta a rolar').toBe('');
  });

  it('fechando na ordem natural também destranca', () => {
    const a = travarRolagem(estilo);
    const b = travarRolagem(estilo);
    b();
    expect(estilo.overflow).toBe('hidden');
    a();
    expect(estilo.overflow).toBe('');
  });

  it('destravar duas vezes não derruba a trava de outro painel', () => {
    // O StrictMode desmonta e remonta: a mesma função de limpeza roda duas
    // vezes. Sem guarda, o contador ficava negativo e a trava caía cedo.
    const a = travarRolagem(estilo);
    const b = travarRolagem(estilo);
    a();
    a();
    a();
    expect(estilo.overflow, 'o painel B continua aberto').toBe('hidden');
    b();
    expect(estilo.overflow).toBe('');
  });

  it('preserva um overflow que já existia antes do primeiro painel', () => {
    estilo.overflow = 'clip';
    const destravar = travarRolagem(estilo);
    expect(estilo.overflow).toBe('hidden');
    destravar();
    expect(estilo.overflow).toBe('clip');
  });
});
