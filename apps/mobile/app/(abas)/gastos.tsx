import {
  fimDoMes,
  formatarBRL,
  formatarDataISO,
  hoje,
  inicioDoMes,
  mesAnterior,
  parseData,
  pluralizar,
  rotuloDoDia,
  somarCentavos,
  type Gasto,
} from '@gastos/core';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icone } from '../../src/componentes/Icone';
import { ItemDeGasto } from '../../src/componentes/ItemDeGasto';
import { Botao, CaixaDeErro, Carregando, Cartao, Vazio, traduzirErro } from '../../src/componentes/ui';
import { useExcluirGasto, useGastos } from '../../src/consultas';
import { ALVO_DE_TOQUE, cores, espaco, fonte, raio } from '../../src/tema';

const AGORA = hoje();
const ANO = AGORA.getUTCFullYear();
const MES = AGORA.getUTCMonth() + 1;
const PASSADO = mesAnterior(ANO, MES);

const PERIODOS = {
  mes: {
    rotulo: 'Este mês',
    de: formatarDataISO(inicioDoMes(ANO, MES)),
    ate: formatarDataISO(fimDoMes(ANO, MES)),
  },
  'mes-passado': {
    rotulo: 'Mês passado',
    de: formatarDataISO(inicioDoMes(PASSADO.ano, PASSADO.mes)),
    ate: formatarDataISO(fimDoMes(PASSADO.ano, PASSADO.mes)),
  },
  tudo: { rotulo: 'Tudo', de: undefined, ate: undefined },
} as const;

type ChaveDePeriodo = keyof typeof PERIODOS;

