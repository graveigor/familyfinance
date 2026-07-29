# Roteiro para o Claude do Chrome — ajustar o projeto no Vercel

Cole o texto do bloco abaixo na conversa com o Claude no Chrome, com o painel do
Vercel aberto.

O código já foi corrigido e enviado para o GitHub (commit `5ee3b19`). O que falta
é só ajustar a configuração no painel, porque o projeto foi importado apontando
para a pasta errada.

---

## Cole isto no Claude do Chrome

> Você está no painel do Vercel, no projeto do meu app de controle de gastos
> (repositório `graveigor/app-controlegastos`). O build está falhando com dezenas
> de erros de TypeScript do tipo `Cannot find module '@gastos/core'`.
>
> A causa é que o projeto foi importado apontando para a subpasta `apps/web`,
> mas é um monorepo: o app web depende do pacote `@gastos/core`, que fica em
> `packages/core`, fora dessa pasta. Já corrigi o código e existe um
> `vercel.json` na raiz do repositório com os comandos certos — ele só não é
> lido enquanto a pasta raiz estiver apontada para `apps/web`.
>
> Faça o seguinte, **me mostrando cada tela antes de salvar**:
>
> **1. Corrigir a pasta raiz**
> - Abra **Settings → Build and Deployment** (em alguns painéis fica em
>   Settings → General).
> - Encontre o campo **Root Directory**. Ele provavelmente está com `apps/web`.
> - **Deixe esse campo vazio** (a raiz do repositório). Se o painel não aceitar
>   vazio, use `.`.
> - Confirme que **Framework Preset** está como **Vite**.
> - Em **Build Command**, **Output Directory** e **Install Command**: se
>   estiverem sobrescritos (com o botão "Override" ligado), **desligue os três**
>   para o `vercel.json` do repositório valer. Não digite comandos na mão.
> - Salve.
>
> **2. Conferir se ficou certo**
> - Depois de salvar, me diga o que aparece em Root Directory, Framework,
>   Build Command, Output Directory e Install Command.
> - O esperado é: Root Directory vazio, Framework = Vite, e os três comandos
>   sem override (mostrando o padrão ou o valor vindo do `vercel.json`).
>
> **3. Publicar de novo**
> - Vá em **Deployments**, abra o deploy mais recente e use **Redeploy**.
> - **Desmarque** a opção de usar o cache do build anterior, se ela aparecer.
> - Acompanhe o log. Me avise quando terminar e me diga se deu certo ou qual
>   erro apareceu.
>
> **4. Se o build passar, ainda falta uma coisa**
> - O site vai abrir, mas nenhuma tela vai carregar dado, porque o backend
>   (Fastify + PostgreSQL) **não roda no Vercel** — ele precisa estar hospedado
>   em outro serviço.
> - Vá em **Settings → Environment Variables** e me diga se já existe uma
>   variável chamada `VITE_API_URL`.
> - Se não existir, **não invente um valor**: apenas me avise, que eu te passo o
>   endereço depois de publicar a API.
>
> Regras: não altere plano, domínio, integrações nem nada de cobrança. Não
> apague deploys. Se algo estiver diferente do que descrevi, **pare e me
> pergunte** em vez de adivinhar.

---

## O que esperar

Depois do passo 3 o build deve terminar com algo assim no log:

```
> @gastos/core@0.1.0 build
> tsc -p tsconfig.json
> @gastos/web@0.1.0 build
> tsc -b && vite build
✓ built in ~1s
```

## Depois: fazer o app realmente funcionar

O Vercel publica **só o site**. O backend precisa de um serviço que rode Node e
PostgreSQL — Railway, Render e Fly.io servem, e todos têm plano gratuito para
começar.

Com a API no ar, faltam duas variáveis:

| Onde | Variável | Valor |
|---|---|---|
| Vercel | `VITE_API_URL` | `https://endereco-da-sua-api.com` |
| Backend | `CORS_ORIGENS` | `https://seu-app.vercel.app` |

A `VITE_API_URL` é lida **na hora do build**: depois de defini-la é preciso
publicar de novo, senão o site continua com o valor antigo.
