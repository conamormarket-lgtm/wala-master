import React, { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBrands } from '../../services/brands';
import { idsDeCategoriaDe, variantesDeImagen } from '../../services/products';
import { useCart } from '../../contexts/CartContext';
import { useWishlist } from '../../contexts/WishlistContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { toThumbnailImageUrl } from '../../utils/imageUrl';
import { isComboProduct, productNeedsVariantSelection, productSelectionNeeds } from '../../utils/comboProductUtils';
import { useProductThumbnailVariant } from '../../hooks/useProductThumbnailVariant';
import useLoViejo from '../../hooks/useLoViejo';
import { fuentesDeImagen, SIZES_TARJETA_PRODUCTO } from '../common/OptimizedImage/OptimizedImage';
import PremiumProductCard from '../../pages/Tienda/components/PremiumProductCard/PremiumProductCard';
import TarjetaProducto from '../../componentes/kit/TarjetaProducto';
import { tarjetaDesdeProducto, portadaDeCombo } from '../../componentes/kit/adaptadores';
import { esYoryoPersonalizable, rutaPersonalizarYoryo } from '../../utils/yoryoPersonalizacion.mjs';
import usePiezasDelCombo from './usePiezasDelCombo';

// La hoja "Agregar rápido" baja aparte, la primera vez que alguien la abre.
const AgregarRapidoDeProducto = lazy(() => import('./AgregarRapidoDeProducto'));

// Qué hay que elegir antes de comprar, dicho con precisión (como la tarjeta de antes).
const textoElegir = (product) => {
  const { color, talla, indeterminado } = productSelectionNeeds(product);
  if (indeterminado) return 'Elegir opciones';
  if (color && talla) return 'Elegir color y talla';
  if (talla) return 'Elegir talla';
  if (color) return 'Elegir color';
  return 'Elegir opciones';
};

// El clic largo abría el menú del navegador ("Guardar imagen…") y en Android
// dejaba la tarjeta sin responder al toque: se sigue suprimiendo.
const sinMenu = (e) => e.preventDefault();

/**
 * La tarjeta de producto de la tienda con el kit (paso 4 de la migración).
 * Mismas props y mismo comportamiento que PremiumProductCard:
 *  - foto: la miniatura elegida (useProductThumbnailVariant) con su recorte,
 *    sus copias en varios tamaños, la de respaldo y el fondo de la marca;
 *    la segunda foto al pasar el ratón (no en los combos)
 *  - "Agregar" sin opciones → addToCart (trackAddToCart va en CartContext);
 *    con opciones ("Elegir talla"…) → la hoja "Agregar rápido"
 *    (AgregarRapidoDeProducto, paso 6); con el interruptor fichaVieja, la ficha
 *  - el corazón con WishlistContext y su aviso
 *  - la impresión cuando entra en pantalla y la ficha precargada al acercarse
 * El interruptor tarjetasViejo (useLoViejo) vuelve a PremiumProductCard.
 */
