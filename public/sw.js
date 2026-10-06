// Service worker mínimo: só mostra uma tela "sem conexão" quando a rede falha ao abrir uma página.
// Não guarda páginas nem dados em cache (nada de informação desatualizada ou de outra conta).
const CACHE = 'residencia-os-offline-v2' // v2: página offline com o logo novo
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.add('/offline.html'))); self.skipWaiting() })
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') e.respondWith(fetch(e.request).catch(() => caches.match('/offline.html')))
})
