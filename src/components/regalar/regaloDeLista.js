import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getProduct, variantesDeImagen } from '../../services/products';
import { getThumbnailVariant } from '../../utils/productThumbnailVariant';
import { recordThumbnailImpression } from '../../utils/productVariantBehavior';
import { toThumbnailImageUrl } from '../../utils/imageUrl';
import { fuentesDeImagen, SIZES_TARJETA_PRODUCTO } from '../common/OptimizedImage/OptimizedImage';
import { itemRegaloDesde, portadaDeCombo } from '../../componentes/kit/adaptadores';

/*
 * Lo que comparten la lista pública (/wishlist/:código) y regalar para una
 * fecha (/regalar/:código): el código, el registro del dueño, los productos
 * de la lista (uno por uno, no el catálogo entero) y sus tarjetas.
 */

/** El código va en MAYÚSCULAS al carrito: markItemAsGifted lo compara así. */
export const codigoDeLista = (codigo) => String(codigo || '').trim().toUpperCase();

/** Lo que dice la ficha cuando hay que elegir talla o color antes de regalar. */
export const avisoDeRegalo = (nombre) => (nombre
  ? `Regalo para ${nombre}, de su lista de deseos. Elige y agrégalo al carrito.`
  : 'Regalo de una lista de deseos. Elige y agrégalo al carrito.');

/** El registro público del dueño: su nombre, sus fechas y su lista. Si falla, null (la página sigue). */
export const consultaRegistro = (codigo) => ({
  queryKey: ['registro-publico', codigoDeLista(codigo)],
  queryFn: async () => {
    try {
      const { data } = await httpsCallable(getFunctions(), 'getPublicGiftRegistry')({ referralCode: codigo });
      return data?.ok ? data : null;
    } catch (e) {
      console.error('Error fetching owner name:', e);
      return null;
    }
  },
  staleTime: 60 * 1000,
  enabled: Boolean(codigo),
});

/** Un producto del catálogo, con la caché de la ficha. null si no existe. */
export const consultaProducto = (id) => ({
  queryKey: ['product', id],
  queryFn: async () => (await getProduct(id)).data || null,
  staleTime: 60 * 1000,
});

/**
 * La foto de la tarjeta como en la tienda (TarjetaDeProducto): la miniatura
 * elegida, sus copias en varios tamaños y la de respaldo; un combo, con su
 * portada.
 */
export function fotoDeTarjeta(producto) {
  if (producto.isComboProduct) return { imagen: portadaDeCombo(producto) || undefined };
  const principal = producto.variants?.find((v) => String(v.id) === String(producto.defaultVariantId)) || producto.variants?.[0];
  const url = getThumbnailVariant(producto).imageUrl || principal?.imageUrl || producto.mainImage || producto.images?.[0] || '';
  const foto = fuentesDeImagen(toThumbnailImageUrl(url), { variantes: variantesDeImagen(producto, url), sizes: SIZES_TARJETA_PRODUCTO });
  return {
    imagen: foto.src,
    extra: {
      srcSet: foto.srcSet,
      sizes: foto.srcSet ? SIZES_TARJETA_PRODUCTO : undefined,
      respaldo: toThumbnailImageUrl(principal?.imageUrl || producto.mainImage || producto.images?.[0] || ''),
      onVisible: () => recordThumbnailImpression(producto.id),
    },
  };
}

/** Mientras llega el producto: la foto que guardó la lista, con sus copias. */
const fotoGuardada = (item) => {
  if (!item.productImage) return {};
  const foto = fuentesDeImagen(toThumbnailImageUrl(item.productImage), { variantes: item.productImageVariantes, sizes: SIZES_TARJETA_PRODUCTO });
  return { imagen: foto.src, srcSet: foto.srcSet, sizes: foto.srcSet ? SIZES_TARJETA_PRODUCTO : undefined };
};

/**
 * Un item de la lista con su producto (undefined mientras llega), listo para
 * <TarjetaRegalo>. Lo usan la lista pública y regalar para una fecha.
 */
export function itemDeTarjeta(item, producto, { marcas = [], exigirPrecio = false } = {}) {
  if (producto === undefined) {
    const base = itemRegaloDesde(item, undefined);
    return { ...base, producto: { ...base.producto, ...fotoGuardada(item) } };
  }
  const foto = producto ? fotoDeTarjeta(producto) : {};
  const it = itemRegaloDesde(item, producto, { imagen: foto.imagen, catalogo: { marcas }, exigirPrecio });
  return it.disponible ? { ...it, producto: { ...it.producto, ...foto.extra } } : it;
}

/** Los productos de la lista, cada uno con su consulta (no el catálogo entero). */
export function useProductosDeLista(items) {
  const ids = useMemo(() => [...new Set((items || []).map((it) => it.productId).filter(Boolean))], [items]);
  const resultados = useQueries({ queries: ids.map(consultaProducto) });
  const porId = {};
  ids.forEach((id, k) => {
    const r = resultados[k];
    // Si la lectura falla, como antes: no se puede regalar (se ve apagado).
    porId[id] = r.isError ? null : r.data;
  });
  return porId;
}
