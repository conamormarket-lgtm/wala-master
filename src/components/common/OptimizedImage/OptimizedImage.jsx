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

    // Verificar si la imagen ya está cacheada
    useEffect(() => {
        if (!src) return;
        
        // Si ya verificamos esta URL antes, usar el resultado cacheado
        if (verifiedCache.has(src)) {
            setIsCached(true);
            setLoaded(true);
            return;
        }

        // Verificar si la imagen ya está en caché del navegador
        const img = new Image();
        img.src = src;
        
        if (img.complete && img.naturalWidth > 0) {
            verifiedCache.add(src);
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
    }, [src]);

    const isCloudinary = src && typeof src === 'string' && src.includes('cloudinary.com');
    const baseDisplaySrc = errored && fallbackSrc ? fallbackSrc : src;
    
    const finalSrc = errored ? baseDisplaySrc : (isCloudinary ? getCloudinaryOptimized(baseDisplaySrc, 800) : baseDisplaySrc);
    const srcSet = errored ? null : getCloudinarySrcSet(baseDisplaySrc);
    const sizes = isCloudinary ? "(max-width: 400px) 400px, (max-width: 600px) 600px, (max-width: 1024px) 800px, 1200px" : undefined;

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
