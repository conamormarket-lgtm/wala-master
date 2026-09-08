// ──────────────────────────────────────────────────────────────────────────────
// MODO DISEÑO — ver cualquier estado de la Zona Arcade sin esperar a mañana
//
// Los minijuegos están cerrados por día o por semana, así que retocar el diseño
// de "Kapi triste" o de "ruleta con giro pendiente" obligaba a esperar días o a
// tocar la base de datos. Esto fuerza lo que se PINTA mediante parámetros en la
// URL.
//
// Lo que NO hace, y es la razón de que sea seguro: no concede nada. Las monedas,
// los giros y los premios los sigue decidiendo el servidor (H-06), que ignora por
// completo estos parámetros. Si fuerzas "ruleta desbloqueada" verás el botón,
// pero al pulsarlo el servidor te dirá que no. Es un espejo, no una llave.
//
// Solo funciona fuera de producción (`npm run dev` y `npm run preview`). En el
// build que sube a Vercel, DISENO_ACTIVO es false y todo esto queda inerte.
//
// Uso — se añaden a la URL:
//
//   /minijuegos?kapi=triste&felicidad=25
//   /minijuegos?ruleta=pendiente
//   /minijuegos?bolitas=completado
//   /ruleta?ruleta=girada
//
//   kapi      = feliz | hambriento | triste
//   felicidad = 0..100
//   ruleta    = bloqueada | desbloqueada | girada | pendiente | perdida
//   dias      = 0..7   (días reclamados que muestra la barra de progreso)
//   bolitas   = disponible | completado
//   moneda    = disponible | reclamada   (la moneda diaria de Kapi en el hub)
//   sesion    = invitado | activa        (pinta la pantalla como si hubiera sesion)
//   premios   = demo                     (rueda de muestra, para repasar colores)
//   resultado = premio | cupon | nada    (abre el modal del premio sin girar)
//   palabra   = jugada | disponible      (estado de La Palabra del Dia en el hub)
// ──────────────────────────────────────────────────────────────────────────────

export const DISENO_ACTIVO = process.env.NODE_ENV !== 'production';

const parametros = () => {
  if (!DISENO_ACTIVO || typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
};

// Devuelve el valor del parámetro, o null si no está (o si es producción).
export const diseno = (clave) => {
  const p = parametros();
  if (!p || !p.has(clave)) return null;
  return (p.get(clave) || '').trim().toLowerCase();
};

// Igual, pero numérico y acotado. Devuelve null si no está o no es un número.
export const disenoNum = (clave, min = 0, max = 100) => {
  const v = diseno(clave);
  if (v === null || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.max(min, Math.min(max, n));
};

// ¿Hay algún parámetro de diseño en la URL? Sirve para pintar el aviso.
export const hayModoDiseno = () => {
  const p = parametros();
  if (!p) return false;
  return ['kapi', 'felicidad', 'ruleta', 'dias', 'bolitas', 'moneda', 'sesion', 'premios',
    'resultado', 'palabra'].some((k) => p.has(k));
};
