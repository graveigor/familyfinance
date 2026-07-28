/**
 * Service worker escrito à mão — sem Workbox, para o comportamento ficar
 * explícito e auditável.
 *
 * Duas regras apenas:
 *  1. Navegação (abrir o app): rede primeiro; sem internet, devolve o
 *     index.html guardado, para o app abrir mesmo offline.
 *  2. Arquivos do próprio app (JS, CSS, ícones): cache primeiro e atualiza em
 *     segundo plano.
 *
 * O que a API responde NÃO é guardado: dinheiro exige dado fresco, e mostrar
 * total desatualizado é pior do que avisar que está sem internet.
 */

const VERSAO = 'gastos-v1';
const ESSENCIAIS = ['/', '/manifest.webmanifest', '/icone-192.png', '/icone-512.png'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(VERSAO)
      .then((cache) => cache.addAll(ESSENCIAIS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((chave) => chave !== VERSAO).map((chave) => caches.delete(chave))),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Na primeira visita o JS e o CSS já foram baixados antes deste worker existir,
 * então não passariam pelo `fetch` daqui e o app abriria em branco se a pessoa
 * ficasse sem internet logo depois de instalar. A página manda a lista do que
 * carregou e guardamos tudo de uma vez.
 */
self.addEventListener('message', (evento) => {
  if (evento.data?.tipo !== 'aquecer' || !Array.isArray(evento.data.urls)) return;
  evento.waitUntil(
    caches.open(VERSAO).then((cache) =>
      // `addAll` falha inteiro se um item falhar; guardamos um a um.
      Promise.all(evento.data.urls.map((url) => cache.add(url).catch(() => undefined))),
    ),
  );
});

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== 'GET') return;

  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (requisicao.mode === 'navigate') {
    evento.respondWith(
      fetch(requisicao)
        .then((resposta) => {
          const copia = resposta.clone();
          void caches.open(VERSAO).then((cache) => cache.put('/', copia));
          return resposta;
        })
        .catch(() => caches.match('/').then((guardada) => guardada ?? Response.error())),
    );
    return;
  }

  evento.respondWith(
    caches.match(requisicao).then((guardada) => {
      const daRede = fetch(requisicao)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            void caches.open(VERSAO).then((cache) => cache.put(requisicao, copia));
          }
          return resposta;
        })
        .catch(() => guardada ?? Response.error());

      return guardada ?? daRede;
    }),
  );
});
