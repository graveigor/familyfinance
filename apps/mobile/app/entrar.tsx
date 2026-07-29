import { Redirect } from 'expo-router';
import { useState, type ReactElement } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Botao, CaixaDeErro, Campo, Cartao, traduzirErro } from '../src/componentes/ui';
import { useSessao } from '../src/sessao';
import { ALVO_DE_TOQUE, cores, espaco, fonte, raio } from '../src/tema';

export default function Entrar(): ReactElement {
  const { entrar, registrar, autenticado } = useSessao();
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigoConvite, setCodigoConvite] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; campos: Record<string, string> }>({
    mensagem: '',
    campos: {},
  });

  if (autenticado) return <Redirect href="/(abas)/inicio" />;

  async function enviar(): Promise<void> {
    setEnviando(true);
    setErro({ mensagem: '', campos: {} });
    try {
      if (modo === 'entrar') await entrar(email, senha);
      else
        await registrar({
          nome,
          email,
          senha,
          ...(codigoConvite.trim() ? { codigoConvite: codigoConvite.trim().toUpperCase() } : {}),
        });
    } catch (falha) {
      setErro(traduzirErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={estilos.rolagem}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.cabecalho}>
          <Image source={require('../assets/icon.png')} style={estilos.logo} />
          <Text style={estilos.titulo}>Family Finance</Text>
          <Text style={estilos.subtitulo}>Os gastos da família, com privacidade para cada um.</Text>
        </View>

        <Cartao estilo={estilos.formulario}>
          <CaixaDeErro mensagem={erro.mensagem || null} />

          {modo === 'criar' && (
            <Campo
              rotulo="Seu nome"
              value={nome}
              onChangeText={setNome}
              autoComplete="name"
              erro={erro.campos.nome}
            />
          )}

          <Campo
            rotulo="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            erro={erro.campos.email}
          />

          <Campo
            rotulo="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
            dica={modo === 'criar' ? 'Pelo menos 8 caracteres.' : undefined}
            erro={erro.campos.senha}
          />

          {modo === 'criar' && (
            <Campo
              rotulo="Código do grupo (opcional)"
              value={codigoConvite}
              onChangeText={(texto) => setCodigoConvite(texto.toUpperCase())}
              autoCapitalize="characters"
              maxLength={8}
              dica="Recebeu um código como FF-9A3K2? Digite aqui."
              erro={erro.campos.codigoConvite}
            />
          )}

          <Botao
            titulo={modo === 'entrar' ? 'Entrar' : 'Criar minha conta'}
            carregando={enviando}
            aoTocar={() => void enviar()}
          />

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setModo(modo === 'entrar' ? 'criar' : 'entrar');
              setErro({ mensagem: '', campos: {} });
            }}
            style={estilos.alternar}
          >
            <Text style={estilos.textoAlternar}>
              {modo === 'entrar' ? 'Ainda não tenho conta' : 'Já tenho conta'}
            </Text>
          </Pressable>
        </Cartao>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  rolagem: { flexGrow: 1, justifyContent: 'center', padding: espaco.lg },
  cabecalho: { alignItems: 'center', gap: espaco.sm, marginBottom: espaco.xl },
  logo: { width: 72, height: 72, borderRadius: raio.lg },
  titulo: { fontSize: 24, fontWeight: '700', color: cores.texto },
  subtitulo: { fontSize: fonte.corpo, color: cores.textoSuave },
  formulario: { padding: espaco.xl, gap: espaco.lg },
  alternar: {
    minHeight: ALVO_DE_TOQUE,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: cores.borda,
    paddingTop: espaco.md,
  },
  textoAlternar: { fontSize: fonte.corpo, fontWeight: '600', color: cores.marcaEscura },
});
