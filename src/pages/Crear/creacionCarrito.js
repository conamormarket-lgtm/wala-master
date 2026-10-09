import { leerPrendaBase, listarZonas, precioPersonalizado, vistasDelColor } from '../../utils/prendaBase';

/**
 * Arma lo que addToCart necesita para una creación del apartado Crear: la
 * prenda (producto del catálogo), la variante (color + talla) y la
 * personalización con todo lo ya generado (imágenes de cada lado y archivos
 * de impresión). Lo usan el estudio y la página de la creación, así el
 * artículo del carrito es el mismo venga de donde venga.
 *
 * `creacion` es un diseño guardado (colección designs, tipo 'crear') o el
 * mismo formato recién generado en el estudio.
 */
export const itemDeCreacion = ({ prenda, creacion, talla }) => {
  const { vistas, colores } = leerPrendaBase(prenda);
  const capas = creacion.layersByView || {};
  const usadas = Object.keys(capas).filter((zId) => Array.isArray(capas[zId]) && capas[zId].length);
  const vistasPrevias = creacion.vistasPrevias || [];
  const color = creacion.color || { nombre: creacion.variant?.color || '' };
  // Las zonas del color de la creación (un bicolor puede tener las suyas).
  const colorPrenda = colores.find((c) => (color.id && c.id === color.id) || c.nombre === color.nombre);
  const zonasPrenda = listarZonas(vistasDelColor(vistas, colorPrenda));
  const imagen = vistasPrevias[0]?.url || creacion.previewUrl || prenda.mainImage || '';

  return [
    // Sin variantes: el color y la talla van en la línea, y la foto es la
    // vista previa (las fotos de las variantes son la prenda en blanco).
    { ...prenda, id: prenda.id, variants: [], hasVariants: false, mainImage: imagen },
    { size: talla, color: color.nombre, colorHex: color.hex || '' },
    {
      tipo: 'crear',
      nombre: creacion.name || '',
      layersByView: capas,
      vistasUsadas: usadas,
      zonas: usadas.map((zId) => {
        const z = zonasPrenda.find((x) => x.id === zId);
        return { id: zId, nombre: z ? `${z.vistaNombre} · ${z.nombre}` : zId };
      }),
      archivosImpresion: creacion.archivosImpresion || [],
      vistasPrevias,
      color,
      variant: { size: talla, color: color.nombre },
      finalPrice: precioPersonalizado(prenda, usadas),
      imageURL: imagen,
      imagenConjunta: creacion.imagenConjunta || '',
      designId: creacion.id || '',
      isComboDesign: false,
    },
    1,
  ];
};

/** ¿La creación ya tiene sus archivos para imprimir? (las guardadas antes no). */
export const creacionLista = (creacion) =>
  Array.isArray(creacion?.archivosImpresion) && creacion.archivosImpresion.length > 0
  && Array.isArray(creacion?.vistasPrevias) && creacion.vistasPrevias.length > 0;
