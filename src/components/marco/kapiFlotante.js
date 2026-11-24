/*
 * Dónde NO flota Walito (el botón de la esquina, components/marco/Walito.jsx).
 * Lo comparten Walito y el pie (PieDeTienda): un solo Walito a la vista, así que
 * el pie lo asoma solo cuando el de la esquina no está.
 */
export const sinKapiFlotante = (pathname) =>
  // El estudio es una herramienta: sin flotantes.
  pathname.startsWith('/crear/')
  // Al abrir un regalo, el Walito del sobre es el único a la vista.
  || pathname.startsWith('/regalo/')
  // En el acceso, el Walito del panel de la marca es el único (la cuenta recién
  // creada ya tiene perfil y el flotante salía al lado).
  || ['/login', '/registro', '/completar-perfil', '/recuperar-contrasena'].some((r) => pathname.startsWith(r))
  // En la encuesta, el Walito de la portada (y del final) es el único.
  || pathname.startsWith('/encuesta-suscripcion')
  // Crear ya tiene a Walito diseñando en el arte de la portada (CREAR.md).
  || pathname === '/personalizar';

/*
 * Dónde el pie no asoma a Walito aunque no flote el de la esquina: las páginas
 * que ya tienen el suyo o son una herramienta (como en el kit, kapiEnPie de
 * cada página en la Tienda de prueba). Las que lo muestran según su estado
 * (un estado vacío) no se ven desde aquí.
 */
const SIN_KAPI_EN_PIE = [
  // Los juegos: Walito sale en el resultado.
  '/ruleta', '/palabra-del-dia', '/ball-sort',
  // Regalar: la lista pública, regalar para una fecha y abrir el regalo.
  '/wishlist/', '/regalar/',
  // Privacidad y términos terminan con la tarjeta de ayuda (Walito asomado).
  '/politicas-privacidad', '/terminos-y-condiciones', '/terminos-condiciones', '/eliminar-cuenta',
  // Pagar: solo pagar.
  '/checkout', '/pago-rapido/',
];

export const sinKapiEnPie = (pathname, { sesion = false } = {}) =>
  sinKapiFlotante(pathname)
  || SIN_KAPI_EN_PIE.some((r) => pathname.startsWith(r))
  // Mi cuenta sin sesión: la invitación a entrar ya trae a Walito.
  || (!sesion && pathname.startsWith('/cuenta'));
