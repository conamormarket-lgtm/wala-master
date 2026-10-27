import { RECURSOS_CAPAS_YORYO } from './recursosCapasYoryo.mjs';

const ids = { 'Alianza Lima': 'alianza_lima', Universitario: 'u', 'Sporting Cristal': 'sporting_cristall', 'Sport Boys': 'sport_boys', Barcelona: 'barcelona', 'Real Madrid': 'real_madrid' };
export const productoPlantillaYoryo = (config) => config?.nombre === 'Mousepad' ? 'mousepad' : 'cuadro';
export const clavePlantillaYoryo = (datos, config) => `${productoPlantillaYoryo(config)}__${datos.plantillaVisual}__${datos.plantillaVisual === 'deportivo' ? ids[datos.equipo] || 'alianza_lima' : 'general'}`;
export const usaCapasYoryo = (datos) => datos?.formatoPlantilla === 4 && datos.plantillaVisual === 'deportivo';
export function dimensionesExportacionYoryo(datos, config) {
  if (usaCapasYoryo(datos)) return config.nombre === 'Mousepad' ? { ancho: 2776, alto: 2303, anchoMm: 235, altoMm: 195 } : { ancho: 3661, alto: 2953, anchoMm: 310, altoMm: 250 };
  const medidas = config.produccion || {};
  const lista = medidas.medidasConfirmadas && Number(medidas.anchoMm) > 0 && Number(medidas.altoMm) > 0;
  const ancho = lista ? Math.round(Number(medidas.anchoMm) * 300 / 25.4) : 2400;
  return { ancho, alto: lista ? Math.round(Number(medidas.altoMm) * 300 / 25.4) : Math.round(ancho * config.proporcion) };
}

export function plantillaCapasBaseYoryo(equipo = 'Alianza Lima', producto = 'cuadro') {
  const recursos = RECURSOS_CAPAS_YORYO[ids[equipo] || 'alianza_lima'];
  const mouse = producto === 'mousepad';
  const tinta = equipo === 'Real Madrid' ? '#14294A' : '#FFFFFF';
  const texto = (id, nombre, x, y, w, h, orden, fuente, color) => ({ id, nombre, x, y, w, h, orden, fuente, color, alineacion: 'centro', mayusculas: false });
  return {
    version: 4, clave: `${producto}__deportivo__${ids[equipo] || 'alianza_lima'}`, producto, equipo,
    recursos,
    elementos: [
      { id: 'fondo', nombre: 'Fondo', recurso: 'fondo', x: .5, y: .5, w: 1, h: 1, orden: 0, margen: 0, encaje: 'cubrir' },
      { id: 'foto', nombre: 'Foto del cliente', indiceFoto: 0, x: mouse ? .73 : .74, y: .46, w: mouse ? .49 : .48, h: .86, orden: 1, encaje: 'completa', margen: 0 },
      { id: 'escudo', nombre: 'Escudo', recurso: 'escudo', x: .265, y: mouse ? .265 : .26, w: .31, h: mouse ? .41 : .43, orden: 2 },
      texto('nombre', 'Nombre', .275, mouse ? .555 : .56, .44, .12, 3, 'Elegante', tinta),
      texto('frase', 'Frase', .275, .67, .44, .095, 4, 'Manuscrita', tinta),
      { id: 'pincelada', nombre: 'Pincelada inferior', recurso: 'pincelada', x: .5, y: mouse ? .825 : .82, w: .94, h: .32, orden: 5, margen: .01 },
      texto('dedicatoria', 'Dedicatoria', .5, mouse ? .825 : .82, .68, .055, 6, 'Manuscrita', '#14294A'),
    ],
  };
}

/** Copia autocontenida: un pedido guardado no cambia cuando el admin edita el preset. */
export function aplicarPresetYoryo(datos, config, presets = {}, base = null) {
  if (config.tecnica === 'laser' || !datos.plantillaVisual) return datos;
  const clave = clavePlantillaYoryo(datos, config);
  const guardada = datos.plantillaConfig?.clave === clave ? datos.plantillaConfig : null;
  const preset = guardada || presets[clave] || (datos.plantillaVisual === 'deportivo' ? plantillaCapasBaseYoryo(datos.equipo, productoPlantillaYoryo(config)) : base);
  if (!preset) return datos;
  return { ...datos, ...(datos.plantillaVisual === 'deportivo' && { formatoPlantilla: 4 }),
    ...(![2, 3].includes(datos.distribucion?.version) && { distribucion: { version: 3, elementos: {} } }),
    plantillaConfig: JSON.parse(JSON.stringify({ ...preset, clave })) };
}

export function validarPresetYoryo(preset) {
  if (!preset?.clave || !Array.isArray(preset.elementos) || !preset.elementos.length) throw new Error('La plantilla no tiene elementos.');
  const vistos = new Set();
  for (const e of preset.elementos) {
    if (!e.id || vistos.has(e.id)) throw new Error('Hay elementos duplicados.');
    vistos.add(e.id);
    if (['x', 'y', 'w', 'h'].some((k) => !Number.isFinite(e[k]) || e[k] < 0 || e[k] > 1) || !e.w || !e.h) throw new Error(`Revisa la posición y el tamaño de ${e.nombre}.`);
    if (!Number.isFinite(e.orden) || e.orden < 0 || e.orden > 20) throw new Error('El orden debe estar entre 0 y 20.');
  }
  for (const r of Object.values(preset.recursos || {})) {
    if (!r?.url || !/^(\/(?!\/)|https:\/\/)/.test(r.url)) throw new Error('Usa recursos locales o enlaces HTTPS.');
    if (!Array.isArray(r.size) || r.size.some((n) => !Number.isFinite(n) || n <= 0)) throw new Error('Revisa las dimensiones de los recursos.');
  }
  return preset;
}

/** Ppp efectivos del fondo al cubrir, sin atribuir detalle al reescalado. */
export function resolucionFondoYoryo(datos, config) {
  const fondo = datos.plantillaConfig?.recursos?.fondo;
  if (!fondo?.size || !config.produccion?.anchoMm || !config.produccion?.altoMm) return null;
  return Math.floor(Math.min(fondo.size[0] / (config.produccion.anchoMm / 25.4), fondo.size[1] / (config.produccion.altoMm / 25.4)));
}
