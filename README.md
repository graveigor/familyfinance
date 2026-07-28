# Controle de Gastos

Aplicativo para substituir a planilha de gastos da família. Roda no navegador e
no celular, importa as planilhas antigas e organiza tudo por categoria, pessoa e
período.

**Estado atual: Fase 1 (Fundação) concluída** — monorepo, banco, autenticação,
CRUD de gastos e categorias, e testes do backend.

## Estrutura

```
/apps
  /api        → backend Fastify + Prisma + PostgreSQL
  /web        → aplicação web (Fase 2)
  /mobile     → app React Native/Expo (Fase 4)
/packages
  /core       → tipos, schemas Zod, regras de dinheiro e datas (compartilhado)
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
```

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
| GET | `/resumos/mensal?ano=&mes=` | Total do mês, por categoria, por pessoa e comparação com o mês anterior |

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

## Próximas fases

2. Web — todas as telas, menos importação
3. Importação de planilha (`.xlsx`/`.xls`/`.csv`) e exportação
4. Mobile (Expo)
5. Offline, recorrentes, foto do comprovante, gráficos de evolução
