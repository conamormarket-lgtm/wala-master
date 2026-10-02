// Puente entre "el usuario tocó una notificación" y el router.
// NotificationsProvider vive FUERA del <Router> (no puede usar useNavigate), así
// que deja el link acá y <PushLinkHandler>, que sí está dentro, navega. Si el
// toque llega antes de que el router monte (app abierta desde la push), el link
// queda guardado y se consume al montar.
const EVENTO = 'wala:push-link';
let pendiente = null;

export const abrirLinkDePush = (link) => {
  if (!link || typeof link !== 'string') return;
  pendiente = link;
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: link }));
};

export const tomarLinkPendiente = () => {
  const l = pendiente;
  pendiente = null;
  return l;
};

export const escucharLinksDePush = (fn) => {
  const handler = (e) => { pendiente = null; fn(e.detail); };
  window.addEventListener(EVENTO, handler);
  return () => window.removeEventListener(EVENTO, handler);
};

// Links internos ("/producto/abc") por el router; externos (https) en otra pestaña.
export const irALink = (navigate, link) => {
  if (!link) return;
  if (link.startsWith('/')) navigate(link);
  else if (/^https:\/\//.test(link)) window.open(link, '_blank', 'noopener');
};