export default function Gastos(): ReactElement {
  const router = useRouter();
  const margens = useSafeAreaInsets();
  const excluir = useExcluirGasto();

  const [periodo, setPeriodo] = useState<ChaveDePeriodo>('mes');
  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [busca, setBusca] = useState('');
  const [emFoco, setEmFoco] = useState<Gasto | null>(null);

  // Espera parar de digitar antes de consultar.
  useEffect(() => {
    const relogio = setTimeout(() => setBusca(buscaDigitada), 350);
    return () => clearTimeout(relogio);
  }, [buscaDigitada]);

  const consulta = useGastos({
    ...(busca ? { busca } : {}),
    ...(PERIODOS[periodo].de ? { de: PERIODOS[periodo].de } : {}),
    ...(PERIODOS[periodo].ate ? { ate: PERIODOS[periodo].ate } : {}),
    porPagina: 50,
  });

  const dias = useMemo(() => {
    const grupos = new Map<string, Gasto[]>();
    for (const gasto of consulta.data?.itens ?? []) {
      const lista = grupos.get(gasto.data);
      if (lista) lista.push(gasto);
      else grupos.set(gasto.data, [gasto]);
    }
    return [...grupos.entries()];
  }, [consulta.data]);

  function confirmarExclusao(gasto: Gasto): void {
    // Alerta nativo: é o aviso que a pessoa já reconhece no aparelho dela.
    Alert.alert(
      'Excluir este gasto?',
      `"${gasto.descricao}" de ${formatarBRL(gasto.valorCentavos)} será removido e o total do mês vai mudar. Não dá para desfazer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            excluir.mutate(gasto.id, {
              onError: (falha) => Alert.alert('Não deu certo', traduzirErro(falha).mensagem),
            });
            setEmFoco(null);
          },
        },
      ],
    );
  }

  return (
    <View style={estilos.tela}>
      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingTop: margens.top + espaco.lg }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={consulta.isFetching}
            onRefresh={() => void consulta.refetch()}
            tintColor={cores.marca}
          />
        }
      >
        <Text style={estilos.titulo}>Gastos</Text>

        <View style={estilos.busca}>
          <Icone nome="lupa" tamanho={22} cor={cores.textoFraco} />
          <TextInput
            accessibilityLabel="Buscar gastos"
            value={buscaDigitada}
            onChangeText={setBuscaDigitada}
            placeholder="Buscar por onde foi o gasto"
            placeholderTextColor={cores.textoFraco}
            style={estilos.campoDeBusca}
          />
        </View>

        <View style={estilos.etiquetas}>
          {(Object.keys(PERIODOS) as ChaveDePeriodo[]).map((chave) => (
            <Pressable
              key={chave}
              accessibilityRole="button"
              accessibilityState={{ selected: periodo === chave }}
              onPress={() => setPeriodo(chave)}
              style={[estilos.etiqueta, periodo === chave && estilos.etiquetaAtiva]}
            >
              <Text
                style={[estilos.textoDaEtiqueta, periodo === chave && estilos.textoDaEtiquetaAtiva]}
              >
                {PERIODOS[chave].rotulo}
              </Text>
            </Pressable>
          ))}
        </View>

        {consulta.data && (
          <Cartao estilo={estilos.resumo}>
            <Text style={estilos.textoSuave}>
              {pluralizar(consulta.data.paginacao.totalItens, 'gasto', 'gastos')}
            </Text>
            <Text style={estilos.totalDoPeriodo}>{formatarBRL(consulta.data.totalCentavos)}</Text>
          </Cartao>
        )}

        {consulta.isPending ? (
          <Carregando />
        ) : consulta.isError ? (
          <CaixaDeErro mensagem={traduzirErro(consulta.error).mensagem} />
        ) : dias.length === 0 ? (
          <Vazio
            icone="lupa"
            titulo="Nenhum gasto encontrado"
            descricao="Tente outro período ou limpe a busca."
          />
        ) : (
          dias.map(([dia, gastos]) => {
            const data = parseData(dia);
            return (
              <Cartao key={dia}>
                <View style={estilos.cabecalhoDoDia}>
                  <Text style={estilos.tituloDoDia}>{data ? rotuloDoDia(data) : dia}</Text>
                  <Text style={estilos.subtotal}>
                    {formatarBRL(somarCentavos(gastos.map((g) => g.valorCentavos)))}
                  </Text>
                </View>
                {gastos.map((gasto, indice) => (
                  <View key={gasto.id} style={indice > 0 ? estilos.separador : undefined}>
                    <ItemDeGasto gasto={gasto} aoTocar={setEmFoco} />
                  </View>
                ))}
              </Cartao>
            );
          })
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Adicionar gasto"
        onPress={() => router.push('/gasto')}
        style={({ pressed }) => [estilos.botaoFlutuante, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Icone nome="mais" tamanho={32} cor={cores.textoInvertido} />
      </Pressable>

      <Modal
        visible={emFoco !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEmFoco(null)}
      >
        <Pressable style={estilos.fundoDoModal} onPress={() => setEmFoco(null)} />
        <View style={[estilos.painel, { paddingBottom: Math.max(margens.bottom, espaco.lg) }]}>
          {emFoco && (
            <>
              <View style={estilos.cabecalhoDoPainel}>
                <Text style={estilos.tituloDoPainel} numberOfLines={1}>
                  {emFoco.descricao}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Fechar"
                  onPress={() => setEmFoco(null)}
                  style={estilos.botaoFechar}
                >
                  <Icone nome="fechar" tamanho={24} cor={cores.textoSuave} />
                </Pressable>
              </View>

              <Text style={estilos.valorDoPainel}>{formatarBRL(emFoco.valorCentavos)}</Text>

              <View style={estilos.detalhes}>
                <Linha rotulo="Quem gastou" valor={emFoco.usuario.nome} />
                <Linha
                  rotulo="Data"
                  valor={(() => {
                    const d = parseData(emFoco.data);
                    return d ? rotuloDoDia(d) : emFoco.data;
                  })()}
                />
                <Linha rotulo="Categoria" valor={emFoco.categoria?.nome ?? 'Sem categoria'} />
              </View>

              <View style={estilos.acoes}>
                <Botao
                  titulo="Editar"
                  variante="secundario"
                  icone="lapis"
                  estilo={{ flex: 1 }}
                  aoTocar={() => {
                    const alvo = emFoco.id;
                    setEmFoco(null);
                    router.push({ pathname: '/gasto', params: { id: alvo } });
                  }}
                />
                <Botao
                  titulo="Excluir"
                  variante="perigo"
                  icone="lixeira"
                  estilo={{ flex: 1 }}
                  carregando={excluir.isPending}
                  aoTocar={() => confirmarExclusao(emFoco)}
                />
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }): ReactElement {
  return (
    <View style={estilos.linhaDeDetalhe}>
      <Text style={estilos.textoSuave}>{rotulo}</Text>
      <Text style={estilos.valorDoDetalhe}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: 120 },
  titulo: { fontSize: fonte.titulo, fontWeight: '700', color: cores.texto },

  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    minHeight: ALVO_DE_TOQUE,
    paddingHorizontal: espaco.lg,
    borderWidth: 2,
    borderColor: cores.bordaForte,
    borderRadius: raio.md,
    backgroundColor: cores.cartao,
  },
  campoDeBusca: { flex: 1, fontSize: fonte.corpo, color: cores.texto, paddingVertical: espaco.md },

  etiquetas: { flexDirection: 'row', gap: espaco.sm },
  etiqueta: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: espaco.lg,
    borderRadius: raio.cheio,
    backgroundColor: cores.cartao,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  etiquetaAtiva: { backgroundColor: cores.marcaClara, borderColor: cores.marca },
  textoDaEtiqueta: { fontSize: fonte.pequeno, fontWeight: '500', color: cores.textoSuave },
  textoDaEtiquetaAtiva: { color: cores.marcaEscura, fontWeight: '700' },

  resumo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: espaco.lg,
    paddingVertical: espaco.md,
  },
  textoSuave: { fontSize: fonte.corpo, color: cores.textoSuave },
  totalDoPeriodo: { fontSize: fonte.titulo, fontWeight: '700', color: cores.texto },

  cabecalhoDoDia: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: espaco.lg,
    paddingVertical: espaco.md,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: raio.lg,
    borderTopRightRadius: raio.lg,
  },
  tituloDoDia: { fontSize: fonte.corpo, fontWeight: '600', color: cores.texto },
  subtotal: { fontSize: fonte.corpo, fontWeight: '600', color: cores.textoSuave },
  separador: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },

  botaoFlutuante: {
    position: 'absolute',
    right: espaco.lg,
    bottom: espaco.xl,
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

  fundoDoModal: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)' },
  painel: {
    backgroundColor: cores.cartao,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: espaco.lg,
    gap: espaco.md,
  },
  cabecalhoDoPainel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tituloDoPainel: { flex: 1, fontSize: fonte.valor, fontWeight: '600', color: cores.texto },
  botaoFechar: {
    width: ALVO_DE_TOQUE,
    height: ALVO_DE_TOQUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valorDoPainel: { fontSize: 32, fontWeight: '700', color: cores.texto },
  detalhes: { gap: espaco.sm },
  linhaDeDetalhe: { flexDirection: 'row', justifyContent: 'space-between', gap: espaco.lg },
  valorDoDetalhe: { fontSize: fonte.corpo, fontWeight: '500', color: cores.texto },
  acoes: { flexDirection: 'row', gap: espaco.md, marginTop: espaco.sm },
});
