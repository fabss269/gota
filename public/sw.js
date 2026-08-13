// Service Worker mínimo — Fase 1 PWA. Chrome/Edge exigen que exista un SW
// registrado CON un handler de `fetch` para ofrecer instalar la app (aunque
// el handler no cachee nada); si el handler no existe, el prompt de
// instalación jamás aparece. Este SW hace justo eso: se registra, y en
// `fetch` deja pasar la request tal cual (network-only). No cachea nada
// todavía — la estrategia de caché offline es la Fase 2.
//
// Cuando aterricemos Fase 2 vamos a reemplazar este archivo por una versión
// Workbox con precache del shell y runtime caching por ruta; hasta
// entonces, cualquier `install`/`activate` extra sobra.

self.addEventListener('install', () => {
  // skipWaiting para que el SW nuevo se active de inmediato en el próximo
  // deploy — no queremos que el usuario tenga que cerrar todas las
  // pestañas para que un fix de Fase 2 tome efecto.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Passthrough deliberado — el requisito de Chrome para "installable" se
  // cumple con solo tener un fetch listener, no con qué hace.
  event.respondWith(fetch(event.request));
});
