// ¿Esta página se está mostrando como VISTA PREVIA del mapa de calor?
// (dentro del <iframe> de HeatmapViewer, en /admin/dashboard/...)
//
// En la vista previa la página tiene que verse como la vio el visitante: sin
// la barra de admin (empujaba todo ~45px y los clics quedaban desplazados) y
// sin ventanas emergentes (campañas, "inicia sesión", idioma…) que la tapen.
export function esVistaPreviaMapaCalor() {
  if (typeof window === 'undefined' || window.self === window.top) return false;
  try {
    return window.top.location.pathname.startsWith('/admin/dashboard');
  } catch {
    // Marco de otro origen: no es nuestra vista previa.
    return false;
  }
}

export const EN_VISTA_PREVIA_CALOR = esVistaPreviaMapaCalor();

// Clase en <html> para que globals.css esconda las ventanas emergentes
// ([role="dialog"], [aria-modal="true"]) dentro de la vista previa.
if (EN_VISTA_PREVIA_CALOR && typeof document !== 'undefined') {
  document.documentElement.classList.add('vista-previa-calor');
}
