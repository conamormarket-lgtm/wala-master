import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { variantesDeImagen } from '../services/products';
import { useGlobalToast } from './ToastContext';
import { useAuth } from './AuthContext';
import { onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { erpDb } from '../services/erp/firebase';
import { db, auth } from '../services/firebase/config';
import { PORTAL_USERS_COLLECTION } from '../constants/userCollections';
import { trackAddToCart } from '../services/analytics/tracker';
import { nombreConCreacion } from '../utils/nombreCreacion';
import { fotosGenerales } from '../utils/fotosDeColor';
import { esYoryoPersonalizable, reemplazarDisenoCarrito } from '../utils/yoryoPersonalizacion.mjs';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe usarse dentro de CartProvider');
  }
  return context;
};

const CART_STORAGE_KEY = 'shopping_cart';

// De quién es el carrito de este aparato y cuándo cambió por última vez:
// { uid, cambio } (cambio: ISO, el mismo formato que cart.cartUpdatedAt). Con
// eso, al abrir la tienda en un aparato que ya tenía el carrito de la cuenta,
// gana el cambio más nuevo (el de aquí o el de la nube) en vez de sumar los
// dos: sumarlos devolvía lo que se había borrado en otro aparato.
const CART_META_KEY = 'shopping_cart_meta';
const leerMeta = () => {
  try {
    const m = JSON.parse(localStorage.getItem(CART_META_KEY) || 'null');
    return m && typeof m === 'object' ? m : {};
  } catch {
    return {};
  }
};
const guardarMeta = (meta) => {
  try { localStorage.setItem(CART_META_KEY, JSON.stringify(meta)); } catch { /* sin almacenamiento */ }
};
// Al volver a la pestaña o a la app, se mira la nube como mucho cada 30 s.
const REVISAR_NUBE_CADA_MS = 30_000;

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
  // Una creación de Crear es la misma si es el mismo diseño: comparar todo su
  // contenido (vistas previas, archivos, zonas…) fallaba porque al volver de
  // Firestore los campos llegan en otro orden, y la misma línea se agregaba
  // otra vez en cada restauración (llegó a haber 84 copias de una).
  const custom = item.customization?.designId
    ? `diseno:${item.customization.designId}`
    : jsonEstable(item.customization || null);
  return `${item.productId}__${color}__${size}__${custom}`;
};

