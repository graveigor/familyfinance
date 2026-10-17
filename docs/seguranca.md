# Cabeçalhos de segurança

Ficam em `vercel.json`, no bloco `headers`. O `vercel.json` é validado contra um
schema que recusa propriedade desconhecida, então **não dá para comentar nada
dentro dele** — o porquê mora aqui. (O truque `_comentario_*` que o
`package.json` usa funciona lá porque o npm não valida nome de script; aqui
aborta o deploy antes de buildar.)

## A CSP

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self'; connect-src 'self';
manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self';
form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

Ela é fechada porque este app **não carrega nada de fora**: o Vite não deixa
script embutido no `index.html` gerado (conferido no `dist/`), e o Analytics da
Vercel é servido pela própria origem (`/_vercel/insights/*`).

Duas frouxidões, as duas deliberadas:

- **`'unsafe-inline'` em `style`**: o React escreve posição e cor em *atributo*
  `style` — o furo do tutorial, as barras do orçamento. Atributo de estilo exige
  `'unsafe-inline'`, e, ao contrário de script, estilo injetado não executa
  código.
- **`camera=(self)` no `Permissions-Policy`**: a foto do comprovante usa
  `<input type="file" capture="environment">`. Microfone, localização, pagamento
  e USB ficam negados.

## Por que ela estreia em `report-only`

O cabeçalho publicado hoje é `content-security-policy-report-only`. Violação de
CSP não aparece no build — aparece na tela de quem está usando, e costuma ser
tela branca, não aviso amarelo. Em modo relatório, a violação sai no console e
nada quebra.

**Para ligar de verdade**, depois de conferir, troque a chave para
`content-security-policy` em `vercel.json`. Antes de trocar, percorra no site
publicado, com o console aberto, procurando `Content Security Policy`:

1. entrar na conta;
2. lançar um gasto;
3. anexar foto no comprovante **e um PDF**, e abrir os dois (o PDF no Safari do
   iPhone também — é o caso mais frágil, por causa do `object-src 'none'`);
4. exportar os dados em Excel;
5. instalar o app (PWA) e abrir offline.

É o mesmo raciocínio do `_comentario_build:vercel`: o passo sem volta vai por
último.

## O que NÃO está aqui

- A CSP não cai nas respostas de `/api/*` (o `source` é `/((?!api/).*)`).
  Cabeçalho de documento não tem função em resposta binária ou JSON, e a de
  comprovante é `application/pdf`.
- `Strict-Transport-Security` não está no arquivo porque a Vercel já manda
  sozinha. Se um dia o site sair de lá, ele precisa vir junto.
- `script-src 'self'` bloqueia a barra de comentários da Vercel nos deploys de
  *preview* (ela vem de `vercel.live`). Em produção não existe.
