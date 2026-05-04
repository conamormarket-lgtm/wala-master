import React, { useState, useEffect } from 'react';
import { getProduct } from '../../../../services/products';
import { ensureSingleImageUrl } from '../../../../utils/imageUrl';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { generateThumbnailWithDesign } from '../../../../utils/thumbnailWithDesign';
import { getCloudinaryOptimized } from '../../../../components/common/OptimizedImage/OptimizedImage';
import { getFonts } from '../../../../services/fonts';
import styles from './ComboProductImage.module.css';

function getBestImageUrl(product, item, variantSelection = {}, comboCustom = null) {
    if (!product) return '';
    const displayColor = item?.variantMapping?.color || variantSelection?.color || '';
    const cleanedColor = displayColor ? displayColor.trim().toLowerCase() : '';

    let exactMatchUrl = '';
    let defaultFallbackUrl = '';

    if (comboCustom && comboCustom.imagesByColor) {
        const keys = Object.keys(comboCustom.imagesByColor);
        if (cleanedColor) {
            const matchKey = keys.find(k => k.trim() === displayColor.trim()) ||
                             keys.find(k => k.trim().toLowerCase() === cleanedColor);
            if (matchKey) exactMatchUrl = ensureSingleImageUrl(comboCustom.imagesByColor[matchKey]);
        }
        if (!defaultFallbackUrl) defaultFallbackUrl = ensureSingleImageUrl(comboCustom.imagesByColor?.default);
    }

    if (!exactMatchUrl) {
        const view = product.customizationViews?.find(v => v.id === item?.viewId) || product.customizationViews?.[0];
        if (view && view.imagesByColor) {
            const keys = Object.keys(view.imagesByColor);
            if (cleanedColor) {
                const matchedColorKey = keys.find(k => k.trim() === displayColor.trim()) ||
                                        keys.find(k => k.trim().toLowerCase() === cleanedColor);
                if (matchedColorKey) exactMatchUrl = ensureSingleImageUrl(view.imagesByColor[matchedColorKey]);
            }
            if (!defaultFallbackUrl) defaultFallbackUrl = ensureSingleImageUrl(view.imagesByColor?.default);
        }
    }

    if (!exactMatchUrl && Array.isArray(product.variants) && product.variants.length > 0 && cleanedColor) {
        let matchingVariant = product.variants.find(v => (v.name || '').trim() === displayColor.trim()) ||
                              product.variants.find(v => (v.name || '').trim().toLowerCase() === cleanedColor);
        if (matchingVariant && matchingVariant.imageUrl) exactMatchUrl = ensureSingleImageUrl(matchingVariant.imageUrl);
        
        if (!defaultFallbackUrl) {
            const principalVariant = product.defaultVariantId
                ? product.variants.find(v => v.id === product.defaultVariantId)
                : null;
            defaultFallbackUrl = ensureSingleImageUrl(principalVariant?.imageUrl || product.variants[0]?.imageUrl);
        }
    }

    if (exactMatchUrl) return getCloudinaryOptimized(exactMatchUrl);

    if (!defaultFallbackUrl) {
        defaultFallbackUrl = ensureSingleImageUrl(product.mainImage || (Array.isArray(product.images) && product.images[0]) || '');
    }

    return defaultFallbackUrl ? getCloudinaryOptimized(defaultFallbackUrl) : '';
}

function getDesignLayers(comboItemCustomization, itemIndex, color) {
    const cust = (comboItemCustomization || [])[itemIndex];
    if (!cust || !cust.initialLayersByColor) return [];

    if (color) {
        const cleanedColor = color.trim().toLowerCase();
        const keys = Object.keys(cust.initialLayersByColor);
        const exactMatch = keys.find(k => k.trim() === color.trim());
        if (exactMatch) return cust.initialLayersByColor[exactMatch];

        const loweredMatch = keys.find(k => k.trim().toLowerCase() === cleanedColor);
        if (loweredMatch) return cust.initialLayersByColor[loweredMatch];
    }

    const colorKey = color || 'default';
    return cust.initialLayersByColor[colorKey]
        || cust.initialLayersByColor.default
        || [];
}

export function comboHasDesignLayers(comboItemCustomization) {
    if (!Array.isArray(comboItemCustomization)) return false;
    return comboItemCustomization.some(cust => {
        if (!cust?.initialLayersByColor) return false;
        return Object.values(cust.initialLayersByColor).some(
            layers => Array.isArray(layers) && layers.length > 0
        );
    });
}

