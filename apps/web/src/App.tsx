import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './componentes/Layout';
import { Ajustes } from './telas/Ajustes';
import { Entrar } from './telas/Entrar';
import { Gastos } from './telas/Gastos';
import { Importar } from './telas/Importar';
import { Inicio } from './telas/Inicio';
import { NovoGasto } from './telas/NovoGasto';
import { Resumo } from './telas/Resumo';
import { useSessao } from './sessao';

export function App(): ReactElement {
  const { autenticado } = useSessao();

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
        <Route path="/ajustes" element={<Ajustes />} />
      </Route>
      {/* Endereço desconhecido volta para o Início em vez de mostrar erro. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
