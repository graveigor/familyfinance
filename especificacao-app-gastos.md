# Especificação: Aplicativo de Controle de Gastos

> **Como usar este documento:** cole o conteúdo inteiro no Claude (ou no Claude Code) como primeira mensagem, seguido de: *"Implemente este projeto seguindo a especificação. Comece pela Fase 1."*

---

## 1. Contexto e Objetivo

Hoje o controle de gastos da família é feito em uma planilha Excel simples, preenchida manualmente todo mês, com apenas três informações: **nome da pessoa**, **local do gasto** e **valor**.

O objetivo é substituir essa planilha por um aplicativo que:

- Rode no **celular** (Android e iOS) e no **computador** (navegador).
- Seja usável por **pessoas sem familiaridade com tecnologia** — a interface é o requisito mais crítico do projeto.
- Permita **importar as planilhas Excel existentes**, para não perder o histórico.
- Permita **lançar gastos direto no app**, de forma rápida (meta: menos de 10 segundos por lançamento).
- Organize os dados melhor que a planilha: categorias, filtros por período e por pessoa, e totais automáticos.

**Princípio norteador:** se uma funcionalidade torna a tela mais complexa sem ser essencial, ela fica para depois. Simplicidade vence completude.

---

## 2. Usuários

| Perfil | Uso principal | Necessidade |
|---|---|---|
| Administrador (quem hoje mantém a planilha) | Importa planilhas, revisa e corrige lançamentos, vê os relatórios | Precisa de visão consolidada e da importação |
| Membro da família | Lança os próprios gastos pelo celular | Precisa de rapidez e zero fricção |

Um grupo familiar é chamado de **household**. Todos os membros de um household enxergam os gastos uns dos outros.

---

## 3. Stack Técnica

Escolhida para permitir que **um único desenvolvedor mantenha web e mobile** com o máximo de código compartilhado.

**Monorepo** (pnpm workspaces ou Turborepo):

```
/apps
  /api        → backend
  /web        → aplicação web
  /mobile     → aplicativo React Native
/packages
  /core       → tipos, validações, regras de negócio, cliente HTTP (compartilhado)
```

- **Backend:** Node.js + TypeScript, framework **Fastify**, ORM **Prisma**, banco **PostgreSQL**.
- **Web:** React + TypeScript + Vite, **Tailwind CSS**, TanStack Query para estado de servidor.
- **Mobile:** **React Native com Expo** (permite build para Android e iOS a partir de uma base só).
- **Autenticação:** JWT (access token curto + refresh token).
- **Compartilhado:** **Zod** para schemas de validação usados no backend e nos dois clientes.
- **Testes:** Vitest no backend e no pacote core.

Toda a interface, mensagens de erro e formatação (moeda BRL, datas `dd/mm/aaaa`) em **português do Brasil**.

---

## 4. Modelo de Dados

```prisma
model Household {
  id        String   @id @default(uuid())
  nome      String
  criadoEm  DateTime @default(now())
  membros   User[]
  gastos    Gasto[]
  categorias Categoria[]
}

model User {
  id           String   @id @default(uuid())
  nome         String
  email        String   @unique
  senhaHash    String
  papel        Papel    @default(MEMBRO)   // ADMIN | MEMBRO
  householdId  String
  household    Household @relation(fields: [householdId], references: [id])
  gastos       Gasto[]
  criadoEm     DateTime @default(now())
}

model Categoria {
  id          String   @id @default(uuid())
  nome        String
  icone       String                        // nome do ícone
  cor         String                        // hex
  householdId String
  household   Household @relation(fields: [householdId], references: [id])
  gastos      Gasto[]
}

model Gasto {
  id           String   @id @default(uuid())
  descricao    String                       // "local que gastou" da planilha
  valorCentavos Int                         // SEMPRE em centavos, nunca float
  data         DateTime                     // data do gasto
  formaPagamento FormaPagamento @default(CARTAO)
  observacao   String?
  categoriaId  String?
  categoria    Categoria? @relation(fields: [categoriaId], references: [id])
  userId       String                       // quem realizou o gasto
  user         User     @relation(fields: [userId], references: [id])
  householdId  String
  household    Household @relation(fields: [householdId], references: [id])
  origemImportacaoId String?                // se veio de planilha
  importacao   Importacao? @relation(fields: [origemImportacaoId], references: [id])
  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  @@index([householdId, data])
}

model Importacao {
  id            String   @id @default(uuid())
  nomeArquivo   String
  status        StatusImportacao            // PENDENTE | CONFIRMADA | CANCELADA
  totalLinhas   Int
  linhasImportadas Int
  householdId   String
  criadoEm      DateTime @default(now())
  gastos        Gasto[]
}

enum Papel { ADMIN MEMBRO }
enum FormaPagamento { CARTAO DINHEIRO PIX BOLETO OUTRO }
enum StatusImportacao { PENDENTE CONFIRMADA CANCELADA }
```

