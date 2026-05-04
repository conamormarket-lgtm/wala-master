
const fs = require('fs');
let text = fs.readFileSync('src/services/products.js', 'utf-8');

const regex = /function normalizeProductPayload\(data\)\s*\{[\s\S]*$/;
text = text.replace(regex, '');

const normalizeProductPayloadStr = \unction normalizeProductPayload(data) {
  const customizationViews = Array.isArray(data.customizationViews)
    ? data.customizationViews.map(normalizeCustomizationView).filter(Boolean)
    : [];
  const productCliparts = Array.isArray(data.productCliparts)
    ? data.productCliparts.map(normalizeProductClipart).filter(Boolean)
    : [];

  const categories = Array.isArray(data.categories)
    ? data.categories.filter(Boolean)
    : data.category
      ? [data.category]
      : [];

  const collections = Array.isArray(data.collections)
    ? data.collections.filter(Boolean).map(c => String(c).trim()).filter(Boolean)
    : [];

  const price = typeof data.price === 'number' ? data.price : parseFloat(data.price) || 0;
  const salePrice = data.salePrice !== undefined && data.salePrice !== null && data.salePrice !== ''
    ? (typeof data.salePrice === 'number' ? data.salePrice : parseFloat(data.salePrice))
    : null;
  const finalSalePrice = salePrice !== null && salePrice < price ? salePrice : null;

  const isComboProduct = Boolean(data.isComboProduct);
  const comboLayout = isComboProduct ? normalizeComboLayout(data.comboLayout) : null;
  const comboItems = isComboProduct && Array.isArray(data.comboItems)
    ? data.comboItems.map((item, index) => normalizeComboItem(item, index)).filter(Boolean)
    : [];

  const hasVariants = Boolean(data.hasVariants);
  const mainImage = hasVariants ? '' : String(data.mainImage ?? '');
  const mainSizes = hasVariants ? [] : (Array.isArray(data.mainSizes) ? data.mainSizes : []);
  const variants = hasVariants && Array.isArray(data.variants)
    ? data.variants.map((item, i) => normalizeVariantItem(item, i)).filter(Boolean)
    : [];

  const validBehaviors = ['default_only', 'after_impressions', 'by_engagement', 'both'];
  const variantDisplayBehavior = validBehaviors.includes(data.variantDisplayBehavior)
    ? data.variantDisplayBehavior
    : 'default_only';
  const defaultVariantId =
    data.defaultVariantId && typeof data.defaultVariantId === 'string'
      ? data.defaultVariantId
      : variants.length > 0
        ? variants[0].id
        : '';
  const behaviorImpressionsThreshold =
    typeof data.behaviorImpressionsThreshold === 'number' && data.behaviorImpressionsThreshold >= 1
      ? data.behaviorImpressionsThreshold
      : 3;

  const images = hasVariants && variants.length > 0
    ? [variants[0].imageUrl].filter(Boolean)
    : (mainImage ? [mainImage] : []);

  const imagesByColor = {};
  if (hasVariants && variants.length > 0) {
    variants.forEach((v) => {
      if (v.imageUrl) imagesByColor[v.name] = [v.imageUrl];
    });
  } else if (mainImage) {
    imagesByColor.default = mainImage;
  }

  // Productos combo nuevos deben aparecer en tienda: visible true por defecto
  const visible = data.visible !== false;

  const payload = {
    name: (data.name ?? '').toString().trim() || (isComboProduct ? 'Combo' : 'Sin nombre'),
    categories: categories.length ? categories : [],
    collections: collections.length ? collections : [],
    price,
    salePrice: finalSalePrice,
    images: images.length ? images : [],
    imagesByColor: Object.keys(imagesByColor).length ? imagesByColor : {},
    description: (data.description ?? '').toString(),
    inStock: typeof data.inStock === 'number' ? data.inStock : parseInt(data.inStock, 10) || 0,
    customizable: Boolean(data.customizable),
    hasVariants: Boolean(hasVariants),
    mainImage: isComboProduct ? '' : mainImage,
    mainSizes: isComboProduct ? [] : mainSizes,
    variants: variants,
    defaultVariantId: defaultVariantId,
    variantDisplayBehavior,
    behaviorImpressionsThreshold,
    customizationViews,
    productCliparts,
    featured: Boolean(data.featured),
    featuredOrder: typeof data.featuredOrder === 'number' ? data.featuredOrder : (parseInt(data.featuredOrder, 10) || 0),
    visible,
    isComboProduct,
    ...(isComboProduct && comboLayout && { comboLayout }),
    ...(isComboProduct && comboItems.length > 0 && { comboItems }),
    ...(data.comboPreviewImage && { comboPreviewImage: String(data.comboPreviewImage) }),
    ...(data.thumbnailWithDesignUrl && { thumbnailWithDesignUrl: String(data.thumbnailWithDesignUrl) }),
    ...(isComboProduct && Array.isArray(data.comboItemCustomization) && data.comboItemCustomization.length > 0 && {
      comboItemCustomization: data.comboItemCustomization.map((c) => ({
        productId: String(c.productId ?? ''),
        viewId: String(c.viewId ?? ''),
        printAreas: Array.isArray(c.printAreas) ? c.printAreas.map((a) => ({
          id: a.id,
          shape: a.shape || 'rectangle',
          x: Number(a.x) ?? 10,
          y: Number(a.y) ?? 10,
          width: Number(a.width) ?? 80,
          height: Number(a.height) ?? 80,
          rotation: Number(a.rotation) ?? 0,
          skewX: Number(a.skewX) ?? 0,
          skewY: Number(a.skewY) ?? 0,
          ...(a.customShapeId && { customShapeId: String(a.customShapeId) }),
          ...(a.freeDrawPath && { freeDrawPath: String(a.freeDrawPath) })
        })) : [],
        initialLayersByColor: c.initialLayersByColor && typeof c.initialLayersByColor === 'object'
          ? Object.fromEntries(Object.entries(c.initialLayersByColor).map(([color, layers]) => [
              color,
              Array.isArray(layers) ? layers.map(normalizeLayer).filter(Boolean) : []
            ]))
          : { default: [] },
        ...(c.backSide ? {
          backSide: {
            initialLayersByColor: c.backSide.initialLayersByColor && typeof c.backSide.initialLayersByColor === 'object'
              ? Object.fromEntries(Object.entries(c.backSide.initialLayersByColor).map(([color, layers]) => [
                  color,
                  Array.isArray(layers) ? layers.map(normalizeLayer).filter(Boolean) : []
                ]))
              : { default: [] },
            printAreas: Array.isArray(c.backSide.printAreas) ? c.backSide.printAreas.map((a) => ({
              id: a.id,
              shape: a.shape || 'rectangle',
              x: Number(a.x) ?? 10,
              y: Number(a.y) ?? 10,
              width: Number(a.width) ?? 80,
              height: Number(a.height) ?? 80,
              rotation: Number(a.rotation) ?? 0,
              skewX: Number(a.skewX) ?? 0,
              skewY: Number(a.skewY) ?? 0,
              ...(a.customShapeId && { customShapeId: String(a.customShapeId) }),
              ...(a.freeDrawPath && { freeDrawPath: String(a.freeDrawPath) })
            })) : []
          }
        } : {})
      }))
    })
  };
  return payload;
}\n\;

fs.writeFileSync('src/services/products.js', text + '\n' + normalizeProductPayloadStr);
console.log('Fixed via regex replacing everything after normalizeProductPayload!');

