// Coordenadas relativas al área útil. Los tamaños de los elementos y sus
// posiciones se guardan con el diseño, nunca en píxeles de la pantalla.
export const FUENTES_YORYO = [
  { id: 'Elegante', archivo: 'Cinzel-Bold.ttf', familia: 'Yoryo Elegante', detalle: 'Serif · ideal para nombres' },
  { id: 'Clásica', archivo: 'segoeui.ttf', familia: 'Yoryo Clasica', detalle: 'Clara y sencilla' },
  { id: 'Fuerte', archivo: 'BebasNeue Bold.ttf', familia: 'Yoryo Fuerte', detalle: 'Alta y compacta' },
  { id: 'Manuscrita', archivo: 'BRUSHSCI.TTF', familia: 'Yoryo Manuscrita', detalle: 'Ideal para dedicatorias' },
];

export const esDistribucionEditable = (datos) => [2, 3].includes(datos?.distribucion?.version);
export const limitar = (valor, min, max) => Math.min(max, Math.max(min, Number(valor) || 0));

export function seccionesYoryo(datos, config) {
  const soloTexto = datos.plantilla === 'nombre' && !datos.equipo;
  const anterior = datos.distribucion?.version === 2;
  if (config.tecnica === 'laser') return [
    { id: 'escudo', nombre: datos.plantilla === 'iniciales' ? 'Iniciales' : datos.plantilla === 'escudo' ? 'Escudo' : 'Equipo', x: .5, y: anterior ? .32 : .31, w: .82, h: anterior ? .60 : .55, fuente: 'Fuerte', mayusculas: true },
    { id: 'nombre', nombre: 'Nombre', x: .5, y: soloTexto ? .44 : anterior ? .72 : .69, w: .94, h: soloTexto ? .23 : anterior ? .14 : .12, fuente: 'Elegante', mayusculas: true },
    { id: 'frase', nombre: 'Frase', x: .5, y: soloTexto ? .70 : anterior ? .89 : .865, w: .90, h: soloTexto ? .24 : anterior ? .16 : .23, fuente: 'Manuscrita', mayusculas: false },
  ];
  return [
    { id: 'foto', nombre: datos.plantilla === 'collage' ? 'Fotos' : 'Foto o diseño', x: .5, y: .37, w: .93, h: .66 },
    { id: 'nombre', nombre: 'Nombre', x: .5, y: .79, w: .90, h: .105, fuente: 'Elegante', mayusculas: false },
    ...(['aniversario', 'collage', 'equipo'].includes(datos.plantilla) ? [{ id: 'fecha', nombre: datos.plantilla === 'equipo' ? 'Equipo' : 'Fecha', x: .5, y: .88, w: .90, h: .06, fuente: 'Clásica', mayusculas: false }] : []),
    { id: 'frase', nombre: 'Dedicatoria', x: .5, y: .95, w: .90, h: .065, fuente: 'Manuscrita', mayusculas: false },
  ];
}

export const distribucionRecomendada = () => ({ version: 3, elementos: {} });

export function ajusteSeccion(datos, seccion) {
  const cambio = datos.distribucion?.elementos?.[seccion.id] || {};
  return {
    ...seccion,
    w: limitar(cambio.w ?? seccion.w, .01, .96),
    h: limitar(cambio.h ?? seccion.h, .01, .96),
    x: limitar(cambio.x ?? seccion.x, .02, .98),
    y: limitar(cambio.y ?? seccion.y, .02, .98),
    escala: limitar(cambio.escala ?? 100, 40, 160),
    fuente: FUENTES_YORYO.some((f) => f.id === cambio.fuente) ? cambio.fuente : seccion.fuente,
    mayusculas: cambio.mayusculas ?? seccion.mayusculas,
  };
}

/** Guarda también los valores resueltos: reabrir no depende de futuros presets. */
export function fijarDistribucion(datos, config) {
  if (!esDistribucionEditable(datos)) return datos;
  const elementos = { ...datos.distribucion.elementos };
  for (const seccion of seccionesYoryo(datos, config)) {
    const a = ajusteSeccion(datos, seccion);
    elementos[a.id] = { x: a.x, y: a.y, w: a.w, h: a.h, escala: a.escala, ...(a.fuente && { fuente: a.fuente, mayusculas: a.mayusculas }) };
  }
  return { ...datos, distribucion: { version: datos.distribucion.version, elementos } };
}

const ordenar = (valor) => Array.isArray(valor) ? valor.map(ordenar) : valor && typeof valor === 'object'
  ? Object.fromEntries(Object.keys(valor).sort().map((clave) => [clave, ordenar(valor[clave])])) : valor;
export const firmaDeDisenoYoryo = (datos, medidas) => JSON.stringify(ordenar({ datos, medidas }));
export const normalizarFirmaYoryo = (firma) => { try { return JSON.stringify(ordenar(JSON.parse(firma))); } catch { return firma; } };

export function cambiarSeccion(datos, id, cambio) {
  const distribucion = esDistribucionEditable(datos) ? datos.distribucion : distribucionRecomendada();
  return { ...datos, distribucion: { ...distribucion, elementos: { ...distribucion.elementos, [id]: { ...distribucion.elementos[id], ...cambio } } } };
}

export function cajaSeccion(ajuste, ancho = ajuste.w, alto = ajuste.h) {
  const w = limitar(ancho, .001, .96), h = limitar(alto, .001, .96);
  const x = limitar(ajuste.x, .02 + w / 2, .98 - w / 2);
  const y = limitar(ajuste.y, .02 + h / 2, .98 - h / 2);
  return { x: x - w / 2, y: y - h / 2, w, h, centroX: x, centroY: y };
}

/** La distribución antigua conserva también su encuadre al reabrirla. */
export function vistaYoryo(config, datos) {
  return config.tecnica === 'laser' && esDistribucionEditable(datos)
    ? { x: .27, y: .22, w: .38, h: .44 }
    : config.vista;
}

/** La misma operación contain que usa la imagen exportada, sobre fotos 3:4. */
export function areaVistaYoryo(config, datos, proporcionFoto = 4 / 3) {
  const vista = vistaYoryo(config, datos);
  const ancho = Math.min(vista.w, vista.h * proporcionFoto / config.proporcion);
  const alto = ancho * config.proporcion / proporcionFoto;
  return { x: vista.x + (vista.w - ancho) / 2, y: vista.y + (vista.h - alto) / 2, w: ancho, h: alto };
}
