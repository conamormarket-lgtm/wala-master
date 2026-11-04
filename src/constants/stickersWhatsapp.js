/**
 * Packs de stickers de WhatsApp que trae la app de Android.
 *
 * Los archivos viven en public/stickers/<id>/ y la ficha completa (emojis,
 * textos, ícono) en public/stickers/packs.json: la app los lleva dentro (su
 * carpeta public) y el proveedor nativo se los da a WhatsApp desde ahí
 * (android/app/src/main/java/com/wala/tienda/stickers). Aquí solo lo que
 * necesita la web: el nombre y unas muestras. El servidor tiene la misma
 * lista en PACKS_STICKERS_WHATSAPP (functions/index.js); si se agrega un pack,
 * van los tres y una versión nueva de la app.
 */
export const PACKS_STICKERS = [
  {
    id: 'kapi',
    nombre: 'Kapi de Walá',
    cantidad: 13,
    muestras: ['kapi_02.webp', 'kapi_03.webp', 'kapi_04.webp', 'kapi_12.webp'],
  },
  {
    id: 'adicto',
    nombre: 'Adicto, el gatito de Kapi',
    cantidad: 13,
    muestras: ['adicto_02.webp', 'adicto_05.webp', 'adicto_10.webp', 'adicto_12.webp'],
  },
];

export const packStickers = (id) => PACKS_STICKERS.find((p) => p.id === id) || null;

/** Dirección pública de un archivo del pack. */
export const archivoSticker = (packId, archivo) => `/stickers/${packId}/${archivo}`;

export const PLAY_STORE_WALA = 'https://play.google.com/store/apps/details?id=com.wala.tienda';
