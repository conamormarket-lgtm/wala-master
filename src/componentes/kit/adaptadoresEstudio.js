/**
 * Vista de una capa de Crear para PanelCapa. Las capas persistidas y Fabric
 * siguen siendo la fuente de verdad; esta vista nunca se guarda en Firestore.
 * `unidades` es UNIDADES_ZONA de la tienda.
 */
export function capaEstudioDesde(capa, unidades) {
  if (!capa) return null;
  return {
    ...capa,
    tipo: capa.type === 'image' ? 'imagen' : 'texto',
    texto: capa.text,
    tamano: (capa.tamano || 90) * Math.abs(capa.escalaY ?? 1) / unidades,
    ancho: (capa.anchoNatural || 1) * Math.abs(capa.escalaX ?? 1) / unidades,
    voltear: Boolean(capa.flipX),
  };
}

/** Solo devuelve las propiedades modificadas, en el formato original. */
export function cambiosDePanelEstudio(capa, cambios, unidades) {
  const { texto, tamano, ancho, voltear, ...resto } = cambios;
  const salida = { ...resto };
  if (texto !== undefined) salida.text = texto;
  if (voltear !== undefined) salida.flipX = voltear;
  const actual = capaEstudioDesde(capa, unidades);
  const factor = ancho !== undefined ? ancho / actual.ancho
    : tamano !== undefined ? tamano / actual.tamano : null;
  if (factor !== null && Number.isFinite(factor) && factor > 0) {
    // Conserva la proporción de las escalas, incluso en diseños antiguos
    // estirados: cambiar el control no normaliza ni degrada sus capas.
    salida.escalaX = (capa.escalaX ?? 1) * factor;
    salida.escalaY = (capa.escalaY ?? 1) * factor;
  }
  return salida;
}
