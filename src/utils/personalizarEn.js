/**
 * Producto de la tienda que se personaliza en Crear: `personalizarEn` es la
 * ruta de la prenda (/crear/:id) o del combo (/combo/:id) de Crear con la que
 * se diseña. Se elige en el admin del producto; vacío = no se personaliza.
 */
const RUTA = /^\/(crear|combo)\/[A-Za-z0-9_-]{1,64}$/;

export const leerPersonalizarEn = (valor) => (typeof valor === 'string' && RUTA.test(valor) ? valor : '');