**Regra inegociável:** valores monetários são armazenados e trafegados como **inteiros em centavos**. A conversão para exibição (`R$ 1.234,56`) acontece apenas na camada de apresentação. Isso evita erros de arredondamento de ponto flutuante.

**Categorias padrão** criadas automaticamente com o household: Mercado, Alimentação, Transporte, Saúde, Casa, Lazer, Educação, Vestuário, Outros.

---

## 5. API REST

Base: `/api/v1`. Todas as rotas exceto auth exigem header `Authorization: Bearer <token>`.

### Autenticação
- `POST /auth/registrar` — cria usuário + household (se for o primeiro)
- `POST /auth/login` — retorna access e refresh token
- `POST /auth/refresh`
- `GET /auth/eu` — dados do usuário logado

### Gastos
- `GET /gastos` — query params: `de`, `ate`, `userId`, `categoriaId`, `busca`, `pagina`, `porPagina`. Retorna lista paginada + total do período.
- `POST /gastos`
- `GET /gastos/:id`
- `PATCH /gastos/:id`
- `DELETE /gastos/:id`

### Categorias
- `GET /categorias`, `POST /categorias`, `PATCH /categorias/:id`, `DELETE /categorias/:id`
  (ao deletar, os gastos ficam sem categoria — nunca deletar gastos em cascata)

### Household
- `GET /household/membros`
- `POST /household/convites` — gera código de convite
- `POST /household/entrar` — entra usando código

### Importação
- `POST /importacoes/analisar` — recebe o arquivo (multipart), devolve o **preview** (ver seção 6)
- `POST /importacoes/:id/confirmar` — grava os gastos definitivamente
- `DELETE /importacoes/:id` — cancela

### Resumos
- `GET /resumos/mensal?ano=&mes=` — total do mês, total por categoria, total por pessoa, comparação com o mês anterior

**Padrão de erro** (sempre este formato):
```json
{ "erro": { "codigo": "VALIDACAO", "mensagem": "Texto amigável em português", "campos": { "valor": "Informe um valor maior que zero" } } }
```

---

## 6. Importação de Planilha Excel — requisito central

Esta é a funcionalidade mais delicada. A planilha atual é irregular e feita à mão, então o parser precisa ser tolerante.

### Formatos aceitos
`.xlsx`, `.xls`, `.csv` (usar a biblioteca **SheetJS/xlsx**).

### Fluxo em três etapas

**Etapa 1 — Envio e detecção.**
O usuário envia o arquivo. O backend lê a primeira aba, procura a linha de cabeçalho (a primeira linha com 2 ou mais células de texto não vazias) e tenta mapear automaticamente as colunas por sinônimos, sem diferenciar maiúsculas, minúsculas ou acentos:

| Campo | Sinônimos aceitos |
|---|---|
| `descricao` | local, lugar, estabelecimento, descrição, onde, gasto, histórico |
| `valor` | valor, preço, total, quantia, r$, gasto |
| `data` | data, dia, vencimento, competência |
| `pessoa` | nome, pessoa, quem, responsável, titular, portador |
| `categoria` | categoria, tipo, classificação |

**Etapa 2 — Confirmação do mapeamento.**
A tela mostra as colunas detectadas e as 5 primeiras linhas já interpretadas. O usuário pode corrigir qualquer mapeamento por um seletor. Se uma coluna obrigatória (`descricao`, `valor`) não for detectada, o app pede explicitamente.

**Etapa 3 — Preview e confirmação.**
Mostra todas as linhas interpretadas, separadas em três grupos:
- **Prontas** — serão importadas
- **Com aviso** — importadas, mas requerem atenção (ex.: data ausente, pessoa desconhecida)
- **Com erro** — ignoradas (ex.: valor não numérico)

O usuário pode editar linha a linha antes de confirmar. Nada é gravado até o clique em **Confirmar importação**.

### Regras de parsing

- **Valores:** aceitar `1.234,56`, `1234,56`, `R$ 1.234,56`, `1234.56`. Se houver vírgula e ponto, o último separador é o decimal. Remover símbolo de moeda e espaços. Valores negativos ou entre parênteses → tratar como estorno (valor negativo).
- **Datas:** aceitar `dd/mm/aaaa`, `dd/mm/aa`, `aaaa-mm-dd` e o formato serial numérico do Excel. Se não houver coluna de data, perguntar ao usuário o **mês de referência** e usar o dia 1.
- **Pessoas:** casar o nome com os membros do household ignorando acentos e caixa. Se não encontrar, oferecer: criar um novo membro, associar a um existente, ou atribuir ao usuário logado.
- **Categoria:** se não vier na planilha, deixar sem categoria (não inventar).
- **Linhas ignoradas:** linhas vazias, linhas de total/subtotal (descrição contendo "total", "soma", "subtotal"), e linhas sem valor numérico.
- **Duplicatas:** se já existir um gasto com mesma descrição, valor e data no household, marcar com aviso "possível duplicata" e deixar **desmarcado** por padrão no preview.

