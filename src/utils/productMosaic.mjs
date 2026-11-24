const integer = (value, min, max, fallback) => Number.isInteger(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;

export const MOSAIC_ROW_RATIOS = { square: 1, portrait: 5 / 4, portrait34: 4 / 3, story: 16 / 9, landscape: 9 / 16 };
export const MEDIA_RATIO_OPTIONS = ['inherit', 'auto', ...Object.keys(MOSAIC_ROW_RATIOS)];
export const MEDIA_FIT_OPTIONS = ['inherit', 'contain', 'cover'];

export function mediaAppearanceStyle(media) {
  return {
    ...(hasOwnMediaRatio(media) ? { '--altura-minima-video': '0px' } : {}),
    ...(media.ratio === 'auto' ? { '--proporcion': 'auto' } : MOSAIC_ROW_RATIOS[media.ratio] ? { '--proporcion': String(1 / MOSAIC_ROW_RATIOS[media.ratio]) } : {}),
    ...(MEDIA_FIT_OPTIONS.includes(media.fit) && media.fit !== 'inherit' ? { '--ajuste': media.fit } : {}),
  };
}

export const hasOwnMediaRatio = media => MEDIA_RATIO_OPTIONS.includes(media.ratio) && media.ratio !== 'inherit';

// Automatic row placement keeps cells from overlapping, even after reordering.
export function mosaicCell(value = {}, columns = 4, mobileColumns = 1) {
  columns = integer(columns, 1, 6, 3);
  mobileColumns = integer(mobileColumns, 1, 2, 1);
  const width = integer(value.width, 1, columns, 1);
  const mobileWidth = integer(value.mobileWidth, 1, mobileColumns, 1);
  return {
    width, height: integer(value.height, 1, 4, 1),
    column: integer(value.column, 0, columns - width + 1, 0),
    mobileWidth, mobileHeight: integer(value.mobileHeight, 1, 3, 1),
  };
}

export function mosaicStyle(media, block) {
  const c = mosaicCell(media.cell, block.columns, block.mobileColumns);
  return { '--cell-column': `${c.column || 'auto'} / span ${c.width}`, '--cell-row': `span ${c.height}`,
    '--cell-mobile-column': `span ${c.mobileWidth}`, '--cell-mobile-row': `span ${c.mobileHeight}`,
    '--cell-height': c.height, '--cell-mobile-height': c.mobileHeight };
}

export function flexibleMosaic(block) {
  return { ...block, mosaicLayout: 'flexible', mosaicSizing: 'proportional', ratio: !block.ratio || block.ratio === 'auto' ? 'portrait34' : block.ratio, columns: 3, rowHeight: 200,
    media: block.media.map((m, i) => ({ ...m, cell: { width: i === 0 ? 2 : 1, height: i === 0 ? 2 : 1, column: 0, mobileWidth: 1, mobileHeight: 1 } })) };
}
