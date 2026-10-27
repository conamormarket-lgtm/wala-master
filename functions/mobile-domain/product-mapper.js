// Generated from wala-mobile. Regenerate with export-payment-domain.mjs.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapProduct = mapProduct;
const app_error_1 = require("./app-error");
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];
const text = (value) => typeof value === 'string' ? value.trim() : '';
const strings = (value) => [...new Set(array(value).map((item) => typeof item === 'number' && Number.isFinite(item) ? String(item) : text(item)).filter(Boolean))];
const normal = (value) => value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const colors = { blanco: '#ffffff', negro: '#000000', rojo: '#e3000f', azul: '#0055a4', 'azul marino': '#000080',
    verde: '#008000', amarillo: '#ffd700', naranja: '#ffa500', rosado: '#ffc0cb', rosa: '#ffc0cb', gris: '#808080',
    'gris jaspe': '#a9a9a9', plomo: '#696969', celeste: '#87ceeb', morado: '#800080', lila: '#c8a2c8', marron: '#8b4513',
    beige: '#f5f5dc', vino: '#722f37', turquesa: '#40e0d0', guinda: '#722f37', 'melange 3%': '#cccccc' };
function url(value) {
    const result = typeof value === 'string' ? value.trim() : text(object(value).url ?? object(value).imageUrl);
    try {
        const parsed = new URL(result);
        return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !result.includes('placeholder') ? result : null;
    }
    catch {
        return null;
    }
}
function photos(values, copies) {
    return [...new Set(values.map(url).filter((item) => !!item))].slice(0, 50).map((original) => {
        const variants = object(copies[original]);
        return { id: original, url: url(variants['800']) ?? original, thumbnailUrl: url(variants['160']) ?? url(variants['400']) ?? original };
    });
}
function viewsForColor(data, color) {
    const from = (map) => Object.entries(object(map)).filter(([name]) => normal(name) === normal(color)).flatMap(([, value]) => Array.isArray(value) ? value : [value]);
    return array(data.customizationViews).flatMap((value) => {
        const view = object(value);
        return [...from(view.imagesByColor), ...(view.hasBackSide ? from(object(view.backSide).imagesByColor) : [])];
    });
}
function numeric(value) {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1_000_000 ? parsed : null;
}
function mapProduct(id, data, options = {}) {
    if ((!options.component && data.visible === false) || data.deleted === true || data.esPrendaBase === true || data.esComboCrear === true)
        return null;
    const name = text(data.name);
    const price = numeric(data.price);
    if (!id || id.includes('/') || !name || price === null)
        throw new app_error_1.AppError('unexpected', 'Un producto tiene datos incompletos.');
    const sale = numeric(data.salePrice);
    const amount = sale !== null && sale > 0 && sale < price ? sale : price;
    const sizes = strings(data.mainSizes ?? data.sizes);
    const comboRows = array(data.comboItems);
    const isCombo = data.isComboProduct === true || comboRows.length > 0;
    let issue = null;
    if (data.mainSizes != null && !Array.isArray(data.mainSizes))
        issue = 'Las opciones de este producto no están disponibles por ahora.';
    const legacy = object(data.variants);
    const legacyColors = strings(legacy.colors);
    let rows = array(data.variants);
    if (!rows.length && legacyColors.length)
        rows = legacyColors.map((color) => ({ id: `legacy:${color}`, name: color,
            sizes: legacy.sizes, images: array(object(data.imagesByColor)[color]).length ? object(data.imagesByColor)[color] : [object(data.imagesByColor)[color]] }));
    const hasVariants = !isCombo && (data.hasVariants === true || legacyColors.length > 0 || (data.hasVariants !== false && rows.length > 0));
    const variants = hasVariants ? rows.slice(0, 128).flatMap((value, index) => {
        const row = object(value);
        const variantName = text(row.name);
        if (row.sizes != null && !Array.isArray(row.sizes))
            issue = 'Las opciones de este producto no están disponibles por ahora.';
        if (!variantName) {
            issue = 'Las opciones de este producto no están disponibles por ahora.';
            return [];
        }
        const rawHex = text(row.colorHex) || colors[normal(variantName)] || variantName;
        return [{ id: text(row.id) || `legacy:${variantName}:${index}`, name: variantName,
                colorHex: /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(rawHex) ? rawHex : null,
                sizes: strings(row.sizes), sizeLabel: text(row.sizeLabel) || text(data.sizeLabel) || 'Talla',
                images: photos([...viewsForColor(data, variantName), row.imageUrl, ...array(row.images), ...array(row.galleryImages)], { ...object(data.imagesVariantes), ...object(row.imagesVariantes) }) }];
    }) : [];
    if (hasVariants && (!variants.length || rows.length > 128 || new Set(variants.map((variant) => variant.id)).size !== variants.length)) {
        issue = 'Las opciones de este producto no están disponibles por ahora.';
    }
    const general = photos([data.mainImage, ...array(data.images), ...array(data.galleryImages)], object(data.imagesVariantes));
    const pieces = comboRows.slice(0, 12).map((value, index) => {
        const row = object(value);
        const mapping = object(row.variantMapping);
        const productId = text(row.productId);
        if (!productId || productId.includes('/'))
            issue = 'No pudimos confirmar las piezas de este combo.';
        return { key: `piece-${index}`, productId, name: text(row.name) || `Pieza ${index + 1}`, imageUrl: url(row.imageUrl),
            allowedColors: strings(mapping.allowedColors), defaultColor: text(mapping.color) || null };
    });
    if (isCombo && (!pieces.length || comboRows.length > 12))
        issue = 'No pudimos confirmar las piezas de este combo.';
    const cover = isCombo ? url(data.comboPreviewImage) : null;
    const images = isCombo ? photos([cover, ...general.map((image) => image.id)], object(data.imagesVariantes)) : general;
    const defaultVariantId = variants.find((variant) => variant.id === data.defaultVariantId)?.id ?? variants[0]?.id ?? null;
    const primary = variants.find((variant) => variant.id === defaultVariantId)?.images[0] ?? images[0];
    const stockValue = numeric(data.inStock);
    const stock = data.inStock === false ? 0 : stockValue === null ? null : Math.floor(stockValue);
    // productType/categoryId are Firestore references, never customer-facing labels.
    const category = text(data.categoryLabel) || 'Productos';
    const description = text(data.description).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
    return { id, name, description, sku: text(data.sku), price: Math.round(amount * 100) / 100, regularPrice: Math.round(price * 100) / 100,
        category, imageUrl: primary?.url ?? pieces[0]?.imageUrl ?? null, images, variants, defaultVariantId, sizes,
        sizeLabel: text(data.sizeLabel) || variants.find((variant) => variant.sizeLabel)?.sizeLabel || 'Talla', stock,
        available: data.active !== false && (data.inStock === true || (stock !== null && stock > 0)),
        requiresConfiguration: !!isCombo || variants.length > 1 || variants.some((variant) => variant.sizes.length > 0) || sizes.length > 0 || !!issue,
        configurationIssue: issue, combo: isCombo ? { sizeMode: data.comboTallas === 'una' ? 'shared' : 'per-piece', pieces } : null,
        searchTerms: normal([name, category, text(data.sku), ...strings(data.tags)].join(' ')) };
}
