/*
 * El módulo de la cuenta de una ruta (/cuenta/wishlist → 'deseos'): la forma
 * del esqueleto de esa sección (MODULOS_ESQUELETO_CUENTA del kit). Aparte de
 * gruposDeCuenta.js para que el esqueleto de carga (components/carga) no
 * arrastre el menú de la cuenta a la primera descarga.
 */
const MODULOS = {
  perfil: 'perfil',
  pedidos: 'pedidos',
  direcciones: 'direcciones',
  ajustes: 'ajustes',
  catalogo: 'catalogo',
  cupones: 'cupones',
  misiones: 'misiones',
  referidos: 'referidos',
  creaciones: 'creaciones',
  wishlist: 'deseos',
  'fechas-importantes': 'fechas',
};

export const moduloDeRuta = (ruta) => MODULOS[String(ruta || '').split('/')[2]] || 'resumen';
