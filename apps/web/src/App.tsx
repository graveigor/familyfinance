import { useEffect, type ReactElement } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api';
import { chaves } from './consultas';
import { Layout } from './componentes/Layout';
import { Ajustes } from './telas/Ajustes';
import { Entrar } from './telas/Entrar';
import { Familia } from './telas/Familia';
import { Gastos } from './telas/Gastos';
import { Importar } from './telas/Importar';
import { Inicio } from './telas/Inicio';
import { NovoGasto } from './telas/NovoGasto';
import { Resumo } from './telas/Resumo';
import { useSessao } from './sessao';

export function App(): ReactElement {
  const { autenticado } = useSessao();
  const queryClient = useQueryClient();

  // Ao abrir o app, criamos os lançamentos das contas fixas que ficaram para
  // trás. É idempotente: se já foram criados, não acontece nada.
  useEffect(() => {
    if (!autenticado) return;
    void api.recorrencias
      .gerar()
      .then(async (resultado) => {
        if (resultado.gastosCriados > 0) {
          await queryClient.invalidateQueries({ queryKey: chaves.gastos });
          await queryClient.invalidateQueries({ queryKey: ['resumos'] });
        }
      })
      .catch(() => {
        // Sem internet agora: na próxima abertura tenta de novo.
      });
  }, [autenticado, queryClient]);

  if (!autenticado) return <Entrar />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Inicio />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="/novo" element={<NovoGasto />} />
        <Route path="/gastos/:id/editar" element={<NovoGasto />} />
        <Route path="/importar" element={<Importar />} />
        <Route path="/resumo" element={<Resumo />} />
        <Route path="/familia" element={<Familia />} />
        <Route path="/ajustes" element={<Ajustes />} />
      </Route>
      {/* Endereço desconhecido volta para o Início em vez de mostrar erro. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
