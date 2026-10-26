const raiz = '/yoryo/cuadros';
export const EQUIPOS_YORYO = [
  ['Alianza Lima', 'alianza_lima'], ['Universitario', 'u'], ['Sporting Cristal', 'sporting_cristall'],
  ['Sport Boys', 'sport_boys'], ['Barcelona', 'barcelona'], ['Real Madrid', 'real_madrid'],
];
export const PLANTILLAS_CUADRO = [
  { id: 'dorado', nombre: 'Banda dorada', tipo: 'nombre', imagen: `${raiz}/parejas/dorado.png` },
  { id: 'floral', nombre: 'Mi lugar favorito', tipo: 'aniversario', imagen: `${raiz}/parejas/floral.png` },
  { id: 'botanico', nombre: 'Nuestra historia', tipo: 'collage', imagen: `${raiz}/parejas/collage.png` },
  { id: 'deportivo', nombre: 'Equipos', tipo: 'equipo', imagen: `${raiz}/equipos/alianza_lima_fondo.png` },
];
export function plantillaImpresionYoryo(datos) {
  const p = PLANTILLAS_CUADRO.find((p) => p.id === datos.plantillaVisual);
  if (!p) return null;
  if (p.id !== 'deportivo') return { ...p, superposicion: p.imagen };
  const equipo = EQUIPOS_YORYO.find(([nombre]) => nombre === datos.equipo)?.[1];
  return equipo ? { ...p, fondo: `${raiz}/equipos/${equipo}_fondo.png`, superposicion: `${raiz}/equipos/${equipo}_logo.png` } : p;
}
// Las ventanas corresponden a los PNG transparentes originales. Las fotos van
// detrás de la decoración; los textos siempre por delante.
export function seccionesPlantillaYoryo(datos) {
  if (!plantillaImpresionYoryo(datos)) return null;
  const texto = (id, nombre, x, y, w, h, fuente = 'Elegante', color = '#26342B') => ({ id, nombre, x, y, w, h, fuente, color, mayusculas: false, orden: 3 });
  const foto = (id, nombre, x, y, w, h, indiceFoto = 0) => ({ id, nombre, x, y, w, h, indiceFoto, orden: 1 });
  switch (datos.plantillaVisual) {
    case 'floral': return [foto('foto', 'Foto o diseño', .29, .50, .56, .96), texto('titulo', 'Título', .815, .255, .30, .22), texto('acento', 'Texto destacado', .815, .43, .30, .10, 'Manuscrita', '#BC6049'), texto('nombre', 'Nombre', .815, .66, .30, .09), texto('fecha', 'Fecha', .815, .745, .27, .045, 'Clásica'), texto('frase', 'Dedicatoria', .815, .88, .28, .12, 'Manuscrita')];
    case 'botanico': return [foto('foto', 'Foto 1', .28, .24, .42, .38), foto('foto2', 'Foto 2', .28, .625, .42, .36, 1), foto('foto3', 'Foto 3', .725, .43, .43, .76, 2), texto('nombre', 'Nombre', .50, .87, .65, .07), texto('fecha', 'Fecha', .50, .925, .40, .035, 'Clásica'), texto('frase', 'Dedicatoria', .50, .965, .65, .028, 'Manuscrita')];
    case 'deportivo': return [foto('foto', 'Foto o diseño', .75, .43, .46, .80), texto('nombre', 'Nombre', .285, .665, .48, .12, 'Elegante', '#FFFFFF'), texto('frase', 'Frase', .285, .76, .48, .075, 'Manuscrita', '#FFFFFF'), texto('dedicatoria', 'Dedicatoria', .50, .865, .84, .065, 'Manuscrita', '#14294A')];
    default: return [foto('foto', 'Foto o diseño', .50, .365, .96, .69), texto('nombre', 'Nombre', .50, .845, .82, .085, 'Elegante', '#F2D399'), texto('frase', 'Dedicatoria', .50, .935, .80, .055, 'Manuscrita', '#F2D399')];
  }
}
