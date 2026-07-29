# Colocar o app no ar — passo a passo no Vercel

O código já está pronto e enviado (commit `3e1be69`). A API agora vai **junto do
site**, no mesmo projeto do Vercel — você não precisa de outro serviço.

Falta só: **um banco de dados** e **três variáveis de ambiente**.

> **Importante:** as variáveis de ambiente contêm segredos. **Digite você
> mesmo**, não peça para o Claude do Chrome preencher — nem para nenhum
> assistente. Ele pode navegar e conferir, mas senha e chave são suas.

---

## Parte 1 — Criar o banco (você, 2 minutos)

1. No painel do Vercel, abra o seu projeto.
2. Vá na aba **Storage**.
3. Clique em **Create Database** e escolha **Neon** (Serverless Postgres).
   É gratuito para um app de família.
4. Aceite o plano **Free** e confirme a criação.
5. Quando terminar, confirme que ele foi **conectado ao projeto** (o Vercel
   costuma perguntar; diga que sim).

Isso cria a variável `DATABASE_URL` sozinho.

## Parte 2 — As duas chaves de segurança (você)

São o que assina o login de quem usa o app. Em **Settings → Environment
Variables**, adicione as duas, marcando os três ambientes (Production, Preview,
Development):

```
JWT_SEGREDO
eaac98addd2e4aee16713164f29c46d61f44fd54888905610cee577d903920c4
```

```
JWT_SEGREDO_REFRESH
415d9255116df3b53a0d8578b265fc0adecbb6f54426cb250135ccae069b3a98
```

Gerei esses valores agora, aleatórios, só para você. Se preferir gerar outros:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Parte 3 — Publicar de novo

Em **Deployments**, abra o mais recente e clique em **Redeploy**, com o cache
desmarcado.

---

## Se preferir que o Claude do Chrome ajude a conferir

Cole isto na conversa com ele. Repare que **nada de segredo é digitado por
ele** — só navegação e conferência.

> Você está no painel do Vercel, no projeto `app-controlegastos`
> (repositório `graveigor/app-controlegastos`). Já configurei o código; preciso
> que você me ajude a conferir o painel e a publicar.
>
> **Não digite nenhum valor de variável de ambiente, senha ou chave.** Eu mesmo
> digito. Você só navega, confere e me diz o que está faltando.
>
> **1. Pasta raiz**
> - Em **Settings → Build and Deployment**, confira o campo **Root Directory**.
> - Ele precisa estar **vazio** (a raiz do repositório). Se estiver `apps/web`,
>   limpe e salve — o projeto é um monorepo e o site depende de pastas de fora.
> - Em Build Command, Output Directory e Install Command: se o botão
>   **Override** estiver ligado em algum, **desligue**. Os comandos certos já
>   vêm do arquivo `vercel.json` do repositório.
>
> **2. Banco de dados**
> - Vá na aba **Storage** e me diga se já existe um banco conectado ao projeto.
> - Se não existir, **pare e me avise** — eu crio, porque envolve escolher plano.
>
> **3. Variáveis de ambiente**
> - Em **Settings → Environment Variables**, me diga **quais nomes** já existem
>   (só os nomes, não os valores).
> - Preciso que existam três: `DATABASE_URL`, `JWT_SEGREDO` e
>   `JWT_SEGREDO_REFRESH`. Me diga quais estão faltando e eu adiciono.
>
> **4. Publicar**
> - Quando eu confirmar que está tudo lá, vá em **Deployments**, abra o mais
>   recente e use **Redeploy**, com a opção de cache **desmarcada**.
> - Acompanhe o log e me diga se terminou com sucesso ou qual erro apareceu.
>
> **5. Testar**
> - Abra o endereço do site e some `/api/v1/../saude` no fim — por exemplo
>   `https://app-controlegastos-web-eta.vercel.app/saude`. Deve responder
>   `{"ok":true,"versao":"0.1.0"}`.
> - Depois abra o site normalmente e tente **criar uma conta**. Me diga o que
>   aconteceu.
>
> Regras: não mexa em plano, cobrança, domínio nem integrações. Não apague
> deploys. Se algo estiver diferente do que descrevi, **pare e me pergunte**.

---

## Como saber que deu certo

O log do deploy deve mostrar as migrações rodando:

```
> @gastos/api@0.1.0 db:deploy
> prisma migrate deploy
Applying migration `20260728141509_inicial`
...
✓ built in ~1s
```

E o teste de saúde deve responder:

```bash
curl https://SEU-ENDERECO.vercel.app/saude
# {"ok":true,"versao":"0.1.0"}
```

Se der `405` ou vier o HTML da página, a pasta raiz ainda está apontando para
`apps/web` — volte à Parte 1 do roteiro do Claude.

Se o build falhar com `Environment variable not found: DATABASE_URL`, o banco
não foi conectado ao projeto (Parte 1).

## Depois de publicar

A primeira pessoa que criar conta vira **administradora** de uma família nova.
Para incluir o resto da casa: **Ajustes → Minha família → Gerar código de
convite**, e a pessoa usa esse código ao criar a conta dela.

O app também instala no celular e no computador: **Ajustes → Instalar o app**.
