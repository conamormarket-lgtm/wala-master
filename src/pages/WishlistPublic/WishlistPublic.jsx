import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Gift } from 'lucide-react';
import { getWishlistByUserCode } from '../../services/wishlist';
import { getCategories } from '../../services/products';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { useProducts } from '../../hooks/useProducts';
// La misma tarjeta que usa la Tienda (ver el mismo fix en WishlistPage.jsx):
// ProductCard, el componente "viejo", ponía el botón de carrito pegado al
// precio y no resolvía la categoría real. showQuickAdd={false} apaga su
// overlay interno porque esta página YA trae su propio botón "Regalar esto"
// -con los dos a la vez había DOS controles compitiendo por la misma acción-.
import PremiumProductCard from '../Tienda/components/PremiumProductCard/PremiumProductCard';
import Loading from '../../components/common/Loading';
import { PLACEHOLDER_IMG } from '../../constants/placeholder';
import styles from './WishlistPublic.module.css';
import { T } from '../../i18n/useTranslatedText';

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
  // Sin esto, PremiumProductCard no tiene con qué resolver la categoría real
  // del producto y cae en su fallback genérico "Esencial" para TODO (mismo
  // fix que WishlistPage.jsx).
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error: err } = await getCategories();
      if (err) throw new Error(err);
      return data;
    }
  });
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

      // Nombre real del dueño: un visitante anónimo NO puede leer
      // portal_clientes_users/{uid} directo (firestore.rules exige ser el
      // dueño o admin), así que antes esto fallaba en silencio y el nombre se
      // quedaba en el fallback 'Alguien' SIEMPRE. getPublicGiftRegistry ya
      // resuelve esto mismo (mismo referralCode/userCode) devolviendo solo el
      // nombre público -sin exponer el perfil completo-, así que se reutiliza
      // en vez de crear una Cloud Function nueva para lo mismo.
      if (data.userId) {
        try {
          const callable = httpsCallable(getFunctions(), 'getPublicGiftRegistry');
          const { data: registry } = await callable({ referralCode: userCode });
          if (registry?.ok && registry.ownerName) {
            setOwnerName(registry.ownerName);
          }
        } catch (e) {
          console.error("Error fetching owner name:", e);
        }
      }

      setLoading(false);

      // Avisa al dueño que alguien visitó su lista. Antes era un addDoc directo
      // sobre users/{uid}/notifications, que firestore.rules rechaza para
      // cualquiera que no sea el propio dueño o un admin -es decir, SIEMPRE
      // fallaba para un visitante-. Ahora corre en el servidor (Admin SDK
      // bypassa esa regla). Best-effort: si falla, la página sigue igual
      // (mismo criterio que antes, solo que ahora el aviso sí puede llegar).
      if (data.userId) {
        try {
          const notify = httpsCallable(getFunctions(), 'notifyWishlistVisitSecure');
          await notify({ userId: data.userId });
        } catch (e) {
          console.error("Error notifying owner:", e);
        }
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
    // Mismo spinner circular de marca que Login/Registro/AdminStoreEditor
    // (componente Loading) en vez de un simple texto plano.
    return <Loading fullScreen portal message="Cargando lista de deseos..." />;
  }

  if (error || !wishlist) {
    return (
      <div className={styles.container}>
        <h2><T>Lista no encontrada</T></h2>
        <p><T>El enlace que seguiste no es válido o la lista ya no existe.</T></p>
        <Link to="/tienda" className={styles.primaryBtn}><T>Ir a la tienda</T></Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>
          Lista de deseos de {ownerName}
          <Gift className={styles.headerTitleIcon} size={28} strokeWidth={2.25} aria-hidden="true" />
        </h1>
        <p><T>Elige un regalo de esta lista y sorpréndele.</T></p>
      </div>

      {wishlist.items?.length === 0 ? (
        <div className={styles.emptyState}>
          <p><T>Esta lista está vacía actualmente.</T></p>
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
                    <span className={styles.unavailableBadge}><T>Ya no disponible</T></span>
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
                
                <PremiumProductCard
                  product={fullProduct}
                  categories={categories}
                  showQuickAdd={false}
                />

                {!item.isGifted && (
                  <button
                    onClick={() => handleGift(fullProduct, item)}
                    className={styles.giftBtnOverlay}
                  >
                    <Gift size={18} strokeWidth={2.25} aria-hidden="true" />
                    Regalar esto
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