### Exportação
Também implementar `GET /gastos/exportar?formato=xlsx|csv&de=&ate=`, para que o usuário nunca se sinta preso ao app.

---

## 7. Interface — telas e comportamento

### Diretrizes de usabilidade (valem para todas as telas)

- Fontes grandes: mínimo 16px no corpo, 18px em valores.
- Alvos de toque com no mínimo 48×48px.
- Contraste alto; nunca usar cor como única forma de transmitir informação.
- Zero jargão técnico. "Não conseguimos salvar, verifique sua internet" em vez de "Erro 500".
- Todo botão que destrói algo pede confirmação e é reversível quando possível.
- Nenhuma tela deve exigir mais de 3 toques para chegar a partir da inicial.

### 7.1 Tela Inicial (Início)

Elemento principal e maior da tela: **o total gasto no mês atual**, em fonte grande.
Abaixo: comparação com o mês anterior em linguagem simples ("R$ 320 a mais que em junho").
Abaixo: lista dos últimos 10 gastos (descrição, pessoa, valor, categoria com ícone colorido).
Fixo no canto inferior direito: **botão flutuante grande "+" para adicionar gasto**.

### 7.2 Adicionar Gasto

Um formulário curto, em uma tela só, nesta ordem:

1. **Valor** — teclado numérico abre automaticamente, com máscara de moeda enquanto digita.
2. **Onde foi** — campo de texto com autocompletar baseado nos gastos anteriores.
3. **Categoria** — grade de ícones grandes, seleção com um toque. Opcional.
4. **Data** — já preenchida com hoje; botões rápidos "Hoje" e "Ontem".
5. **Quem gastou** — já preenchido com o usuário logado.

Botão **Salvar** grande e fixo na base. Ao salvar, volta ao Início com uma confirmação discreta.

### 7.3 Gastos (lista completa)

Agrupada por dia, com subtotal diário. Barra de busca no topo. Filtros por período, pessoa e categoria em uma gaveta lateral, com o filtro ativo sempre visível como "etiqueta" removível. Deslizar um item para a esquerda revela editar e excluir.

### 7.4 Resumo

Seletor de mês no topo. Um gráfico de rosca por categoria e uma lista de barras horizontais por pessoa, cada uma com valor e percentual. Sem gráficos complexos ou métricas que exijam interpretação.

### 7.5 Importar Planilha

Área de arrastar-e-soltar no desktop, botão "Escolher arquivo" no celular. Em seguida, o fluxo de três etapas da seção 6, com uma barra de progresso indicando em qual etapa o usuário está.

### 7.6 Ajustes

Perfil, membros da família e convites, gerenciar categorias, exportar dados, sair.

### Navegação

Barra inferior no mobile e lateral no desktop, com 4 itens apenas: **Início · Gastos · Resumo · Ajustes**.

---

## 8. Fases de Implementação

Implementar em ordem. Cada fase deve estar funcionando antes de começar a próxima.

**Fase 1 — Fundação**
Monorepo, Prisma + migrations, autenticação completa, CRUD de gastos e categorias, testes do backend.

**Fase 2 — Web**
Todas as telas da seção 7, exceto importação. Responsivo. Cliente HTTP no pacote `core`.

**Fase 3 — Importação**
Parser de planilha, endpoints de análise/confirmação, fluxo de três etapas na web, exportação.

**Fase 4 — Mobile**
App Expo reaproveitando `core`. Todas as telas. Teclado numérico nativo no campo de valor.

**Fase 5 — Refinamento**
Modo offline no mobile (fila local sincronizada ao reconectar), gastos recorrentes, anexo de foto do comprovante, gráficos de evolução.

---

## 9. Critérios de Aceitação

O projeto está pronto quando:

- [ ] Uma planilha real, com colunas em português e valores em `R$ 1.234,56`, é importada corretamente sem configuração manual de mapeamento.
- [ ] Um gasto é lançado no celular em menos de 10 segundos.
- [ ] Uma pessoa sem familiaridade com apps consegue lançar um gasto sem instruções.
- [ ] O total do mês na tela inicial bate exatamente com a soma da planilha original.
- [ ] Nenhum valor monetário é manipulado como número de ponto flutuante em nenhum ponto do código.
- [ ] Todos os textos visíveis estão em português do Brasil.
- [ ] Os dados podem ser exportados de volta para Excel a qualquer momento.

---

## 10. Instruções para o Claude

Ao implementar:

1. Comece pela **Fase 1** e confirme com o usuário antes de avançar para a próxima fase.
2. Escreva **TypeScript estrito** — sem `any`.
3. Valide toda entrada com **Zod**, e reutilize os mesmos schemas no frontend.
4. Antes de escrever muito código, apresente a estrutura de pastas proposta para validação.
5. Em cada decisão de interface, opte pela alternativa mais simples para o usuário final, mesmo que dê mais trabalho de implementar.
6. Comente apenas o que não é óbvio — especialmente o parser de valores e datas.
7. Ao terminar cada fase, liste o que foi feito e o que ficou pendente.
