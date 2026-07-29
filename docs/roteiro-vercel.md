# Colocar o Family Finance no ar

O código está pronto e enviado. **Só falta um passo: conectar o banco que você
já tem.** Não é preciso criar chave, colar segredo nem configurar variável —
o servidor gera e guarda o que precisa sozinho na primeira vez que sobe.

Cole o bloco abaixo na conversa com o Claude no Chrome, com o painel do Vercel
aberto.

---

## Cole isto no Claude do Chrome

> Você está no painel do Vercel. Preciso que você conclua a publicação do meu
> projeto `app-controlegastos` (repositório `graveigor/app-controlegastos`).
> O código já está corrigido; falta configurar o painel.
>
> Faça na ordem e me mostre cada tela antes de salvar.
>
> **1. Corrigir a pasta raiz**
> - Abra **Settings → Build and Deployment**.
> - O campo **Root Directory** precisa estar **vazio** (a raiz do repositório).
>   Se estiver `apps/web`, limpe e salve. É um monorepo: o site depende de
>   pastas que ficam fora de `apps/web`.
> - Em **Build Command**, **Output Directory** e **Install Command**: se o botão
>   **Override** estiver ligado em algum, **desligue**. Os comandos certos vêm
>   do arquivo `vercel.json` do repositório. Não digite comando nenhum à mão.
> - Salve e me diga como os campos ficaram.
>
> **2. Conectar o banco de dados**
> - Vá na aba **Storage**.
> - Deve aparecer um banco chamado **neon-teal-feather** com um botão
>   **Connect** ao lado. Clique em **Connect** e confirme, escolhendo este
>   projeto (`app-controlegastos-web`).
> - Se ele pedir para escolher os ambientes, marque **todos**
>   (Production, Preview e Development).
> - Isso cria a variável `DATABASE_URL` sozinho. Me confirme quando terminar.
> - Se **não** existir nenhum banco na lista, pare e me avise — eu crio.
>
> **3. Conferir as variáveis**
> - Vá em **Settings → Environment Variables** e me diga **só os nomes** das
>   variáveis que existem (não me mande os valores).
> - Precisa existir `DATABASE_URL`. Se o Neon tiver criado também
>   `DATABASE_URL_UNPOOLED`, ótimo, o projeto usa.
> - **Não crie nenhuma outra variável** e **não digite valor nenhum**. As
>   chaves de segurança do app são geradas pelo próprio servidor.
>
> **4. Publicar**
> - Vá em **Deployments**, abra o mais recente e clique em **Redeploy**.
> - **Desmarque** a opção de usar o cache do build anterior.
> - Acompanhe o log. Deve aparecer `prisma migrate deploy` aplicando as
>   migrações e terminar com `built in ...`.
> - Me diga se concluiu ou qual erro apareceu.
>
> **5. Testar de verdade**
> - Abra `https://app-controlegastos-web-eta.vercel.app/saude`. Deve responder
>   `{"ok":true,"versao":"0.1.0"}`.
> - Abra o site, clique em **Ainda não tenho conta** e crie uma conta de teste
>   com um e-mail qualquer e uma senha de 8+ caracteres. **Use uma senha
>   descartável, não uma senha sua de verdade.**
> - Me diga se a conta foi criada e se a tela inicial apareceu.
>
> Regras: não mexa em plano, cobrança, domínio nem integrações; não apague
> deploys; não digite nenhuma senha ou chave minha. Se algo estiver diferente
> do que descrevi, **pare e me pergunte** em vez de adivinhar.

---

## Por que não há segredo para configurar

O login é assinado por uma chave secreta. Antes era preciso criar essa chave e
colá-la no painel — o passo que mais dá errado numa publicação, e o que mais
leva gente a repetir a mesma senha em vários lugares.

Agora, quando a chave não vem do ambiente, o servidor gera uma aleatória na
primeira vez e guarda no banco, junto com os dados que ela protege. Ela
continua a mesma entre publicações, então ninguém é desconectado a cada deploy.

Quem quiser controlar isso manualmente ainda pode: basta definir `JWT_SEGREDO`
e `JWT_SEGREDO_REFRESH` nas variáveis de ambiente, que elas têm prioridade.

## Se algo falhar

| O que aparece | O que é |
|---|---|
| `405` ou o HTML da página em `/saude` | A pasta raiz ainda está em `apps/web` (passo 1) |
| `Environment variable not found: DATABASE_URL` | O banco não foi conectado ao projeto (passo 2) |
| `prepared statement ... already exists` na migração | O Neon não expôs o endereço direto. Me avise: o projeto já tenta usar `DATABASE_URL_UNPOOLED`, mas posso ajustar |
| A conta é criada mas some ao recarregar | Provavelmente o banco não persistiu. Me mande o log do deploy |

## Depois que estiver no ar

- A primeira pessoa que criar conta vira administradora de um grupo novo.
- Para incluir alguém: aba **Família → Gerar código do grupo**. Sai um código
  como `FF-9A3K2` para mandar no WhatsApp.
- **Os gastos de cada pessoa são privados por padrão.** Quem quiser que o grupo
  acompanhe os seus toca em **Compartilhar meus gastos**, na mesma aba — e pode
  desligar quando quiser.
- O app instala no celular e no computador em **Ajustes → Instalar o app**.
- Na primeira vez que abre cada tela aparece um tutorial. O botão **(?)** no
  canto superior direito traz de volta a qualquer momento.
