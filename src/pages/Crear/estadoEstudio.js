/** Quita únicamente marcas de subida y zonas vacías; conserva el contrato de Crear. */
export function capasParaGuardar(capasPorZona) {
  const salida = {};
  Object.entries(capasPorZona || {}).forEach(([zonaId, capas]) => {
    const limpias = (capas || []).filter((c) => c.type !== 'image' || (c.src && !c.src.startsWith('blob:')))
      .map(({ subiendo, ...capa }) => capa);
    if (limpias.length) salida[zonaId] = limpias;
  });
  return salida;
}

/** El orden de las propiedades no cambia una firma; el orden de las capas sí. */
function firma(estado, diseno = false) {
  return JSON.stringify(estado, (clave, valor) => {
    if (diseno && (clave === 'src' || clave === 'subiendo' || valor === false)) return undefined;
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      return Object.fromEntries(Object.keys(valor).sort().map((k) => [k, valor[k]]));
    }
    return valor;
  });
}

export function firmaDiseno(capasPorZona, colorId) {
  const capas = Object.keys(capasPorZona || {}).sort().filter((z) => capasPorZona[z]?.length)
    .map((z) => [z, capasPorZona[z]]);
  return firma({ capas, colorId: colorId || null }, true);
}

export const firmaBorrador = (capas, colorId, talla) => firma({ capas: capasParaGuardar(capas), colorId: colorId || null, talla: talla || '' });

/** No reutiliza una creación anterior con archivos incompletos o sin URLs. */
export function archivosVigentes(creacion, capas, vistas) {
  if (!creacion?.imagenConjunta || !Array.isArray(creacion.archivosImpresion) || !Array.isArray(creacion.vistasPrevias)) return false;
  let hayDiseno = false;
  return vistas.every((vista) => {
    const zonas = vista.zonas.filter((z) => capas[z.id]?.length);
    if (!zonas.length) return true;
    hayDiseno = true;
    return creacion.vistasPrevias?.some((v) => v.vista === vista.id && v.url)
      && zonas.every((z) => creacion.archivosImpresion?.some((a) => a.vista === z.id && a.url));
  }) && hayDiseno;
}
