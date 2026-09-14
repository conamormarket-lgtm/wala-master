import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Heart, ShoppingCart, CalendarHeart, Share2 } from 'lucide-react';
import { useWishlist } from '../../contexts/WishlistContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { useProducts } from '../../hooks/useProducts';
import { useCart } from '../../contexts/CartContext';
import { getCategories } from '../../services/products';
// La misma tarjeta que usa la Tienda (ProductGrid/FeaturedCarousel/...), NO el
// ProductCard "viejo": ese ponía el botón de carrito pegado al precio, sin aire
// (padding horizontal en 0), mientras que PremiumProductCard ya resuelve el
// agregado rápido como un overlay sobre la imagen -con su propio padding- y
// ya trae el aviso "Elegir color y talla" cuando el producto lo necesita.
import PremiumProductCard from '../Tienda/components/PremiumProductCard/PremiumProductCard';
import { productNeedsVariantSelection } from '../../utils/comboProductUtils';
import { PLACEHOLDER_IMG } from '../../constants/placeholder';
import styles from './WishlistPage.module.css';
import { T } from '../../i18n/useTranslatedText';

/**
 * ¿El producto del catálogo sigue disponible para comprarse?
 * Con includeHidden el catálogo también trae ocultos y borrados lógicos
 * (tombstones visible:false/deleted:true): sirven para pintar nombre/imagen,
 * pero NO deben poder agregarse al carrito.
 */
const estaDisponible = (p) => !!p && p.visible !== false && p.deleted !== true;

/**
 * "Guardado hace 3 días" / "Guardado ayer" / "Guardado hoy": lo único que
 * distingue a esta tarjeta de una del catálogo normal es CUÁNDO se guardó,
 * así que es el dato que le da identidad propia a la lista de deseos (ver
 * item.addedAt en WishlistContext). Intl.RelativeTimeFormat con numeric:
 * 'auto' ya resuelve "hoy"/"ayer" en español sin tener que codificarlos a mano.
 */
const formatearGuardadoHace = (isoDate) => {
  if (!isoDate) return null;
  const entonces = new Date(isoDate);
  if (Number.isNaN(entonces.getTime())) return null;
  const diffDias = Math.round((Date.now() - entonces.getTime()) / 86400000);
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (diffDias < 30) return `Guardado ${rtf.format(-diffDias, 'day')}`;
  const diffMeses = Math.round(diffDias / 30);
  if (diffMeses < 12) return `Guardado ${rtf.format(-diffMeses, 'month')}`;
  const diffAnios = Math.round(diffMeses / 12);
  return `Guardado ${rtf.format(-diffAnios, 'year')}`;
};

