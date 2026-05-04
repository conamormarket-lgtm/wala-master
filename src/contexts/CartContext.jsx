import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useGlobalToast } from './ToastContext';
import { onSnapshot, doc } from 'firebase/firestore';
import { erpDb } from '../services/erp/firebase';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe usarse dentro de CartProvider');
  }
  return context;
};

const CART_STORAGE_KEY = 'shopping_cart';

export const CartProvider = ({ children }) => {
  const toast = useGlobalToast();

  const [items, setItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.error('Error al cargar carrito:', error);
      return [];
    }
  });

  // Refs para mantener los unsubscribers activos de onSnapshot
  // { [webOrderId]: unsubscribeFn }
  const listenersRef = useRef({});

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // ── Escuchar en tiempo real los pedidos_web pendientes ─────────────────────
  // Cada vez que cambian los ítems del carrito, recalculamos qué webOrderIds
  // deben ser vigilados con un onSnapshot en Firestore.
  useEffect(() => {
    if (!erpDb) return; // ERP Firebase no disponible

    // Extraer webOrderIds únicos de ítems en estado pending_confirmation
    const pendingIds = [
      ...new Set(
        items
          .filter((i) => i.status === 'pending_confirmation' && i.webOrderId)
          .map((i) => i.webOrderId)
      ),
    ];

    // Suscribir listeners para los IDs que aún no se están escuchando
    pendingIds.forEach((webOrderId) => {
      if (listenersRef.current[webOrderId]) return; // ya escuchando

      const docRef = doc(erpDb, 'pedidos_web', webOrderId);
      const unsub = onSnapshot(
        docRef,
        (snapshot) => {
          // Aprobado = documento eliminado de pedidos_web  O  web === false
          const aprobado =
            !snapshot.exists() ||
            snapshot.data()?.web === false;

          if (aprobado) {
            // Quitar del carrito todos los ítems que pertenecen a este pedido
            setItems((prev) => {
              const remaining = prev.filter((i) => i.webOrderId !== webOrderId);
              if (remaining.length < prev.length) {
                toast.success('✅ Tu pedido fue aprobado y confirmado. ¡Gracias!');
              }
              return remaining;
            });

            // Ya no necesitamos seguir escuchando este documento
            if (listenersRef.current[webOrderId]) {
              listenersRef.current[webOrderId]();
              delete listenersRef.current[webOrderId];
            }
          }
        },
        (err) => {
          console.warn(`Error escuchando pedidos_web/${webOrderId}:`, err);
        }
      );

      listenersRef.current[webOrderId] = unsub;
    });

    // Cancelar listeners de webOrderIds que ya no existen en el carrito
    Object.keys(listenersRef.current).forEach((webOrderId) => {
      if (!pendingIds.includes(webOrderId)) {
        listenersRef.current[webOrderId]();
        delete listenersRef.current[webOrderId];
      }
    });
  }, [items, toast]);

  // Limpiar todos los listeners al desmontar el provider
  useEffect(() => {
    return () => {
      Object.values(listenersRef.current).forEach((unsub) => unsub());
      listenersRef.current = {};
    };
  }, []);

  const addToCart = React.useCallback((product, variant = {}, customization = null, quantity = 1, comboData = null) => {
    const selectedVariant = variant.selectedVariant;

    let productImage = '';
    if (product.isComboProduct) {
      productImage = product.comboPreviewImage || product.images?.[0] || '';
    } else if (selectedVariant?.imageUrl) {
      productImage = selectedVariant.imageUrl;
    } else if (product.hasVariants && product.variants?.[0]?.imageUrl) {
      productImage = product.variants[0].imageUrl;
    } else if (product.mainImage) {
      productImage = product.mainImage;
    } else {
      productImage = product.images?.[0] || '';
    }

    if (customization?.imageURL) {
      productImage = customization.imageURL;
    }

    const itemPrice = product.salePrice || product.price;
    const regularPrice = product.salePrice ? product.price : null;

    const variantKey = product.isComboProduct
      ? (comboData ? JSON.stringify(comboData.variantSelections) : '')
      : `${variant.size || ''}_${(selectedVariant?.name ?? variant.color) || ''}`;
    const itemId = `${product.id}_${variantKey}_${Date.now()}`;

    const cartItem = {
      id: itemId,
      productId: product.id,
      productName: product.name,
      productImage,
      price: itemPrice,
      basePrice: product.basePrice || itemPrice,
      regularPrice,
      variant: { ...variant, selectedVariant: selectedVariant ?? undefined },
      customization,
      quantity,
      addedAt: new Date().toISOString(),
      ...(product.isComboProduct && {
        isComboProduct: true,
        comboItems: product.comboItems || [],
        comboLayout: product.comboLayout || { orientation: 'horizontal', spacing: 20 },
        comboVariantSelections: comboData?.variantSelections || {},
        comboCustomizations: comboData?.customizations || {},
        // Datos completos de los sub-productos cargados desde Firestore (nombres, imágenes, vistas)
        comboSubProductsData: comboData?.subProductsData || {},
      })
    };

    setItems(prev => {
      const sameVariant = (a, b) =>
        a.size === b.size &&
        (a.selectedVariant?.name ?? a.color) === (b.selectedVariant?.name ?? b.color);
      const existingIndex = prev.findIndex(item => {
        if (item.productId !== product.id) return false;
        return sameVariant(item.variant, variant) &&
          JSON.stringify(item.customization) === JSON.stringify(customization);
      });

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        toast.success(`Se agregaron ${quantity} unidades de ${product.name} a tu carrito`);
        return updated;
      } else {
        toast.success(`Se agregó ${product.name} a tu carrito`);
        return [...prev, cartItem];
      }
    });
  }, [toast]);

  const removeFromCart = React.useCallback((itemId) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updateQuantity = React.useCallback((itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  }, [removeFromCart]);

  const clearCart = React.useCallback(() => {
    setItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  const getTotalItems = React.useCallback(() => {
    return items.reduce((total, item) => total + item.quantity, 0);
  }, [items]);

  const getTotalPrice = React.useCallback(() => {
    return items.reduce((total, item) => {
      const itemPrice = item.customization?.finalPrice || item.price;
      return total + (itemPrice * item.quantity);
    }, 0);
  }, [items]);

  const value = React.useMemo(() => ({
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice,
    isEmpty: items.length === 0
  }), [items, addToCart, removeFromCart, updateQuantity, clearCart, getTotalItems, getTotalPrice]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
