import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../../contexts/WishlistContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { useProducts } from '../../hooks/useProducts';
import { useCart } from '../../contexts/CartContext';
import ProductCard from '../Tienda/components/ProductCard/ProductCard';
import styles from './WishlistPage.module.css';

const WishlistPage = () => {
  const { wishlistItems, loading: wishlistLoading, toggleFavorite } = useWishlist();
  const { data: allProducts, isLoading: productsLoading } = useProducts([]);
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
      if (!p) { skipped++; continue; }                                    // producto borrado
      if (p.stock === 0 || p.isActive === false) { skipped++; continue; } // sin stock / inactivo
      if (cartItems.some((ci) => ci.productId === p.id)) { skipped++; continue; } // ya en carrito
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

  // eslint-disable-next-line no-unused-vars
  // eslint-disable-next-line no-unused-vars
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
        <h1 className={styles.title}>Mi Lista de Deseos</h1>
        {wishlistItems.length > 0 && (
          <div className={styles.headerActions}>
            <button
              className={styles.addAllBtn}
              onClick={handleAddAll}
              disabled={addingAll}
              title="Agrega todos tus productos guardados a tu carrito"
            >
              {addingAll ? 'Agregando…' : '🛒 Agregar todo al carrito'}
            </button>
            {giftRegistryLink && (
              <button
                className={styles.datesBtn}
                onClick={handleShareGiftRegistry}
                title="Comparte tus fechas especiales para que te regalen en la fecha justa"
              >
                📅 Mis fechas especiales
              </button>
            )}
            {shareLink && (
              <button
                className={styles.primaryBtn}
                onClick={handleCopyLink}
                disabled={copying}
              >
                {copying ? '¡Copiado!' : 'Compartir mi lista'}
              </button>
            )}
          </div>
        )}
      </div>

      {!userProfile?.birthDate && (
        <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <p style={{ margin: 0 }}>
            <strong>💡 Tip:</strong> Registra tu fecha de cumpleaños en tu perfil para que te recordemos compartir esta lista con tus amigos antes de tu gran día.
          </p>
          <Link to="/cuenta/perfil" style={{ color: '#8b5cf6', fontWeight: 'bold', marginTop: '0.5rem', display: 'inline-block' }}>Ir a mi perfil</Link>
        </div>
      )}

      {wishlistLoading || productsLoading ? (
        <div className={styles.loading}>Cargando tu lista de deseos...</div>
      ) : wishlistItems.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>💝</div>
          <h3>Tu lista de deseos está vacía</h3>
          <p>Explora la tienda y guarda los productos que te encantaría recibir o comprar después.</p>
          <Link to="/tienda" className={styles.primaryBtn}>
            Explorar Tienda
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {wishlistItems.map((item) => {
            const fullProduct = allProducts?.find(p => p.id === item.productId);
            
            if (!fullProduct) {
              return null; // Omitimos si el producto fue borrado del sistema
            }

            return (
              <div key={item.productId} style={{ position: 'relative' }}>
                <ProductCard product={fullProduct} />
                
                {item.isGifted && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    padding: '0.4rem 1rem',
                    borderRadius: '20px',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none'
                  }}>
                    ¡Ya te lo regalaron! 🎁
                  </div>
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
