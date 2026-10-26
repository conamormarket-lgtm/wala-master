const raiz = '/yoryo/cuadros';
export const EQUIPOS_YORYO = [
  ['Alianza Lima', 'alianza_lima'], ['Universitario', 'u'], ['Sporting Cristal', 'sporting_cristall'],
  ['Sport Boys', 'sport_boys'], ['Barcelona', 'barcelona'], ['Real Madrid', 'real_madrid'],
];
export const PLANTILLAS_IMPRESION_YORYO = [
  { id: 'dorado', nombre: 'Banda dorada', tipo: 'nombre', imagen: `${raiz}/parejas/dorado.png` },
  { id: 'floral', nombre: 'Mi lugar favorito', tipo: 'aniversario', imagen: `${raiz}/parejas/floral.png` },
  { id: 'botanico', nombre: 'Nuestra historia', tipo: 'collage', imagen: `${raiz}/parejas/collage.png` },
  { id: 'deportivo', nombre: 'Equipos', tipo: 'equipo', imagen: `${raiz}/equipos/alianza_lima_fondo.png` },
];
export const PLANTILLAS_CUADRO = PLANTILLAS_IMPRESION_YORYO;
const medidasEquipos = {
  'Alianza Lima': [1536, 1024], Universitario: [1527, 1030], 'Sporting Cristal': [1525, 1031],
  'Sport Boys': [1536, 1024], Barcelona: [1551, 1014], 'Real Madrid': [1526, 1031],
};

export function proporcionPlantillaYoryo(datos) {
  if (!plantillaImpresionYoryo(datos)) return null;
  const [ancho, alto] = datos.plantillaVisual === 'deportivo' ? medidasEquipos[datos.equipo] || [1536, 1024] : [1536, 1024];
  return alto / ancho;
}

/** Un único ajuste proporcional para la decoración y todas sus ventanas. */
export function encajePlantillaYoryo(datos, config) {
  const [ancho, alto] = datos.plantillaVisual === 'deportivo' ? medidasEquipos[datos.equipo] || [1536, 1024] : [1536, 1024];
  const proporcion = Number(config?.proporcion) || alto / ancho;
  const escala = Math.min(1 / ancho, proporcion / alto);
  const w = ancho * escala, h = alto * escala / proporcion;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h, preserveAspectRatio: 'xMidYMid meet' };
}

function encajarSeccion(seccion, encaje) {
  const margen = seccion.indiceFoto !== undefined ? 0 : .02;
  const x1 = Math.max(margen, encaje.x + (seccion.x - seccion.w / 2) * encaje.w);
  const y1 = Math.max(margen, encaje.y + (seccion.y - seccion.h / 2) * encaje.h);
  const x2 = Math.min(1 - margen, encaje.x + (seccion.x + seccion.w / 2) * encaje.w);
  const y2 = Math.min(1 - margen, encaje.y + (seccion.y + seccion.h / 2) * encaje.h);
  const w = Math.max(.01, Math.min(1 - 2 * margen, x2 - x1)), h = Math.max(.01, Math.min(1 - 2 * margen, y2 - y1));
  return { ...seccion, margen, x: Math.max(margen + w / 2, Math.min(1 - margen - w / 2, (x1 + x2) / 2)), y: Math.max(margen + h / 2, Math.min(1 - margen - h / 2, (y1 + y2) / 2)), w, h };
}