/** JSON con las claves de cada objeto ordenadas: el mismo dato, el mismo texto. */
const jsonEstable = (valor) => JSON.stringify(valor, (_, v) => (
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.keys(v).sort().reduce((o, k) => { o[k] = v[k]; return o; }, {})
    : v
));

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
  const indicePorId = new Map();
  const resultado = [];
  for (const item of items) {
    // Mismo id = la MISMA línea copiada (p.ej. por la restauración desde la
    // nube), no un segundo agregado: queda una sola, sin sumar cantidades.
    if (item.id && indicePorId.has(item.id)) {
      const idx = indicePorId.get(item.id);
      const existente = resultado[idx];
      resultado[idx] = { ...existente, quantity: Math.max(existente.quantity || 0, item.quantity || 0) };
      continue;
    }
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
    if (item.id) indicePorId.set(item.id, resultado.length);
    // Las creaciones agregadas antes de que la línea llevara su nombre
    // (mostraban solo "Polera clásica") lo toman al cargar el carrito.
    const nombre = item.customization?.tipo === 'crear' ? String(item.customization.nombre || '').trim() : '';
    resultado.push(nombre && !String(item.productName || '').includes(nombre)
      ? { ...item, productName: nombreConCreacion(item.productName, item.customization) }
      : item);
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
  // Sin galería propia, las generales del producto que no son de otro color
  // (product.images empieza con la foto del primer color: el taller recibía
  // la billetera azul como referencia de una marrón).
  const gallery = matchingVariant?.galleryImages?.length
    ? matchingVariant.galleryImages
    : matchingVariant?.images?.length
      ? matchingVariant.images
      : fotosGenerales(product, matchingVariant);
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

  // Avisos que deciden los updaters de setItems. No se muestran ahí: React
  // corre esos updaters DURANTE el render de CartProvider (y en desarrollo dos
  // veces), y un toast en ese momento actualiza ProveedorToasts en pleno render
  // ("Cannot update a component while rendering a different component"). Se
  // guardan por clave -la segunda pasada pisa la primera en vez de repetir el
  // aviso- y el efecto de abajo los muestra apenas se confirma el cambio.
  const avisosRef = useRef(new Map());
  const avisar = React.useCallback((clave, tipo, mensaje, duracion) => {
    avisosRef.current.set(clave, { tipo, mensaje, duracion });
  }, []);
  useEffect(() => {
    if (avisosRef.current.size === 0) return;
    const pendientes = [...avisosRef.current.values()];
    avisosRef.current.clear();
    pendientes.forEach(({ tipo, mensaje, duracion }) => toast[tipo](mensaje, duracion));
  }, [items, toast]);

  // Lo último de items (para leerlo fuera de un render, al volver de la nube).
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // La cuenta cuyo carrito ya se comparó con la nube en esta pestaña. Hasta
  // entonces no se escribe en la nube: un aparato con el carrito de hace días
  // pisaba lo que se había borrado en otro.
  const listoUidRef = useRef(null);
  // La próxima persistencia no es un cambio de aquí (llega de la nube o es
  // cerrar sesión): guarda este meta y no escribe en la nube.
  const metaSiguienteRef = useRef(null);

  /** Escribe el carrito de la cuenta en la nube con la hora de su cambio. */
  const escribirNube = React.useCallback((uidNube, lista, cambio) => {
    if (!db) return;
    // Vacío también lleva la hora: así otro aparato sabe que se vació (con
    // `null` no se sabía cuándo y volvía lo que tenía guardado).
    setDoc(doc(db, PORTAL_USERS_COLLECTION, uidNube), {
      cart: { items: lista, cartUpdatedAt: cambio, abandonedLevel: 0 },
    }, { merge: true }).catch((err) => {
      console.warn('Error sincronizando carrito con Firestore:', err);
    });
  }, []);

  // Guardar el carrito en localStorage cuando cambie y, con la cuenta ya
  // comparada con la nube, también allí (el aviso de Carrito Abandonado y los
  // demás aparatos lo leen).
  useEffect(() => {
    const serializado = JSON.stringify(items);
    let antes = null;
    try { antes = localStorage.getItem(CART_STORAGE_KEY); } catch { /* nada */ }
    lastCartJsonRef.current = serializado;
    localStorage.setItem(CART_STORAGE_KEY, serializado);

    const siguiente = metaSiguienteRef.current;
    metaSiguienteRef.current = null;
    if (siguiente) { guardarMeta(siguiente); return; }
    // Igual a lo guardado: no cambió nada aquí (al abrir, o lo cambió otra pestaña).
    if (serializado === antes) return;

    const uidSync = auth?.currentUser?.uid || null;
    const listo = Boolean(uidSync) && listoUidRef.current === uidSync;
    const cambio = new Date().toISOString();
    // Hasta compararlo con la nube, el carrito sigue siendo de quien era.
    guardarMeta({ uid: listo ? uidSync : (leerMeta().uid ?? null), cambio });
    if (listo) escribirNube(uidSync, items, cambio);
  }, [items, escribirNube]);

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
      // sin dueño. No es "vaciar el carrito": la nube no se toca y, al volver
      // a entrar, la cuenta recupera lo suyo.
      listoUidRef.current = null;
      metaSiguienteRef.current = { uid: null, cambio: null };
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
  // Se compara al iniciar sesión (una vez por uid por pestaña) y cada vez que
  // se vuelve a la pestaña o a la app (cada 30 s como mucho):
  //  - Si este aparato ya tenía el carrito de ESTA cuenta (meta.uid), gana el
  //    cambio más nuevo: el de la nube reemplaza al de aquí, o el de aquí se
  //    sube. Antes se sumaban los dos y lo borrado en otro aparato volvía (sin
  //    marcar, "No se cobra en esta compra").
  //  - Si era de un invitado (o de antes de esta versión), se FUSIONA como
  //    siempre (mismo criterio de "mismo item" que addToCart): quien agrega
  //    algo y LUEGO inicia sesión no pierde lo que acaba de agregar.
  const comparandoRef = useRef(false);
  const compararConNube = React.useCallback(async (uidNube) => {
    /** Pone una lista que no es un cambio de aquí (con su meta). La misma lista no re-renderiza: solo el meta. */
    const ponerDesdeNube = (lista, meta) => {
      if (lista === itemsRef.current) { guardarMeta(meta); return; }
      metaSiguienteRef.current = meta;
      setItems(lista);
    };
    if (!db || comparandoRef.current) return;
    comparandoRef.current = true;
    try {
      const snap = await getDoc(doc(db, PORTAL_USERS_COLLECTION, uidNube));
      // Cambió la cuenta mientras se leía: lo hará la comparación de la nueva.
      if (auth?.currentUser?.uid !== uidNube) return;
      const cart = snap.exists() ? snap.data()?.cart : null;
      const remotos = Array.isArray(cart?.items) ? cart.items : [];
      const horaNube = typeof cart?.cartUpdatedAt === 'string' ? cart.cartUpdatedAt : null;
      const meta = leerMeta();
      const locales = itemsRef.current;

      if (meta.uid === uidNube) {
        listoUidRef.current = uidNube;
        if (horaNube && (!meta.cambio || horaNube > meta.cambio)) {
          // Cambió en otro aparato después: se toma tal cual.
          if (JSON.stringify(remotos) === JSON.stringify(locales)) { guardarMeta({ uid: uidNube, cambio: horaNube }); return; }
          ponerDesdeNube(consolidarDuplicados(remotos), { uid: uidNube, cambio: horaNube });
        } else if (meta.cambio && (!horaNube || meta.cambio > horaNube)) {
          // Lo de aquí es más nuevo (p.ej. se cambió sin conexión): se sube.
          escribirNube(uidNube, locales, meta.cambio);
        }
        return;
      }

      // Carrito de invitado: se suma lo de la nube que no esté ya aquí.
      // 1) Limpia PRIMERO los duplicados que ya pudiera tener este dispositivo.
      const propios = consolidarDuplicados(locales);
      // 2) De lo que trae la nube, solo entra lo que NO esté ya representado
      //    aquí (por claveDedupItem o por id). Los regalos/combos (clave null)
      //    siempre entran, son su propia línea.
      const clavesLocales = new Set(propios.map(claveDedupItem).filter(Boolean));
      const idsLocales = new Set(propios.map((i) => i.id).filter(Boolean));
      const nuevosDeLaNube = remotos.filter((remoto) => {
        if (remoto?.id && idsLocales.has(remoto.id)) return false;
        const clave = claveDedupItem(remoto);
        return !clave || !clavesLocales.has(clave);
      });
      // 3) Si este equipo ya tenía algo (p.ej. un invitado que inicia sesión a
      //    mitad del checkout), lo de la nube entra SIN marcar: no se cobra en
      //    esta compra, queda para otra vez. Con el carrito local vacío se
      //    restaura tal como estaba guardado.
      let resultado = propios;
      if (nuevosDeLaNube.length > 0) {
        if (propios.length === 0) {
          resultado = consolidarDuplicados(nuevosDeLaNube);
        } else {
          const n = nuevosDeLaNube.length;
          avisar('nube', 'info', n === 1
            ? 'Tu cuenta tenía 1 producto guardado: quedó en tu carrito para otra vez.'
            : `Tu cuenta tenía ${n} productos guardados: quedaron en tu carrito para otra vez.`, 6000);
          resultado = consolidarDuplicados([
            ...propios,
            ...nuevosDeLaNube.map((remoto) => ({ ...remoto, selected: false })),
          ]);
        }
      }
      // Desde aquí el carrito es de la cuenta. Si quedó igual a la nube, se
      // queda con su hora; si no, es un cambio de ahora y se sube.
      listoUidRef.current = uidNube;
      const igualANube = JSON.stringify(resultado) === JSON.stringify(remotos);
      const cambio = igualANube && horaNube ? horaNube : new Date().toISOString();
      ponerDesdeNube(resultado, { uid: uidNube, cambio });
      if (!igualANube) escribirNube(uidNube, resultado, cambio);
    } catch (err) {
      console.warn('No se pudo comparar el carrito con la nube:', err);
    } finally {
      comparandoRef.current = false;
    }
  }, [avisar, escribirNube]);

  useEffect(() => {
    if (!uid || !db) return undefined;
    if (listoUidRef.current !== uid) compararConNube(uid);
    // Una pestaña que quedó abierta (o la app en segundo plano) tenía el
    // carrito de antes: al volver, se compara otra vez.
    let ultima = Date.now();
    const alVolver = () => {
      if (document.visibilityState !== 'visible' || listoUidRef.current !== uid) return;
      if (Date.now() - ultima < REVISAR_NUBE_CADA_MS) return;
      ultima = Date.now();
      compararConNube(uid);
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, [uid, compararConNube]);

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
        setItems(Array.isArray(parsed) ? consolidarDuplicados(parsed) : []);
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
                avisar(`aprobado:${webOrderId}`, 'success', '✅ Tu pedido fue aprobado y confirmado. ¡Gracias!');
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
  }, [items, avisar]);

  // Limpiar todos los listeners al desmontar el provider
  useEffect(() => {
    return () => {
      Object.values(listenersRef.current).forEach((unsub) => unsub());
      listenersRef.current = {};
    };
  }, []);

  const addToCart = React.useCallback((product, variant = {}, customization = null, quantity = 1, comboData = null, options = {}) => {
    if (esYoryoPersonalizable(product) && !customization?.datosYoryo && !(customization?.piezas?.length === 3 && customization.piezas.every((p) => p.datosYoryo))) {
      avisar(`personalizar-${product.id}`, 'info', 'Personaliza este producto antes de agregarlo al carrito.');
      return false;
    }
    // Producto con UNA sola variante (un sérum, un reloj): no hay nada que
    // elegir, así que se usa esa. Sin esto, los "agregar" rápidos (ideas de
    // regalo, lista de deseos…) lo dejaban en el carrito con "Falta elegir
    // color" y no se podía pagar. Si tiene una sola talla, también se usa.
    if (!product.isComboProduct && !variant?.selectedVariant && !variant?.color
      && product.hasVariants && Array.isArray(product.variants) && product.variants.length === 1) {
      const unica = product.variants[0];
      const tallas = Array.isArray(unica?.sizes) ? unica.sizes : [];
      variant = {
        ...(variant || {}),
        selectedVariant: unica,
        ...(!variant?.size && tallas.length === 1 ? { size: tallas[0] } : {}),
      };
    }
    const selectedVariant = variant.selectedVariant;
    const selectedColorName = selectedVariant?.name ?? variant.color ?? '';
    const productReferences = snapshotProductReferences(product, selectedVariant, selectedColorName);

    let productImage = '';
    if (product.isComboProduct) {
      productImage = product.comboPreviewImage || product.images?.[0] || '';
    } else if (selectedVariant?.imageUrl || selectedVariant?.images?.[0] || selectedVariant?.galleryImages?.[0]) {
      // La del color elegido (su principal o, si no tiene, la primera de su galería).
      productImage = selectedVariant.imageUrl || selectedVariant.images?.[0] || selectedVariant.galleryImages[0];
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
      // Una creación de Crear se ve con SU nombre, no solo el de la prenda.
      productName: nombreConCreacion(product.name, customization),
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
        if (!options.silent) avisar(itemId, 'success', `Se agregaron ${quantity} unidades de ${product.name} a tu carrito`);
        return updated;
      } else {
        if (!options.silent) avisar(itemId, 'success', `Se agregó ${product.name} a tu carrito`);
        const base = selectOnly ? prev.map(it => ({ ...it, selected: false })) : prev;
        return [...base, cartItem];
      }
    });
  }, [avisar]);

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

  const actualizarPersonalizacion = React.useCallback((itemId, productoId, nueva, firmaAnterior) => {
    const actual = itemsRef.current.find((i) => i.id === itemId && i.productId === productoId);
    if (!actual || firmaAnterior && JSON.stringify(actual.customization) !== firmaAnterior) return false;
    setItems((prev) => reemplazarDisenoCarrito(prev, itemId, productoId, nueva));
    return true;
  }, []);

  const value = React.useMemo(() => ({
    items,
    addToCart,
    actualizarPersonalizacion,
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
  }), [items, addToCart, actualizarPersonalizacion, removeFromCart, updateQuantity, clearCart, toggleItemSelected, selectAllItems, setAllItemsSelected, removeSelectedItems, clearSelectedItems, getTotalItems, getTotalPrice]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
