/**
 * ¿Se muestra en la tienda?
 *
 * Las prendas y los combos de Crear (esPrendaBase / esComboCrear) son
 * productos de verdad -se compran, se validan y llegan al ERP como
 * cualquiera-, pero solo se venden personalizados. Salen en la tienda (y en
 * la página de su marca) solo si el admin prende "También en la tienda"
 * (enTienda), y entonces su botón lleva al estudio, nunca al carrito.
 *
 * `visible` no sirve de interruptor para ellos: en una prenda significa
 * "publicada en Crear" (false = borrador) y un combo de Crear lo guarda
 * siempre en false; el suyo es comboCrear.publicado.
 *
 * Una prenda con `seVendeTalCual` también se vende sin personalizar. Si
 * reemplaza a un producto de la tienda, ese lleva `reemplazadoPor` (el id
 * de la prenda): la web ya no lo muestra y su enlace lleva a la prenda, pero
 * sigue visible para la app de Android, que no muestra prendas de Crear, y
 * para los combos que lo usan.
 */
export const esProductoDeTienda = (p) => {
  if (!p || p.deleted === true) return false;
  if (p.reemplazadoPor) return false;
  if (p.esComboCrear === true) return p.enTienda === true && p.comboCrear?.publicado === true;
  if (p.esPrendaBase === true) return p.enTienda === true && p.visible !== false;
  return p.visible !== false;
};

/** Ruta del estudio de un producto de Crear (prenda o combo), o null. */
export const rutaDeCrear = (p) => {
  if (!p?.id) return null;
  if (p.esComboCrear === true) return `/combo/${p.id}`;
  if (p.esPrendaBase === true) return `/crear/${p.id}`;
  return null;
};
