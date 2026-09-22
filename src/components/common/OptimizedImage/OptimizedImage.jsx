import React, { useState, useRef, useEffect } from 'react';
import styles from './OptimizedImage.module.css';

/**
 * OptimizedImage — Componente profesional de imagen optimizado para E-commerce
 * - Detecta URLs de Cloudinary y genera automáticamente srcSet, WebP/AVIF (f_auto) y compresión (q_auto).
 * - Skeleton placeholder mientras carga (shimmer)
 * - Precarga en background sin parpadeos
 * - Fallback si la imagen falla
 */

// Función utilitaria para optimizar URLs de Cloudinary
export const getCloudinaryOptimized = (url, width) => {
    if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return url;
    
    const sizeTransform = width ? `c_limit,w_${width}` : 'c_limit,w_1200';
    const transformations = `f_auto,fl_progressive,q_auto,${sizeTransform}`;
    
    if (url.includes('/upload/')) {
        const parts = url.split('/upload/');
        if (parts[1] && (parts[1].match(/^v\d+\//) || parts[1].match(/^[a-zA-Z0-9_-]+\//))) {
           return `${parts[0]}/upload/${transformations}/${parts[1]}`;
        }
    }
    return url;
};

// Función para generar srcSet automáticamente si es Cloudinary
const getCloudinarySrcSet = (url) => {
    if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return null;
    return `
        ${getCloudinaryOptimized(url, 400)} 400w,
        ${getCloudinaryOptimized(url, 600)} 600w,
        ${getCloudinaryOptimized(url, 800)} 800w,
        ${getCloudinaryOptimized(url, 1200)} 1200w
    `.trim();
};

/**
 * srcSet a partir del mapa de variantes que devuelve uploadFile
 * ({ 160: url, 400: url, 800: url }).
 *
 * Esto es lo que hace que un hueco de 60 px reciba un archivo de 160 px en vez
 * del de 2000: sin `srcSet` el navegador no tiene alternativa que ofrecer, y
 * reducir 30 veces de golpe no solo pesa — se ve sucio, porque a esa escala el
 * navegador remuestrea con un filtro barato.
 *
 * A la principal se le pone el ancho MÁXIMO posible como descriptor. Su ancho
 * real no se guarda en ningún sitio y pedirlo costaría una petición extra; con
 * este valor el navegador la elige solo cuando ninguna variante alcanza, que es
 * justo lo que se busca.
 */
const ANCHO_MAXIMO_PRINCIPAL = 2000;

/**
 * `sizes` de la imagen de una tarjeta de producto.
 *
 * NO es el ancho de la tarjeta, y esa es justo la trampa: `sizes` describe el
 * ancho de la IMAGEN RENDERIZADA, y con `object-fit: cover` en un hueco 3/4 una
 * foto apaisada se pinta mucho más ancha que el hueco — lo que sobra se recorta,
 * pero el navegador ya tuvo que resolverlo.
 *
 * El caso que lo destapó: una casaca de 1370x784 (16/9) en la lista de deseos.
 * Declarando 400px el navegador servía la copia de 400x229 y, como con `cover`
 * manda el alto, 229px tenían que cubrir 373 → la ampliaba 1,63x y se veía
 * borrosa, mientras la miniatura de 60px del header (que recibe la principal)
 * se veía perfecta.
 *
 * La cuenta del caso peor, una foto 16/9 en un hueco 3/4:
 *     alto del hueco  = ancho / 0,75          = ancho x 1,333
 *     ancho renderizado = alto x 1,777         = ancho x 2,37
 * De ahí 750px en escritorio (~320px de tarjeta) y 117vw en móvil (50vw x 2,37).
 *
 * Coste: una foto que YA viene en 3/4 no necesita tanto y se lleva una copia
 * más grande de la cuenta. Se acepta a cambio de que ninguna se vea borrosa;
 * la solución de fondo es que las fotos de producto vengan en 3/4.
 */
export const SIZES_TARJETA_PRODUCTO = '(max-width: 640px) 117vw, 750px';

const srcSetDeVariantes = (principal, variantes) => {
    if (!principal || !variantes) return null;
    const partes = Object.entries(variantes)
        .map(([ancho, url]) => [Number(ancho), url])
        .filter(([ancho, url]) => Number.isFinite(ancho) && ancho > 0 && typeof url === 'string' && url)
        .sort((a, b) => a[0] - b[0])
        .map(([ancho, url]) => `${url} ${ancho}w`);
    if (partes.length === 0) return null;
    partes.push(`${principal} ${ANCHO_MAXIMO_PRINCIPAL}w`);
    return partes.join(', ');
};

// Cache de imágenes verificadas
const verifiedCache = new Set();

const OptimizedImage = ({
    src,
    alt = '',
    className = '',
    containerClassName = '',
    style = {},
    containerStyle = {},
    objectFit = 'cover',
    loading = 'lazy',
    fetchPriority: fetchPriorityProp,
    aspectRatio,
    onReady,
    onError: onErrorProp,
    fallbackSrc,
    showSkeleton = false,
    fadeInDuration = 150,
    seamless = false,
    cropData,
    // Mapa { ancho: url } de las copias pequeñas (ver uploadFile). Si no viene,
    // el componente se comporta exactamente como antes.
    variantes,
    // Cuánto espacio ocupará la imagen, para que el navegador elija bien del
    // srcSet. Sin esto asume el ancho de la ventana y se lleva la más grande.
    sizes: sizesProp,
    ...rest
}) => {
    const [loaded, setLoaded] = useState(false);
    const [errored, setErrored] = useState(false);
    const [isCached, setIsCached] = useState(false);
    const imgRef = useRef(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (seamless && loaded) return;
        setLoaded(false);
        setErrored(false);
        setIsCached(false);
    }, [src, seamless, loaded]);

    // ¿Ya sabemos que esta URL cargó bien antes? Entonces nos ahorramos el
    // estado "cargando" y el esqueleto.
    //
    // OJO con cómo se comprueba: aquí antes se hacía `new Image(); img.src =
    // src` para leer `img.complete`. Asignar `.src` NO es una consulta a la
    // caché — inicia una descarga de verdad, inmediatamente y sin pasar por el
    // `loading="lazy"` del <img> real. Es decir, este componente anulaba el
    // lazy-loading de TODA la app: en la home, las 24 tarjetas de producto
    // bajaban sus dos imágenes (principal + hover) de golpe al montar, aunque
    // estuvieran muy por debajo del pliegue, y de paso saturaban la conexión
    // justo mientras Firestore intentaba resolver las queries que mantienen
    // puesta la pantalla de carga. Para imágenes de Cloudinary era peor: `src`
    // es la original sin transformar, así que se bajaba esa Y la optimizada.
    //
    // El <img> de abajo ya lleva `onLoad`, y el effect de más abajo cubre el
    // caso "vino de la caché del navegador y `complete` ya era true al montar".
    // Con eso basta; no hace falta descargar nada por adelantado.
    useEffect(() => {
        if (!src) return;
        if (verifiedCache.has(src)) {
            setIsCached(true);
            setLoaded(true);
        }
    }, [src]);

    const handleLoad = () => {
        if (mountedRef.current) {
            if (src) verifiedCache.add(src);
            setLoaded(true);
            setIsCached(true);
            onReady?.();
        }
    };

    const handleError = () => {
        if (mountedRef.current) {
            setErrored(true);
            onErrorProp?.();
        }
    };

    // Si la imagen está cacheada, no necesita esperar onLoad
    useEffect(() => {
        if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
            handleLoad();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src]);

    const isCloudinary = src && typeof src === 'string' && src.includes('cloudinary.com');
    const baseDisplaySrc = errored && fallbackSrc ? fallbackSrc : src;
    
    const finalSrc = errored ? baseDisplaySrc : (isCloudinary ? getCloudinaryOptimized(baseDisplaySrc, 800) : baseDisplaySrc);
    // Cloudinary transforma por URL; Firebase no, así que ahí las alternativas
    // son los archivos que uploadFile dejó subidos.
    const srcSet = errored
        ? null
        : (isCloudinary ? getCloudinarySrcSet(baseDisplaySrc) : srcSetDeVariantes(baseDisplaySrc, variantes));
    const sizes = srcSet
        ? (sizesProp || (isCloudinary
            ? "(max-width: 400px) 400px, (max-width: 600px) 600px, (max-width: 1024px) 800px, 1200px"
            : undefined))
        : undefined;

    const containerCls = [
        styles.container,
        containerClassName,
    ].filter(Boolean).join(' ');

    const imgCls = [
        styles.image,
        loaded ? styles.imageLoaded : styles.imageLoading,
        className,
    ].filter(Boolean).join(' ');

    const isEager = loading === 'eager';
    const finalFetchPriority = fetchPriorityProp || (isEager ? 'high' : 'auto');

    const hasValidCrop = cropData && cropData.width > 0 && cropData.height > 0;
    const cropStyles = hasValidCrop ? {
        position: 'absolute',
        top: `${-(cropData.y / cropData.height) * 100}%`,
        left: `${-(cropData.x / cropData.width) * 100}%`,
        width: `${100 / cropData.width * 100}%`,
        height: `${100 / cropData.height * 100}%`,
        maxWidth: 'none',
        maxHeight: 'none',
        objectFit: 'fill',
    } : { objectFit };

    const mergedContainerStyle = {
        ...containerStyle,
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(hasValidCrop ? { 
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
        } : {})
    };

    // Solo mostrar skeleton si NO está cacheada y NO está cargada y NO hay error
    const showSkeletonLoader = showSkeleton && !loaded && !errored && !isCached;

    return (
        <div
            className={containerCls}
            style={mergedContainerStyle}
        >
            {showSkeletonLoader && (
                <div className={styles.skeleton} aria-hidden="true" />
            )}

            {hasValidCrop ? (
                <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    aspectRatio: '1 / 1',
                    overflow: 'hidden',
                    flexShrink: 0
                }}>
                    <img
                        ref={imgRef}
                        src={finalSrc}
                        srcSet={srcSet || undefined}
                        sizes={sizes}
                        alt={alt}
                        className={imgCls}
                        onLoad={handleLoad}
                        onError={handleError}
                        style={{
                            ...cropStyles,
                            transitionDuration: `${fadeInDuration}ms`,
                            ...style,
                        }}
                        loading={loading}
                        decoding="async"
                        draggable={false}
                        {...(finalFetchPriority ? { fetchpriority: finalFetchPriority } : {})}
                        {...rest}
                    />
                </div>
            ) : (
                <img
                    ref={imgRef}
                    src={finalSrc}
                    srcSet={srcSet || undefined}
                    sizes={sizes}
                    alt={alt}
                    className={imgCls}
                    onLoad={handleLoad}
                    onError={handleError}
                    style={{
                        ...cropStyles,
                        transitionDuration: `${fadeInDuration}ms`,
                        ...style,
                    }}
                    loading={loading}
                    decoding="async"
                    draggable={false}
                    {...(finalFetchPriority ? { fetchpriority: finalFetchPriority } : {})}
                    {...rest}
                />
            )}
        </div>
    );
};

export default OptimizedImage;

/**
 * useImagePreloader — Hook to preload an array of image URLs.
 */
export function useImagePreloader(urls = []) {
    const [loadedCount, setLoadedCount] = useState(0);
    const [allLoaded, setAllLoaded] = useState(false);

    useEffect(() => {
        const validUrls = urls.filter(Boolean);
        if (validUrls.length === 0) {
            setAllLoaded(true);
            return;
        }

        let count = 0;
        const total = validUrls.length;
        setLoadedCount(0);
        setAllLoaded(false);

        const onDone = () => {
            count++;
            setLoadedCount(count);
            if (count >= total) setAllLoaded(true);
        };

        validUrls.forEach((url) => {
            const img = new Image();
            // Preload optimizado si es Cloudinary
            img.src = getCloudinaryOptimized(url, 800) || url;
            if (img.complete && img.naturalWidth > 0) {
                onDone();
            } else {
                img.onload = onDone;
                img.onerror = onDone;
            }
        });
    }, [urls.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

    return { allLoaded, loadedCount, totalCount: urls.filter(Boolean).length };
}
