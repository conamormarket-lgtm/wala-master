import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getWishlistByUserId, addWishlistItem, removeWishlistItem, createWishlist, syncWishlistUserCode } from '../services/wishlist';

const WishlistContext = createContext();

/**
 * Caché LOCAL (por cuenta) del último wishlistItems conocido — el mismo
 * truco que ya usa CartContext (localStorage de entrada, sin esperar red)
 * para que el ícono de deseos no parpadee "vacío" en cada refresh mientras
 * la wishlist real (que SÍ vive en Firestore, a diferencia del carrito) se
 * revalida en segundo plano. Clave por uid: si cambia de cuenta en el mismo
 * navegador, cada una lee su propia caché (o ninguna) — nunca la ajena.
 */
const wishlistCacheKey = (uid) => `wishlist_cache_${uid}`;

const readCachedWishlist = (uid) => {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(wishlistCacheKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCachedWishlist = (uid, items) => {
  if (!uid) return;
  try {
    localStorage.setItem(wishlistCacheKey(uid), JSON.stringify(items));
  } catch {
    // localStorage puede fallar (privado, cuota llena): no debe romper la app.
  }
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist debe usarse dentro de WishlistProvider');
  }
  return context;
};

export const WishlistProvider = ({ children }) => {
  const { user, userProfile, processChallengeEvent } = useAuth();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      if (!user || !userProfile?.referralCode) {
        setWishlistItems([]);
        setLoading(false);
        return;
      }
      
      // Pinta YA el último estado conocido (localStorage, por cuenta) mientras
      // se revalida contra Firestore en segundo plano. Sin esto, cada refresh
      // encadenaba 2 lecturas de red (perfil -> wishlist) antes de poder
      // mostrar nada, y el ícono se veía "vacío" un momento y luego saltaba
      // al número real -a diferencia del carrito, que lee localStorage de
      // entrada y por eso nunca parpadea-.
      const cached = readCachedWishlist(user.uid);
      if (cached) {
        setWishlistItems(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const { data, error } = await getWishlistByUserId(user.uid);

      if (data && data.items) {
        setWishlistItems(data.items);
        writeCachedWishlist(user.uid, data.items);
        // Autoreparación: si el referralCode del perfil cambió desde que se
        // creó la wishlist, userCode se quedó desalineado y "Compartir mi
        // lista" arma un link que ya no encuentra nada (ver syncWishlistUserCode).
        if (data.userCode !== userProfile.referralCode) {
          syncWishlistUserCode(user.uid, userProfile.referralCode);
        }
      } else if (!error && !data) {
        // Create an empty wishlist if it doesn't exist
        await createWishlist(user.uid, userProfile.referralCode);
        setWishlistItems([]);
        writeCachedWishlist(user.uid, []);
      }
      setLoading(false);
    };

    fetchWishlist();
  }, [user, userProfile]);

  const isFavorite = useCallback((productId) => {
    return wishlistItems.some(item => item.productId === productId);
  }, [wishlistItems]);

  // Envoltorio de setWishlistItems que también actualiza la caché local: sin
  // esto, agregar/quitar un favorito quedaba bien en pantalla pero la caché
  // se quedaba con el estado viejo hasta el próximo fetch, y un refresh
  // rápido justo después mostraba por un instante el estado ANTERIOR al
  // cambio que la persona acababa de hacer.
  const updateItems = useCallback((updater) => {
    setWishlistItems(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      writeCachedWishlist(user?.uid, next);
      return next;
    });
  }, [user?.uid]);

  const toggleFavorite = async (product) => {
    if (!user || !userProfile?.referralCode) {
      // Si no hay usuario, idealmente redirigir a login o mostrar toast
      return { error: 'Debes iniciar sesión para agregar a favoritos' };
    }

    const alreadyFavorite = isFavorite(product.id);

    if (alreadyFavorite) {
      // Remover (Optimistic UI update)
      updateItems(prev => prev.filter(item => item.productId !== product.id));
      const { error } = await removeWishlistItem(user.uid, product.id);
      if (error) {
        // Revert on error
        updateItems(prev => [...prev, { productId: product.id, productName: product.name }]);
        return { error };
      }
    } else {
      // Agregar (Optimistic UI update)
      const newItem = {
        productId: product.id,
        productName: product.name,
        productImage: product.mainImage || product.images?.[0] || '',
        // Precio snapshot (mismo criterio que addWishlistItem en services/wishlist.js):
        // el espejo optimista debe calzar con lo que se persiste en Firestore.
        price: product.salePrice || product.price || 0,
        addedAt: new Date().toISOString(),
        isGifted: false,
        giftedBy: null
      };
      updateItems(prev => [...prev, newItem]);

      const { data, error } = await addWishlistItem(user.uid, userProfile.referralCode, product);
      if (error) {
        // Revert on error
        updateItems(prev => prev.filter(item => item.productId !== product.id));
        return { error };
      } else if (data) {
        // Update with actual data from backend if needed
        updateItems(prev => prev.map(item => item.productId === product.id ? data : item));
      }

      // Hook para el reto semanal
      if (processChallengeEvent) {
        processChallengeEvent('add_wishlist', 1);
      }
    }

    return { success: true };
  };

  const value = {
    wishlistItems,
    loading,
    isFavorite,
    toggleFavorite
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};