const SafeSvgImage = ({ layer, imageHref, transform, opacity }) => {
    const filterId = React.useMemo(() => 
        layer.id ? `tint-${layer.id}` : `tint-${Math.random().toString(36).substring(2, 9)}`, 
    [layer.id]);

    return (
        <g transform={transform} opacity={opacity}>
            {layer.tintColor && (
                <defs>
                    <filter id={filterId} colorInterpolationFilters="sRGB">
                        <feFlood floodColor={layer.tintColor} floodOpacity={layer.tintOpacity ?? 1} result="color" />
                        <feComposite in="color" in2="SourceAlpha" operator="in" />
                    </filter>
                </defs>
            )}
            <g transform={layer.flipX || layer.flipY ? `translate(${(layer.width || 200) / 2}, ${(layer.height || (layer.width || 200)) / 2}) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1}) translate(${-(layer.width || 200) / 2}, ${-(layer.height || (layer.width || 200)) / 2})` : undefined}>
                <image
                    href={imageHref}
                    xlinkHref={imageHref}
                    x="0"
                    y="0"
                    width={layer.width || 200}
                    height={layer.height || (layer.width || 200)}
                    preserveAspectRatio="none"
                    filter={layer.tintColor ? `url(#${filterId})` : undefined}
                />
            </g>
        </g>
    );
};

const thumbnailCache = new Map();
const MAX_CACHE_SIZE = 150;
const CACHE_VERSION = 'v20_forced_dims';

