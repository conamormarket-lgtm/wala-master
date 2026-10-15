/*
 * Un traductor DE PRUEBA para la Tienda de prueba: cambia palabras de un
 * diccionario chico al inglés. Solo sirve para ver qué textos del kit pasan
 * por la traducción. En la tienda va el de verdad (src/i18n/useTranslatedText:
 * services/translate, con caché, sin red en español).
 */

const FRASES = [
  ['Conjunto Pareja', 'Couple set'], ['Lista de deseos', 'Wishlist'], ['También te puede gustar', 'You may also like'],
  ['Más vendidos', 'Best sellers'], ['Lo más nuevo', 'New arrivals'], ['Ofertas', 'Deals'],
];

const PALABRAS = {
  casaca: 'jacket', casacas: 'jackets', polo: 't-shirt', polos: 't-shirts', polera: 'hoodie', poleras: 'hoodies',
  jogger: 'joggers', taza: 'mug', tazas: 'mugs', reloj: 'watch', collar: 'necklace', collares: 'necklaces',
  niños: 'kids', niñas: 'girls', pareja: 'couple', parejas: 'couples', para: 'for', con: 'with', de: 'of', y: 'and',
  años: 'years', clásico: 'classic', clásica: 'classic', unisex: 'unisex', algodón: 'cotton', cierre: 'zipper',
  personalizados: 'custom', personalizadas: 'custom', favoritos: 'favorite', diseños: 'designs', colores: 'colors',
  tallas: 'sizes', disponibles: 'available', varios: 'several', son: 'are', tus: 'your', luce: 'show off',
  a: 'to', en: 'in', el: 'the', la: 'the', los: 'the', las: 'the', un: 'a', una: 'a', crema: 'cream', mascarilla: 'mask',
  calmante: 'soothing', ligera: 'light', piel: 'skin', rostro: 'face',
};

const conMayuscula = (orig, t) => (orig[0] === orig[0].toUpperCase() ? t[0].toUpperCase() + t.slice(1) : t);

/** Un texto "traducido" con el diccionario de prueba. */
export function traducirDemo(texto) {
  if (typeof texto !== 'string' || !texto) return texto;
  let t = texto;
  FRASES.forEach(([es, en]) => { t = t.split(es).join(en); });
  return t.replace(/[A-Za-zÁÉÍÓÚÑáéíóúñü]+/g, (p) => {
    const en = PALABRAS[p.toLowerCase()];
    return en ? conMayuscula(p, en) : p;
  });
}

/** HTML "traducido": solo los textos entre etiquetas (como useTranslatedHtml). */
export function traducirHtmlDemo(html) {
  if (typeof html !== 'string' || !html) return html;
  return html.replace(/>([^<]+)</g, (_, txt) => `>${traducirDemo(txt)}<`);
}
