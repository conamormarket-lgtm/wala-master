// Generated from wala-mobile. Regenerate with export-payment-domain.mjs.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SELECTION_QUANTITY = void 0;
exports.pieceVariants = pieceVariants;
exports.variantFor = variantFor;
exports.sizesFor = sizesFor;
exports.initialSelection = initialSelection;
exports.sharedSizes = sharedSizes;
exports.selectVariant = selectVariant;
exports.reconcileSelection = reconcileSelection;
exports.selectionGallery = selectionGallery;
exports.resolveSelection = resolveSelection;
exports.selectionFromChosen = selectionFromChosen;
exports.assertQuantity = assertQuantity;
const app_error_1 = require("./app-error");
exports.MAX_SELECTION_QUANTITY = 10;
const normal = (value) => value.trim().toLocaleLowerCase('es');
function pieceVariants(piece) {
    const variants = piece.product?.variants ?? [];
    return piece.allowedColors.length ? variants.filter((variant) => piece.allowedColors.some((color) => normal(color) === normal(variant.name))) : variants;
}
function variantFor(product, variantId) {
    return product.variants.find((variant) => variant.id === variantId);
}
function sizesFor(product, variantId) {
    const variant = variantFor(product, variantId);
    return variant?.sizes.length ? variant.sizes : product.sizes;
}
function initialSelection(product) {
    return { variantId: product.defaultVariantId, size: null, pieces: Object.fromEntries((product.combo?.pieces ?? []).map((piece) => {
            const variants = pieceVariants(piece);
            const preferred = variants.find((variant) => normal(variant.name) === normal(piece.defaultColor ?? ''))
                ?? variants.find((variant) => variant.id === piece.product?.defaultVariantId) ?? variants[0];
            return [piece.key, { variantId: preferred?.id ?? null, size: null }];
        })) };
}
function sharedSizes(product, selection) {
    const lists = (product.combo?.pieces ?? []).flatMap((piece) => {
        const sizes = piece.product ? sizesFor(piece.product, selection.pieces[piece.key]?.variantId ?? null) : [];
        return sizes.length ? [sizes] : [];
    });
    // A shared size must exist in EVERY sized piece; never offer a union of incompatible sizes.
    return lists.length ? lists[0].filter((size) => lists.every((sizes) => sizes.includes(size))) : [];
}
function selectVariant(product, selection, id, pieceKey) {
    if (!pieceKey)
        return { ...selection, variantId: id, size: sizesFor(product, id).includes(selection.size ?? '') ? selection.size : null };
    const piece = product.combo?.pieces.find((item) => item.key === pieceKey);
    if (!piece?.product || !pieceVariants(piece).some((variant) => variant.id === id))
        return selection;
    const previous = selection.pieces[pieceKey];
    const next = { ...selection, pieces: { ...selection.pieces, [pieceKey]: { variantId: id,
                size: sizesFor(piece.product, id).includes(previous?.size ?? '') ? previous.size : null } } };
    return { ...next, size: sharedSizes(product, next).includes(selection.size ?? '') ? selection.size : null };
}
function reconcileSelection(product, current) {
    const defaults = initialSelection(product);
    const variantId = product.variants.some((variant) => variant.id === current.variantId) ? current.variantId : defaults.variantId;
    const pieces = Object.fromEntries((product.combo?.pieces ?? []).map((piece) => {
        const previous = current.pieces[piece.key];
        const variantId = pieceVariants(piece).some((variant) => variant.id === previous?.variantId) ? previous.variantId : defaults.pieces[piece.key].variantId;
        const size = piece.product && sizesFor(piece.product, variantId).includes(previous?.size ?? '') ? previous.size : null;
        return [piece.key, { variantId, size }];
    }));
    const next = { variantId, size: current.size, pieces };
    return { ...next, size: (product.combo ? sharedSizes(product, next) : sizesFor(product, variantId)).includes(current.size ?? '') ? current.size : null };
}
function uniqueImages(images) {
    return [...new Map(images.map((image) => [image.id, image])).values()];
}
function ownGallery(product, variantId) {
    const variant = variantFor(product, variantId);
    if (!variant)
        return product.variants.length ? [] : product.images;
    const own = new Set(variant.images.map((image) => image.id));
    const other = new Set(product.variants.filter((item) => item.id !== variant.id).flatMap((item) => item.images.map((image) => image.id)).filter((id) => !own.has(id)));
    return uniqueImages([...variant.images, ...product.images.filter((image) => !other.has(image.id))]);
}
function selectionGallery(product, selection) {
    if (!product.combo)
        return ownGallery(product, selection.variantId);
    return uniqueImages([...product.images, ...product.combo.pieces.flatMap((piece) => {
            const images = piece.product ? ownGallery(piece.product, selection.pieces[piece.key]?.variantId ?? null) : [];
            return images.length ? images : piece.imageUrl && (!piece.product || !piece.product.variants.length)
                ? [{ id: piece.imageUrl, url: piece.imageUrl, thumbnailUrl: piece.imageUrl }] : [];
        })]);
}
function choose(product, selection, variants = product.variants, label = product.name) {
    let variant = variants.find((item) => item.id === selection.variantId);
    if (!variant && !selection.variantId && variants.length === 1)
        variant = variants[0];
    if (variants.length && !variant)
        throw new app_error_1.AppError('validation', `Elige un color o modelo válido para ${label}.`);
    if (!variants.length && selection.variantId)
        throw new app_error_1.AppError('validation', 'Las opciones cambiaron. Revisa tu selección.');
    const sizes = variant?.sizes.length ? variant.sizes : product.sizes;
    if (sizes.length && !sizes.includes(selection.size ?? ''))
        throw new app_error_1.AppError('validation', `Elige ${variant?.sizeLabel ?? product.sizeLabel} para ${label}.`);
    if (!sizes.length && selection.size)
        throw new app_error_1.AppError('validation', 'Las opciones cambiaron. Revisa tu selección.');
    return { variantId: variant?.id ?? null, variantName: variant?.name ?? null, size: sizes.length ? selection.size : null };
}
function resolveSelection(product, selection) {
    if (product.configurationIssue)
        throw new app_error_1.AppError('validation', product.configurationIssue);
    const current = selection ?? { variantId: null, size: null, pieces: {} };
    if (!product.combo)
        return { ...choose(product, current), pieces: [], imageUrl: selectionGallery(product, { ...current, variantId: current.variantId ?? (product.variants.length === 1 ? product.variants[0].id : null) })[0]?.url ?? null };
    if (!product.combo.pieces.length)
        throw new app_error_1.AppError('validation', 'Este combo no está disponible por ahora.');
    if (product.combo.sizeMode === 'shared' && product.combo.pieces.every((piece) => piece.product)
        && product.combo.pieces.some((piece) => sizesFor(piece.product, current.pieces[piece.key]?.variantId ?? null).length > 0)
        && !sharedSizes(product, current).length)
        throw new app_error_1.AppError('validation', 'Las prendas no comparten una talla con estos colores. Elige otra combinación de colores.');
    const pieces = product.combo.pieces.map((piece) => {
        if (!piece.product || piece.product.combo || piece.product.configurationIssue)
            throw new app_error_1.AppError('validation', `No pudimos confirmar las opciones de ${piece.name}.`);
        const variants = pieceVariants(piece);
        if (piece.product.variants.length && !variants.length)
            throw new app_error_1.AppError('validation', `No hay colores disponibles para ${piece.name}.`);
        const chosen = current.pieces[piece.key] ?? { variantId: null, size: null };
        const sizes = sizesFor(piece.product, chosen.variantId);
        const size = product.combo?.sizeMode === 'shared' ? sizes.length ? current.size : null : chosen.size;
        return { key: piece.key, productId: piece.productId, name: piece.name, ...choose(piece.product, { ...chosen, size }, variants, piece.name) };
    });
    return { variantId: null, variantName: null, size: null, pieces, imageUrl: selectionGallery(product, current)[0]?.url ?? null };
}
function selectionFromChosen(options) {
    const sizes = options.pieces.map((piece) => piece.size).filter(Boolean);
    return { variantId: options.variantId, size: options.size ?? (sizes.length && sizes.every((size) => size === sizes[0]) ? sizes[0] : null),
        pieces: Object.fromEntries(options.pieces.map((piece) => [piece.key, { variantId: piece.variantId, size: piece.size }])) };
}
function assertQuantity(product, quantity, alreadyInCart = 0) {
    if (!product.available)
        throw new app_error_1.AppError('validation', 'Este producto no está disponible por ahora.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > exports.MAX_SELECTION_QUANTITY)
        throw new app_error_1.AppError('validation', `Elige una cantidad entre 1 y ${exports.MAX_SELECTION_QUANTITY}.`);
    if (product.stock !== null && quantity + alreadyInCart > product.stock)
        throw new app_error_1.AppError('validation', `Solo quedan ${product.stock} unidades de este producto. Revisa las cantidades de tu carrito.`);
}
