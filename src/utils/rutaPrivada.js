// Páginas que piden cuenta: una sola regla para toda la tienda.
// Sin sesión se va al login con ?redirect=<la página>, y al entrar se vuelve
// ahí. El destino viaja en la URL (no solo en el state del router) para que
// sobreviva a recargar el login y a la vuelta del login con Google.

// La sesión anónima (la que abren algunas landings para pagar) no es una cuenta.
export const tieneCuenta = (user) => Boolean(user && !user.isAnonymous);

// Solo rutas de esta misma tienda: nunca una URL externa ("//otro.com",
// "https://…"), ni el propio login o registro (darían una vuelta sin fin).
export const destinoInterno = (ruta) => {
  if (typeof ruta !== 'string' || !ruta.startsWith('/') || ruta.startsWith('//') || ruta.includes('\\')) return null;
  const camino = ruta.split(/[?#]/)[0];
  if (camino === '/login' || camino === '/registro') return null;
  return ruta;
};

// A dónde volver tras entrar: el state.from de siempre o el ?redirect= de la URL.
export const leerDestino = (location) =>
  destinoInterno(location?.state?.from) ||
  destinoInterno(new URLSearchParams(location?.search || '').get('redirect'));

export const urlLogin = (destino) => {
  const seguro = destinoInterno(destino);
  return seguro ? `/login?redirect=${encodeURIComponent(seguro)}` : '/login';
};

// Lo que dice el login cuando llegas desde una página que pide cuenta.
const MOTIVOS = [
  ['/cuenta/pedidos', 'Inicia sesión para ver tus pedidos y su avance.'],
  ['/cuenta/creaciones', 'Inicia sesión para ver tus creaciones.'],
  ['/cuenta/cupones', 'Inicia sesión para ver tus cupones.'],
  ['/cuenta/wishlist', 'Inicia sesión para ver tu lista de deseos.'],
  ['/cuenta/referidos', 'Inicia sesión para ver a tus invitados y tus monedas.'],
  ['/cuenta', 'Inicia sesión para entrar a tu cuenta.'],
  ['/creacion', 'Inicia sesión para ver tu creación.'],
  ['/vendedor', 'Inicia sesión para entrar a tu panel de vendedor.'],
  ['/admin', 'Inicia sesión con tu cuenta de administrador.'],
  ['/ruleta', 'Inicia sesión para girar la ruleta.'],
  ['/ball-sort', 'Inicia sesión para jugar y ganar monedas.'],
  ['/encuesta-suscripcion', 'Inicia sesión para responder la encuesta y ganar tus monedas.'],
  ['/checkout', 'Inicia sesión para terminar tu compra.'],
  ['/pago-rapido', 'Inicia sesión para pagar tu pedido.'],
  ['/sorteos', 'Inicia sesión para participar en el sorteo.'],
];

export const motivoDeRuta = (destino) => {
  const camino = String(destino || '').split(/[?#]/)[0];
  const hallado = MOTIVOS.find(([base]) => camino === base || camino.startsWith(`${base}/`));
  return hallado ? hallado[1] : null;
};
