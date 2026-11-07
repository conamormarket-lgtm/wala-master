/*
 * Modo juego: en el celular (hasta 768 px), los minijuegos van a pantalla
 * completa, sin la cabecera, el pie, la barra de abajo ni los flotantes (Kapi
 * y WhatsApp). La salida y las monedas van en la barra del juego (MarcoJuego).
 * En escritorio no cambia nada. App.jsx pone la clase .modo-juego y App.css
 * oculta el marco; la barra de abajo y los flotantes se apagan solos.
 */
export const RUTAS_DE_JUEGO = ['/palabra-del-dia', '/ruleta', '/ball-sort'];

export const esRutaDeJuego = (ruta = '') => {
  const limpia = ruta.length > 1 ? ruta.replace(/\/+$/, '') : ruta;
  return RUTAS_DE_JUEGO.includes(limpia);
};
