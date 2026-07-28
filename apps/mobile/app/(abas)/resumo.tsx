import {
  formatarBRL,
  formatarBRLCurto,
  fraseComparacaoMensal,
  hoje,
  nomeDoMes,
  percentual,
  pluralizar,
  type ResumoMensal,
} from '@gastos/core';
import { useState, type ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Icone } from '../../src/componentes/Icone';
import { CaixaDeErro, Carregando, Cartao, Vazio, traduzirErro } from '../../src/componentes/ui';
import { useEvolucao, useResumoMensal } from '../../src/consultas';
import { ALVO_DE_TOQUE, cores, espaco, fonte, raio } from '../../src/tema';

export default function Resumo(): ReactElement {
  const margens = useSafeAreaInsets();
  const agora = hoje();
  const [ano, setAno] = useState(agora.getUTCFullYear());
  const [mes, setMes] = useState(agora.getUTCMonth() + 1);
  const consulta = useResumoMensal(ano, mes);

  function mudarMes(passo: number): void {
    const novo = mes + passo;
    if (novo < 1) {
      setMes(12);
      setAno(ano - 1);
    } else if (novo > 12) {
      setMes(1);
      setAno(ano + 1);
    } else {
      setMes(novo);
    }
  }

  const ehMesAtual = ano === agora.getUTCFullYear() && mes === agora.getUTCMonth() + 1;

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={[estilos.conteudo, { paddingTop: margens.top + espaco.lg }]}
    >
      <Text style={estilos.titulo}>Resumo</Text>

      <Cartao estilo={estilos.seletor}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          onPress={() => mudarMes(-1)}
          style={estilos.seta}
        >
          <Icone nome="esquerda" tamanho={26} cor={cores.textoSuave} />
        </Pressable>

        <Text style={estilos.mes}>
          {nomeDoMes(mes).replace(/^./, (l) => l.toUpperCase())} de {ano}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
          accessibilityState={{ disabled: ehMesAtual }}
          disabled={ehMesAtual}
          onPress={() => mudarMes(1)}
          style={[estilos.seta, ehMesAtual && { opacity: 0.3 }]}
        >
          <Icone nome="direita" tamanho={26} cor={cores.textoSuave} />
        </Pressable>
      </Cartao>

      {consulta.isPending ? (
        <Carregando />
      ) : consulta.isError ? (
        <CaixaDeErro mensagem={traduzirErro(consulta.error).mensagem} />
      ) : consulta.data.quantidade === 0 ? (
        <Vazio
          icone="grafico"
          titulo={`Nenhum gasto em ${nomeDoMes(mes)}`}
          descricao="Use as setas acima para ver outro mês."
        />
      ) : (
        <Conteudo resumo={consulta.data} />
      )}

      <Evolucao />
    </ScrollView>
  );
}

/** Últimos seis meses lado a lado: "estou gastando mais que antes?". */
function Evolucao(): ReactElement {
  const evolucao = useEvolucao(6);

  return (
    <Cartao estilo={estilos.bloco}>
      <Text style={estilos.tituloDaSecao}>Últimos 6 meses</Text>

      {evolucao.isPending ? (
        <Carregando />
      ) : evolucao.isError ? (
        <CaixaDeErro mensagem={traduzirErro(evolucao.error).mensagem} />
      ) : evolucao.data.maiorCentavos === 0 ? (
        <Text style={estilos.textoSuave}>Ainda não há gastos para comparar.</Text>
      ) : (
        <>
          <View style={estilos.grafico}>
            {evolucao.data.pontos.map((ponto) => {
              const altura = (ponto.totalCentavos / Math.max(evolucao.data.maiorCentavos, 1)) * 100;
              const ehMaior = ponto.totalCentavos === evolucao.data.maiorCentavos;
              return (
                <View key={`${ponto.ano}-${ponto.mes}`} style={estilos.colunaDoGrafico}>
                  {/* `adjustsFontSizeToFit`: encolhe em vez de cortar o valor. */}
                  <Text style={estilos.valorDaColuna} numberOfLines={1} adjustsFontSizeToFit>
                    {ponto.totalCentavos > 0 ? formatarBRLCurto(ponto.totalCentavos) : ''}
                  </Text>
                  <View
                    accessibilityRole="image"
                    accessibilityLabel={`${ponto.rotulo}: ${formatarBRL(ponto.totalCentavos)}`}
                    style={[
                      estilos.barraDoGrafico,
                      {
                        // Os 85% deixam espaço para o valor escrito acima.
                        height: `${Math.max(altura * 0.85, ponto.totalCentavos > 0 ? 4 : 0)}%`,
                        backgroundColor: ehMaior ? cores.marcaEscura : cores.marca,
                      },
                    ]}
                  />
                  <Text style={estilos.rotuloDaColuna}>{ponto.rotulo}</Text>
                </View>
              );
            })}
          </View>
          {evolucao.data.mediaCentavos > 0 && (
            <Text style={estilos.textoSuave}>
              Média dos meses com gasto: {formatarBRL(evolucao.data.mediaCentavos)}
            </Text>
          )}
        </>
      )}
    </Cartao>
  );
}

