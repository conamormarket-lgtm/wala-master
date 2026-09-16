import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { variantesDeImagen } from '../services/products';
import { useGlobalToast } from './ToastContext';
import { useAuth } from './AuthContext';
import { onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { erpDb } from '../services/erp/firebase';
import { db, auth } from '../services/firebase/config';
import { PORTAL_USERS_COLLECTION } from '../constants/userCollections';
import { trackAddToCart } from '../services/analytics/tracker';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe usarse dentro de CartProvider');
  }
  return context;
};

const CART_STORAGE_KEY = 'shopping_cart';

/**
 * Clave de "mismo producto" para deduplicar líneas del carrito: productId +
 * color + talla + personalización, TODO normalizado (trim/lowercase, y
 * null/undefined/'' tratados como equivalentes). Un regalo (wishlist pública
 * / registro de regalos) o un combo SIEMPRE es su propia línea -mismo
 * criterio que ya usa addToCart- y por eso nunca se fusiona (retorna null).
 *
 * Por qué normalizar tan a fondo: dos líneas del MISMO producto sin variantes
 * pueden llegar con el campo color/size como null en una y '' en otra según
 * por qué camino se agregaron (fecha del código, quick-add vs. ficha, o un
 * carrito viejo restaurado desde la nube) — una comparación estricta (===)
 * las trataba como productos DISTINTOS y terminaban duplicadas en vez de
 * sumar cantidad en una sola fila.
 */
const claveDedupItem = (item) => {
  if (item.isWishlistGift || item.deliveryDate || item.isComboProduct) return null;
  const color = String(item.variant?.selectedVariant?.name || item.variant?.color || '').trim().toLowerCase();
  const size = String(item.variant?.size || '').trim().toLowerCase();
  const custom = JSON.stringify(item.customization || null);
  return `${item.productId}__${color}__${size}__${custom}`;
};

/**
 * Fusiona líneas duplicadas del carrito (misma claveDedupItem) sumando
 * cantidades, en vez de dejarlas como filas separadas. Si CUALQUIERA de las
 * copias estaba seleccionada, la fusionada queda seleccionada (agregar de
 * nuevo algo marcado "no comprar esta vez" se interpreta como "sí lo quiero
 * ahora"). Se corre al cargar el carrito (localStorage) y después de
 * fusionar con la nube, para autolimpiar duplicados de cualquier origen.
 */
const consolidarDuplicados = (items) => {
  if (!Array.isArray(items) || items.length === 0) return items || [];
  const indicePorClave = new Map();
  const resultado = [];
  for (const item of items) {
    const clave = claveDedupItem(item);
    if (clave && indicePorClave.has(clave)) {
      const idx = indicePorClave.get(clave);
      const existente = resultado[idx];
      resultado[idx] = {
        ...existente,
        quantity: (existente.quantity || 0) + (item.quantity || 0),
        selected: existente.selected !== false || item.selected !== false,
      };
      continue;
    }
    if (clave) indicePorClave.set(clave, resultado.length);
    resultado.push(item);
  }
  return resultado;
};

const snapshotProductReferences = (product, selectedVariant, colorName) => {
  const references = [];
  const seen = new Set();
  const push = (url, lado) => {
    if (typeof url !== 'string' || !url.trim() || seen.has(url.trim())) return;
    seen.add(url.trim());
    references.push({ url: url.trim(), lado, color: colorName || '' });
  };
  const normalizedColor = String(colorName || '').trim().toLowerCase();
  const matchingVariant = selectedVariant || (product.variants || []).find(
    (candidate) => String(candidate?.name || '').trim().toLowerCase() === normalizedColor
  );

  (product.customizationViews || []).forEach((view) => {
    const frontKey = Object.keys(view?.imagesByColor || {}).find(
      (key) => key.trim().toLowerCase() === normalizedColor
    );
    if (frontKey) push(view.imagesByColor[frontKey], view.name || 'Frente');
    const backKey = Object.keys(view?.backSide?.imagesByColor || {}).find(
      (key) => key.trim().toLowerCase() === normalizedColor
    );
    if (backKey) push(view.backSide.imagesByColor[backKey], view.backSide?.name || 'Espalda');
  });

  push(matchingVariant?.imageUrl, 'Frente');
  const gallery = matchingVariant?.galleryImages?.length
    ? matchingVariant.galleryImages
    : matchingVariant?.images?.length
      ? matchingVariant.images
      : product.images || [];
  gallery.forEach((url, index) => push(url, index === 0 ? 'Frente' : index === 1 ? 'Espalda' : `Vista ${index + 1}`));
  if (references.length === 0) push(product.mainImage, 'Frente');

  return {
    colorHex: matchingVariant?.colorHex || '',
    references,
  };
};

