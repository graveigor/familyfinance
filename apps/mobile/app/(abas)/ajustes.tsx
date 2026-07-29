import { ROTULO_PAPEL } from '@gastos/core';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, enderecoDaApi } from '../../src/api';
import { Icone } from '../../src/componentes/Icone';
import { Botao, Cartao, traduzirErro } from '../../src/componentes/ui';
import { chaves, useCategorias, useMembros } from '../../src/consultas';
import { useSessao } from '../../src/sessao';
import { ALVO_DE_TOQUE, cores, espaco, fonte, raio } from '../../src/tema';

export default function Ajustes(): ReactElement {
  const margens = useSafeAreaInsets();
  const { usuario, sair } = useSessao();
  const membros = useMembros();
  const categorias = useCategorias();
  const household = useQuery({ queryKey: chaves.household, queryFn: () => api.household.obter() });

  const [painel, setPainel] = useState<'familia' | 'categorias' | null>(null);
  const [convite, setConvite] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  async function gerarConvite(): Promise<void> {
    setGerando(true);
    try {
      const novo = await api.household.criarConvite(7);
      setConvite(novo.codigo);
    } catch (falha) {
      Alert.alert('Não deu certo', traduzirErro(falha).mensagem);
    } finally {
      setGerando(false);
    }
  }

  function confirmarSaida(): void {
    Alert.alert('Sair da conta?', 'Você vai precisar entrar de novo com e-mail e senha.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => void sair() },
    ]);
  }

  const secoes = [
    {
      chave: 'familia' as const,
      icone: 'pessoas',
      titulo: 'Minha família',
      descricao: membros.data
        ? `${membros.data.length} ${membros.data.length === 1 ? 'pessoa' : 'pessoas'}`
        : '...',
    },
    {
      chave: 'categorias' as const,
      icone: 'etiqueta',
      titulo: 'Categorias',
      descricao: categorias.data ? `${categorias.data.length} categorias` : '...',
    },
  ];

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={[estilos.conteudo, { paddingTop: margens.top + espaco.lg }]}
    >
      <View>
        <Text style={estilos.titulo}>Ajustes</Text>
        {household.data && <Text style={estilos.subtitulo}>{household.data.nome}</Text>}
      </View>

      <Cartao estilo={estilos.perfil}>
        <View style={estilos.avatar}>
          <Text style={estilos.inicial}>{usuario?.nome.charAt(0).toUpperCase() ?? '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={estilos.nome}>{usuario?.nome}</Text>
          <Text style={estilos.email} numberOfLines={1}>
            {usuario?.email}
          </Text>
          {usuario && <Text style={estilos.papel}>{ROTULO_PAPEL[usuario.papel]}</Text>}
        </View>
      </Cartao>

      <Cartao>
        {secoes.map((secao, indice) => (
          <Pressable
            key={secao.chave}
            accessibilityRole="button"
            onPress={() => setPainel(secao.chave)}
            style={({ pressed }) => [
              estilos.item,
              indice > 0 && estilos.separador,
              pressed && { backgroundColor: '#F8FAFC' },
            ]}
          >
            <View style={estilos.circulo}>
              <Icone nome={secao.icone} tamanho={22} cor={cores.textoSuave} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={estilos.tituloDoItem}>{secao.titulo}</Text>
              <Text style={estilos.descricaoDoItem}>{secao.descricao}</Text>
            </View>
            <Icone nome="direita" tamanho={22} cor={cores.textoFraco} />
          </Pressable>
        ))}
      </Cartao>

      {/* Importar planilha é tarefa de tela grande: aqui só apontamos o caminho. */}
      <Cartao estilo={estilos.dica}>
        <Icone nome="planilha" tamanho={22} cor={cores.textoSuave} />
        <Text style={estilos.textoDaDica}>
          Para importar uma planilha do Excel, abra o app no computador — a tela é maior e fica
          mais fácil conferir linha a linha.
        </Text>
      </Cartao>

      <Botao titulo="Sair da conta" variante="secundario" icone="sair" aoTocar={confirmarSaida} />

      <Text style={estilos.rodape}>
        Family Finance · versão 1.0.0{'\n'}
        {enderecoDaApi}
      </Text>

      <Modal
        visible={painel !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPainel(null)}
      >
        <Pressable style={estilos.fundoDoModal} onPress={() => setPainel(null)} />
        <View style={[estilos.painel, { paddingBottom: Math.max(margens.bottom, espaco.lg) }]}>
          <View style={estilos.cabecalhoDoPainel}>
            <Text style={estilos.tituloDoPainel}>
              {painel === 'familia' ? 'Minha família' : 'Categorias'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              onPress={() => setPainel(null)}
              style={estilos.botaoFechar}
            >
              <Icone nome="fechar" tamanho={24} cor={cores.textoSuave} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }}>
            {painel === 'familia' &&
              membros.data?.map((membro) => (
                <View key={membro.id} style={estilos.membro}>
                  <View style={estilos.avatarPequeno}>
                    <Text style={estilos.inicialPequena}>
                      {membro.nome.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.tituloDoItem}>
                      {membro.nome}
                      {membro.id === usuario?.id ? ' (você)' : ''}
                    </Text>
                    <Text style={estilos.descricaoDoItem} numberOfLines={1}>
                      {ROTULO_PAPEL[membro.papel]} · {membro.email}
                    </Text>
                  </View>
                </View>
              ))}

            {painel === 'categorias' &&
              categorias.data?.map((categoria) => (
                <View key={categoria.id} style={estilos.membro}>
                  <View style={[estilos.circulo, { backgroundColor: `${categoria.cor}1A` }]}>
                    <Icone nome={categoria.icone} tamanho={20} cor={categoria.cor} />
                  </View>
                  <Text style={estilos.tituloDoItem}>{categoria.nome}</Text>
                </View>
              ))}
          </ScrollView>

          {painel === 'familia' && usuario?.papel === 'ADMIN' && (
            <View style={estilos.areaDoConvite}>
              {convite ? (
                <>
                  <Text style={estilos.rotuloDoConvite}>Código do convite (vale por 7 dias)</Text>
                  <Text style={estilos.codigo}>{convite}</Text>
                  <Botao
                    titulo="Enviar código"
                    variante="secundario"
                    aoTocar={() => {
                      void Share.share({
                        message: `Entre na nossa família no app Controle de Gastos com o código ${convite}`,
                      });
                    }}
                  />
                </>
              ) : (
                <Botao
                  titulo="Gerar código de convite"
                  carregando={gerando}
                  aoTocar={() => void gerarConvite()}
                />
              )}
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg, paddingBottom: espaco.xxl },
  titulo: { fontSize: fonte.titulo, fontWeight: '700', color: cores.texto },
  subtitulo: { fontSize: fonte.corpo, color: cores.textoSuave },

  perfil: { flexDirection: 'row', alignItems: 'center', gap: espaco.md, padding: espaco.lg },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: raio.cheio,
    backgroundColor: cores.marcaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicial: { fontSize: 24, fontWeight: '700', color: cores.marcaEscura },
  nome: { fontSize: fonte.valor, fontWeight: '600', color: cores.texto },
  email: { fontSize: fonte.pequeno, color: cores.textoSuave },
  papel: { fontSize: fonte.pequeno, color: cores.textoFraco, marginTop: 2 },

  item: {
    minHeight: ALVO_DE_TOQUE + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    paddingHorizontal: espaco.lg,
    paddingVertical: espaco.md,
  },
  separador: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  circulo: {
    width: 44,
    height: 44,
    borderRadius: raio.cheio,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloDoItem: { fontSize: fonte.corpo, fontWeight: '500', color: cores.texto },
  descricaoDoItem: { fontSize: fonte.pequeno, color: cores.textoSuave },

  dica: { flexDirection: 'row', gap: espaco.md, padding: espaco.lg, alignItems: 'flex-start' },
  textoDaDica: { flex: 1, fontSize: fonte.corpo, color: cores.textoSuave },

  rodape: { textAlign: 'center', fontSize: fonte.pequeno, color: cores.textoFraco },

  fundoDoModal: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)' },
  painel: {
    backgroundColor: cores.cartao,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: espaco.lg,
    gap: espaco.md,
  },
  cabecalhoDoPainel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tituloDoPainel: { fontSize: fonte.valor, fontWeight: '600', color: cores.texto },
  botaoFechar: {
    width: ALVO_DE_TOQUE,
    height: ALVO_DE_TOQUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membro: { flexDirection: 'row', alignItems: 'center', gap: espaco.md, paddingVertical: espaco.md },
  avatarPequeno: {
    width: 44,
    height: 44,
    borderRadius: raio.cheio,
    backgroundColor: cores.marcaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicialPequena: { fontSize: fonte.corpo, fontWeight: '700', color: cores.marcaEscura },

  areaDoConvite: {
    gap: espaco.md,
    backgroundColor: cores.fundo,
    borderRadius: raio.md,
    padding: espaco.lg,
  },
  rotuloDoConvite: { fontSize: fonte.pequeno, color: cores.textoSuave, textAlign: 'center' },
  codigo: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 8,
    color: cores.marcaEscura,
    textAlign: 'center',
  },
});
