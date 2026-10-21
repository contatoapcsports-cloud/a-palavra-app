/* Service worker do Palavra Viva.
   - sem skipWaiting automático: a página pede com o botão "Atualizar";
   - cache antigo só é apagado na ativação do novo, e só chaves com prefixo pv4-;
   - sw.js e content-manifest.json sempre da rede (no-store); cache só como reserva offline;
   - __SHELL_HASH__ é trocado no deploy pelo hash dos arquivos do app: só muda quando o app muda. */
importScripts('src/core.js');
const VERSION = '__SHELL_HASH__';
const SHELL = 'pv4-shell-' + VERSION;
const CONTENT = 'pv4-content';
const MEDIA = 'pv4-media';
const SHELL_FILES = ['./', 'index.html', 'app.js', 'styles.css', 'src/core.js', 'src/books.js', 'manifest.json', 'reset.html', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png'];
/* opcionais: se faltarem no servidor, a instalação NÃO falha */
const OPTIONAL_FILES = ['config.json', 'assets/termos.html', 'assets/hero-bible.jpg', 'assets/hero-dawn.jpg', 'assets/hero-reading.jpg', 'assets/abencoe.jpg'];

async function precacheContent() {
  const r = await fetch('content-manifest.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('manifesto indisponível');
  const text = await r.text();
  const m = JSON.parse(text);
  const c = await caches.open(CONTENT);
  for (const e of m.packages.filter(function (p) { return p.precache; })) {
    if (await c.match(e.path)) continue; // já guardado e verificado
    const pr = await fetch(e.path, { cache: 'no-store' });
    if (!pr.ok) throw new Error('pacote indisponível: ' + e.path);
    const bytes = new Uint8Array(await pr.clone().arrayBuffer());
    const v = await PVCore.verifyPackage(bytes, e);
    if (!v.ok) throw new Error('hash não confere: ' + e.path); // falha fechada: instalação não conclui
    await c.put(e.path, pr);
  }
  await c.put('content-manifest.json', new Response(text, { headers: { 'content-type': 'application/json' } }));
}

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    const c = await caches.open(SHELL);
    await c.addAll(SHELL_FILES.map(function (u) { return new Request(u, { cache: 'reload' }); }));
    await Promise.all(OPTIONAL_FILES.map(async function (u) {
      try { const r = await fetch(new Request(u, { cache: 'reload' })); if (r.ok) await c.put(u, r); } catch (e) { /* opcional */ }
    }));
    await precacheContent();
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    const names = await caches.keys();
    await Promise.all(PVCore.cleanupPlan(names, [SHELL, CONTENT, MEDIA]).map(function (n) { return caches.delete(n); }));
    await self.clients.claim();
  })());
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(req, cacheName, key) {
  try {
    const r = await fetch(req, { cache: 'no-store' });
    if (r.ok) { const c = await caches.open(cacheName); await c.put(key, r.clone()); }
    return r;
  } catch (e) {
    const c = await caches.open(cacheName);
    const hit = await c.match(key);
    if (hit) return hit;
    throw e;
  }
}

async function staleWhileRevalidate(event, req, cacheName, key) {
  const c = await caches.open(cacheName);
  const hit = await c.match(key);
  const net = fetch(req, { cache: 'no-store' }).then(async function (r) { if (r.ok) await c.put(key, r.clone()); return r; });
  if (hit) { event.waitUntil(net.catch(function () { /* sem internet: fica o guardado */ })); return hit; }
  return net;
}

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const file = url.pathname.split('/').pop();
  if (file === 'sw.js') return; // sempre da rede, nunca interceptado
  if (file === 'content-manifest.json') { event.respondWith(networkFirst(req, CONTENT, 'content-manifest.json')); return; }
  if (file === 'config.json') { event.respondWith(staleWhileRevalidate(event, req, SHELL, 'config.json')); return; }
  event.respondWith((async function () {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r.ok && r.status === 200 && /\/assets\//.test(url.pathname) && !req.headers.has('range')) { const c = await caches.open(SHELL); await c.put(req, r.clone()); }
      return r;
    } catch (e) {
      if (req.mode === 'navigate') { const shell = await caches.open(SHELL); const idx = await shell.match('index.html'); if (idx) return idx; }
      throw e;
    }
  })());
});
