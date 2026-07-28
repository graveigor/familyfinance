import { formatarBRL, type Gasto } from '@gastos/core';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ALVO_DE_TOQUE, cores, espaco, fonte, raio } from '../tema';
import { Icone } from './Icone';

export function ItemDeGasto({
  gasto,
  aoTocar,
}: {
  gasto: Gasto;
  aoTocar?: (gasto: Gasto) => void;
}): ReactElement {
  const cor = gasto.categoria?.cor ?? cores.textoFraco;

  const conteudo = (
    <>
      <View style={[estilos.circulo, { backgroundColor: `${cor}1A` }]}>
        <Icone nome={gasto.categoria?.icone ?? 'etiqueta'} tamanho={22} cor={cor} />
      </View>

      <View style={estilos.meio}>
        <Text numberOfLines={1} style={estilos.descricao}>
          {gasto.descricao}
        </Text>
        <Text numberOfLines={1} style={estilos.detalhe}>
          {gasto.usuario.nome}
          {gasto.categoria ? ` · ${gasto.categoria.nome}` : ' · Sem categoria'}
        </Text>
      </View>

      <Text
        style={[
          estilos.valor,
          gasto.valorCentavos < 0 && { color: cores.marcaEscura },
        ]}
      >
        {formatarBRL(gasto.valorCentavos)}
      </Text>
    </>
  );

  if (!aoTocar) return <View style={estilos.linha}>{conteudo}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${gasto.descricao}, ${formatarBRL(gasto.valorCentavos)}`}
      onPress={() => aoTocar(gasto)}
      style={({ pressed }) => [estilos.linha, pressed && { backgroundColor: '#F1F5F9' }]}
    >
      {conteudo}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: {
    minHeight: ALVO_DE_TOQUE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    paddingHorizontal: espaco.lg,
    paddingVertical: espaco.md,
  },
  circulo: {
    width: 44,
    height: 44,
    borderRadius: raio.cheio,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meio: { flex: 1, minWidth: 0 },
  descricao: { fontSize: fonte.corpo, fontWeight: '500', color: cores.texto },
  detalhe: { fontSize: fonte.pequeno, color: cores.textoSuave, marginTop: 2 },
  valor: { fontSize: fonte.valor, fontWeight: '600', color: cores.texto },
});
