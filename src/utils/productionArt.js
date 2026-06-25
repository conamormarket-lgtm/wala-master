// productionArt.js — Base del pipeline de ARTE DE PRODUCCIÓN (POD estilo Printful).
//
// Estas utilidades convierten medidas físicas (cm) en píxeles a un dpi dado,
// exportan el lienzo fabric en alta resolución (lo que se manda a imprenta),
// y validan que la imagen colocada tenga suficiente resolución para el área.
//
// La integración real con el editor fabric (capas, recorte al área, PDF final)
// se hace después en EditorPage; aquí queda la lógica pura/reutilizable.

/**
 * Convierte centímetros a píxeles para un dpi (puntos por pulgada) dado.
 * 1 pulgada = 2.54 cm  ->  px = (cm / 2.54) * dpi
 * @param {number} cm  Medida física en centímetros.
 * @param {number} dpi Resolución de salida (p.ej. 300 para imprenta).
 * @returns {number} Píxeles redondeados.
 */
export function pxFromCm(cm, dpi) {
  return Math.round((cm / 2.54) * dpi);
}

/**
 * Exporta el lienzo fabric como PNG en ALTA RESOLUCIÓN.
 * fabric.Canvas.toDataURL soporta un `multiplier` que escala la exportación
 * por encima del tamaño en pantalla: con multiplier=4 obtenemos ~4x la
 * resolución visible, suficiente para impresión de calidad.
 * @param {object} fabricCanvas  Instancia de fabric.Canvas.
 * @param {object} [opts]
 * @param {number} [opts.dpiMultiplier=4]  Factor de escala de exportación.
 * @returns {string} Data URL PNG en alta resolución.
 */
export function exportProductionArtPNG(fabricCanvas, { dpiMultiplier = 4 } = {}) {
  return fabricCanvas.toDataURL({ format: 'png', multiplier: dpiMultiplier }); // alta resolución
}

/**
 * Valida que una imagen tenga resolución suficiente para imprimir un área dada.
 * Calcula los píxeles necesarios para `areaWidthCm` al `dpi` objetivo y los
 * compara con el ancho real de la imagen. Si `have < needed`, la impresión
 * saldría pixelada y habría que avisar al usuario / rechazar el arte.
 * @param {object} args
 * @param {number} args.imgWidthPx  Ancho real de la imagen en píxeles.
 * @param {number} args.areaWidthCm Ancho del área de impresión en cm.
 * @param {number} [args.dpi=300]   Resolución objetivo de imprenta.
 * @returns {{ ok: boolean, needed: number, have: number }}
 */
export function validatePrintResolution({ imgWidthPx, areaWidthCm, dpi = 300 }) {
  const needed = Math.round((areaWidthCm / 2.54) * dpi);
  return { ok: imgWidthPx >= needed, needed, have: imgWidthPx };
}
