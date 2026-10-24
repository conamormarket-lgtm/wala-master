import { Capacitor } from '@capacitor/core';

// ¿Esta página se está mostrando como VISTA PREVIA del mapa de calor?
// (dentro del <iframe> de HeatmapViewer, en Resultados › Detalle técnico)
//
// En la vista previa la página tiene que verse como la vio el visitante: sin
// la barra de admin (empujaba todo ~45px y los clics quedaban desplazados) y
// sin ventanas emergentes (campañas, "inicia sesión", idioma…) que la tapen.
export function esVistaPreviaMapaCalor() {
  if (typeof window === 'undefined' || window.self === window.top) return false;
  try {
    const ruta = window.top.location.pathname;
    return ruta.startsWith('/admin/resultados/tecnico') || ruta.startsWith('/admin/dashboard');
  } catch {
    // Marco de otro origen: no es nuestra vista previa.
    return false;
  }
}

export const EN_VISTA_PREVIA_CALOR = esVistaPreviaMapaCalor();

// Vista previa "como la app" (?vista=app en el iframe): para ver los clics de
// la app de Android sobre la página tal como se ve dentro de la app (sin pie
// de página, con su cabecera, sin el aviso de "descarga la app").
export const VISTA_PREVIA_COMO_APP = EN_VISTA_PREVIA_CALOR
  && new URLSearchParams(window.location.search).get('vista') === 'app';

// ¿La página se comporta como la app nativa? En la app de verdad, o en la
// vista previa del mapa de calor "como la app". Úsalo SOLO para lo que cambia
// cómo se VE la página; lo que depende de la plataforma de verdad (plugins,
// notificaciones, enlaces profundos) sigue con Capacitor.isNativePlatform().
export function esAppNativa() {
  return Capacitor.isNativePlatform() || VISTA_PREVIA_COMO_APP;
}

// Clase en <html> para que globals.css esconda las ventanas emergentes
// ([role="dialog"], [aria-modal="true"]) dentro de la vista previa.
if (EN_VISTA_PREVIA_CALOR && typeof document !== 'undefined') {
  document.documentElement.classList.add('vista-previa-calor');
}
