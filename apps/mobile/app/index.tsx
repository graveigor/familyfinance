import { Redirect } from 'expo-router';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Carregando } from '../src/componentes/ui';
import { useSessao } from '../src/sessao';
import { cores } from '../src/tema';

/**
 * Porta de entrada: enquanto a sessão é lida do disco não decidimos nada, para
 * não piscar a tela de login em quem já está conectado.
 */
export default function Entrada(): ReactElement {
  const { autenticado, carregando } = useSessao();

  if (carregando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: cores.fundo }}>
        <Carregando texto="Abrindo..." />
      </View>
    );
  }

  return <Redirect href={autenticado ? '/(abas)/inicio' : '/entrar'} />;
}
