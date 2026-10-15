// ¿Esta página se está mostrando como VISTA PREVIA del mapa de calor?
// (dentro del <iframe> de HeatmapViewer, en /admin/dashboard/...)
//
// En la vista previa la página tiene que verse como la vio el visitante: sin
// la barra de admin (empujaba todo ~45px y los clics quedaban desplazados).
export function esVistaPreviaMapaCalor() {
  if (typeof window === 'undefined' || window.self === window.top) return false;
  try {
    return window.top.location.pathname.startsWith('/admin/dashboard');
  } catch {
    // Marco de otro origen: no es nuestra vista previa.
    return false;
  }
}
