import type { ReactElement } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icone } from './Icone';

const ITENS = [
  { para: '/', rotulo: 'Início', icone: 'inicio' },
  { para: '/gastos', rotulo: 'Gastos', icone: 'lista' },
  { para: '/resumo', rotulo: 'Resumo', icone: 'grafico' },
  { para: '/ajustes', rotulo: 'Ajustes', icone: 'ajustes' },
] as const;

/**
 * Quatro itens, sempre os mesmos, sempre visíveis: barra embaixo no celular e
 * coluna à esquerda no computador. O botão "+" fica fixo no canto inferior
 * direito, do jeito que o polegar alcança.
 */
export function Layout(): ReactElement {
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const mostrarBotaoAdicionar = pathname === '/' || pathname === '/gastos';
  // Lançar/editar gasto é tarefa de tela cheia: a barra inferior sai de cena
  // para o botão "Salvar" ocupar a base e para ninguém perder o que digitou
  // tocando sem querer em outra aba.
  const ehFormulario = pathname === '/novo' || pathname.endsWith('/editar');

  return (
    <div className="min-h-dvh md:flex">
      {/* Computador: navegação lateral */}
      <nav
        aria-label="Navegação principal"
        className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 md:block"
      >
        <div className="mb-6 flex items-center gap-2 px-2 py-3">
          <img src="/icone-192.png" alt="" className="h-9 w-9 rounded-lg" />
          <span className="text-lg font-bold text-slate-900">Gastos</span>
        </div>

        <ul className="space-y-1">
          {ITENS.map((item) => (
            <li key={item.para}>
              <NavLink
                to={item.para}
                end={item.para === '/'}
                className={({ isActive }) =>
                  `flex min-h-toque items-center gap-3 rounded-xl px-3 py-3 text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-marca-50 text-marca-800'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <>
                  <Icone nome={item.icone} tamanho={24} />
                  {item.rotulo}
                </>
              </NavLink>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => navegar('/novo')}
          className="mt-6 flex min-h-toque w-full items-center justify-center gap-2 rounded-xl
            bg-marca-600 px-4 py-3 text-base font-semibold text-white hover:bg-marca-700"
        >
          <Icone nome="mais" tamanho={22} />
          Adicionar gasto
        </button>
      </nav>

      <div className={`flex-1 md:pb-0 ${ehFormulario ? 'pb-4' : 'pb-24'}`}>
        <main className="mx-auto w-full max-w-3xl px-4 py-5 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>

      {/* Celular: botão flutuante e barra inferior */}
      {mostrarBotaoAdicionar && (
        <button
          type="button"
          onClick={() => navegar('/novo')}
          className="fixed bottom-24 right-5 z-30 flex h-16 w-16 items-center justify-center
            rounded-full bg-marca-600 text-white shadow-lg transition-transform hover:bg-marca-700
            active:scale-95 md:hidden"
          style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
        >
          <Icone nome="mais" tamanho={32} />
          <span className="sr-only">Adicionar gasto</span>
        </button>
      )}

      <nav
        aria-label="Navegação principal"
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden ${
          ehFormulario ? 'hidden' : ''
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="flex">
          {ITENS.map((item) => (
            <li key={item.para} className="flex-1">
              <NavLink
                to={item.para}
                end={item.para === '/'}
                className={({ isActive }) =>
                  // Ativo se distingue por cor E por peso do texto — quem não
                  // enxerga a diferença de tom percebe o negrito.
                  `flex min-h-toque flex-col items-center gap-1 py-2.5 text-sm ${
                    isActive ? 'font-bold text-marca-700' : 'font-medium text-slate-600'
                  }`
                }
              >
                <>
                  <Icone nome={item.icone} tamanho={26} />
                  {item.rotulo}
                </>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
