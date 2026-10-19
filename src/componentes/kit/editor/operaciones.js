/* Operaciones sobre la lista de secciones del builder (siempre devuelven otra lista). */

export const renumerar = (lista) => lista.map((x, order) => (x.order === order ? x : { ...x, order }));
export const ordenadas = (lista) => [...lista].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
export const nuevoIdSeccion = () => `section_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export function actualizarAjustes(secciones, id, parche) {
  return secciones.map((x) => (x.id === id ? { ...x, settings: { ...(x.settings || {}), ...parche } } : x));
}
export function insertarSeccion(secciones, seccion, indice = secciones.length) {
  const l = ordenadas(secciones);
  l.splice(indice, 0, seccion);
  return renumerar(l);
}
export function moverSeccion(secciones, id, paso) {
  const l = ordenadas(secciones);
  const i = l.findIndex((x) => x.id === id);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= l.length) return secciones;
  [l[i], l[j]] = [l[j], l[i]];
  return renumerar(l);
}
export function duplicarSeccion(secciones, id) {
  const l = ordenadas(secciones);
  const i = l.findIndex((x) => x.id === id);
  if (i < 0) return secciones;
  l.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(l[i])), id: nuevoIdSeccion() });
  return renumerar(l);
}
export function quitarSeccion(secciones, id) {
  return renumerar(ordenadas(secciones).filter((x) => x.id !== id));
}
