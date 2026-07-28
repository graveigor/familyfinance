import {
  centavosDoTextoMascarado,
  formatarBRL,
  formatarData,
  formatarDataISO,
  hoje,
  mascararMoeda,
  ontem,
  parseData,
} from '@gastos/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../src/api';
import { Icone } from '../src/componentes/Icone';
import { Botao, CaixaDeErro, Campo, Carregando, Cartao, traduzirErro } from '../src/componentes/ui';
import {
  useAtualizarGasto,
  useCategorias,
  useCriarGasto,
  useMembros,
  useSugestoes,
} from '../src/consultas';
import { useSessao } from '../src/sessao';
import { ALVO_DE_TOQUE, cores, espaco, fonte, raio } from '../src/tema';

/**
 * Lançar um gasto em menos de dez segundos: o teclado numérico já abre no
 * valor, a data já vem preenchida e a categoria é opcional.
 */
export default function TelaDeGasto(): ReactElement {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editando = Boolean(id);
  const router = useRouter();
  const margens = useSafeAreaInsets();
  const { usuario } = useSessao();

  const categorias = useCategorias();
  const membros = useMembros();
  const criar = useCriarGasto();
  const atualizar = useAtualizarGasto();

  const existente = useQuery({
    queryKey: ['gastos', 'um', id],
    queryFn: () => api.gastos.obter(id ?? ''),
    enabled: editando,
  });

  const [digitos, setDigitos] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [data, setData] = useState(() => formatarDataISO(hoje()));
  const [userId, setUserId] = useState<string>('');
  const [erro, setErro] = useState<{ mensagem: string; campos: Record<string, string> }>({
    mensagem: '',
    campos: {},
  });

  const campoValor = useRef<TextInput>(null);
  const sugestoes = useSugestoes(descricao);
  const [sugestoesVisiveis, setSugestoesVisiveis] = useState(false);

  // Abre já com o teclado numérico no valor — um toque a menos.
  useEffect(() => {
    if (editando) return;
    const relogio = setTimeout(() => campoValor.current?.focus(), 350);
    return () => clearTimeout(relogio);
  }, [editando]);

  useEffect(() => {
    const gasto = existente.data;
    if (!gasto) return;
    setDigitos(String(Math.abs(gasto.valorCentavos)));
    setDescricao(gasto.descricao);
    setCategoriaId(gasto.categoria?.id ?? null);
    setData(gasto.data);
    setUserId(gasto.usuario.id);
  }, [existente.data]);

  useEffect(() => {
    if (!userId && usuario) setUserId(usuario.id);
  }, [usuario, userId]);

  const centavos = centavosDoTextoMascarado(digitos);
  const salvando = criar.isPending || atualizar.isPending;
  const dataLegivel = parseData(data);

  async function salvar(): Promise<void> {
    setErro({ mensagem: '', campos: {} });

    if (centavos === 0) {
      setErro({ mensagem: '', campos: { valorCentavos: 'Informe um valor maior que zero.' } });
      campoValor.current?.focus();
      return;
    }
    if (descricao.trim() === '') {
      setErro({ mensagem: '', campos: { descricao: 'Informe onde foi o gasto.' } });
      return;
    }

    const dados = {
      descricao: descricao.trim(),
      valorCentavos: centavos,
      data,
      categoriaId,
      ...(userId ? { userId } : {}),
    };

    try {
      // Ao editar não mandamos a forma de pagamento: o que já estava gravado
      // (Pix, boleto...) continua valendo.
      if (editando && id) {
        await atualizar.mutateAsync({ id, dados });
      } else {
        const resultado = await criar.mutateAsync({ ...dados, formaPagamento: 'CARTAO' });
        if (resultado.guardadoOffline) {
          Alert.alert(
            'Gasto guardado no celular',
            'Você está sem internet. Assim que a conexão voltar, ele entra sozinho no app da família.',
          );
        }
      }
      router.back();
    } catch (falha) {
      setErro(traduzirErro(falha));
    }
  }

  if (editando && existente.isPending) return <Carregando />;

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[estilos.cabecalho, { paddingTop: espaco.md }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={() => router.back()}
          style={estilos.botaoFechar}
        >
          <Icone nome="fechar" tamanho={26} cor={cores.textoSuave} />
        </Pressable>
        <Text style={estilos.titulo}>{editando ? 'Editar gasto' : 'Novo gasto'}</Text>
      </View>

      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <CaixaDeErro mensagem={erro.mensagem || null} />

        {/* 1. Valor */}
        <Cartao estilo={estilos.bloco}>
          <Text style={estilos.rotulo}>Quanto foi?</Text>
          <TextInput
            ref={campoValor}
            accessibilityLabel="Valor do gasto"
            // Teclado numérico nativo: sem letras para atrapalhar.
            keyboardType="number-pad"
            value={mascararMoeda(digitos)}
            onChangeText={(texto) => setDigitos(texto.replace(/\D/g, ''))}
            placeholder="R$ 0,00"
            placeholderTextColor="#CBD5E1"
            style={[estilos.campoDeValor, erro.campos.valorCentavos && estilos.campoComErro]}
          />
          {erro.campos.valorCentavos && (
            <View style={estilos.linhaDeErro}>
              <Icone nome="aviso" tamanho={16} cor={cores.perigo} />
              <Text style={estilos.textoDeErro}>{erro.campos.valorCentavos}</Text>
            </View>
          )}
        </Cartao>

        {/* 2. Onde foi */}
        <Cartao estilo={estilos.bloco}>
          <Campo
            rotulo="Onde foi?"
            value={descricao}
            onChangeText={(texto) => {
              setDescricao(texto);
              setSugestoesVisiveis(true);
            }}
            placeholder="Supermercado, farmácia, posto..."
            erro={erro.campos.descricao}
          />
          {sugestoesVisiveis &&
            (sugestoes.data?.length ?? 0) > 0 &&
            sugestoes.data?.map((texto) => (
              <Pressable
                key={texto}
                accessibilityRole="button"
                onPress={() => {
                  setDescricao(texto);
                  setSugestoesVisiveis(false);
                }}
                style={estilos.sugestao}
              >
                <Text style={estilos.textoDaSugestao}>{texto}</Text>
              </Pressable>
            ))}
        </Cartao>

        {/* 3. Categoria */}
        <Cartao estilo={estilos.bloco}>
          <Text style={estilos.rotulo}>Categoria (opcional)</Text>
          <View style={estilos.grade}>
            {categorias.data?.map((categoria) => {
              const escolhida = categoriaId === categoria.id;
              return (
                <Pressable
                  key={categoria.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Categoria ${categoria.nome}`}
                  accessibilityState={{ selected: escolhida }}
                  onPress={() => setCategoriaId(escolhida ? null : categoria.id)}
                  style={[estilos.itemDaGrade, escolhida && estilos.itemEscolhido]}
                >
                  <View
                    style={[estilos.circuloDaCategoria, { backgroundColor: `${categoria.cor}1A` }]}
                  >
                    <Icone nome={categoria.icone} tamanho={22} cor={categoria.cor} />
                  </View>
                  <Text style={estilos.nomeDaCategoria} numberOfLines={2}>
                    {categoria.nome}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Cartao>

        {/* 4. Data */}
        <Cartao estilo={estilos.bloco}>
          <Text style={estilos.rotulo}>Quando foi?</Text>
          <View style={estilos.linhaDeBotoes}>
            {(
              [
                ['Hoje', formatarDataISO(hoje())],
                ['Ontem', formatarDataISO(ontem())],
              ] as const
            ).map(([rotulo, valor]) => (
              <Pressable
                key={rotulo}
                accessibilityRole="button"
                accessibilityState={{ selected: data === valor }}
                onPress={() => setData(valor)}
                style={[estilos.botaoDeData, data === valor && estilos.itemEscolhido]}
              >
                <Text style={estilos.textoDoBotaoDeData}>{rotulo}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={estilos.dataEscolhida}>
            Data escolhida: {dataLegivel ? formatarData(dataLegivel) : data}
          </Text>
        </Cartao>

        {/* Comprovante: só depois que o gasto existe, porque a foto vai anexada a ele. */}
        {editando && id && (
          <Cartao estilo={estilos.bloco}>
            <Text style={estilos.rotulo}>Comprovante</Text>
            <Comprovante gastoId={id} tem={existente.data?.temComprovante ?? false} />
          </Cartao>
        )}

        {/* 5. Quem gastou — só quando a família tem mais de uma pessoa */}
        {(membros.data?.length ?? 0) > 1 && (
          <Cartao estilo={estilos.bloco}>
            <Text style={estilos.rotulo}>Quem gastou?</Text>
            <View style={estilos.linhaDeBotoes}>
              {membros.data?.map((membro) => (
                <Pressable
                  key={membro.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: userId === membro.id }}
                  onPress={() => setUserId(membro.id)}
                  style={[estilos.botaoDeData, userId === membro.id && estilos.itemEscolhido]}
                >
                  <Text style={estilos.textoDoBotaoDeData}>
                    {membro.nome.split(' ')[0]}
                    {membro.id === usuario?.id ? ' (você)' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Cartao>
        )}
      </ScrollView>

      {/* Salvar fixo na base, sempre ao alcance. */}
      <View style={[estilos.rodape, { paddingBottom: Math.max(margens.bottom, espaco.md) }]}>
        <Botao
          titulo={editando ? 'Salvar alterações' : 'Salvar gasto'}
          carregando={salvando}
          aoTocar={() => void salvar()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Foto do comprovante. Abre a câmera direto — no mercado a pessoa fotografa a
 * nota, não vai procurar arquivo.
 */
function Comprovante({ gastoId, tem }: { gastoId: string; tem: boolean }): ReactElement {
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const [temComprovante, setTemComprovante] = useState(tem);

  useEffect(() => setTemComprovante(tem), [tem]);

  async function enviar(uri: string, nome: string, tipo: string): Promise<void> {
    setEnviando(true);
    try {
      const resposta = await fetch(uri);
      const conteudo = await resposta.blob();
      await api.gastos.enviarComprovante(gastoId, conteudo, nome);
      setTemComprovante(true);
      await queryClient.invalidateQueries({ queryKey: ['gastos'] });
    } catch (falha) {
      Alert.alert('Não deu certo', traduzirErro(falha).mensagem);
    } finally {
      setEnviando(false);
    }
  }

  async function escolher(daCamera: boolean): Promise<void> {
    const permissao = daCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissao.granted) {
      Alert.alert(
        'Precisamos da sua permissão',
        daCamera
          ? 'Libere o acesso à câmera nos ajustes do aparelho para fotografar o comprovante.'
          : 'Libere o acesso às fotos nos ajustes do aparelho para escolher o comprovante.',
      );
      return;
    }

    const resultado = daCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });

    const arquivo = resultado.assets?.[0];
    if (resultado.canceled || !arquivo) return;

    await enviar(arquivo.uri, arquivo.fileName ?? 'comprovante.jpg', arquivo.mimeType ?? 'image/jpeg');
  }

  async function remover(): Promise<void> {
    setEnviando(true);
    try {
      await api.gastos.removerComprovante(gastoId);
      setTemComprovante(false);
      await queryClient.invalidateQueries({ queryKey: ['gastos'] });
    } catch (falha) {
      Alert.alert('Não deu certo', traduzirErro(falha).mensagem);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={{ gap: espaco.md }}>
      {temComprovante && (
        <Image
          source={{ uri: `${api.gastos.urlDoComprovante(gastoId)}?t=${gastoId}` }}
          style={estilos.previaDoComprovante}
          resizeMode="cover"
          accessibilityLabel="Comprovante anexado"
        />
      )}

      <View style={{ flexDirection: 'row', gap: espaco.sm }}>
        <Botao
          titulo={temComprovante ? 'Trocar foto' : 'Fotografar'}
          variante="secundario"
          icone="planilha"
          estilo={{ flex: 1 }}
          carregando={enviando}
          aoTocar={() => void escolher(true)}
        />
        <Botao
          titulo="Da galeria"
          variante="secundario"
          estilo={{ flex: 1 }}
          carregando={enviando}
          aoTocar={() => void escolher(false)}
        />
      </View>

      {temComprovante && (
        <Botao
          titulo="Remover comprovante"
          variante="secundario"
          icone="lixeira"
          carregando={enviando}
          aoTocar={() => void remover()}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  previaDoComprovante: {
    width: '100%',
    height: 200,
    borderRadius: raio.md,
    backgroundColor: '#F1F5F9',
  },
  tela: { flex: 1, backgroundColor: cores.fundo },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    paddingHorizontal: espaco.md,
    paddingBottom: espaco.md,
  },
  botaoFechar: {
    width: ALVO_DE_TOQUE,
    height: ALVO_DE_TOQUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { fontSize: fonte.titulo, fontWeight: '700', color: cores.texto },

  conteudo: { padding: espaco.lg, paddingTop: 0, gap: espaco.lg, paddingBottom: espaco.xxl },
  bloco: { padding: espaco.lg },
  rotulo: { fontSize: fonte.corpo, fontWeight: '600', color: cores.textoSuave, marginBottom: espaco.sm },

  campoDeValor: {
    borderWidth: 2,
    borderColor: cores.bordaForte,
    borderRadius: raio.md,
    backgroundColor: cores.cartao,
    paddingVertical: espaco.lg,
    fontSize: 36,
    fontWeight: '700',
    color: cores.texto,
    textAlign: 'center',
  },
  campoComErro: { borderColor: cores.perigo, backgroundColor: cores.perigoClaro },
  linhaDeErro: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: espaco.sm },
  textoDeErro: { fontSize: fonte.pequeno, color: cores.perigo, fontWeight: '500' },

  sugestao: {
    minHeight: ALVO_DE_TOQUE,
    justifyContent: 'center',
    paddingHorizontal: espaco.md,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
  textoDaSugestao: { fontSize: fonte.corpo, color: cores.texto },

  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  itemDaGrade: {
    width: '31%',
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: espaco.sm,
    // Pouco recuo lateral: "Alimentação" precisa caber sem quebrar no meio.
    paddingHorizontal: 2,
    borderWidth: 2,
    borderColor: cores.borda,
    borderRadius: raio.md,
    backgroundColor: cores.cartao,
  },
  itemEscolhido: { borderColor: cores.marca, backgroundColor: cores.marcaClara },
  circuloDaCategoria: {
    width: 40,
    height: 40,
    borderRadius: raio.cheio,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nomeDaCategoria: { fontSize: 12, fontWeight: '500', color: cores.textoSuave, textAlign: 'center' },

  linhaDeBotoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  botaoDeData: {
    minHeight: ALVO_DE_TOQUE,
    justifyContent: 'center',
    paddingHorizontal: espaco.xl,
    borderWidth: 2,
    borderColor: cores.borda,
    borderRadius: raio.md,
    backgroundColor: cores.cartao,
  },
  textoDoBotaoDeData: { fontSize: fonte.corpo, fontWeight: '600', color: cores.textoSuave },
  dataEscolhida: { marginTop: espaco.sm, fontSize: fonte.pequeno, color: cores.textoSuave },

  rodape: {
    paddingHorizontal: espaco.lg,
    paddingTop: espaco.md,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
    backgroundColor: cores.cartao,
  },
});
