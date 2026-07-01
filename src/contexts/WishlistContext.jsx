import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getWishlistByUserId, addWishlistItem, removeWishlistItem, createWishlist } from '../services/wishlist';

const WishlistContext = createContext();

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
      
      setLoading(true);
      const { data, error } = await getWishlistByUserId(user.uid);
      
      if (data && data.items) {
        setWishlistItems(data.items);
      } else if (!error && !data) {
        // Create an empty wishlist if it doesn't exist
        await createWishlist(user.uid, userProfile.referralCode);
        setWishlistItems([]);
      }
      setLoading(false);
    };

    fetchWishlist();
  }, [user, userProfile]);

  const isFavorite = useCallback((productId) => {
    return wishlistItems.some(item => item.productId === productId);
  }, [wishlistItems]);

  const toggleFavorite = async (product) => {
    if (!user || !userProfile?.referralCode) {
      // Si no hay usuario, idealmente redirigir a login o mostrar toast
      return { error: 'Debes iniciar sesión para agregar a favoritos' };
    }

    const alreadyFavorite = isFavorite(product.id);
    
    if (alreadyFavorite) {
      // Remover (Optimistic UI update)
      setWishlistItems(prev => prev.filter(item => item.productId !== product.id));
      const { error } = await removeWishlistItem(user.uid, product.id);
      if (error) {
        // Revert on error
        setWishlistItems(prev => [...prev, { productId: product.id, productName: product.name }]);
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
      setWishlistItems(prev => [...prev, newItem]);
      
      const { data, error } = await addWishlistItem(user.uid, userProfile.referralCode, product);
      if (error) {
        // Revert on error
        setWishlistItems(prev => prev.filter(item => item.productId !== product.id));
        return { error };
      } else if (data) {
        // Update with actual data from backend if needed
        setWishlistItems(prev => prev.map(item => item.productId === product.id ? data : item));
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