export const CartProvider = ({ children }) => {
  const toast = useGlobalToast();

  // Usuario autenticado desde AuthContext (AuthProvider envuelve a CartProvider
  // en App.jsx). Se usa SOLO para detectar logout / cambio de cuenta; el sync a
  // Firestore sigue usando auth.currentUser como hasta ahora (sin tocar pagos).
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [items, setItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      return savedCart ? consolidarDuplicados(JSON.parse(savedCart)) : [];
    } catch (error) {
      console.error('Error al cargar carrito:', error);
      return [];
    }
  });

  // Refs para mantener los unsubscribers activos de onSnapshot
  // { [webOrderId]: unsubscribeFn }
  const listenersRef = useRef({});

  // Último JSON del carrito escrito por ESTA pestaña. Guard anti-ciclo del
  // listener 'storage' multi-pestaña: si el valor que llega es el que nosotros
  // mismos escribimos, se ignora (no re-hidratar ni re-escribir en bucle).
  const lastCartJsonRef = useRef(null);

  // Guardar carrito en localStorage cuando cambie y en Firestore si el usuario está logueado
  useEffect(() => {
    const serializado = JSON.stringify(items);
    lastCartJsonRef.current = serializado;
    localStorage.setItem(CART_STORAGE_KEY, serializado);

    // Sync con Firestore para notificaciones de Carrito Abandonado
    if (auth?.currentUser && db) {
      // uidSync: renombrado para no hacer shadowing del uid del provider (arriba).
      const uidSync = auth.currentUser.uid;
      const docRef = doc(db, PORTAL_USERS_COLLECTION, uidSync);
      
      const cartData = items.length > 0 ? {
        items,
        cartUpdatedAt: new Date().toISOString(),
        abandonedLevel: 0
      } : null; // Si está vacío, limpiamos el cart del usuario
      
      setDoc(docRef, { cart: cartData }, { merge: true }).catch(err => {
        console.warn('Error sincronizando carrito con Firestore:', err);
      });
    }
  }, [items]);

  // ── Carrito por usuario: limpiar al CERRAR SESIÓN o CAMBIAR de cuenta ──────
  // prevUidRef arranca en `undefined` para distinguir el PRIMER render y no
  // limpiar en el arranque anónimo normal. Casos:
  //   - Arranque anónimo (uid null desde el inicio)  → NO limpiar.
  //   - LOGIN normal (null → uid)                    → NO limpiar (el invitado
  //     conserva su carrito al iniciar sesión).
  //   - LOGOUT (uid → null)                          → LIMPIAR: el carrito era
  //     de ese usuario; evita herencia en una PC compartida.
  //   - CAMBIO de cuenta (uid A → uid B)             → LIMPIAR ANTES de que el
  //     efecto de sync (que solo corre cuando `items` cambia) pueda escribir el
  //     carrito de A en portal_clientes_users/B.cart.
  const prevUidRef = useRef(undefined);
  useEffect(() => {
    const prevUid = prevUidRef.current;
    prevUidRef.current = uid;
    if (prevUid === undefined) return; // primer render: solo registrar el uid
    const huboLogout = !!prevUid && !uid;
    const cambioDeCuenta = !!prevUid && !!uid && prevUid !== uid;
    if (huboLogout || cambioDeCuenta) {
      // setItems([]) dispara el efecto de persistencia: localStorage queda '[]'
      // y (solo si hay un usuario NUEVO logueado) su cart en Firestore se limpia.
      setItems([]);
    }
  }, [uid]);

  // ── Restaurar el carrito guardado en la nube al iniciar sesión ────────────
  // El efecto de arriba (persistencia) YA escribía el carrito en
  // portal_clientes_users/{uid}.cart, pero solo para el aviso de "Carrito
  // Abandonado" -nadie lo volvía a LEER-. Si entrabas desde otro dispositivo
  // (o el mismo, después de un logout que limpia el carrito local a propósito)
  // no aparecía nada: el carrito de la nube existía, pero este dispositivo
  // nunca lo pedía.
  //
  // Se restaura UNA vez por uid por sesión de pestaña (restoredUidRef), y se
  // FUSIONA con lo que ya haya en este dispositivo (mismo criterio de "mismo
  // item" que addToCart: productId + color + talla + personalización) en vez
  // de reemplazar — así un invitado que agrega algo y LUEGO inicia sesión no
  // pierde lo que acaba de agregar aquí.
  const restoredUidRef = useRef(null);
  useEffect(() => {
    if (!uid || !db) return;
    if (restoredUidRef.current === uid) return;
    restoredUidRef.current = uid;

    (async () => {
      try {
        const snap = await getDoc(doc(db, PORTAL_USERS_COLLECTION, uid));
        const remoteItems = snap.exists() ? snap.data()?.cart?.items : null;
        if (!Array.isArray(remoteItems) || remoteItems.length === 0) return;

        setItems((prev) => {
          // 1) Limpia PRIMERO los duplicados que ya pudiera tener este dispositivo
          //    (de cualquier origen, no solo de esta fusión).
          const propios = consolidarDuplicados(prev);
          // 2) De lo que trae la nube, solo entra lo que NO esté ya representado
          //    aquí (por claveDedupItem) — si ya está, es la misma línea synced
          //    en un reload normal y sumarla de nuevo duplicaría la cantidad.
          //    Los regalos/combos (clave null) siempre entran, son su propia línea.
          const clavesLocales = new Set(propios.map(claveDedupItem).filter(Boolean));
          const nuevosDeLaNube = remoteItems.filter((remoto) => {
            const clave = claveDedupItem(remoto);
            return !clave || !clavesLocales.has(clave);
          });
          if (nuevosDeLaNube.length === 0) return propios;
          return consolidarDuplicados([...propios, ...nuevosDeLaNube]);
        });
      } catch (err) {
        console.warn('No se pudo restaurar el carrito guardado en la nube:', err);
      }
    })();
  }, [uid]);

  // ── Multi-pestaña: re-hidratar el carrito cuando OTRA pestaña lo cambie ────
  // El evento 'storage' solo se dispara en las demás pestañas (no en la que
  // escribió). Aun así comparamos contra lastCartJsonRef (lo último que escribió
  // ESTA pestaña) como guard extra para no ciclar re-escrituras.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== CART_STORAGE_KEY) return;
      if (e.newValue === lastCartJsonRef.current) return; // eco propio / sin cambio real
      try {
        // newValue null = otra pestaña hizo removeItem (p.ej. clearCart) → carrito vacío.
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        setItems(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        console.warn('Carrito multi-pestaña: JSON inválido en storage:', error);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

  const addToCart = React.useCallback((product, variant = {}, customization = null, quantity = 1, comboData = null, options = {}) => {
    const selectedVariant = variant.selectedVariant;
    const selectedColorName = selectedVariant?.name ?? variant.color ?? '';
    const productReferences = snapshotProductReferences(product, selectedVariant, selectedColorName);

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

    // Copias pequeñas de esa foto. El carrito guarda un snapshot y la vista
    // previa del header la pinta a 60 px: sin esto pedía la imagen entera.
    // Una imagen de personalización es única de este pedido y no tiene copias.
    const variantesImagen = customization?.imageURL ? undefined : variantesDeImagen(product, productImage);

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
      // Omitida si no hay: Firestore rechaza undefined.
      ...(variantesImagen ? { productImageVariantes: variantesImagen } : {}),
      productImage,
      productReferenceImages: productReferences.references,
      // Marca del producto: permite dividir el WhatsApp del checkout por marca
      // (cada asesor recibe solo sus productos). Aditivo; null si no tiene marca.
      brandId: product.brandId || null,
      price: itemPrice,
      basePrice: product.basePrice || itemPrice,
      regularPrice,
      // FIX COLOR: normalizamos el color EN ORIGEN. ProductDetail pasa el color
      // dentro de selectedVariant.name (sin campo color) y el checkout lee
      // item.variant?.color → sin esto el pedido salía con color vacío.
      // EditorPage sí manda color plano: selectedVariant es undefined y se
      // conserva variant.color tal cual (sin duplicar ni romper la forma actual).
      variant: {
        ...variant,
        color: selectedColorName || null,
        colorHex: productReferences.colorHex || selectedVariant?.colorHex || variant.colorHex || '',
        selectedVariant: selectedVariant ?? null,
      },
      customization,
      quantity,
      // Selección de compra: por defecto el item se compra (true).
      // "No comprar esta vez" lo deja en false → excluido del total/contador/pago,
      // pero permanece en el carrito (reversible con "Comprar esta vez").
      selected: true,
      addedAt: new Date().toISOString(),
      // ── Contexto de REGALO (wishlist pública / registro de regalos por fecha) ──
      // ADITIVO: solo se copia si el producto trae los flags (WishlistPublic / GiftRegistryPage).
      // SIN esto el checkout NO detectaba el regalo: los flags se perdían al armar el cartItem.
      ...(product.isWishlistGift && {
        isWishlistGift: true,
        wishlistUserCode: product.wishlistUserCode || null,
      }),
      ...(product.deliveryDate && {
        deliveryDate: product.deliveryDate,
        deliveryEventLabel: product.deliveryEventLabel || null,
        deliveryRecipient: product.deliveryRecipient || null,
      }),
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

    // ── Analytics: emitir evento add_to_cart (embudo) ─────────────────────
    // No bloquea ni rompe el flujo del carrito: cualquier error se ignora.
    // Enviamos datos REALES del producto (id, nombre, precio, cantidad) para
    // que el panel 'Carrito' del dashboard sea legible sin lecturas extra.
    try {
      const unitPrice = customization?.finalPrice || itemPrice || 0;
      const productName = product.name || product.productName || 'Producto sin nombre';
      // ── Variante seleccionada (color/talla) si existe en este add to cart. ──
      const varianteSel = {
        ...((selectedVariant?.name ?? variant.color) && {
          color: selectedVariant?.name ?? variant.color,
        }),
        ...(variant.size && { talla: variant.size }),
      };
      trackAddToCart(
        {
          productId: product.id,
          name: productName,
          price: unitPrice,
          qty: quantity,
          category: product.category || product.categoria || null,
          totalCents: Math.round(unitPrice * quantity * 100),
          currency: 'PEN',
          // ── Enriquecimiento aditivo: solo IDs que el producto realmente tenga. ──
          ...(product.categoryId && { categoryId: product.categoryId }),
          ...(product.collectionId && { collectionId: product.collectionId }),
          ...(product.lineaProducto && { lineaProducto: product.lineaProducto }),
          ...(product.brandId && { brandId: product.brandId }),
          ...(Object.keys(varianteSel).length > 0 && { variante: varianteSel }),
        },
        auth?.currentUser
          ? {
              uid: auth.currentUser.uid,
              email: auth.currentUser.email,
              displayName: auth.currentUser.displayName,
            }
          : {}
      ).catch(() => {});
    } catch (_e) {
      // Tracking nunca debe afectar la experiencia de compra.
    }

    setItems(prev => {
      // MISMA clave que usan consolidarDuplicados/la fusión con la nube (ver
      // claveDedupItem arriba): antes esta comparación era su propia lógica
      // aparte (sameVariant) y comparaba item.variant (ya normalizado, con
      // color:null) contra el `variant` CRUDO de este llamado (p.ej. {} en un
      // "agregar todo" -> color:undefined). null !== undefined, así que el
      // MISMO producto sin variantes terminaba en una fila nueva cada vez en
      // vez de sumar cantidad. claveDedupItem normaliza los dos lados igual,
      // y ya trae la regla de "un regalo/combo siempre es su propia línea".
      const clave = claveDedupItem(cartItem);
      const existingIndex = clave ? prev.findIndex(item => claveDedupItem(item) === clave) : -1;

      // "Comprar ahora": deja seleccionado SOLO este item (los demás permanecen en
      // el carrito pero deseleccionados), para que el checkout pague únicamente este.
      const selectOnly = options.selectOnly === true;

      if (existingIndex >= 0) {
        const updated = prev.map((it, idx) => {
          if (idx === existingIndex) {
            return { ...it, quantity: it.quantity + quantity, ...(selectOnly && { selected: true }) };
          }
          return selectOnly ? { ...it, selected: false } : it;
        });
        if (!options.silent) toast.success(`Se agregaron ${quantity} unidades de ${product.name} a tu carrito`);
        return updated;
      } else {
        if (!options.silent) toast.success(`Se agregó ${product.name} a tu carrito`);
        const base = selectOnly ? prev.map(it => ({ ...it, selected: false })) : prev;
        return [...base, cartItem];
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

  // Alterna la selección de compra de un item (true ↔ false).
  // Los items sin la propiedad 'selected' se consideran seleccionados.
  const toggleItemSelected = React.useCallback((itemId) => {
    setItems(prev =>
      prev.map(i =>
        i.id === itemId
          ? { ...i, selected: i.selected === false ? true : false }
          : i
      )
    );
  }, []);

  // Selecciona TODOS los items del carrito (para "Comprar todo el carrito").
  const selectAllItems = React.useCallback(() => {
    setItems(prev => prev.map(i => (i.selected === false ? { ...i, selected: true } : i)));
  }, []);

  // Marca o desmarca TODOS a la vez: lo usa la casilla "Seleccionar todo" del
  // carrito, que necesita las dos direcciones (selectAllItems solo marca).
  const setAllItemsSelected = React.useCallback((selected) => {
    setItems(prev => prev.map(i => ({ ...i, selected: Boolean(selected) })));
  }, []);

  // Quita del carrito los items marcados (accion "Eliminar seleccionados").
  const removeSelectedItems = React.useCallback(() => {
    setItems(prev => prev.filter(i => i.selected === false));
  }, []);

  // Tras pagar: conserva SOLO los items NO seleccionados ("no comprar esta vez").
  // Los items seleccionados (los que se pagaron) se quitan del carrito.
  // El efecto existente sincroniza localStorage/Firestore automáticamente.
  const clearSelectedItems = React.useCallback(() => {
    setItems(prev => prev.filter(i => i.selected === false));
  }, []);

  const getTotalItems = React.useCallback(() => {
    // Excluye del contador los items deseleccionados (selected === false).
    return items.reduce((total, item) => total + (item.selected !== false ? item.quantity : 0), 0);
  }, [items]);

  const getTotalPrice = React.useCallback(() => {
    return items.reduce((total, item) => {
      // Los items deseleccionados no suman al total (no se cobran).
      if (item.selected === false) return total;
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
    toggleItemSelected,
    selectAllItems,
    setAllItemsSelected,
    removeSelectedItems,
    clearSelectedItems,
    getTotalItems,
    getTotalPrice,
    isEmpty: items.length === 0
  }), [items, addToCart, removeFromCart, updateQuantity, clearCart, toggleItemSelected, selectAllItems, setAllItemsSelected, removeSelectedItems, clearSelectedItems, getTotalItems, getTotalPrice]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
