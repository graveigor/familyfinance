# Controle de Gastos

Aplicativo para substituir a planilha de gastos da família. Roda no navegador e
no celular, importa as planilhas antigas e organiza tudo por categoria, pessoa e
período.

**Todas as 5 fases da especificação estão concluídas** — backend com testes,
aplicativo web **instalável no celular e no computador** (PWA),
importação/exportação de planilhas do Excel, **app nativo (Expo) para Android e
iOS**, e o refinamento: lançamento offline, contas fixas, foto do comprovante e
gráfico de evolução.

## Estrutura

```
/apps
  /api        → backend Fastify + Prisma + PostgreSQL
  /web        → aplicação web React + Vite + Tailwind (instalável como app)
  /mobile     → app nativo React Native + Expo (Android e iOS)
/packages
  /core       → tipos, schemas Zod, cliente HTTP, dinheiro e datas (compartilhado)
```

Regra que atravessa todo o código: **dinheiro é inteiro em centavos**. Nenhum
valor monetário passa por `float` em ponto algum — a conversão para
`R$ 1.234,56` só acontece na hora de exibir.

## Como rodar

Pré-requisitos: Node 20+ e PostgreSQL 17 (no macOS: `brew install postgresql@17`
e `brew services start postgresql@17`).

```bash
npm install
createdb controle_gastos
createdb controle_gastos_test
cp apps/api/.env.example apps/api/.env   # ajuste DATABASE_URL e os segredos
npm run db:migrate
npm run db:seed                          # dados de exemplo (opcional)
npm run dev                              # API em http://localhost:3333
npm run dev:web                          # app em http://localhost:5173
npm run dev:mobile                       # app nativo (Expo)
```

O `npm run dev:web` já repassa `/api` para o backend — não é preciso configurar
CORS nem variável de ambiente para desenvolver.

Gere os segredos do JWT com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Depois do seed, entre com `maria@exemplo.com` / `senha123` (administradora) ou
`joao@exemplo.com` / `senha123` (membro).

## Testes

```bash
npm test
```

Os testes do `core` são puros; os da API sobem o Fastify de verdade e usam o
banco `controle_gastos_test`, definido em `apps/api/.env.test`.

## Instalar no celular e no computador

O app web é um PWA: instala sem loja de aplicativos, abre em tela cheia e
funciona offline para consultar o que já foi carregado (lançar exige internet).

| Onde | Como |
|---|---|
| Android (Chrome) | Aparece a faixa "Instalar" na tela inicial, ou menu ⋮ > Instalar aplicativo |
| iPhone / iPad (Safari) | Botão Compartilhar > **Adicionar à Tela de Início** |
| Windows / Mac / Linux (Chrome, Edge) | Ícone de instalar na barra de endereço, ou menu > Instalar |

Em **Ajustes > Instalar o app** há o botão e as instruções para cada aparelho.

Requisito: em produção o app precisa ser servido por **HTTPS** (em
`localhost` funciona sem). O service worker fica em `apps/web/public/sw.js`,
escrito à mão — guarda os arquivos do app, e **nunca** guarda resposta da API,
para não exibir total desatualizado.

Os ícones são gerados por script, sem dependência de imagem:

```bash
npm run icones -w @gastos/web
```

## Importar a planilha antiga

**Ajustes > Importar planilha**, em três passos, sem nada gravado até o fim:

1. **Escolher a planilha** — `.xlsx`, `.xls` ou `.csv`; arrastar e soltar no
   computador, botão no celular.
2. **Conferir as colunas** — o app detecta sozinho quais colunas são nome,
   local, valor, data e categoria, mesmo com título no topo e linha de total no
   fim. Dá para corrigir qualquer uma. Sem coluna de data, ele pergunta o mês.
3. **Conferir os gastos** — as linhas aparecem separadas em **Prontas**,
   **Atenção** e **Não dá para importar**, com o motivo de cada aviso. Dá para
   editar linha a linha e desmarcar o que não quer.

O que o interpretador aguenta:

| Situação | O que acontece |
|---|---|
| `R$ 1.234,56`, `1234,56`, `1234.56`, `1.234` | Vira centavo exato, sem `float` |
| `(45,90)` ou `-45,90` | Estorno, valor negativo |
| `dd/mm/aaaa`, `dd/mm/aa`, `aaaa-mm-dd`, número de série do Excel | Data reconhecida |
| Nome escrito só com o primeiro nome, com acento ou em CAIXA ALTA | Casa com o membro certo |
| Nome que não está na família | Aviso e fica com quem importou |
| Categoria que não existe | Aviso e fica sem categoria — o app não inventa |
| Linha em branco, "TOTAL", "Subtotal", "Soma" | Ignorada em silêncio |
| Gasto igual (descrição + valor + data) já lançado | Marcado como possível duplicata e **desmarcado** |
| Valor que não é número | Fica em "Não dá para importar", com a célula original à mostra |

