import { precioBase } from '../../utils/prendaBase';
import { itemDeCreacion } from './creacionCarrito';

/**
 * Combos de Crear ("Pareja", "Trío"...): el cliente diseña cada pieza en el
 * estudio de siempre y aquí se arman en una sola línea del carrito.
 *
 * Lo que lleva armado (qué creación y qué talla va en cada pieza) vive en
 * este navegador mientras va y viene del estudio. Junto a eso se guarda:
 *   - miComboId: el "Mi combo" de su cuenta (services/misCombos.js), que se
 *     crea en cuanto todas las piezas tienen diseño;
 *   - plantilla: la publicación de la comunidad de la que partió (un combo),
 *     para que cada pieza sin diseño propio arranque desde la suya.
 */
const clave = (comboId) => `wala:combo-crear:${comboId}`;

const piezaVacia = () => ({ designId: '', talla: '' });

const leer = (comboId) => {
  try { return JSON.parse(localStorage.getItem(clave(comboId)) || 'null') || {}; } catch { return {}; }
};

const escribir = (comboId, guardado) => {
  try { localStorage.setItem(clave(comboId), JSON.stringify(guardado)); } catch { /* sin almacenamiento */ }
};

export const leerArmado = (comboId, cantidadPiezas) => {
  const piezas = Array.isArray(leer(comboId).piezas) ? leer(comboId).piezas : [];
  return Array.from({ length: cantidadPiezas }, (_, i) => ({ ...piezaVacia(), ...(piezas[i] || {}) }));
};

export const guardarArmado = (comboId, piezas) => escribir(comboId, { ...leer(comboId), piezas });

/** { miComboId, plantilla } del armado de este combo. */
export const leerMetaArmado = (comboId) => {
  const { miComboId = '', plantilla = '' } = leer(comboId);
  return { miComboId, plantilla };
};

export const guardarMetaArmado = (comboId, cambios) => escribir(comboId, { ...leer(comboId), ...cambios });

/** Pone (o cambia) lo que lleva una pieza. Lo usa el estudio al volver. */
export const ponerPieza = (comboId, indice, cambios) => {
  const guardado = leer(comboId);
  const piezas = Array.isArray(guardado.piezas) ? [...guardado.piezas] : [];
  while (piezas.length <= indice) piezas.push(piezaVacia());
  piezas[indice] = { ...piezaVacia(), ...piezas[indice], ...cambios };
  guardarArmado(comboId, piezas);
};

/**
 * Empieza un combo NUEVO con un diseño ya hecho: `porPieza` = { [índice]: id }
 * con la copia de cada prenda que es su misma prenda (en una pareja de
 * poleras, una copia en cada una); las demás quedan por diseñar. Lo que había
 * a medias sigue en la cuenta (Mi combo).
 */
export const empezarComboCon = (combo, porPieza) => {
  olvidarArmado(combo.id);
  guardarArmado(combo.id, combo.piezas.map((_, i) => ({ ...piezaVacia(), designId: porPieza[i] || '' })));
};

export const olvidarArmado = (comboId) => {
  try { localStorage.removeItem(clave(comboId)); } catch { /* sin almacenamiento */ }
};

/**
 * Pieza fija: un producto de la tienda que va tal cual, en el color que fijó
 * el admin (services/combosCrear.js). No se diseña ni lleva talla.
 */
export const esPiezaFija = (pieza) => pieza?.fija === true;

/** La variante del producto que lleva la pieza fija (por id o por nombre). */
export const varianteDeFija = (producto, color) => {
  const variantes = producto?.variants || [];
  return variantes.find((v) => color?.id && String(v.id) === String(color.id))
    || variantes.find((v) => color?.nombre && v.name === color.nombre) || null;
};

/** Las fotos de la pieza fija: las de su color o, si no, las del producto. */
export const fotosDeFija = (producto, color) => {
  const v = varianteDeFija(producto, color);
  const fotos = v ? [v.imageUrl, ...(v.images || [])] : [producto?.mainImage, ...(producto?.images || [])];
  return [...new Set(fotos.filter(Boolean))];
};

