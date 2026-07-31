import { ROTULO_TIPO_CARTAO, type Cartao } from '@gastos/core';
import { useRef, type ReactElement } from 'react';
import { useCartoes } from '../consultas';

/**
 * Escolha do cartão em um `select` só. Some da tela quando a família ainda não
 * cadastrou nenhum: cobrar uma escolha que não existe só atrapalha.
 */
export function EscolherCartao({
  valor,
  aoMudar,
  rotulo = 'Cartão (opcional)',
  id,
  incluirSemCartao = false,
}: {
  /** `''` = nenhum cartão. */
  valor: string;
  aoMudar: (cartaoId: string) => void;
  rotulo?: string;
  id?: string;
  /** Adiciona a opção "Sem cartão" — só faz sentido ao filtrar. */
  incluirSemCartao?: boolean;
}): ReactElement | null {
  const cartoes = useCartoes();
  const gerado = useRef(`cartao-${Math.random().toString(36).slice(2, 9)}`);
  const idFinal = id ?? gerado.current;

  if ((cartoes.data?.length ?? 0) === 0) return null;

  return (
    <div>
      <label htmlFor={idFinal} className="rotulo">
        {rotulo}
      </label>
      <select
        id={idFinal}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="campo"
      >
        <option value="">{incluirSemCartao ? 'Todos os cartões' : 'Nenhum cartão'}</option>
        {incluirSemCartao && <option value="sem-cartao">Sem cartão</option>}
        {cartoes.data?.map((cartao) => (
          <option key={cartao.id} value={cartao.id}>
            {nomeCompleto(cartao)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** "Itaú · Crédito" — o tipo evita confundir dois cartões do mesmo banco. */
export function nomeCompleto(cartao: Cartao): string {
  return `${cartao.nome} · ${ROTULO_TIPO_CARTAO[cartao.tipo]}`;
}