O número da linha mostrado na tela é o mesmo do Excel, para conferir lado a lado.

A planilha enviada fica guardada só entre os passos e é apagada ao confirmar ou
cancelar.

## Exportar

**Ajustes > Exportar meus dados** baixa tudo em `.xlsx` ou `.csv`, com período
opcional. O `.csv` sai com ponto e vírgula e BOM, do jeito que o Excel em
português abre sem bagunçar os acentos.

## App nativo (Android e iOS)

```bash
npm run dev:mobile
```

Leia o QR code com o app **Expo Go** (Play Store / App Store). O celular precisa
estar na mesma rede do computador — o app descobre o endereço da API sozinho a
partir do endereço do Expo, então não é preciso configurar IP na mão.

Para apontar para outro servidor, use `EXPO_PUBLIC_API_URL`:

```bash
EXPO_PUBLIC_API_URL=https://api.suacasa.com npm run dev:mobile
```

O que é compartilhado com a web: **todo** o pacote `core` — tipos, schemas Zod,
regras de dinheiro e datas e o cliente HTTP com renovação de sessão. Muda só a
camada de tela e o armazenamento da sessão (AsyncStorage no lugar do
localStorage).

Detalhes de plataforma:

- Campo de valor abre com o **teclado numérico nativo** (`number-pad`), já com
  o cursor nele ao abrir a tela.
- Confirmação de exclusão e de saída usa o **alerta do sistema**.
- Convite é enviado pela **folha de compartilhamento** do aparelho.
- "Puxar para atualizar" no Início e na lista de gastos.
- Ícone e cor da marca gerados pelo mesmo script da web.

Para publicar nas lojas é preciso conta de desenvolvedor Apple (US$ 99/ano) e
Google (US$ 25, uma vez), e gerar os pacotes com EAS Build.

## Contas fixas, comprovante, offline e evolução

**Contas fixas** (Ajustes > Contas fixas) — o que se repete todo mês: aluguel,
internet, mensalidade. O lançamento entra sozinho na data escolhida. Não há
tarefa agendada rodando escondida: os meses pendentes são criados quando alguém
abre o app, de forma idempotente (o campo `ultimoMesGerado` guarda até onde já
foi). "Todo dia 31" cai no dia 28 em fevereiro — pular o mês seria pior, a conta
existe de qualquer jeito. Apagar a conta fixa **não** apaga os lançamentos já
feitos: eles são história e continuam no total.

**Comprovante** — foto ou PDF anexado ao gasto. No celular abre a câmera direto;
na web, o seletor de arquivo. Os arquivos ficam em disco
(`apps/api/arquivos/comprovantes/<household>/`), nunca no banco: imagem em
coluna incha o backup e deixa toda consulta mais lenta. O nome é sorteado e o
caminho é conferido contra travessia de pasta. Excluir o gasto leva o arquivo
junto.

**Lançar sem internet** (só no app nativo) — se a chamada falhar por rede, o
gasto entra numa fila no próprio aparelho e sobe sozinho quando a conexão volta.
A tela inicial mostra quantos estão esperando. Só falha de rede vai para a fila:
erro de validação (valor zerado, categoria de outra casa) aparece na hora, para
a pessoa corrigir, em vez de ficar preso.

**Evolução** — no Resumo, os últimos 6 meses em barras, com uma linha tracejada
na média. A média considera só os meses que tiveram gasto; incluir mês vazio
afundaria a linha e daria uma impressão errada.

## Telas

- **Início** — total do mês em fonte grande, comparação com o mês anterior em
  linguagem simples e os últimos gastos. Botão "+" fixo.
- **Novo gasto** — valor com teclado numérico e máscara, "onde foi" com
  autocompletar, categoria em grade de ícones, "Hoje/Ontem" e quem gastou.
- **Gastos** — agrupados por dia com subtotal, busca, filtros em gaveta com
  etiquetas removíveis, editar e excluir.
- **Resumo** — seletor de mês, rosca por categoria e barras por pessoa.
- **Importar planilha** — os três passos acima, com barra de progresso (só na web:
  conferir linha a linha pede tela grande).
- **Ajustes** — perfil, família e convites, categorias, contas fixas, importar,
  exportar, instalar o app, sair.

Navegação com 4 itens: barra inferior no celular, coluna lateral no computador.

## API

Base `/api/v1`. Toda rota fora de `auth/registrar`, `auth/login` e
`auth/refresh` exige `Authorization: Bearer <token>`.

