import { ehCorpoErro, ErroApp } from '@gastos/core';
import type { ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { ALVO_DE_TOQUE, cores, espaco, fonte, raio } from '../tema';
import { Icone } from './Icone';

type Variante = 'principal' | 'secundario' | 'perigo';

export function Botao({
  titulo,
  aoTocar,
  variante = 'principal',
  carregando = false,
  desabilitado = false,
  icone,
  estilo,
}: {
  titulo: string;
  aoTocar: () => void;
  variante?: Variante;
  carregando?: boolean;
  desabilitado?: boolean;
  icone?: string;
  estilo?: ViewStyle;
}): ReactElement {
  const inativo = desabilitado || carregando;
  const fundo =
    variante === 'principal' ? cores.marca : variante === 'perigo' ? cores.perigo : cores.cartao;
  const corDoTexto = variante === 'secundario' ? cores.texto : cores.textoInvertido;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: carregando }}
      onPress={aoTocar}
      disabled={inativo}
      style={({ pressed }) => [
        estilos.botao,
        { backgroundColor: fundo, opacity: inativo ? 0.5 : pressed ? 0.85 : 1 },
        variante === 'secundario' && { borderWidth: 2, borderColor: cores.bordaForte },
        estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={corDoTexto} />
      ) : (
        <>
          {icone && <Icone nome={icone} tamanho={20} cor={corDoTexto} />}
          <Text style={[estilos.textoDoBotao, { color: corDoTexto }]}>{titulo}</Text>
        </>
      )}
    </Pressable>
  );
}

interface CampoProps extends TextInputProps {
  rotulo: string;
  erro?: string;
  dica?: string;
}

export function Campo({ rotulo, erro, dica, style, ...resto }: CampoProps): ReactElement {
  return (
    <View>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={cores.textoFraco}
        style={[estilos.entrada, erro ? estilos.entradaComErro : null, style]}
        {...resto}
      />
      {dica && !erro && <Text style={estilos.dica}>{dica}</Text>}
      {erro && (
        // Ícone + texto: a cor sozinha não avisa quem não distingue tons.
        <View style={estilos.linhaDeErro}>
          <Icone nome="aviso" tamanho={16} cor={cores.perigo} />
          <Text style={estilos.textoDeErro}>{erro}</Text>
        </View>
      )}
    </View>
  );
}

export function Cartao({
  children,
  estilo,
}: {
  children: ReactNode;
  estilo?: ViewStyle;
}): ReactElement {
  return <View style={[estilos.cartao, estilo]}>{children}</View>;
}

export function Carregando({ texto = 'Carregando...' }: { texto?: string }): ReactElement {
  return (
    <View style={estilos.carregando}>
      <ActivityIndicator color={cores.marca} size="large" />
      <Text style={estilos.textoSuave}>{texto}</Text>
    </View>
  );
}

export function CaixaDeErro({ mensagem }: { mensagem: string | null }): ReactElement | null {
  if (!mensagem) return null;
  return (
    <View accessibilityRole="alert" style={estilos.caixaDeErro}>
      <Icone nome="aviso" tamanho={20} cor={cores.perigo} />
      <Text style={estilos.textoDaCaixaDeErro}>{mensagem}</Text>
    </View>
  );
}

export function Vazio({
  icone = 'planilha',
  titulo,
  descricao,
}: {
  icone?: string;
  titulo: string;
  descricao?: string;
}): ReactElement {
  return (
    <View style={estilos.vazio}>
      <View style={estilos.circuloDoVazio}>
        <Icone nome={icone} tamanho={32} cor={cores.textoFraco} />
      </View>
      <Text style={estilos.tituloDoVazio}>{titulo}</Text>
      {descricao && <Text style={estilos.textoSuave}>{descricao}</Text>}
    </View>
  );
}

/** Traduz qualquer falha do cliente HTTP para algo exibível, sem jargão. */
export function traduzirErro(erro: unknown): { mensagem: string; campos: Record<string, string> } {
  if (erro instanceof ErroApp) return { mensagem: erro.message, campos: erro.campos ?? {} };
  if (ehCorpoErro(erro)) {
    return { mensagem: erro.erro.mensagem, campos: erro.erro.campos ?? {} };
  }
  return {
    mensagem: 'Não conseguimos concluir agora. Tente novamente em instantes.',
    campos: {},
  };
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: ALVO_DE_TOQUE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.sm,
    paddingHorizontal: espaco.xl,
    paddingVertical: espaco.md,
    borderRadius: raio.md,
  },
  textoDoBotao: { fontSize: fonte.corpo, fontWeight: '600' },

  rotulo: {
    fontSize: fonte.corpo,
    fontWeight: '600',
    color: cores.textoSuave,
    marginBottom: espaco.sm,
  },
  entrada: {
    minHeight: ALVO_DE_TOQUE,
    borderWidth: 2,
    borderColor: cores.bordaForte,
    borderRadius: raio.md,
    backgroundColor: cores.cartao,
    paddingHorizontal: espaco.lg,
    paddingVertical: espaco.md,
    fontSize: fonte.corpo,
    color: cores.texto,
  },
  entradaComErro: { borderColor: cores.perigo, backgroundColor: cores.perigoClaro },
  dica: { marginTop: espaco.xs, fontSize: fonte.pequeno, color: cores.textoSuave },
  linhaDeErro: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: espaco.xs },
  textoDeErro: { fontSize: fonte.pequeno, color: cores.perigo, fontWeight: '500', flex: 1 },

  cartao: {
    backgroundColor: cores.cartao,
    borderRadius: raio.lg,
    borderWidth: 1,
    borderColor: cores.borda,
  },

  carregando: { alignItems: 'center', gap: espaco.md, paddingVertical: espaco.xxl },
  textoSuave: { fontSize: fonte.corpo, color: cores.textoSuave, textAlign: 'center' },

  caixaDeErro: {
    flexDirection: 'row',
    gap: espaco.md,
    alignItems: 'flex-start',
    backgroundColor: cores.perigoClaro,
    borderWidth: 2,
    borderColor: '#FECACA',
    borderRadius: raio.md,
    padding: espaco.lg,
  },
  textoDaCaixaDeErro: { flex: 1, fontSize: fonte.corpo, color: '#991B1B' },

  vazio: { alignItems: 'center', gap: espaco.md, paddingVertical: espaco.xxl, paddingHorizontal: espaco.xl },
  circuloDoVazio: { backgroundColor: '#F1F5F9', padding: espaco.lg, borderRadius: raio.cheio },
  tituloDoVazio: { fontSize: fonte.valor, fontWeight: '600', color: cores.texto },
});
