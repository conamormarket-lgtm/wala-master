import { precioBase } from '../../utils/prendaBase';
import { itemDeCreacion } from './creacionCarrito';

/**
 * Combos de Crear ("Pareja", "Trío"...): el cliente diseña cada pieza en el
 * estudio de siempre y aquí se arman en una sola línea del carrito.
 *
 * Lo que lleva armado (qué creación y qué talla va en cada pieza) vive en
 * este navegador mientras va y viene del estudio: es un paso de compra, no
 * algo de su cuenta. Las creaciones sí quedan en su cuenta, como siempre.
 */
const clave = (comboId) => `wala:combo-crear:${comboId}`;

const piezaVacia = () => ({ designId: '', talla: '' });

export const leerArmado = (comboId, cantidadPiezas) => {
  let guardado = null;
  try { guardado = JSON.parse(localStorage.getItem(clave(comboId)) || 'null'); } catch { /* sin almacenamiento */ }
  const piezas = Array.isArray(guardado?.piezas) ? guardado.piezas : [];
  return Array.from({ length: cantidadPiezas }, (_, i) => ({ ...piezaVacia(), ...(piezas[i] || {}) }));
};

export const guardarArmado = (comboId, piezas) => {
  try { localStorage.setItem(clave(comboId), JSON.stringify({ piezas })); } catch { /* sin almacenamiento */ }
};

/** Pone (o cambia) lo que lleva una pieza. Lo usa el estudio al volver. */
export const ponerPieza = (comboId, indice, cambios) => {
  let guardado = null;
  try { guardado = JSON.parse(localStorage.getItem(clave(comboId)) || 'null'); } catch { /* sin almacenamiento */ }
  const piezas = Array.isArray(guardado?.piezas) ? [...guardado.piezas] : [];
  while (piezas.length <= indice) piezas.push(piezaVacia());
  piezas[indice] = { ...piezaVacia(), ...piezas[indice], ...cambios };
  guardarArmado(comboId, piezas);
};

export const olvidarArmado = (comboId) => {
  try { localStorage.removeItem(clave(comboId)); } catch { /* sin almacenamiento */ }
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
 * `piezas` = [{ prenda, creacion, talla }] en el orden del combo.
 */
export const itemDeCombo = ({ combo, piezas }) => {
  const detalle = piezas.map(({ prenda, creacion, talla }) => {
    const [, , personalizacion] = itemDeCreacion({ prenda, creacion, talla });
    return {
      ...personalizacion,
      prendaId: prenda.id,
      prendaNombre: prenda.name,
      talla,
    };
  });
  const imagen = detalle[0]?.imageURL || combo.mainImage || '';
  return [
    { ...combo, id: combo.id, variants: [], hasVariants: false, mainImage: imagen },
    {},
    {
      tipo: 'comboCrear',
      nombre: combo.name,
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

/** "Polo clásico/Negro (M) + Polo clásico/Blanco (S)", para el resumen del pedido. */
export const resumenPiezas = (item) => (item?.customization?.piezas || [])
  .map((p) => `${p.prendaNombre}${p.color?.nombre ? `/${p.color.nombre}` : ''}${p.talla ? ` (${p.talla})` : ''}`)
  .join(' + ');