function Conteudo({ resumo }: { resumo: ResumoMensal }): ReactElement {
  return (
    <>
      <Cartao estilo={estilos.cartaoDoTotal}>
        <Text style={estilos.rotuloDoTotal}>Total do mês</Text>
        <Text style={estilos.total} adjustsFontSizeToFit numberOfLines={1}>
          {formatarBRL(resumo.totalCentavos)}
        </Text>
        <Text style={estilos.comparacao}>{fraseComparacaoMensal(resumo)}</Text>
        <Text style={estilos.quantidade}>{pluralizar(resumo.quantidade, 'gasto', 'gastos')}</Text>
      </Cartao>

      <Cartao estilo={estilos.bloco}>
        <Text style={estilos.tituloDaSecao}>Por categoria</Text>
        <View style={estilos.areaDaRosca}>
          <Rosca resumo={resumo} />
        </View>

        {resumo.porCategoria.map((linha) => {
          const cor = linha.categoria?.cor ?? cores.textoFraco;
          return (
            <View key={linha.categoria?.id ?? 'sem'} style={estilos.linhaDeCategoria}>
              <View style={[estilos.circulo, { backgroundColor: `${cor}1A` }]}>
                <Icone nome={linha.categoria?.icone ?? 'etiqueta'} tamanho={18} cor={cor} />
              </View>
              <Text style={estilos.nomeDaCategoria} numberOfLines={1}>
                {linha.categoria?.nome ?? 'Sem categoria'}
              </Text>
              <Text style={estilos.valorDaCategoria}>{formatarBRL(linha.totalCentavos)}</Text>
              <Text style={estilos.percentual}>
                {percentual(linha.totalCentavos, resumo.totalCentavos)}%
              </Text>
            </View>
          );
        })}
      </Cartao>

      <Cartao estilo={estilos.bloco}>
        <Text style={estilos.tituloDaSecao}>Por pessoa</Text>
        {resumo.porPessoa.map((linha) => {
          const parte = percentual(linha.totalCentavos, resumo.totalCentavos);
          return (
            <View key={linha.usuario.id} style={estilos.blocoDaPessoa}>
              <View style={estilos.linhaDaPessoa}>
                <Text style={estilos.nomeDaPessoa} numberOfLines={1}>
                  {linha.usuario.nome}
                </Text>
                <Text style={estilos.valorDaCategoria}>
                  {formatarBRL(linha.totalCentavos)}{' '}
                  <Text style={estilos.percentual}>{parte}%</Text>
                </Text>
              </View>
              <View
                style={estilos.trilho}
                accessibilityRole="progressbar"
                accessibilityLabel={`${linha.usuario.nome}: ${parte}% do total`}
              >
                <View style={[estilos.barra, { width: `${Math.max(parte, 2)}%` }]} />
              </View>
            </View>
          );
        })}
      </Cartao>
    </>
  );
}