| Método | Rota | O que faz |
|---|---|---|
| POST | `/auth/registrar` | Cria conta. Sem convite vira ADMIN de uma família nova; com `codigoConvite` entra na existente |
| POST | `/auth/login` | Devolve access + refresh token |
| POST | `/auth/refresh` | Renova a sessão |
| GET/PATCH | `/auth/eu` | Dados e edição do perfil |
| GET | `/gastos` | Lista paginada + total do período. Filtros: `de`, `ate`, `userId`, `categoriaId`, `busca`, `pagina`, `porPagina` |
| GET | `/gastos/sugestoes` | Autocompletar do campo "Onde foi" |
| POST/GET/PATCH/DELETE | `/gastos[/:id]` | CRUD de gastos |
| GET/POST/PATCH/DELETE | `/categorias[/:id]` | CRUD de categorias (apagar nunca apaga gastos) |
| GET/PATCH | `/household` | Dados da família |
| GET | `/household/membros` | Quem está na família |
| PATCH | `/household/membros/:id` | Troca o papel (só ADMIN) |
| GET/POST | `/household/convites` | Códigos de convite (só ADMIN) |
| POST | `/household/entrar` | Entra em outra família com um código |
| GET | `/gastos/exportar?formato=xlsx\|csv&de=&ate=` | Baixa o histórico |
| POST | `/importacoes/analisar` | Recebe a planilha (multipart) e devolve a prévia |
| POST | `/importacoes/:id/mapear` | Refaz a prévia com o mapeamento corrigido |
| POST | `/importacoes/:id/confirmar` | Grava só as linhas marcadas |
| DELETE | `/importacoes/:id` | Cancela e apaga a planilha guardada |
| GET | `/importacoes` | Histórico de importações |
| PUT/GET/DELETE | `/gastos/:id/comprovante` | Anexa, devolve e remove a foto ou o PDF |
| GET/POST/PATCH/DELETE | `/recorrencias[/:id]` | Contas fixas |
| POST | `/recorrencias/gerar` | Cria os lançamentos pendentes (idempotente) |
| GET | `/resumos/mensal?ano=&mes=` | Total do mês, por categoria, por pessoa e comparação com o mês anterior |
| GET | `/resumos/evolucao?meses=` | Total mês a mês, para o gráfico |

Erro sempre no mesmo formato, em português e sem jargão:

```json
{
  "erro": {
    "codigo": "VALIDACAO",
    "mensagem": "Confira os campos destacados e tente de novo.",
    "campos": { "valorCentavos": "Informe um valor maior que zero." }
  }
}
```

## Regras de negócio já valendo

- Cada household é isolado: nenhuma consulta cruza famílias.
- Membro edita e apaga só o que lançou; administrador revisa o de todos.
- Apagar categoria deixa os gastos sem categoria — nunca em cascata.
- A família não pode ficar sem nenhum administrador.
- Login responde igual para senha errada e e-mail inexistente.
- Senha guardada com scrypt (`node:crypto`), nunca em texto puro.

## Decisões de dependência

- **npm workspaces** no lugar de pnpm: `corepack enable` não instala o pnpm
  sem sudo nesta máquina. O layout do monorepo é o mesmo.
- **Sem biblioteca de gráficos e sem pacote de ícones**: a rosca e os ícones
  são SVG escritos no projeto. Menos peso para baixar e nada quebra offline.
- **Sem `vite-plugin-pwa`**: o service worker é curto e explícito, e a cadeia
  de dependências do Workbox trazia alertas de segurança em ferramenta de build.
- `react-router-dom` fica na **7.18.1**, a versão mais nova disponível. O único
  alerta aberto é de modo RSC com server actions, que este SPA não usa.
- **Metro sem `disableHierarchicalLookup`**: essa configuração é receita para
  pnpm e yarn; com npm, pacotes de versão conflitante ficam aninhados
  (`expo-modules-core` mora dentro de `expo/node_modules`) e desligar a busca
  hierárquica faz o empacotador não encontrá-los.
- **SheetJS instalado da distribuição oficial** (`cdn.sheetjs.com`), não do npm:
  o pacote `xlsx` publicado no npm parou na 0.18.5 e tem falhas conhecidas de
  poluição de protótipo e ReDoS. A 0.20.3 oficial não tem nenhuma.

### Alertas de segurança abertos

`npm audit` acusa duas cadeias que não têm correção disponível hoje:

- `react-router` — só em modo RSC com server actions, que este SPA não usa.
- Ferramentas de build do Expo (`@expo/config`, `uuid`) — rodam na sua máquina
  ao empacotar, não vão dentro do app. A "correção" automática rebaixaria o
  Expo da versão 57 para a 46.

## O que ficou de fora

- **Publicação nas lojas** — precisa de conta de desenvolvedor Apple (US$ 99/ano)
  e Google (US$ 25, uma vez) e de builds pelo EAS. Enquanto isso, o app nativo
  roda pelo Expo Go e a web instala como PWA sem loja nenhuma.
- **Importar planilha no app nativo** — conferir linha a linha pede tela grande;
  o app aponta o caminho para o computador.
- **Fila offline na web** — o PWA abre offline e mostra o que já carregou, mas
  lançar exige internet. A fila existe só no app nativo, onde é onde o caso
  acontece (mercado sem sinal).
