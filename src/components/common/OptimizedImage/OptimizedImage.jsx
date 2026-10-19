import React, { useState, useRef, useEffect } from 'react';
import styles from './OptimizedImage.module.css';

/**
 * OptimizedImage — Componente profesional de imagen optimizado para E-commerce
 * - Detecta URLs de Cloudinary y genera automáticamente srcSet, WebP/AVIF (f_auto) y compresión (q_auto).
 * - Las de Firebase Storage pasan por el modo fetch de Cloudinary (ver más abajo).
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
 * MODO FETCH DE CLOUDINARY
 * ════════════════════════
 * Las fotos siguen guardadas en Firebase Storage; la tienda las pide a través
 * de Cloudinary, que las baja una vez, las reduce al ancho pedido, las pasa a
 * AVIF/WebP según el navegador y las sirve desde su CDN:
 *     res.cloudinary.com/dtixoxgsf/image/fetch/f_auto,q_auto,c_limit,w_400/<url de Storage codificada>
 * Una foto de producto de 1,6 MB (PNG) llega en 18 KB a 400 px.
 *
 * En el panel de Cloudinary (Seguridad) fetch solo acepta
 * firebasestorage.googleapis.com: cualquier otro dominio responde 401, así que
 * nadie puede gastar la cuenta con imágenes ajenas.
 *
 * Solo para MOSTRAR (OptimizedImage y fuentesDeImagen). getCloudinaryOptimized
 * no lo usa a propósito: lo llaman los lienzos que componen diseños y combos,
 * y esos necesitan la foto original.
 *
 * Si una foto no llega por fetch (cuota agotada, Cloudinary caído, archivo
 * borrado), esa <img> vuelve sola a la URL de Storage; tras FALLOS_PARA_APAGAR
 * fallos se apaga fetch para el resto de la visita. Para apagarlo del todo:
 * USAR_FETCH_CLOUDINARY = false.
 */
const USAR_FETCH_CLOUDINARY = true;
const BASE_FETCH = 'https://res.cloudinary.com/dtixoxgsf/image/fetch/';
const ANCHOS_FETCH = [200, 400, 800, 1200, 1600];
const FALLOS_PARA_APAGAR = 3;

let fallosDeFetch = 0;
const fetchActivo = () => USAR_FETCH_CLOUDINARY && fallosDeFetch < FALLOS_PARA_APAGAR;

// Solo las carpetas de Storage con fotos públicas de la tienda. Los diseños,
// pedidos y archivos de clientes (designs/, pedidos/, users/, gift_recipients/,
// YoryoPersonalizado/, boletas_envio/…) NO: Cloudinary se quedaría una copia
// en su CDN y además los recomprimiría. Una carpeta nueva queda fuera hasta
// que se agregue aquí.
const CARPETAS_FETCH = new Set([
    'productos', 'productos_v2', 'reconvertidas', 'storefront', 'brands', 'brand_nav',
    'categories', 'collections', 'link_pages', 'mockups', 'rewards', 'sorteos',
    'sorteos_suscripcion', 'config', 'cliparts', 'product_reviews',
]);

const carpetaDeStorage = (url) => {
    const despues = url.split('/o/')[1];
    if (!despues) return '';
    try { return decodeURIComponent(despues.split('?')[0]).split('/')[0]; } catch { return ''; }
};

// SVG y GIF no: el primero es vectorial y el segundo perdería la animación.
const sePuedeTraerPorFetch = (url) => typeof url === 'string'
    && url.startsWith('https://firebasestorage.googleapis.com/')
    && !/\.(svg|gif)$/i.test(url.split('?')[0])
    && CARPETAS_FETCH.has(carpetaDeStorage(url));

const urlPorFetch = (url, ancho) => `${BASE_FETCH}f_auto,q_auto,c_limit,w_${ancho}/${encodeURIComponent(url)}`;
const srcSetPorFetch = (url) => ANCHOS_FETCH.map((ancho) => `${urlPorFetch(url, ancho)} ${ancho}w`).join(', ');

// El mismo `sizes` por defecto que las fotos de Cloudinary.
const SIZES_POR_DEFECTO = '(max-width: 400px) 400px, (max-width: 600px) 600px, (max-width: 1024px) 800px, 1200px';

