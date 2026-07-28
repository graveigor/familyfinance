import { Redirect, Tabs } from 'expo-router';
import type { ReactElement } from 'react';
import { Icone } from '../../src/componentes/Icone';
import { useSessao } from '../../src/sessao';
import { ALVO_DE_TOQUE, cores, fonte } from '../../src/tema';

/** Quatro abas, sempre as mesmas — nada além disso na navegação. */
export default function AbasLayout(): ReactElement {
  const { autenticado, carregando } = useSessao();

  if (!carregando && !autenticado) return <Redirect href="/entrar" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.marcaEscura,
        tabBarInactiveTintColor: cores.textoFraco,
        tabBarStyle: { backgroundColor: cores.cartao, borderTopColor: cores.borda, height: 88 },
        tabBarItemStyle: { minHeight: ALVO_DE_TOQUE, paddingVertical: 6 },
        // Ativo se distingue por cor E por peso do texto.
        tabBarLabelStyle: { fontSize: fonte.pequeno, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="inicio"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <Icone nome="inicio" tamanho={26} cor={color} />,
        }}
      />
      <Tabs.Screen
        name="gastos"
        options={{
          title: 'Gastos',
          tabBarIcon: ({ color }) => <Icone nome="lista" tamanho={26} cor={color} />,
        }}
      />
      <Tabs.Screen
        name="resumo"
        options={{
          title: 'Resumo',
          tabBarIcon: ({ color }) => <Icone nome="grafico" tamanho={26} cor={color} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <Icone nome="ajustes" tamanho={26} cor={color} />,
        }}
      />
    </Tabs>
  );
}