export const NativeOverlay = ({ baseImageUrl, layers, isThumbnail = false }) => {
    const [dataUrl, setDataUrl] = useState(null);
    const [isGenerating, setIsGenerating] = useState(true);
    const validLayers = Array.isArray(layers) ? layers.filter(l => l && l.type) : [];

    const { data: customFonts, isLoading: loadingFonts } = useQuery({
        queryKey: ['fonts'],
        queryFn: async () => {
            const { data, error } = await getFonts();
            return error ? [] : data;
        }
    });

    const displayUrl = getCloudinaryOptimized(ensureSingleImageUrl(baseImageUrl));

    useEffect(() => {
        if (loadingFonts) return;

        let cancelled = false;
        if (!baseImageUrl) {
            setDataUrl('error');
            setIsGenerating(false);
            return;
        }

        const cacheKey = `${CACHE_VERSION}-${baseImageUrl}-${JSON.stringify(validLayers.map(l => ({
            id: l.id, type: l.type, src: l.src, text: l.text, color: l.color, 
            x: l.x, y: l.y, scaleX: l.scaleX, scaleY: l.scaleY, baseW: l.baseW
        })))}`;
        
        if (thumbnailCache.has(cacheKey)) {
            setDataUrl(thumbnailCache.get(cacheKey));
            setIsGenerating(false);
            return;
        }

        setIsGenerating(true);

        const fontFamilies = new Set();
        validLayers.forEach(l => {
            if (l.type === 'text' && l.fontFamily) {
                const clean = String(l.fontFamily).replace(/['"]/g, '').trim();
                l.fontFamily = clean;
                fontFamilies.add(clean);
            }
        });

        const loadFonts = async () => {
            const promises = [];
            for (const ff of fontFamilies) {
                const cf = (customFonts || []).find(f => (f.family || f.name || '').replace(/['"]/g, '').trim() === ff);
                if (cf && cf.url) {
                    try {
                        const face = new FontFace(ff, `url("${cf.url}")`);
                        document.fonts.add(face);
                        promises.push(face.load().catch(() => document.fonts.load(`16px "${ff}"`)));
                    } catch { promises.push(document.fonts.load(`16px "${ff}"`).catch(() => null)); }
                } else {
                    promises.push(document.fonts.load(`16px "${ff}"`).catch(() => null));
                }
            }
            await Promise.all(promises);
            await document.fonts.ready;
        };

        loadFonts().then(async () => {
            if (cancelled) return;
            try {
                const imageUrl = getCloudinaryOptimized(ensureSingleImageUrl(baseImageUrl));
                const url = await generateThumbnailWithDesign(imageUrl, validLayers, { maxWidth: 900 });
                if (!cancelled && url) {
                    if (thumbnailCache.size >= MAX_CACHE_SIZE) {
                        thumbnailCache.delete(thumbnailCache.keys().next().value);
                    }
                    thumbnailCache.set(cacheKey, url);
                    setDataUrl(url);
                }
            } catch (err) {
                console.error('Fabric generation failed:', err);
            }
            setIsGenerating(false);
        });

        return () => { cancelled = true; };
    }, [baseImageUrl, layers, loadingFonts]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
                src={displayUrl}
                alt="Producto"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    objectFit: 'contain',
                    opacity: dataUrl && dataUrl !== 'error' ? 0 : 1,
                    transition: 'opacity 0.3s ease'
                }}
                loading="eager"
                fetchpriority="high"
            />
            {dataUrl && dataUrl !== 'error' && (
                <img
                    src={dataUrl}
                    alt="Producto personalizado"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'block',
                        objectFit: 'contain',
                        opacity: 1,
                        transition: 'opacity 0.3s ease'
                    }}
                />
            )}
        </div>
    );
};

export const DomOverlay = ({ baseImageUrl, layers }) => {
    const validLayers = Array.isArray(layers) ? layers.filter(l => l && l.type) : [];
    const defaultBaseW = validLayers.find(l => l.baseW)?.baseW || 1200;
    const defaultBaseH = validLayers.find(l => l.baseH)?.baseH || 1200;

    return (
        <div style={{ position: 'relative', width: '100%', overflow: 'hidden', backgroundColor: 'transparent' }}>
            <img
                src={ensureSingleImageUrl(baseImageUrl)}
                alt="Product Container"
                style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain', zIndex: 1 }}
            />
            <svg
                viewBox={`0 0 ${defaultBaseW} ${defaultBaseH}`}
                preserveAspectRatio="none"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none', overflow: 'visible' }}
            >
                {validLayers.map((layer, idx) => {
                    const lBaseW = layer.baseW || defaultBaseW;
                    const lBaseH = layer.baseH || lBaseW;
                    const rX = defaultBaseW / lBaseW;
                    const rY = defaultBaseH / lBaseH;

                    const rawX = typeof layer.x === 'number' ? layer.x : 20;
                    const rawY = typeof layer.y === 'number' ? layer.y : 20;
                    const rawScaleX = layer.scaleX ?? 1;
                    const rawScaleY = layer.scaleY ?? 1;

                    const x = rawX * rX;
                    const y = rawY * rY;
                    const scaleX = rawScaleX * rX;
                    const scaleY = rawScaleY * rY;
                    const angle = layer.angle || 0;
                    const opacity = layer.opacity ?? 1;
                    const transform = `translate(${x}, ${y}) rotate(${angle}) scale(${scaleX}, ${scaleY})`;

                    const rawSrc = ensureSingleImageUrl(layer.src);
                    const imageHref = rawSrc.startsWith('blob:') ? rawSrc : rawSrc;

                    if (layer.type === 'image' && layer.src) {
                        return (
                            <SafeSvgImage
                                key={idx}
                                layer={layer}
                                imageHref={imageHref}
                                transform={transform}
                                opacity={opacity}
                            />
                        );
                    }

                    if (layer.type === 'text') {
                        const _fontSize = layer.fontSize || 40;
                        const lines = (layer.text || 'Texto').split('\n');
                        const lineHeight = layer.lineHeight || 1.16;
                        const textAlign = layer.textAlign || 'left';

                        const maxLineLen = lines.reduce((max, l) => Math.max(max, l.length), 0);
                        const w = layer.width || (maxLineLen * (_fontSize * 0.55));
                        const tAnchor = textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start';
                        const xPos = textAlign === 'center' ? w / 2 : textAlign === 'right' ? w : 0;

                        return (
                            <g key={idx} transform={transform} opacity={opacity}>
                                <g transform={layer.flipX || layer.flipY ? `translate(${w / 2}, ${(_fontSize * lines.length) / 2}) scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1}) translate(${-w / 2}, ${-(_fontSize * lines.length) / 2})` : undefined}>
                                    <text
                                        x={xPos}
                                        y={_fontSize * 0.8}
                                        fill={layer.color || '#000000'}
                                        fontSize={`${_fontSize}px`}
                                        fontFamily={layer.fontFamily || 'Arial'}
                                        fontWeight={layer.fontWeight || 'normal'}
                                        fontStyle={layer.fontStyle || 'normal'}
                                        textAnchor={tAnchor}
                                    >
                                        {lines.map((ln, i) => (
                                            <tspan x={xPos} dy={i === 0 ? 0 : `${lineHeight}em`} key={i}>{ln}</tspan>
                                        ))}
                                    </text>
                                </g>
                            </g>
                        );
                    }

                    if (layer.type === 'shape') {
                        const rawWidth = layer.width || 80;
                        const rawHeight = layer.height || 60;
                        const fill = layer.fill || '#000000';
                        const stroke = layer.stroke || 'none';
                        const strokeWidth = layer.strokeWidth || 0;

                        return (
                            <g key={idx} transform={transform} opacity={opacity}>
                                {layer.shapeType === 'circle' ? (
                                    <circle
                                        cx={layer.radius || 40}
                                        cy={layer.radius || 40}
                                        r={layer.radius || 40}
                                        fill={fill}
                                        stroke={stroke}
                                        strokeWidth={strokeWidth}
                                    />
                                ) : (
                                    <rect
                                        x="0"
                                        y="0"
                                        width={rawWidth}
                                        height={rawHeight}
                                        fill={fill}
                                        stroke={stroke}
                                        strokeWidth={strokeWidth}
                                    />
                                )}
                            </g>
                        );
                    }

                    return null;
                })}
            </svg>
        </div>
    );
};

const ComboProductImageWithDesign = ({
    comboProduct,
    className = '',
    isAboveFold = false,
    isThumbnail = false,
    variantSelections = {},
    renderSelector,
    onError
}) => {
    const queryClient = useQueryClient();
    const [itemsData, setItemsData] = useState([]);

    const { data: customFonts, isLoading: loadingFonts } = useQuery({
        queryKey: ['fonts'],
        queryFn: async () => {
            const { data, error } = await getFonts();
            return error ? [] : data;
        }
    });

    const comboItems = comboProduct?.comboItems || [];
    const comboLayout = comboProduct?.comboLayout || { orientation: 'horizontal', spacing: 20 };
    const comboItemCustomization = comboProduct?.comboItemCustomization || [];

    useEffect(() => {
        if (loadingFonts) return;

        if (comboItems.length === 0) {
            setItemsData([]);
            return;
        }

        let cancelled = false;

        const load = async () => {
            const data = [];
            for (let i = 0; i < comboItems.length; i++) {
                const item = comboItems[i];
                let product = queryClient.getQueryData(['product', item.productId]);
                if (!product) {
                    try {
                        const { data: p } = await getProduct(item.productId);
                        product = p;
                    } catch { }
                }

                if (!product) {
                    data.push(null);
                    continue;
                }

                const userSelectedColor = variantSelections[i]?.color;
                let defaultColor = item.variantMapping?.color || '';
                if (!defaultColor && Array.isArray(product.variants) && product.variants.length > 0 && product.variants[0]?.name) {
                    defaultColor = product.variants[0].name;
                }

                const effectiveItem = {
                    ...item,
                    variantMapping: {
                        ...(item.variantMapping || {}),
                        color: userSelectedColor || defaultColor || ''
                    }
                };

                const comboCustomForItem = (comboItemCustomization || [])[i] || null;
                const baseImageUrl = getBestImageUrl(product, effectiveItem, {}, comboCustomForItem);
                const color = effectiveItem.variantMapping.color;
                const layers = getDesignLayers(comboItemCustomization, i, color);

                data.push({ baseImageUrl, layers, product, itemIndex: i });
            }

            if (!cancelled) {
                setItemsData(data);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [comboItems, comboItemCustomization, queryClient, variantSelections, loadingFonts]);

    const isHorizontal = comboLayout.orientation !== 'vertical';
    const computedGap = isThumbnail ? Math.min((comboLayout.spacing ?? 20) / 2, 8) : (comboLayout.spacing ?? 20);
    const computedPadding = isThumbnail ? '0.25rem' : '0.5rem';

    const isLoading = itemsData.length === 0 && comboItems.length > 0;

    return (
        <div
            className={`${styles.container} ${styles.comboRow} ${className}`}
            style={{
                flexDirection: isHorizontal ? 'row' : 'column',
                gap: `${computedGap}px`,
                padding: computedPadding,
                backgroundColor: 'transparent'
            }}
        >
            {comboItems.map((item, index) => {
                const data = itemsData[index];
                const comboScale = comboItems[index]?.scale || 1;
                const relativeScale = isThumbnail ? comboScale * 1.1 : Math.min(comboScale / Math.max(1, ...comboItems.map(i => i.scale || 1)), 1);

                if (isLoading) {
                    return (
                        <div key={`placeholder-${item.productId}-${index}`} className={styles.comboRowItem}>
                            <div className={styles.comboRowPlaceholder} />
                        </div>
                    );
                }

                if (!data) {
                    return <div key={index} className={styles.comboRowItem}>Error loading item</div>;
                }

                return (
                    <div key={index} className={styles.comboRowItem}>
                        {renderSelector && !isThumbnail && renderSelector(index, data.product, 'top')}
                        <div style={{
                            width: `${isThumbnail ? 100 : relativeScale * 100}%`,
                            position: 'relative',
                            margin: '0 auto',
                            aspectRatio: '4 / 5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transform: isThumbnail ? `scale(${relativeScale})` : 'none',
                            transformOrigin: 'center center'
                        }}>
                            <NativeOverlay baseImageUrl={data.baseImageUrl} layers={data.layers} />
                        </div>
                        {renderSelector && !isThumbnail && renderSelector(index, data.product, 'bottom')}
                    </div>
                );
            })}
        </div>
    );
};

export default ComboProductImageWithDesign;