/**
 * { src, srcSet, sizes } por fetch, o null si la URL no es de Storage o fetch
 * está apagado. Para las <img> del kit que reciben la URL tal cual (portadas
 * de combo, FotoProducto): solo cuando no traen ya su propio srcSet.
 */
export const fuentesPorFetch = (src, sizes) => (fetchActivo() && sePuedeTraerPorFetch(src)
    ? { src: urlPorFetch(src, 800), srcSet: srcSetPorFetch(src), sizes: sizes || SIZES_POR_DEFECTO }
    : null);

/** Para esparcir en una <img> propia: por fetch si se puede, si no la URL tal cual. */
export const atributosDeFoto = (url, sizes) => fuentesPorFetch(url, sizes) || { src: url };

// De una URL de fetch, la de Storage que lleva dentro.
const urlOriginal = (urlFetch) => decodeURIComponent(urlFetch.slice(urlFetch.indexOf('/', BASE_FETCH.length) + 1));

// La red de seguridad para TODAS las <img>, también las que dibujan su propia
// etiqueta con fuentesDeImagen: el evento `error` no burbujea, pero se ve en
// la fase de captura. Se cambia la <img> que falló a la original y se cuenta.
if (typeof window !== 'undefined') {
    window.addEventListener('error', (evento) => {
        const img = evento.target;
        if (!(img instanceof HTMLImageElement)) return;
        const pedida = img.currentSrc || img.src || '';
        if (!pedida.startsWith(BASE_FETCH)) return;
        fallosDeFetch += 1;
        // Dentro de un <picture> manda el <source>: también vuelve a la original.
        if (img.parentElement?.tagName === 'PICTURE') {
            img.parentElement.querySelectorAll('source').forEach((fuente) => {
                const copias = fuente.getAttribute('srcset') || '';
                if (copias.startsWith(BASE_FETCH)) {
                    fuente.removeAttribute('sizes');
                    fuente.setAttribute('srcset', urlOriginal(copias.split(' ')[0]));
                }
            });
        }
        img.removeAttribute('srcset');
        img.src = urlOriginal(pedida);
    }, true);
}

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

/**
 * Las mismas fuentes que pinta OptimizedImage, sin pintar nada: para quien
 * dibuja su propia <img> (la tarjeta de producto del kit).
 *  → { src, srcSet, sizes } (srcSet y sizes undefined si no hay copias)
 */
export const fuentesDeImagen = (src, { variantes, sizes } = {}) => {
    if (!src) return { src };
    const porFetch = fuentesPorFetch(src, sizes);
    if (porFetch) return porFetch;
    const esCloudinary = typeof src === 'string' && src.includes('cloudinary.com');
    const srcSet = esCloudinary ? getCloudinarySrcSet(src) : srcSetDeVariantes(src, variantes);
    return {
        src: esCloudinary ? getCloudinaryOptimized(src, 800) : src,
        srcSet: srcSet || undefined,
        sizes: srcSet ? sizes : undefined,
    };
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
    // Fetch no trajo esta foto: se muestra la de Storage, con sus variantes.
    const [fetchFallo, setFetchFallo] = useState(false);
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
        setFetchFallo(false);
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

    const porFetch = !fetchFallo && fetchActivo() && sePuedeTraerPorFetch(src);

    const handleError = () => {
        if (mountedRef.current) {
            // El primer fallo por fetch no es un error de la foto: se reintenta
            // con la de Storage antes de pasar a fallbackSrc.
            if (porFetch) {
                setFetchFallo(true);
                return;
            }
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
    
    const finalSrc = errored
        ? baseDisplaySrc
        : (porFetch ? urlPorFetch(src, 800) : (isCloudinary ? getCloudinaryOptimized(baseDisplaySrc, 800) : baseDisplaySrc));
    // Cloudinary transforma por URL (también las de Storage, por fetch); si no,
    // las alternativas son los archivos que uploadFile dejó subidos.
    const srcSet = errored
        ? null
        : (porFetch ? srcSetPorFetch(src) : (isCloudinary ? getCloudinarySrcSet(baseDisplaySrc) : srcSetDeVariantes(baseDisplaySrc, variantes)));
    const sizes = srcSet
        ? (sizesProp || ((isCloudinary || porFetch) ? SIZES_POR_DEFECTO : undefined))
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
