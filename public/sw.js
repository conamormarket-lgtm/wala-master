/* eslint-disable no-restricted-globals */
/**
 * Service worker de Walá — caché del "shell" de la app.
 *
 * Qué problema resuelve: hoy cada arranque en frío vuelve a pedir por red los
 * ~430 KB de JavaScript y CSS, aunque sean byte por byte los mismos de la
 * visita anterior. En la app de Android eso pasa cada vez que se abre.
 *
 * Lo que SÍ toca, y por qué cada estrategia:
 *
 *   /assets/*  → CACHÉ PRIMERO. Vite firma estos archivos con un hash del
 *                contenido: si el contenido cambia, cambia el nombre. Entonces
 *                una respuesta cacheada nunca puede estar obsoleta, y se sirve
 *                sin tocar la red.
 *
 *   navegación → RED PRIMERO, con la caché como red de seguridad. index.html es
 *                quien apunta a los chunks con hash: si se sirviera de caché,
 *                un deploy nuevo no llegaría hasta que caducase, y peor, podría
 *                pedir chunks que ya no existen. Yendo primero a la red, un
 *                deploy se nota al instante; sin conexión, se sirve la última
 *                copia buena y la app arranca igual.
 *
 *   imágenes y fuentes de public/ → CACHÉ MIENTRAS REVALIDA. El nombre no lleva
 *                hash, así que no se puede confiar en la caché para siempre: se
 *                sirve lo cacheado (rápido) y se refresca por detrás para la
 *                próxima vez.
 *
 * Lo que NO toca, a propósito: todo lo demás. Firestore, Auth, Storage,
 * Cloud Functions, Cloudinary, analítica. Son datos vivos o peticiones con
 * credenciales; cachearlas daría respuestas viejas o, peor, la respuesta de
 * otra persona. Si la petición no encaja en uno de los tres casos de arriba,
 * este worker no se mete y el navegador hace lo de siempre.
 */

const VERSION = 'v1';
const CACHE_ESTATICOS = `wala-estaticos-${VERSION}`;
const CACHE_PAGINAS = `wala-paginas-${VERSION}`;
const CACHE_MEDIA = `wala-media-${VERSION}`;

// Tope de entradas del caché de /assets. Cada deploy cambia los nombres, así
// que sin poda los builds viejos se acumularían para siempre en el disco de la
// persona. Se recortan las más antiguas (cache.keys() conserva el orden de
// inserción), no las menos usadas: es una aproximación, pero no requiere
// llevar metadatos de acceso y basta para lo que hay que evitar.
const MAX_ESTATICOS = 160;

const MEDIA = /\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$/i;

self.addEventListener('install', (event) => {
  // Entra en servicio en cuanto esté listo, sin esperar a que se cierren las
  // pestañas viejas. Es seguro porque no hay estado compartido entre versiones:
  // los estáticos van por hash y las páginas se piden a la red primero.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(
      nombres
        .filter((n) => n.startsWith('wala-') && !n.endsWith(`-${VERSION}`))
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

const podar = async (cache, maximo) => {
  const claves = await cache.keys();
  if (claves.length <= maximo) return;
  await Promise.all(claves.slice(0, claves.length - maximo).map((k) => cache.delete(k)));
};

/** Caché primero: si está guardado se sirve tal cual y no se toca la red. */
const cachePrimero = async (request, nombreCache, maximo) => {
  const cache = await caches.open(nombreCache);
  const guardado = await cache.match(request);
  if (guardado) return guardado;

  const respuesta = await fetch(request);
  // Solo se guardan respuestas completas y correctas. Un 206 o un error no
  // sirven de nada cacheados, y un 404 cacheado sería un bug permanente.
  if (respuesta && respuesta.status === 200) {
    await cache.put(request, respuesta.clone());
    if (maximo) await podar(cache, maximo);
  }
  return respuesta;
};

/** Red primero, y si no hay red, lo último que se guardó. */
const redPrimero = async (request, nombreCache) => {
  const cache = await caches.open(nombreCache);
  try {
    const respuesta = await fetch(request);
    if (respuesta && respuesta.status === 200) await cache.put(request, respuesta.clone());
    return respuesta;
  } catch (e) {
    const guardado = await cache.match(request);
    if (guardado) return guardado;
    throw e;
  }
};

/** Se sirve lo guardado y se refresca por detrás para la próxima. */
const revalidando = async (request, nombreCache) => {
  const cache = await caches.open(nombreCache);
  const guardado = await cache.match(request);

  const refresco = fetch(request)
    .then((respuesta) => {
      if (respuesta && respuesta.status === 200) cache.put(request, respuesta.clone());
      return respuesta;
    })
    .catch(() => null);

  return guardado || (await refresco) || fetch(request);
};

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo GET: un POST/PUT cacheado sería repetir una escritura.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Nada de otros dominios: Firestore, Storage, Cloudinary, fuentes de Google,
  // analítica. Son datos vivos o llevan credenciales.
  if (url.origin !== self.location.origin) return;

  // El worker de notificaciones tiene su propia vida; no lo tocamos.
  if (url.pathname === '/firebase-messaging-sw.js') return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cachePrimero(request, CACHE_ESTATICOS, MAX_ESTATICOS));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(redPrimero(request, CACHE_PAGINAS));
    return;
  }

  if (MEDIA.test(url.pathname)) {
    event.respondWith(revalidando(request, CACHE_MEDIA));
  }
});