function TarjetaNueva({
  product,
  categories = [],
  isAboveFold = false,
  currentBrandId = null,
  showNewBadge = true,
  showStockBadge = true,
  showQuickAdd = true,
  showHoverSecondaryMedia = true,
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useWishlist();
  const { addToast } = useGlobalToast();
  const { thumbnailImageUrl, recordImpression } = useProductThumbnailVariant(product);
  const fichaVieja = useLoViejo('ficha');
  // null: la hoja nunca se abrió (no se monta ni baja su código).
  const [hoja, setHoja] = useState(null);
  const [piezasVisibles, setPiezasVisibles] = useState(isAboveFold);
  const { porId: subproductos, terminado: piezasPedidas } = usePiezasDelCombo(product, piezasVisibles);

  const { data: marcas } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await getBrands()).data,
    staleTime: 1000 * 60 * 5,
  });

  const esCombo = isComboProduct(product);
  const necesitaElegir = productNeedsVariantSelection(product);
  const principal = product?.variants?.find((v) => String(v.id) === String(product.defaultVariantId)) || product?.variants?.[0];

  const fotoUrl = thumbnailImageUrl || principal?.imageUrl || product?.mainImage || product?.images?.[0] || '';
  const segundaUrl = !esCombo && showHoverSecondaryMedia
    ? (principal?.images?.[0] || principal?.galleryImages?.[0] || product?.images?.[1] || null)
    : null;
  const respaldo = toThumbnailImageUrl(principal?.imageUrl || product?.mainImage || product?.images?.[0] || '');

  // Las mismas copias y el mismo `sizes` que OptimizedImage.
  const foto = fuentesDeImagen(toThumbnailImageUrl(fotoUrl), { variantes: variantesDeImagen(product, fotoUrl), sizes: SIZES_TARJETA_PRODUCTO });
  const segunda = segundaUrl
    ? fuentesDeImagen(toThumbnailImageUrl(segundaUrl), { variantes: variantesDeImagen(product, segundaUrl), sizes: SIZES_TARJETA_PRODUCTO })
    : null;

  // La categoría propia del producto (no la primera de la lista global).
  const categoria = useMemo(() => {
    const propias = idsDeCategoriaDe(product);
    const nombre = propias.length ? categories.find((c) => (c?.id || c?.slug) === propias[0])?.name : null;
    // Ya no hay productos "personalizables" en la tienda (eso es Crear).
    return nombre || 'Esencial';
  }, [product, categories]);

  const marca = (marcas || []).find((b) => b.id === product.brandId);
  const base = tarjetaDesdeProducto(product, {
    // Un combo se ve con su portada o, sin ella, con sus piezas (el kit).
    imagen: esCombo ? (portadaDeCombo(product) || undefined) : foto.src,
    catalogo: { marcas: marcas || [], marcaActual: currentBrandId },
    subproductos,
    piezasCargando: !piezasVisibles || !piezasPedidas,
  });

  const deseado = isFavorite(product.id);
  const alDesear = useCallback(async () => {
    const resultado = await toggleFavorite(product);
    if (resultado?.error) addToast(resultado.error, 'error');
    else if (resultado?.success) addToast(deseado ? 'Eliminado de tu lista de deseos' : 'Agregado a tu lista de deseos', 'success');
  }, [toggleFavorite, product, addToast, deseado]);

  const alAgregar = () => {
    if (esYoryoPersonalizable(product)) { navigate(rutaPersonalizarYoryo(product)); return false; }
    if (necesitaElegir) {
      if (fichaVieja) navigate(`/producto/${product.id}`);
      else setHoja(true);
      return false;
    }
    addToCart(product, {}, null, 1);
    return true;
  };

  const precargar = useCallback(() => {
    setPiezasVisibles(true);
    queryClient.setQueryData(['product', product.id], product);
  }, [queryClient, product]);

  const alVer = () => {
    setPiezasVisibles(true);
    recordImpression();
  };

  return (
    <>
    <TarjetaProducto
      {...base}
      categoria={categoria}
      imagenHover={segunda ? segunda.src : undefined}
      srcSet={esCombo ? undefined : foto.srcSet}
      srcSetHover={segunda?.srcSet}
      sizes={foto.sizes || segunda?.sizes}
      recorte={esCombo ? undefined : principal?.thumbnailCrop?.percentages}
      recorteHover={segundaUrl ? principal?.imagesCrops?.[segundaUrl]?.percentages : undefined}
      respaldo={respaldo && respaldo !== foto.src ? respaldo : undefined}
      prioridad={isAboveFold}
      fondo={marca && (marca.bgColor || marca.bgImage) ? { color: marca.bgColor, imagen: marca.bgImage, opacidad: marca.bgOpacity ?? 100 } : undefined}
      nuevo={showNewBadge && base.nuevo}
      stock={showStockBadge ? base.stock : undefined}
      accion={esYoryoPersonalizable(product) ? 'crear' : necesitaElegir ? 'elegir' : 'agregar'}
      url={esYoryoPersonalizable(product) ? rutaPersonalizarYoryo(product) : base.url}
      textoAccion={esYoryoPersonalizable(product) ? product.personalizacionYoryo?.pack ? 'Personalizar pack' : 'Personalizar' : necesitaElegir ? textoElegir(product) : undefined}
      sinAccion={!showQuickAdd}
      onAgregar={alAgregar}
      deseado={deseado}
      onDeseo={alDesear}
      onVisible={alVer}
      onAcercar={precargar}
      onMenu={sinMenu}
    />
    {hoja !== null && (
      <Suspense fallback={null}>
        <AgregarRapidoDeProducto product={product} abierto={hoja} onCerrar={() => setHoja(false)} />
      </Suspense>
    )}
    </>
  );
}

function TarjetaDeProducto(props) {
  const viejo = useLoViejo('tarjetas');
  return viejo ? <PremiumProductCard {...props} /> : <TarjetaNueva {...props} />;
}

export default React.memo(TarjetaDeProducto);