/** Rosca com um círculo por fatia, sem biblioteca de gráficos. */
function Rosca({ resumo }: { resumo: ResumoMensal }): ReactElement {
  const RAIO = 60;
  const CIRCUNFERENCIA = 2 * Math.PI * RAIO;
  let acumulado = 0;

  const positivos = resumo.porCategoria.filter((linha) => linha.totalCentavos > 0);
  const total = positivos.reduce((soma, linha) => soma + linha.totalCentavos, 0) || 1;

  return (
    <Svg width={176} height={176} viewBox="0 0 160 160">
      <Circle cx="80" cy="80" r={RAIO} fill="none" stroke="#F1F5F9" strokeWidth={26} />
      {positivos.map((linha) => {
        const fracao = linha.totalCentavos / total;
        const comprimento = fracao * CIRCUNFERENCIA;
        const deslocamento = -acumulado * CIRCUNFERENCIA;
        acumulado += fracao;
        return (
          <Circle
            key={linha.categoria?.id ?? 'sem'}
            cx="80"
            cy="80"
            r={RAIO}
            fill="none"
            stroke={linha.categoria?.cor ?? '#94A3B8'}
            strokeWidth={26}
            strokeDasharray={`${comprimento} ${CIRCUNFERENCIA - comprimento}`}
            strokeDashoffset={deslocamento}
            // Começa no topo, como todo gráfico de pizza.
            transform="rotate(-90 80 80)"
          />
        );
      })}
    </Svg>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg, paddingBottom: espaco.xxl },
  titulo: { fontSize: fonte.titulo, fontWeight: '700', color: cores.texto },

  seletor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espaco.sm,
    paddingVertical: espaco.sm,
  },
  seta: {
    width: ALVO_DE_TOQUE,
    height: ALVO_DE_TOQUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mes: { fontSize: fonte.valor, fontWeight: '600', color: cores.texto },

  cartaoDoTotal: { padding: espaco.xl, alignItems: 'center' },
  rotuloDoTotal: { fontSize: fonte.corpo, color: cores.textoSuave },
  total: { fontSize: 40, fontWeight: '700', color: cores.texto, marginTop: espaco.xs },
  comparacao: { fontSize: fonte.corpo, color: cores.textoSuave, marginTop: espaco.sm, textAlign: 'center' },
  quantidade: { fontSize: fonte.pequeno, color: cores.textoFraco, marginTop: espaco.xs },

  bloco: { padding: espaco.lg, gap: espaco.md },
  tituloDaSecao: { fontSize: fonte.corpo, fontWeight: '600', color: cores.texto },
  areaDaRosca: { alignItems: 'center', paddingVertical: espaco.sm },

  linhaDeCategoria: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
  circulo: {
    width: 36,
    height: 36,
    borderRadius: raio.cheio,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nomeDaCategoria: { flex: 1, fontSize: fonte.corpo, color: cores.textoSuave },
  valorDaCategoria: { fontSize: fonte.corpo, fontWeight: '600', color: cores.texto },
  percentual: { fontSize: fonte.pequeno, color: cores.textoFraco, minWidth: 42, textAlign: 'right' },

  textoSuave: { fontSize: fonte.corpo, color: cores.textoSuave },
  grafico: { flexDirection: 'row', alignItems: 'flex-end', height: 180, gap: espaco.sm },
  colunaDoGrafico: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  valorDaColuna: { fontSize: 11, color: cores.textoSuave, marginBottom: 4 },
  barraDoGrafico: { width: '100%', borderTopLeftRadius: raio.sm, borderTopRightRadius: raio.sm },
  rotuloDaColuna: { fontSize: fonte.pequeno, color: cores.textoSuave, marginTop: 6 },

  blocoDaPessoa: { gap: 6 },
  linhaDaPessoa: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  nomeDaPessoa: { flex: 1, fontSize: fonte.corpo, fontWeight: '500', color: cores.textoSuave },
  trilho: { height: 12, borderRadius: raio.cheio, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  barra: { height: '100%', borderRadius: raio.cheio, backgroundColor: cores.marca },
});
