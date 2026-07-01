import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getWishlistByUserCode } from '../../services/wishlist';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { db } from '../../services/firebase/config';
// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line no-unused-vars
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { useProducts } from '../../hooks/useProducts';
import ProductCard from '../Tienda/components/ProductCard/ProductCard';
import { PLACEHOLDER_IMG } from '../../constants/placeholder';
import styles from './WishlistPublic.module.css';

/**
 * ¿El producto del catálogo sigue disponible para regalarse?
 * Con includeHidden también llegan ocultos y borrados lógicos (tombstones
 * visible:false/deleted:true): sirven para pintar nombre/imagen, pero NO
 * deben poder agregarse al carrito como regalo.
 */
const estaDisponible = (p) => !!p && p.visible !== false && p.deleted !== true;

const WishlistPublic = () => {
  const { userCode } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToast } = useGlobalToast();

  // includeHidden: la lista compartida es HISTORIAL — un producto borrado
  // lógicamente debe seguir mostrándose (degradado), no desaparecer en silencio.
  const { data: allProducts, isLoading: productsLoading } = useProducts([], { includeHidden: true });
  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ownerName, setOwnerName] = useState('Alguien');

  useEffect(() => {
    const fetchWishlist = async () => {
      setLoading(true);
      const { data, error } = await getWishlistByUserCode(userCode);
      
      if (error || !data) {
        setError(error || 'Lista no encontrada');
        setLoading(false);
        return;
      }
      
      setWishlist(data);

      // Try to get the owner's name
      if (data.userId) {
        try {
          const userDoc = await getDoc(doc(db, 'portal_clientes_users', data.userId));
          if (userDoc.exists()) {
            setOwnerName(userDoc.data().displayName || userDoc.data().name || 'Alguien');
          }
        } catch (e) {
          console.error("Error fetching user name:", e);
        }
      }

      setLoading(false);

      // Notify the owner that someone visited their wishlist
      // (This could be optimized to not spam)
      try {
        if (data.userId) {
          await addDoc(collection(db, `users/${data.userId}/notifications`), {
            title: '¡Alguien visitó tu lista de deseos! 👀',
            body: 'Un amigo o familiar acaba de ver tu lista de regalos.',
            createdAt: new Date().toISOString(),
            read: false,
            type: 'wishlist_visit'
          });
        }
      } catch (e) {
        console.error("Error notifying owner:", e);
      }
    };

    if (userCode) {
      fetchWishlist();
    }
  }, [userCode]);

  // `item` es el producto del catálogo; `wishlistItem` (opcional) es el item
  // crudo de la wishlist, cuyo snapshot productImage sirve de último fallback.
  const handleGift = (item, wishlistItem = null) => {
    const fullProduct = typeof item === 'object' && item.id ? item : undefined;
    const price = fullProduct?.salePrice || fullProduct?.price || 0;

    const productMock = {
      id: item.productId || fullProduct?.id,
      name: item.productName || fullProduct?.name,
      // Imagen con fallbacks: en productos CON variantes mainImage es '' (la
      // miniatura vive en images[0], derivada de la variante principal); sin
      // esto el pedido de regalo se creaba SIN imagen.
      mainImage: fullProduct?.mainImage || fullProduct?.images?.[0] || wishlistItem?.productImage || item.productImage || '',
      price: price,
      // Flag para saber que es un regalo
      isWishlistGift: true,
      // Normalizamos el casing igual que GiftRegistryPage para que markItemAsGifted
      // matchee el código almacenado (la CF compara en MAYÚSCULAS).
      wishlistUserCode: String(userCode || '').trim().toUpperCase()
    };

    addToCart(productMock, {}, null, 1);
    addToast('¡Producto agregado a tu carrito! Podrás elegir dónde enviarlo en el Checkout.', 'success');
    navigate('/carrito');
  };

  if (loading || productsLoading) {
    return <div className={styles.container}><p>Cargando lista de deseos...</p></div>;
  }

  if (error || !wishlist) {
    return (
      <div className={styles.container}>
        <h2>Lista no encontrada</h2>
        <p>El enlace que seguiste no es válido o la lista ya no existe.</p>
        <Link to="/tienda" className={styles.primaryBtn}>Ir a la tienda</Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Lista de deseos de {ownerName} 🎁</h1>
        <p>Elige un regalo de esta lista y sorpréndele.</p>
      </div>

      {wishlist.items?.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Esta lista está vacía actualmente.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {wishlist.items.map((item) => {
            const fullProduct = allProducts?.find(p => p.id === item.productId);

            // Producto borrado (físico legado o tombstone) u oculto: en vez de
            // desaparecer en silencio, TARJETA DEGRADADA con el snapshot del
            // item (nombre + imagen). Sin botón de regalar (no se puede comprar).
            if (!estaDisponible(fullProduct)) {
              const nombre = fullProduct?.name || item.productName || 'Producto';
              const imagen = fullProduct?.mainImage || item.productImage || PLACEHOLDER_IMG;
              return (
                <div key={item.productId} className={`${styles.cardWrapper} ${styles.unavailableCard}`}>
                  {item.isGifted && (
                    <div className={styles.giftedOverlay}>
                      ¡Ya regalado! 🎉
                    </div>
                  )}
                  <div className={styles.unavailableImgWrap}>
                    <img
                      className={styles.unavailableImg}
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
                    <span className={styles.unavailableBadge}>Ya no disponible</span>
                  </div>
                  <div className={styles.unavailableInfo}>
                    <h3 className={styles.unavailableName}>{nombre}</h3>
                    <p className={styles.unavailableText}>
                      Este producto ya no está en la tienda.
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div key={item.productId} className={styles.cardWrapper}>
                {item.isGifted && (
                  <div className={styles.giftedOverlay}>
                    ¡Ya regalado! 🎉
                  </div>
                )}
                
                <ProductCard
                  product={fullProduct}
                  onAddToCartOverride={() => handleGift(fullProduct, item)}
                />

                {!item.isGifted && (
                  <button
                    onClick={() => handleGift(fullProduct, item)}
                    className={styles.giftBtnOverlay}
                  >
                    Regalar esto 🎁
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WishlistPublic;