// Se aplica solo al abrir un diseño para editar. Los archivos de pedidos y
// sus vistas previas anteriores se conservan. Mantiene texto, fotos y ajustes.
export function adaptarPlantillaYoryo(datos, config) {
  if (config?.tecnica !== 'impresion' || !plantillaImpresionYoryo(datos) || datos.formatoPlantilla === 2) return datos;
  const encaje = encajePlantillaYoryo(datos, config), bases = seccionesOriginales(datos), nuevas = seccionesOriginales({ ...datos, formatoPlantilla: 2 });
  const elementos = Object.fromEntries(Object.entries(datos.distribucion?.elementos || {}).map(([id, cambio]) => {
    const base = bases.find((s) => s.id === id);
    if (!base) return [id, cambio];
    const nueva = nuevas.find((s) => s.id === id), ajustes = { ...cambio };
    for (const k of ['x', 'y', 'w', 'h']) if (Math.abs(Number(ajustes[k]) - base[k]) < .00001) ajustes[k] = nueva[k];
    const ajustado = encajarSeccion({ ...nueva, ...ajustes }, encaje);
    return [id, { ...cambio, x: ajustado.x, y: ajustado.y, w: ajustado.w, h: ajustado.h }];
  }));
  return { ...datos, formatoPlantilla: 2, ...(datos.distribucion && { distribucion: { ...datos.distribucion, elementos } }) };
}
export function plantillaImpresionYoryo(datos) {
  const p = PLANTILLAS_CUADRO.find((p) => p.id === datos.plantillaVisual);
  if (!p) return null;
  if (p.id !== 'deportivo') return { ...p, superposicion: p.imagen };
  const equipo = EQUIPOS_YORYO.find(([nombre]) => nombre === datos.equipo)?.[1];
  return equipo ? { ...p, fondo: `${raiz}/equipos/${equipo}_fondo.png`, superposicion: `${raiz}/equipos/${equipo}_logo.png` } : p;
}
// Las ventanas corresponden a los PNG transparentes originales. Las fotos van
// detrás de la decoración; los textos siempre por delante.
export function seccionesPlantillaYoryo(datos, config) {
  const originales = seccionesOriginales(datos);
  if (!originales || ![2, 3].includes(datos.formatoPlantilla)) return originales;
  const encaje = encajePlantillaYoryo(datos, config);
  return originales.map((s) => encajarSeccion(s, encaje));
}

function seccionesOriginales(datos) {
  if (!plantillaImpresionYoryo(datos)) return null;
  const texto = (id, nombre, x, y, w, h, fuente = 'Elegante', color = '#26342B') => ({ id, nombre, x, y, w, h, fuente, color, mayusculas: false, orden: 3 });
  const foto = (id, nombre, x, y, w, h, indiceFoto = 0) => ({ id, nombre, x, y, w, h, indiceFoto, orden: 1 });
  const ventana = (id, nombre, x, y, w, h, indice = 0) => foto(id, nombre, (x + w / 2) / 1536, (y + h / 2) / 1024, w / 1536, h / 1024, indice);
  const proporcional = [2, 3].includes(datos.formatoPlantilla);
  switch (datos.plantillaVisual) {
    case 'floral': return [proporcional ? ventana('foto', 'Foto o diseño', 0, 0, 1004, 1024) : foto('foto', 'Foto o diseño', .29, .50, .56, .96), texto('titulo', 'Título', .815, .255, .30, .22), texto('acento', 'Texto destacado', .815, .43, .30, .10, 'Manuscrita', '#BC6049'), texto('nombre', 'Nombre', .815, .66, .30, .09), texto('fecha', 'Fecha', .815, .745, .27, .045, 'Clásica'), texto('frase', 'Dedicatoria', .815, .88, .28, .12, 'Manuscrita')];
    case 'botanico': return [...(proporcional ? [ventana('foto', 'Foto 1', 110, 54, 650, 389), ventana('foto2', 'Foto 2', 110, 455, 650, 372, 1), ventana('foto3', 'Foto 3', 780, 54, 670, 773, 2)] : [foto('foto', 'Foto 1', .28, .24, .42, .38), foto('foto2', 'Foto 2', .28, .625, .42, .36, 1), foto('foto3', 'Foto 3', .725, .43, .43, .76, 2)]), texto('nombre', 'Nombre', .50, .87, .65, .07), texto('fecha', 'Fecha', .50, .925, .40, .035, 'Clásica'), texto('frase', 'Dedicatoria', .50, .965, .65, .028, 'Manuscrita')];
    case 'deportivo': return [foto('foto', 'Foto o diseño', .75, .43, .46, .80), texto('nombre', 'Nombre', .285, .665, .48, .12, 'Elegante', '#FFFFFF'), texto('frase', 'Frase', .285, .76, .48, .075, 'Manuscrita', '#FFFFFF'), texto('dedicatoria', 'Dedicatoria', .50, .865, .84, .065, 'Manuscrita', '#14294A')];
    default: return [proporcional ? ventana('foto', 'Foto o diseño', 0, 0, 1536, 737) : foto('foto', 'Foto o diseño', .50, .365, .96, .69), texto('nombre', 'Nombre', .50, .845, .82, .085, 'Elegante', '#F2D399'), texto('frase', 'Dedicatoria', .50, .935, .80, .055, 'Manuscrita', '#F2D399')];
  }
}
