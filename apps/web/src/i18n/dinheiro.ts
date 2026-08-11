import { formatarDinheiro, mascararMoeda, type Moeda } from '@gastos/core';
import { useIdioma } from './index';
import { useSessao } from '../sessao';

/**
 * Formata dinheiro com a moeda do grupo ativo e o idioma da tela.
 *
 * A moeda vem da sessão porque é dado do grupo, não preferência de exibição:
 * os valores são centavos daquela moeda. Trocar de grupo já atualiza a sessão,
 * então a tela acompanha sozinha.
 */
export function useMoeda(): Moeda {
  const { usuario } = useSessao();
  return usuario?.moeda ?? 'BRL';
}

export function useDinheiro(): {
  dinheiro: (centavos: number) => string;
  mascara: (digitado: string) => string;
  moeda: Moeda;
} {
  const { idioma } = useIdioma();
  const moeda = useMoeda();
  return {
    dinheiro: (centavos) => formatarDinheiro(centavos, idioma, moeda),
    mascara: (digitado) => mascararMoeda(digitado, idioma, moeda),
    moeda,
  };
}
