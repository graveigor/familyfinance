import { describe, expect, it } from 'vitest';
import { zCodigoConvite } from './household.js';

/**
 * O código chega copiado do WhatsApp, ditado por telefone ou digitado errado.
 * A normalização é que faz um código válido nunca ser recusado por formatação
 * — e ela ganhou uma conta a mais quando o núcleo passou de 5 para 8.
 */
describe('código de convite', () => {
  const normalizar = (bruto: string) => zCodigoConvite.safeParse(bruto);

  it('aceita o formato novo, de 8', () => {
    expect(normalizar('FF-9A3K2M7Q').data).toBe('FF-9A3K2M7Q');
  });

  it('ainda aceita os códigos de 5 que já estavam na mão das pessoas', () => {
    // Eles continuam valendo até expirar; recusá-los deixaria gente de fora
    // do grupo por causa do deploy.
    expect(normalizar('FF-9A3K2').data).toBe('FF-9A3K2');
  });

  it('perdoa minúscula, espaço e a falta do prefixo', () => {
    for (const bruto of ['ff-9a3k2m7q', ' FF 9A3K2M7Q ', '9A3K2M7Q', 'ff9a3k2m7q']) {
      expect(normalizar(bruto).data, bruto).toBe('FF-9A3K2M7Q');
    }
  });

  it('não come as duas primeiras letras de um núcleo que começa com FF', () => {
    // `F` está no alfabeto do sorteio, então `FFABCDEF` é um núcleo possível.
    // Tirar o prefixo sem olhar o tamanho deixava sobrar 6 caracteres e
    // recusava um código legítimo.
    expect(normalizar('FFABCDEF').data).toBe('FF-FFABCDEF');
    expect(normalizar('FF-FFABCDEF').data).toBe('FF-FFABCDEF');
  });

  it('recusa o que não tem tamanho de código', () => {
    for (const bruto of ['FF-9A3K2M7Q9', '', 'abc', '9A3K2M']) {
      expect(normalizar(bruto).success, bruto).toBe(false);
    }
  });

  it('um núcleo curto demais vira outro código, e não um erro de formato', () => {
    // `FF-123` não tem núcleo válido nem descontando o prefixo, então o texto
    // inteiro é lido como núcleo: `FF123`, que tem 5 e passa no formato. Quem
    // digitou errado recebe "convite inválido" em vez de "formato errado" —
    // é a mesma tela e o mesmo caminho, só uma frase menos precisa. Está aqui
    // para que a escolha seja consciente, e não uma surpresa depois.
    expect(normalizar('FF-123').data).toBe('FF-FF123');
  });
});
