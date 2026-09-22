/**
 * Utilidades para productos combo
 */
import { getCachedProducts } from '../services/products';

/**
 * Verifica si un producto es un producto combo
 * @param {Object} product - Producto a verificar
 * @returns {boolean}
 */
export const isComboProduct = (product) => {
  return Boolean(product?.isComboProduct);
};

/**
 * Obtiene los items del combo de un producto
 * @param {Object} product - Producto combo
 * @returns {Array} Array de items del combo
 */
export const getComboItems = (product) => {
  if (!isComboProduct(product)) return [];
  return Array.isArray(product.comboItems) ? product.comboItems : [];
};

/** Lo que un producto suelto pide por sus propios datos. */
const necesidadesPropias = (product) => {
  const variantes = Array.isArray(product?.variants) ? product.variants : [];
  return {
    // Más de una variante: el editor crea siempre una variante "Principal" de
    // relleno para la foto, aunque no haya colores reales.
    color: Boolean(product?.hasVariants && variantes.length > 1),
    talla: Boolean(
      (product?.mainSizes?.length || 0) > 0 ||
      variantes.some((v) => Array.isArray(v?.sizes) && v.sizes.length > 0)
    ),
  };
};

/**
 * ¿QUÉ tiene que elegir el cliente en este producto? Devuelve
 * { color, talla, indeterminado }.
 *
 * Existe porque saber que hay algo que elegir (productNeedsVariantSelection)
 * no basta para hablarle al cliente: el botón decía siempre "Elegir color y
 * talla", también en un reloj o una billetera, que no tienen tallas.
 *
 * EN UN COMBO las piezas son otros productos, y sus tallas no viven en el
 * comboItem. Mirar solo lo que el combo declara se queda corto: un conjunto
 * de casaca, polo y jogger decía "Elegir color" cuando además pide talla.
 * Por eso se resuelven las piezas contra el catálogo cacheado
 * (getCachedProducts, síncrono y ya poblado por la tienda, mismo recurso que
 * usa cartValidation).
 *
 * Con las piezas que se encuentran se afirma lo que ellas pidan. De las que
 * no estén en la caché —las ocultas, que no salen en el catálogo público— no
 * se puede saber nada; si NINGUNA pieza se pudo resolver se devuelve
 * `indeterminado` para que quien llame use un texto neutro en vez de
 * inventarse una respuesta.
 *
 * @param {Object} product
 * @param {Function} [buscarProducto] Resolutor opcional (id) => producto. Por
 *   defecto, la caché del catálogo. Se puede inyectar para test.
 * @returns {{ color: boolean, talla: boolean, indeterminado: boolean }}
 */
export const productSelectionNeeds = (product, buscarProducto) => {
  if (!isComboProduct(product)) {
    return { ...necesidadesPropias(product), indeterminado: false };
  }

  const items = getComboItems(product);
  if (items.length === 0) return { color: false, talla: false, indeterminado: false };

  let lookup = buscarProducto;
  if (!lookup) {
    const catalogo = getCachedProducts();
    const porId = Array.isArray(catalogo) ? new Map(catalogo.map((p) => [p.id, p])) : new Map();
    lookup = (id) => porId.get(id);
  }

  let color = false;
  let talla = false;
  let resueltas = 0;

  for (const item of items) {
    // El color fijado en el combo ya prueba que esa pieza tiene colores.
    if (item?.variantMapping?.color) color = true;

    const pieza = item?.productId ? lookup(item.productId) : null;
    if (!pieza) continue;
    resueltas++;
    const n = necesidadesPropias(pieza);
    color = color || n.color;
    talla = talla || n.talla;
  }

  return { color, talla, indeterminado: resueltas === 0 && !color };
};

/**
 * ¿Hay algo que el cliente TENGA que elegir antes de comprar este producto
 * (color, talla o piezas de combo)? Si es así, un "agregar rápido" no puede
 * meter la línea al carrito a ciegas (sin color/talla el pedido no se puede
 * despachar) — debe mandar a la ficha del producto para que se elija ahí.
 *
 * "hasVariants && variants.length > 0" NO alcanza: el editor de productos
 * (y los imports en bloque) crean SIEMPRE al menos una variante "Principal"
 * para guardar la foto del producto, aunque no tenga colores reales —
 * sizes:[] y un colorHex gris genérico de relleno. Se exige una elección
 * real: más de una variante (hay color entre qué elegir) o alguna variante
 * con tallas.
 * @param {Object} product - Producto a verificar
 * @returns {boolean}
 */
export const productNeedsVariantSelection = (product) => {
  const tieneEleccionRealDeVariante = Boolean(
    product?.hasVariants && (
      (product?.variants?.length || 0) > 1 ||
      product?.variants?.some((v) => Array.isArray(v?.sizes) && v.sizes.length > 0)
    )
  );
  return Boolean(
    tieneEleccionRealDeVariante ||
    product?.mainSizes?.length > 0 ||
    (isComboProduct(product) && product?.comboItems?.length > 0)
  );
};

/**
 * Obtiene la configuración de layout del combo
 * @param {Object} product - Producto combo
 * @returns {Object} Configuración de layout { orientation, spacing }
 */
export const getComboLayout = (product) => {
  if (!isComboProduct(product)) {
    return { orientation: 'horizontal', spacing: 0 };
  }
  const layout = product.comboLayout || {};
  return {
    orientation: layout.orientation === 'vertical' ? 'vertical' : 'horizontal',
    spacing: typeof layout.spacing === 'number' ? Math.max(0, layout.spacing) : 20
  };
};

/**
 * Valida la estructura de un producto combo
 * @param {Object} product - Producto a validar
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export const validateComboStructure = (product) => {
  const errors = [];
  if (!isComboProduct(product)) {
    return { valid: true, errors: [] };
  }
  const comboItems = getComboItems(product);
  if (comboItems.length === 0) {
    errors.push('Un producto combo debe tener al menos un item');
  }
  comboItems.forEach((item, index) => {
    if (!item.productId) errors.push(`Item ${index + 1}: falta productId`);
    if (!item.viewId) errors.push(`Item ${index + 1}: falta viewId`);
    if (typeof item.position !== 'number') errors.push(`Item ${index + 1}: position debe ser un número`);
    if (typeof item.scale !== 'number' || item.scale <= 0) errors.push(`Item ${index + 1}: scale debe ser un número mayor a 0`);
  });
  const layout = getComboLayout(product);
  if (layout.spacing < 0) errors.push('El spacing del layout no puede ser negativo');
  return { valid: errors.length === 0, errors };
};

/**
 * Genera todas las combinaciones de variantes de un combo
 * @param {Array} comboItems - Array de items del combo
 * @returns {Array} Array de variantes generadas
 */
export const generateComboVariants = (comboItems) => {
  if (!comboItems || comboItems.length === 0) return [];
  const colorArrays = comboItems.map(item => {
    let colors = item.variantMapping?.allowedColors || [];
    if (colors.length === 0) colors = ['default'];
    return colors;
  });

  const combine = (arrays) => {
    if (arrays.length === 0) return [[]];
    const rest = combine(arrays.slice(1));
    return arrays[0].flatMap(x => rest.map(y => [x, ...y]));
  };

  const combinations = combine(colorArrays);
  return combinations.map((comb, idx) => {
    const selections = {};
    comb.forEach((color, i) => {
      selections[i] = { color: color === 'default' ? '' : color };
    });
    const naming = comb.filter(c => c !== 'default');
    return {
      id: `combo_var_${idx}`,
      name: naming.length > 0 ? naming.join(' - ') : 'Por defecto',
      comboSelections: selections
    };
  });
};
