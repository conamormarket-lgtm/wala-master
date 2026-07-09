// ─────────────────────────────────────────────────────────────────────────────
// Slugs de la landing del reloj K-CHERO.
//
// El slug original era `reloj-matador-pro-2026`. Al renombrar la marca a K-CHERO
// cambiamos la URL a `reloj-kchero-2026`, pero conservamos el LEGACY para:
//   1) redirigir los links viejos (anuncios, compartidos) al nuevo,
//   2) que los overrides de TiendaPage sigan aplicando si algún doc antiguo
//      todavía se renderiza.
// ─────────────────────────────────────────────────────────────────────────────

/** Slug actual de la landing y del producto. */
export const KCHERO_SLUG = 'reloj-kchero-2026';

/** Slug antiguo (se redirige al actual). */
export const KCHERO_SLUG_LEGACY = 'reloj-matador-pro-2026';

/** True si el slug corresponde a la landing del reloj K-CHERO (nueva o antigua). */
export const isKcheroLanding = (slug) =>
  slug === KCHERO_SLUG || slug === KCHERO_SLUG_LEGACY;

export default KCHERO_SLUG;
