import {
  formatarBRL,
  formatarDataISO,
  fraseComparacaoMensal,
  hoje,
  inicioDoMes,
  nomeDoMes,
  pluralizar,
} from '@gastos/core';
import { Link, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icone } from '../../src/componentes/Icone';
import { ItemDeGasto } from '../../src/componentes/ItemDeGasto';
import { CaixaDeErro, Carregando, Cartao, Vazio, traduzirErro } from '../../src/componentes/ui';
import { useGastos, useResumoMensal } from '../../src/consultas';
import { useSessao } from '../../src/sessao';
import { cores, espaco, fonte, raio } from '../../src/tema';

export default function Inicio(): ReactElement {
  const { usuario } = useSessao();
  const router = useRouter();
  const margens = useSafeAreaInsets();

  const referencia = hoje();
  const ano = referencia.getUTCFullYear();
  const mes = referencia.getUTCMonth() + 1;

  const resumo = useResumoMensal(ano, mes);
  const ultimos = useGastos({ de: formatarDataISO(inicioDoMes(ano, mes)), porPagina: 10 });

  const atualizando = resumo.isFetching || ultimos.isFetching;

  return (
    <View style={estilos.tela}>
      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingTop: margens.top + espaco.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => {
              void resumo.refetch();
              void ultimos.refetch();
            }}
            tintColor={cores.marca}
          />
        }
      >
        <View>
          <Text style={estilos.saudacao}>Olá, {usuario?.nome.split(' ')[0] ?? ''}</Text>
          <Text style={estilos.mes}>
            {nomeDoMes(mes).replace(/^./, (l) => l.toUpperCase())} de {ano}
          </Text>
        </View>

        {/* O total do mês é o maior elemento da tela. */}
        <Cartao estilo={estilos.cartaoDoTotal}>
          <Text style={estilos.rotuloDoTotal}>Gastos deste mês</Text>

          {resumo.isPending ? (
            <Carregando texto="Somando..." />
          ) : resumo.isError ? (
            <CaixaDeErro mensagem={traduzirErro(resumo.error).mensagem} />
          ) : (
            <>
              <Text
                style={estilos.total}
                adjustsFontSizeToFit
                numberOfLines={1}
                accessibilityLabel={`Total do mês: ${formatarBRL(resumo.data.totalCentavos)}`}
              >
                {formatarBRL(resumo.data.totalCentavos)}
              </Text>
              <Text style={estilos.comparacao}>{fraseComparacaoMensal(resumo.data)}</Text>
              <Text style={estilos.quantidade}>
                {pluralizar(resumo.data.quantidade, 'gasto registrado', 'gastos registrados')}
              </Text>
            </>
          )}
        </Cartao>

        <Cartao>
          <View style={estilos.cabecalhoDaLista}>
            <Text style={estilos.tituloDaLista}>Últimos gastos</Text>
            <Link href="/(abas)/gastos" style={estilos.verTodos}>
              Ver todos
            </Link>
          </View>

          {ultimos.isPending ? (
            <Carregando />
          ) : ultimos.isError ? (
            <View style={{ padding: espaco.lg }}>
              <CaixaDeErro mensagem={traduzirErro(ultimos.error).mensagem} />
            </View>
          ) : ultimos.data.itens.length === 0 ? (
            <Vazio
              titulo="Nenhum gasto ainda"
              descricao="Toque no botão + para lançar o primeiro."
            />
          ) : (
            ultimos.data.itens.map((gasto, indice) => (
              <View
                key={gasto.id}
                style={indice > 0 ? estilos.separador : undefined}
              >
                <ItemDeGasto gasto={gasto} />
              </View>
            ))
          )}
        </Cartao>
      </ScrollView>

      {/* Botão grande no canto do polegar. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Adicionar gasto"
        onPress={() => router.push('/gasto')}
        style={({ pressed }) => [
          estilos.botaoFlutuante,
          { bottom: espaco.xl, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Icone nome="mais" tamanho={32} cor={cores.textoInvertido} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg, paddingBottom: 120 },
  saudacao: { fontSize: fonte.corpo, color: cores.textoSuave },
  mes: { fontSize: fonte.titulo, fontWeight: '700', color: cores.texto },

  cartaoDoTotal: { padding: espaco.xl, alignItems: 'center' },
  rotuloDoTotal: { fontSize: fonte.corpo, color: cores.textoSuave },
  total: {
    fontSize: 48,
    fontWeight: '700',
    color: cores.texto,
    marginTop: espaco.sm,
    letterSpacing: -1,
  },
  comparacao: { fontSize: fonte.corpo, color: cores.textoSuave, marginTop: espaco.md, textAlign: 'center' },
  quantidade: { fontSize: fonte.pequeno, color: cores.textoFraco, marginTop: espaco.xs },

  cabecalhoDaLista: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espaco.lg,
    paddingVertical: espaco.md,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  tituloDaLista: { fontSize: fonte.corpo, fontWeight: '600', color: cores.texto },
  verTodos: { fontSize: fonte.corpo, fontWeight: '600', color: cores.marcaEscura, padding: espaco.sm },
  separador: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },

  botaoFlutuante: {
    position: 'absolute',
    right: espaco.lg,
    width: 64,
    height: 64,
    borderRadius: raio.cheio,
    backgroundColor: cores.marca,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
