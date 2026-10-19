import { moduloDeRuta } from '../cuenta/moduloDeRuta';

/*
 * Qué forma tiene la página que está llegando (EsqueletoPagina del kit), según
 * su ruta. Para cambiar de página siempre el esqueleto (ya se sabe la forma
 * de lo que viene): ver componentes/kit/guia/CARGA.md.
 *
 * Devuelve { forma, modulo? } o null para lo que no es del kit (el admin):
 * ahí se queda el esqueleto de antes.
 */

// Rutas de una sola parte (o de prefijo fijo) → forma.
const EXACTAS = {
  '': 'inicio',
  tienda: 'tienda',
  buscar: 'busqueda',
  carrito: 'carrito',
  checkout: 'checkout',
  personalizar: 'crear',
  comunidad: 'comunidad',
  'encuesta-suscripcion': 'encuesta',
  suscripciones: 'landing',
  login: 'acceso',
  registro: 'acceso',
  'recuperar-contrasena': 'acceso',
  'completar-perfil': 'formulario',
  minijuegos: 'minijuegos',
  'palabra-del-dia': 'palabra',
  ruleta: 'ruleta',
  'ball-sort': 'bolitas',
  'politicas-privacidad': 'legal',
  'terminos-y-condiciones': 'legal',
  'terminos-condiciones': 'legal',
  'libro-de-reclamaciones': 'reclamaciones',
  app: 'aviso',
  descargar: 'aviso',
  // Listas de productos de la tienda.
  ofertas: 'productos',
  nichos: 'productos',
  vendedor: 'productos',
  'regalos-con-amor': 'productos',
  'nuevos-usuarios': 'productos',
  sorteos: 'sorteo',
};

// Rutas con un parámetro (/producto/:id…) → forma, por su primera parte.
const CON_PARAMETRO = {
  producto: 'producto',
  creacion: 'producto',
  crear: 'estudio',
  combo: 'estudio',
  editor: 'estudio',
  ver: 'verDiseno',
  wishlist: 'productos',
  regalar: 'productos',
  'pago-rapido': 'formulario',
  regalo: 'formulario',
  invitar: 'invitacion',
  nicho: 'productos',
  'tienda-vendedor': 'productos',
  sorteos: 'sorteo',
  'suscrito-sorteo': 'suscripcionSorteo',
  l: 'enlaces',
};

/** La forma del esqueleto para una ruta ('/cuenta/pedidos' → { forma: 'cuenta', modulo: 'pedidos' }). */
export function formaDeRuta(ruta = '/') {
  const partes = String(ruta || '/').split('?')[0].split('#')[0].replace(/\/+$/, '').split('/').filter(Boolean);
  const [primera = '', segunda] = partes;
  if (primera === 'admin') return null;
  if (primera === 'cuenta' || primera === 'pedidos') return { forma: 'cuenta', modulo: moduloDeRuta(primera === 'cuenta' ? `/${partes.join('/')}` : '/cuenta/pedidos') };
  if (primera === 'suscrito-sorteo') return { forma: 'suscripcionSorteo' };
  if (segunda && CON_PARAMETRO[primera]) return { forma: CON_PARAMETRO[primera] };
  if (!segunda && EXACTAS[primera]) return { forma: EXACTAS[primera] };
  // Una sola parte que no es de la tienda: una landing del builder (/:slug).
  if (partes.length === 1) return { forma: 'landing' };
  return { forma: 'aviso' };
}