/** Precio del combo y cuánto costarían sus prendas sueltas. */
export const preciosDeCombo = (combo, prendas) => {
  const precio = precioBase(combo);
  const sueltas = prendas.reduce((total, p) => total + (p ? precioBase(p) : 0), 0);
  return { precio, sueltas, ahorro: Math.max(0, Math.round((sueltas - precio) * 100) / 100) };
};

/**
 * Reparte el precio del combo entre sus piezas (en céntimos, el resto a la
 * última): en el pedido cada pieza es una línea y entre todas suman el combo.
 */
export const repartirPrecio = (total, n) => {
  const centimos = Math.round(Number(total || 0) * 100);
  const cada = Math.floor(centimos / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? centimos - cada * (n - 1) : cada) / 100);
};

/**
 * Arma lo que addToCart necesita: el combo como producto y, en la
 * personalización, cada pieza con lo mismo que lleva una creación suelta
 * (vistas previas, archivos de impresión, zonas, color y talla).
 * `piezas` = [{ prenda, creacion, talla }] en el orden del combo. Una pieza
 * fija lleva solo su producto, su color y su foto (`fija: true`).
 */
export const itemDeCombo = ({ combo, piezas, miComboId = '' }) => {
  const detalle = piezas.map(({ prenda, creacion, talla }, i) => {
    const pieza = combo.piezas?.[i];
    if (esPiezaFija(pieza)) {
      const v = varianteDeFija(prenda, pieza.color);
      return {
        fija: true,
        prendaId: prenda.id,
        prendaNombre: prenda.name,
        color: { id: pieza.color?.id || '', nombre: pieza.color?.nombre || '', hex: v?.colorHex || pieza.color?.hex || '' },
        imageURL: fotosDeFija(prenda, pieza.color)[0] || pieza.imagen || '',
        talla: '',
        designId: '',
      };
    }
    const [, , personalizacion] = itemDeCreacion({ prenda, creacion, talla });
    return {
      ...personalizacion,
      prendaId: prenda.id,
      prendaNombre: prenda.name,
      talla,
    };
  });
  // La foto de la línea: la primera pieza con diseño (el reloj fijo no dice qué se personalizó).
  const imagen = detalle.find((d) => !d.fija)?.imageURL || detalle[0]?.imageURL || combo.mainImage || '';
  return [
    { ...combo, id: combo.id, variants: [], hasVariants: false, mainImage: imagen },
    {},
    {
      tipo: 'comboCrear',
      nombre: combo.name,
      // De qué "Mi combo" salió: el carrito vuelve a ESE combo (con sus diseños).
      ...(miComboId && { miComboId }),
      piezas: detalle,
      finalPrice: precioBase(combo),
      imageURL: imagen,
      designId: '',
      isComboDesign: false,
    },
    1,
  ];
};

export const esComboCrear = (item) => item?.customization?.tipo === 'comboCrear';

/**
 * Las creaciones que usa el carrito: las sueltas y CADA prenda de un combo
 * (la línea del combo no lleva designId propio: antes sus prendas quedaban
 * sin proteger al eliminar un combo o al limpiar versiones anteriores).
 */
export const disenosEnCarrito = (items) => new Set((items || []).flatMap((i) => [
  i.customization?.designId,
  // El "Mi combo" de la línea: eliminarlo lo archiva en vez de borrarlo.
  i.customization?.miComboId,
  ...(i.customization?.piezas || []).map((p) => p?.designId),
]).filter(Boolean));

/** "Polo clásico/Negro (M) + Polo clásico/Blanco (S)", para el resumen del pedido. */
export const resumenPiezas = (item) => (item?.customization?.piezas || [])
  .map((p) => `${p.prendaNombre}${p.color?.nombre ? `/${p.color.nombre}` : ''}${p.talla ? ` (${p.talla})` : ''}${p.fija ? ' (tal cual)' : ''}`)
  .join(' + ');
