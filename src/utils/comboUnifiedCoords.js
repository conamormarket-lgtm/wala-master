/**
 * Conversión de coordenadas entre imagen unificada del combo y coordenadas por ítem (%).
 * itemBounds: array de { x, y, width, height } en píxeles dentro de la imagen compuesta.
 * totalWidth, totalHeight: dimensiones de la imagen compuesta.
 */

/**
 * Convierte bounds en píxeles a % del total (0-100).
 * @param {number} totalWidth
 * @param {number} totalHeight
 * @param {Array<{ x: number, y: number, width: number, height: number }>} itemBounds
 * @returns {Array<{ xPct: number, yPct: number, widthPct: number, heightPct: number }>}
 */
export function itemBoundsToPct(totalWidth, totalHeight, itemBounds) {
  if (!totalWidth || !totalHeight || !itemBounds?.length) return [];
  return itemBounds.map((b) => ({
    xPct: (100 * b.x) / totalWidth,
    yPct: (100 * b.y) / totalHeight,
    widthPct: (100 * b.width) / totalWidth,
    heightPct: (100 * b.height) / totalHeight
  }));
}

/**
 * Zona en % de la imagen unificada -> zona en % de la imagen del ítem.
 * @param {Object} zone - { x, y, width, height, ... } en % (0-100) de la imagen unificada
 * @param {number} itemIndex
 * @param {Array<{ xPct, yPct, widthPct, heightPct }>} boundsPct
 * @returns {Object} zona con x, y, width, height en % de la imagen del ítem (sin itemIndex)
 */
export function unifiedZoneToItemZone(zone, itemIndex, boundsPct) {
  const b = boundsPct[itemIndex];
  if (!b || b.widthPct <= 0 || b.heightPct <= 0) return { ...zone };

  const ux = Number(zone.x) ?? 0;
  const uy = Number(zone.y) ?? 0;
  const uw = Number(zone.width) ?? 80;
  const uh = Number(zone.height) ?? 80;

  const ix = ((ux - b.xPct) / b.widthPct) * 100;
  const iy = ((uy - b.yPct) / b.heightPct) * 100;
  const iw = (uw / b.widthPct) * 100;
  const ih = (uh / b.heightPct) * 100;

  const { itemIndex: _removed, ...rest } = zone;
  return {
    ...rest,
    x: ix,
    y: iy,
    width: iw,
    height: ih
  };
}

/**
 * Zona en % de la imagen del ítem -> zona en % de la imagen unificada.
 * @param {Object} zone - { x, y, width, height, ... } en % de la imagen del ítem
 * @param {number} itemIndex
 * @param {Array<{ xPct, yPct, widthPct, heightPct }>} boundsPct
 * @returns {Object} zona con x, y, width, height en % unificado y itemIndex
 */
export function itemZoneToUnifiedZone(zone, itemIndex, boundsPct) {
  const b = boundsPct[itemIndex];
  if (!b) return { ...zone, itemIndex };

  const ix = Number(zone.x) ?? 0;
  const iy = Number(zone.y) ?? 0;
  const iw = Number(zone.width) ?? 80;
  const ih = Number(zone.height) ?? 80;

  const ux = b.xPct + (ix / 100) * b.widthPct;
  const uy = b.yPct + (iy / 100) * b.heightPct;
  const uw = (iw / 100) * b.widthPct;
  const uh = (ih / 100) * b.heightPct;

  return {
    ...zone,
    x: ux,
    y: uy,
    width: uw,
    height: uh,
    itemIndex
  };
}

export function getItemIndexForUnifiedZone(zone, boundsPct) {
  if (!boundsPct || boundsPct.length === 0) return 0;
  const cx = (Number(zone.x) ?? 0) + (Number(zone.width) ?? 0) / 2;
  const cy = (Number(zone.y) ?? 0) + (Number(zone.height) ?? 0) / 2;

  let closestIndex = 0;
  let minDistance = Infinity;

  for (let i = 0; i < boundsPct.length; i++) {
    const b = boundsPct[i];
    // Check if it's inside
    if (
      cx >= b.xPct &&
      cx <= b.xPct + b.widthPct &&
      cy >= b.yPct &&
      cy <= b.yPct + b.heightPct
    ) {
      return i; // Found exact match
    }

    // Calculate distance to the center of the bounds
    const centerB_X = b.xPct + b.widthPct / 2;
    const centerB_Y = b.yPct + b.heightPct / 2;
    const dist = Math.pow(cx - centerB_X, 2) + Math.pow(cy - centerB_Y, 2);

    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }

  // Devolvemos el más cercano, que es lo más robusto para combos pequeños
  return closestIndex;
}
