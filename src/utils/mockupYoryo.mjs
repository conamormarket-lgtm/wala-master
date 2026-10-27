import { adaptarPlantillaYoryo, encajePlantillaYoryo, proporcionPlantillaYoryo } from './plantillasYoryo.mjs';
import { medidasConfirmadas } from './yoryoPersonalizacion.mjs';

// La proporción de una plantilla es visual, no una medida inventada del taller.
// Cuando hay medidas confirmadas, se respetan para el lienzo y la impresión.
export function configurarDisenoYoryo(config, datos) {
  if (config.tecnica === 'impresion' && (datos.formatoPlantilla === 4 || datos.plantillaConfig?.estructuraFija)) return { ...config, proporcion: config.nombre === 'Mousepad' ? 195 / 235 : 250 / 310 };
  if (config.tecnica === 'impresion' && datos.plantillaConfig?.proporcion) return { ...config, proporcion: datos.plantillaConfig.proporcion };
  if (config.tecnica !== 'impresion' || datos.formatoPlantilla !== 3 || medidasConfirmadas(config.produccion)) return config;
  const proporcion = proporcionPlantillaYoryo(datos);
  return proporcion && proporcion !== config.proporcion ? { ...config, proporcion } : config;
}

export function prepararMockupYoryo(datos, config) {
  if (config.tecnica !== 'impresion' || datos.formatoPlantilla >= 3) return datos;
  const anterior = adaptarPlantillaYoryo(datos, config), nuevo = { ...anterior, formatoPlantilla: 3 };
  if (!proporcionPlantillaYoryo(anterior)) return nuevo;
  const antes = encajePlantillaYoryo(anterior, config), despues = encajePlantillaYoryo(nuevo, configurarDisenoYoryo(config, nuevo));
  const elementos = Object.fromEntries(Object.entries(anterior.distribucion?.elementos || {}).map(([id, cambio]) => [id, {
    ...cambio,
    ...('x' in cambio && { x: despues.x + (cambio.x - antes.x) / antes.w * despues.w }),
    ...('y' in cambio && { y: despues.y + (cambio.y - antes.y) / antes.h * despues.h }),
    ...('w' in cambio && { w: cambio.w / antes.w * despues.w }),
    ...('h' in cambio && { h: cambio.h / antes.h * despues.h }),
  }]));
  return { ...nuevo, ...(anterior.distribucion && { distribucion: { ...anterior.distribucion, elementos } }) };
}

/** También alimenta la miniatura: el marco nunca se incluye en el archivo de impresión. */
export function medidasMockupYoryo(config, ancho = 1000) {
  const mousepad = config.nombre === 'Mousepad', margen = ancho * .025;
  const anchoMarco = ancho - 2 * margen, borde = anchoMarco * (mousepad ? .012 : .045);
  const w = anchoMarco - 2 * borde, h = w * config.proporcion;
  return { ancho, alto: Math.ceil(h + 2 * borde + 2 * margen), margen, borde, w, h, x: margen + borde, y: margen + borde, radio: mousepad ? anchoMarco * .04 : 0, mousepad };
}