const WishlistPage = () => {
  const { wishlistItems, loading: wishlistLoading, toggleFavorite } = useWishlist();
  // includeHidden: la wishlist es HISTORIAL — los productos borrados lógicamente
  // deben seguir resolviendo nombre/imagen (tarjeta degradada, no desaparecer).
  const { data: allProducts, isLoading: productsLoading } = useProducts([], { includeHidden: true });
  // Sin esto, PremiumProductCard no tiene con qué resolver la categoría real
  // del producto (idsDeCategoriaDe -> nombre) y cae en su fallback genérico
  // "Esencial"/"Personalizable" para TODO, sea cual sea el producto.
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error: err } = await getCategories();
      if (err) throw new Error(err);
      return data;
    }
  });
  const { userProfile } = useAuth();
  const { addToast } = useGlobalToast();
  const { addToCart, items: cartItems } = useCart();
  const [copying, setCopying] = useState(false);
  const [addingAll, setAddingAll] = useState(false);

  const shareLink = userProfile?.referralCode 
    ? `${window.location.origin}/wishlist/${userProfile.referralCode}` 
    : '';

  const handleCopyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopying(true);
    addToast('Enlace copiado al portapapeles', 'success');
    setTimeout(() => setCopying(false), 2000);
  };

  // Enlace al REGISTRO DE REGALOS (Feature B "Mis fechas especiales"):
  // página pública /regalar/:referralCode donde quien lo abre ve las fechas
  // especiales del dueño + su wishlist y elige una fecha de entrega para el regalo.
  const giftRegistryLink = userProfile?.referralCode
    ? `${window.location.origin}/regalar/${userProfile.referralCode}`
    : '';

  // Copia el link del registro de regalos al portapapeles, avisa con un toast y
  // lo abre en una pestaña nueva para que el dueño lo previsualice/comparta.
  const handleShareGiftRegistry = () => {
    if (!giftRegistryLink) return;
    navigator.clipboard.writeText(giftRegistryLink);
    addToast('Enlace de tu registro de regalos copiado', 'success');
    window.open(giftRegistryLink, '_blank', 'noopener,noreferrer');
  };

  // Agrega de un golpe TODOS los productos disponibles de la wishlist PERSONAL al carrito propio.
  // No es modo regalo (es un atajo de compra para uno mismo). Reutiliza allProducts (ya cargado,
  // con precio) para no leer Firestore por item; omite borrados, sin stock y los que ya están en
  // el carrito. Usa addToCart en modo silent para mostrar UN solo toast resumen.
  const handleAddAll = () => {
    const pendientes = wishlistItems.filter((i) => !i.isGifted);
    setAddingAll(true);
    let added = 0;
    let skipped = 0;
    for (const item of pendientes) {
      const p = allProducts?.find((fp) => fp.id === item.productId);
      if (!estaDisponible(p)) { skipped++; continue; }                    // borrado (físico o lógico) / oculto
      // Campo REAL del modelo: inStock (numérico); la tienda trata !inStock como
      // agotado (ProductCard/ProductDetail). `stock` e `isActive` no existen.
      if (!(Number(p.inStock) > 0)) { skipped++; continue; }              // sin stock
      if (cartItems.some((ci) => ci.productId === p.id)) { skipped++; continue; } // ya en carrito
      // Tiene color/talla/combo para elegir: un agregado masivo no puede abrir
      // la ficha por cada uno, así que se omite en vez de mandarlo al carrito
      // sin variante (eso era lo que dejaba la línea "Falta elegir color y
      // talla" en el carrito). El usuario lo agrega desde su propia ficha.
      if (productNeedsVariantSelection(p)) { skipped++; continue; }
      addToCart(p, {}, null, 1, null, { silent: true });
      added++;
    }
    setAddingAll(false);
    if (added === 0) {
      addToast(
        skipped ? 'Esos productos ya están en tu carrito o no están disponibles.' : 'No hay productos para agregar.',
        'info'
      );
    } else {
      addToast(
        skipped
          ? `${added} producto${added !== 1 ? 's' : ''} agregado${added !== 1 ? 's' : ''} al carrito 🛒 · ${skipped} omitido${skipped !== 1 ? 's' : ''}`
          : `${added} producto${added !== 1 ? 's' : ''} agregado${added !== 1 ? 's' : ''} al carrito 🛒`,
        'success'
      );
    }
  };

  // Quita un item de la wishlist (recibe cualquier objeto con productId:
  // producto del catálogo o el propio snapshot del item degradado).
  const handleRemove = async (product) => {
    const res = await toggleFavorite({ id: product.productId });
    if (res?.error) {
      addToast(res.error, 'error');
    } else {
      addToast('Producto eliminado', 'success');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>
          <Heart className={styles.titleIcon} size={26} fill="currentColor" aria-hidden="true" />
          <T>Mi Lista de Deseos</T>
        </h1>
        {wishlistItems.length > 0 && (
          <div className={styles.headerActions}>
            <button
              className={styles.addAllBtn}
              onClick={handleAddAll}
              disabled={addingAll}
              title="Agrega todos tus productos guardados a tu carrito"
            >
              <ShoppingCart size={17} strokeWidth={2.25} aria-hidden="true" />
              {addingAll ? 'Agregando…' : 'Agregar todo al carrito'}
            </button>
            {giftRegistryLink && (
              <button
                className={styles.datesBtn}
                onClick={handleShareGiftRegistry}
                title="Comparte tus fechas especiales para que te regalen en la fecha justa"
              >
                <CalendarHeart size={17} strokeWidth={2.25} aria-hidden="true" />
                Mis fechas especiales
              </button>
            )}
            {shareLink && (
              <button
                className={styles.shareBtn}
                onClick={handleCopyLink}
                disabled={copying}
              >
                <Share2 size={16} strokeWidth={2.25} aria-hidden="true" />
                {copying ? '¡Copiado!' : 'Compartir mi lista'}
              </button>
            )}
          </div>
        )}
      </div>

      {!userProfile?.birthDate && (
        <div className={styles.birthdayTip}>
          <p>
            <strong>💡 Tip:</strong> Registra tu fecha de cumpleaños en tu perfil para que te recordemos compartir esta lista con tus amigos antes de tu gran día.
          </p>
          <Link to="/cuenta/perfil" className={styles.birthdayTipLink}><T>Ir a mi perfil</T></Link>
        </div>
      )}

      {wishlistLoading || productsLoading ? (
        <div className={styles.loading}><T>Cargando tu lista de deseos...</T></div>
      ) : wishlistItems.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Heart size={56} fill="currentColor" aria-hidden="true" />
          </div>
          <h3><T>Tu lista de deseos está vacía</T></h3>
          <p><T>Explora la tienda y guarda los productos que te encantaría recibir o comprar después.</T></p>
          <Link to="/tienda" className={styles.primaryBtn}>
            Explorar Tienda
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {wishlistItems.map((item) => {
            const fullProduct = allProducts?.find(p => p.id === item.productId);

            // Producto borrado (físico legado o tombstone) u oculto: en vez de
            // desaparecer en silencio, mostramos una TARJETA DEGRADADA con el
            // snapshot guardado en la wishlist (nombre + imagen) y la opción de
            // quitarlo de la lista. El tombstone conserva name/mainImage, así
            // que lo preferimos por ser más fresco; el snapshot es el fallback.
            if (!estaDisponible(fullProduct)) {
              const nombre = fullProduct?.name || item.productName || 'Producto';
              const imagen = fullProduct?.mainImage || item.productImage || PLACEHOLDER_IMG;
              return (
                <div key={item.productId} className={`${styles.card} ${styles.unavailableCard}`}>
                  <div className={styles.imageWrapper}>
                    <img
                      className={`${styles.image} ${styles.unavailableImg}`}
                      src={imagen}
                      alt={nombre}
                      loading="lazy"
                      onError={(e) => {
                        // Si la imagen del snapshot/tombstone ya no existe, placeholder.
                        // endsWith: img.src devuelve la URL ABSOLUTA (evita bucle de error).
                        if (!e.currentTarget.src.endsWith(PLACEHOLDER_IMG)) {
                          e.currentTarget.src = PLACEHOLDER_IMG;
                        }
                      }}
                    />
                    <span className={styles.unavailableBadge}><T>Ya no disponible</T></span>
                  </div>
                  <div className={styles.info}>
                    <h3 className={styles.name}>{nombre}</h3>
                    <p className={styles.unavailableText}>
                      Este producto ya no está en la tienda.
                    </p>
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => handleRemove(item)}
                      >
                        Quitar de mi lista
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            const guardadoHace = formatearGuardadoHace(item.addedAt);

            return (
              <div key={item.productId} className={styles.cardSlot}>
                <PremiumProductCard product={fullProduct} categories={categories} />

                {item.isGifted && (
                  <div className={styles.giftedBadge}>¡Ya te lo regalaron! 🎁</div>
                )}

                {/* Lo único que distingue a esta tarjeta de una del catálogo:
                    CUÁNDO se guardó. Es la identidad propia de "lista de
                    deseos" frente a la tarjeta normal de la tienda. */}
                {guardadoHace && (
                  <p className={styles.savedCaption}>
                    <Heart size={12} fill="currentColor" aria-hidden="true" />
                    {guardadoHace}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
