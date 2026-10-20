import { updateProductField } from './products';

/**
 * Los productos de la tienda ya no se personalizan (2026-10-20): eso es Crear.
 * Esto pasa a "normales" los que tenían la personalización de antes (el
 * editor viejo: customizable / customizationViews; o Yoryo:
 * YoryoPersonalizado, también dentro de un combo). A las esclavas se les
 * agrega a la descripción que la pidan personalizada por WhatsApp.
 * Lo corre el admin con un botón en Productos (no se cambia nada solo).
 */

export const NOTA_ESCLAVA = '¿La quieres personalizada? Escríbenos por el botón de WhatsApp y la personalizamos para ti.';
const NOTA_ESCLAVA_HTML = `<p><strong>¿La quieres personalizada?</strong> Escríbenos por el botón de WhatsApp y la personalizamos para ti.</p>`;

const conYoryo = (p) => Boolean(p?.YoryoPersonalizado)
  || (p?.comboItems || []).some((i) => Boolean(i?.YoryoPersonalizado));

/** ¿Tiene todavía la personalización de antes? (las prendas de Crear no cuentan). */
export const tienePersonalizacionVieja = (p) => p?.esPrendaBase !== true && p?.deleted !== true && (
  p?.customizable === true
  || (p?.customizationViews || []).length > 0
  || conYoryo(p)
  || (p?.comboItems || []).some((i) => i?.customizable === true)
);

/**
 * Una esclava (o un combo que trae una): "esclava" o "Yoryo" (su marca) en el
 * nombre del producto o de una pieza del combo. No basta con tener el campo
 * YoryoPersonalizado: la ficha del admin lo escribía (vacío) al guardar
 * cualquier producto personalizable.
 */
const ESCLAVA = /esclava|yoryo/i;
export const esEsclava = (p) => ESCLAVA.test(p?.name || '')
  || (p?.comboItems || []).some((i) => ESCLAVA.test(i?.name || ''));

/** Lo pasa a normal. Devuelve { error }. */
export const quitarPersonalizacionVieja = async (p) => {
  const cambios = {
    customizable: false,
    // null y [] borran el campo (updateDocument).
    customizationViews: [],
    YoryoPersonalizado: null,
  };
  if ((p.comboItems || []).some((i) => i?.customizable || i?.YoryoPersonalizado)) {
    cambios.comboItems = p.comboItems.map((i) => {
      const { YoryoPersonalizado, ...resto } = i || {};
      return { ...resto, customizable: false };
    });
  }
  const descripcion = p.description || '';
  if (esEsclava(p) && !descripcion.includes('¿La quieres personalizada?')) {
    cambios.description = `${descripcion}${NOTA_ESCLAVA_HTML}`;
  }
  try {
    await updateProductField(p.id, cambios);
    return { error: null };
  } catch (e) {
    return { error: e?.message || String(e) };
  }
};
