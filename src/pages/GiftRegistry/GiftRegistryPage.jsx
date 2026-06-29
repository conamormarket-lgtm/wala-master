// =========================================================================
// Walá — GiftRegistryPage (Feature B "Mis fechas especiales")
// -------------------------------------------------------------------------
// Registro público de regalos por fecha. Vive en la ruta
// /regalar/:referralCode (la cablea el orquestador en App.jsx).
//
// Quien abre el enlace ve:
//   1) Las fechas especiales del dueño como COLUMNAS de entrega (zonas de drop).
//   2) La wishlist del dueño con precio/imagen reales del catálogo.
//
// FLUJO NUEVO (rediseño):
//   - Cada producto de la wishlist se renderiza como una TARJETA A MEDIDA
//     (GiftProductCard) que se puede ARRASTRAR desde su imagen.
//   - Al soltar el producto sobre una FECHA, NO se agrega al carrito: se crea
//     una ASIGNACIÓN (assignments[dateKey]). Cada fecha muestra arriba un botón
//     "Proceder a regalar (N)" que recién entonces agrega todo al carrito y va
//     al checkout.
//   - El nombre del producto es un <Link> al detalle: tocar el nombre navega;
//     arrastrar la imagen mueve la tarjeta. Así evitamos el "drag nativo" del
//     navegador (imagen fantasma / cursor denegado).
//
// ARRASTRE (reescrito para eliminar el PARPADEO):
//   - Antes usábamos framer-motion (drag + dragSnapToOrigin + whileDrag). El
//     setDraggingId en onDragStart re-renderizaba TODA la lista a mitad del
//     gesto e interrumpía el transform de framer-motion => flicker y la tarjeta
//     "saltaba"/desaparecía.
//   - Ahora el arrastre se basa en Pointer Events (desktop + touch en una sola
//     ruta) gestionados por el hook useGiftDrag:
//       1) La tarjeta ORIGEN nunca se desmonta ni cambia de key: solo recibe la
//          clase .dragging (opacidad reducida). Sigue montada en su sitio.
//       2) Un GHOST en position:fixed (renderizado por portal en <body>) sigue
//          al puntero con transform — clon visual estable de la tarjeta, sin
//          re-montar el origen, sin imagen fantasma del navegador.
//       3) La fecha bajo el puntero se resalta en vivo (dropTargetKey) como
//          zona de soltado; al soltar, se asigna producto -> fecha (lógica
//          intacta: assignToDate / handleCardDrop).
//
// SEGURIDAD (decisión del usuario — enfoque SEGURO):
//   La página NO lee Firestore directamente. Pide los datos mínimos a la
//   Cloud Function `getPublicGiftRegistry({ referralCode })`, que devuelve
//   SOLO { ownerName, dates, wishlistItems }.
//
// REUTILIZACIÓN (cambios ADITIVOS):
//   Arma un productMock con los flags isWishlistGift + wishlistUserCode (igual
//   que WishlistPublic) + el contexto de entrega (deliveryDate /
//   deliveryEventLabel / deliveryRecipient) y lo manda al carrito → checkout.
//   No toca CartContext ni el checkout.
// =========================================================================

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { useProducts } from '../../hooks/useProducts';
import AuroraBackground from '../../components/ui/AuroraBackground';
import GlassCard from '../../components/ui/GlassCard';
import GlassButton from '../../components/ui/GlassButton';
import styles from './GiftRegistryPage.module.css';

// Formatea 'YYYY-MM-DD' a 'DD/MM/YYYY' de forma segura (sin Date para evitar
// corrimientos por zona horaria). Si no matchea, devuelve el valor crudo.
const formatearFecha = (iso) => {
  if (typeof iso !== 'string') return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mes, d] = m;
  return `${d}/${mes}/${y}`;
};

// Compone el label humano de una fecha a partir de lo que envía la CF:
// base (label/type) + nombre del tercero + relación con el dueño.
// Ej: "Cumpleaños" → "Cumpleaños de Mamá (Padre/Madre)".
const construirLabel = (date) => {
  const base = date?.label || date?.type || 'Fecha especial';
  const nombre = date?.recipientName ? ` de ${date.recipientName}` : '';
  const rel = date?.relation ? ` (${date.relation})` : '';
  return `${base}${nombre}${rel}`;
};

// =========================================================================
// useGiftDrag — hook de arrastre por Pointer Events (sin parpadeo).
// -------------------------------------------------------------------------
// Centraliza TODO el gesto en un único pointermove/up a nivel window:
//   - drag: estado del arrastre activo { productId, cardProduct, item, x, y,
//     w, h, offsetX, offsetY, image, name } o null. Mientras es != null se
//     renderiza el GHOST (position:fixed) que sigue al puntero.
//   - dropTargetKey: la fecha [data-date-key] bajo el puntero (para resaltarla).
//   - start(e, payload): se llama desde el pointerdown de la zona de imagen.
//
// Claves anti-flicker:
//   - El estado del puntero (x/y) se guarda en un REF y se aplica al ghost por
//     manipulación directa del DOM (transform), NO por setState en cada move:
//     así NO re-renderizamos la lista en cada píxel. Solo hacemos setState al
//     iniciar, al cambiar de fecha resaltada y al terminar.
//   - El origen no se desmonta: el componente padre solo le pone .dragging.
// =========================================================================
const DRAG_THRESHOLD = 6; // px que hay que mover antes de considerar "arrastre"

const useGiftDrag = ({ onDrop }) => {
  const [drag, setDrag] = useState(null);       // payload del arrastre activo (o null)
  const [dropTargetKey, setDropTargetKey] = useState(null); // fecha resaltada
  const ghostRef = useRef(null);                // nodo del ghost (para mover por transform)
  const stateRef = useRef(null);                // datos vivos del gesto (sin re-render)

  // onDrop se guarda en un ref y se mantiene fresco SIN cambiar la identidad de
  // los handlers: así los listeners de window se agregan/quitan con la MISMA
  // referencia aunque el componente re-renderice a mitad del gesto (clave para
  // que removeEventListener funcione y no queden listeners colgados).
  const onDropRef = useRef(onDrop);
  useEffect(() => { onDropRef.current = onDrop; }, [onDrop]);

  // Resuelve qué columna de fecha hay bajo un punto de pantalla.
  const hitDateKey = useCallback((x, y) => {
    const zonas = document.querySelectorAll('[data-date-key]');
    for (const zona of zonas) {
      const r = zona.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return zona.getAttribute('data-date-key');
      }
    }
    return null;
  }, []);

  // pointermove global: mueve el ghost por transform (sin setState) y actualiza
  // la fecha resaltada solo cuando cambia (setState mínimo).
  const handleMove = useCallback((e) => {
    const st = stateRef.current;
    if (!st) return;
    const x = e.clientX;
    const y = e.clientY;
    st.x = x;
    st.y = y;

    // Aún no superamos el umbral: no "arrastramos" todavía (deja pasar taps).
    if (!st.active) {
      if (Math.hypot(x - st.startX, y - st.startY) < DRAG_THRESHOLD) return;
      st.active = true;
      // Evita selección de texto y el cursor de texto durante el arrastre real.
      document.body.classList.add(styles.dragActiveBody);
      // Activa el ghost (1 render). Incluimos la posición inicial para que el
      // DragGhost MONTE ya colocado bajo el puntero (sin un frame en 0,0).
      setDrag({
        ...st.payload,
        w: st.w,
        h: st.h,
        initX: x - st.offsetX,
        initY: y - st.offsetY,
      });
    }

    // Mueve el ghost directamente (centrado en el puntero, conservando offset).
    if (ghostRef.current) {
      ghostRef.current.style.transform =
        `translate3d(${x - st.offsetX}px, ${y - st.offsetY}px, 0) rotate(-3deg)`;
    }

    // Resalta la fecha bajo el puntero solo si cambió.
    const key = hitDateKey(x, y);
    if (key !== st.lastKey) {
      st.lastKey = key;
      setDropTargetKey(key);
    }
  }, [hitDateKey]);

  // pointerup global: si hubo arrastre real, intenta el drop; siempre limpia.
  const handleUp = useCallback((e) => {
    const st = stateRef.current;
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
    window.removeEventListener('pointercancel', handleUp);
    if (st && st.active) {
      const key = hitDateKey(e.clientX, e.clientY);
      if (key) onDropRef.current(key, st.payload.cardProduct, st.payload.item);
    }
    document.body.classList.remove(styles.dragActiveBody);
    stateRef.current = null;
    setDrag(null);
    setDropTargetKey(null);
  }, [handleMove, hitDateKey]);

  // start: se invoca desde el pointerdown de la zona de imagen del producto.
  const start = useCallback((e, payload) => {
    // Solo botón principal / touch / pen (ignora click derecho).
    if (e.button != null && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    stateRef.current = {
      payload,
      active: false,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      // El ghost replica el tamaño de la tarjeta y se ancla donde se agarró.
      w: rect.width,
      h: rect.height,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      lastKey: null,
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, [handleMove, handleUp]);

  // Limpieza defensiva si el componente se desmonta a mitad de gesto.
  useEffect(() => () => {
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
    window.removeEventListener('pointercancel', handleUp);
    document.body.classList.remove(styles.dragActiveBody);
  }, [handleMove, handleUp]);

  return { drag, dropTargetKey, start, ghostRef };
};

// =========================================================================
// DragGhost — clon visual estable que sigue al puntero (position:fixed).
// -------------------------------------------------------------------------
// Se renderiza por portal en <body> para que ningún overflow/transform de un
// ancestro lo recorte. NO captura el puntero (pointer-events:none) para que
// pointermove/up sigan llegando a window. Su transform lo mueve useGiftDrag
// directamente vía ghostRef => seguimiento fluido sin re-render.
// =========================================================================
const DragGhost = ({ drag, ghostRef }) => {
  if (!drag) return null;
  return createPortal(
    <div
      ref={ghostRef}
      className={styles.dragGhost}
      style={{
        // Ancho = ancho de la zona de imagen agarrada; alto auto (imagen
        // cuadrada + caption con el nombre). Replica visualmente la tarjeta.
        width: drag.w,
        // Posición inicial ya bajo el puntero; luego useGiftDrag mueve por ref.
        transform: `translate3d(${drag.initX}px, ${drag.initY}px, 0) rotate(-3deg)`,
      }}
      aria-hidden="true"
    >
      <div className={styles.dragGhostInner}>
        <img src={drag.image} alt="" className={styles.dragGhostImg} draggable={false} />
        <div className={styles.dragGhostName}>{drag.name}</div>
      </div>
    </div>,
    document.body
  );
};

// =========================================================================
// GiftProductCard — tarjeta A MEDIDA para el registro de regalos.
// -------------------------------------------------------------------------
// Por qué NO reutilizamos ProductCard: ProductCard envuelve TODO en un <Link>
// y su <img> conserva el ARRASTRE NATIVO del navegador, que secuestra el
// gesto (aparece la imagen fantasma con una URL y el cursor "denegado").
// Aquí separamos responsabilidades:
//   - La ZONA DE IMAGEN es el "agarre" para arrastrar (cursor:grab). La <img>
//     lleva draggable={false} + reglas CSS -webkit-user-drag:none para anular
//     el drag nativo. El arrastre real lo gestiona useGiftDrag vía onPointerDown.
//   - El NOMBRE es un <Link> al detalle del producto: tocarlo navega.
// =========================================================================
const GiftProductCard = ({ cardProduct, item, yaRegalado, sinFecha, onGift, onDragStart }) => {
  const imagen = cardProduct.mainImage || item.productImage || '';
  const precio = cardProduct.salePrice || cardProduct.price || 0;
  // Descuento simple (solo si hay precio de oferta y es menor al regular).
  const descuento =
    cardProduct.salePrice && cardProduct.price && cardProduct.price > cardProduct.salePrice
      ? Math.round(((cardProduct.price - cardProduct.salePrice) / cardProduct.price) * 100)
      : 0;
  // Stock simple: el catálogo trae inStock; el fallback de la CF asume 1.
  const stock =
    typeof cardProduct.inStock === 'number' ? cardProduct.inStock : (cardProduct.inStock ? 1 : 0);

  return (
    <div className={styles.giftCard}>
      {/* Badges sobre la imagen (descuento / stock). */}
      <div className={styles.giftBadges}>
        {descuento > 0 && <span className={styles.giftDiscountBadge}>-{descuento}%</span>}
        {stock > 0 && <span className={styles.giftStockBadge}>{stock} disp.</span>}
      </div>

      {/* ── ZONA DE IMAGEN = agarre de arrastre ───────────────────────────
          onPointerDown inicia el arrastre por Pointer Events (useGiftDrag):
          funciona en desktop y touch sin el drag nativo del navegador. La
          <img> lleva draggable={false} + CSS -webkit-user-drag:none para
          matar la imagen fantasma; el contenedor lleva cursor:grab. */}
      <div
        className={`${styles.giftImageZone} ${yaRegalado ? styles.giftImageZoneStatic : ''}`}
        onPointerDown={yaRegalado ? undefined : onDragStart}
      >
        <img
          src={imagen}
          alt={cardProduct.name || item.productName || 'Producto'}
          className={styles.giftImage}
          draggable={false}
          loading="lazy"
        />
      </div>

      <div className={styles.giftContent}>
        {/* ── NOMBRE = enlace al detalle del producto ──────────────────── */}
        <Link
          to={`/producto/${cardProduct.id}`}
          className={styles.giftName}
          draggable={false}
          title={cardProduct.name || item.productName}
        >
          {cardProduct.name || item.productName || 'Producto'}
        </Link>

        <div className={styles.giftPriceRow}>
          {descuento > 0 ? (
            <>
              <span className={styles.giftSalePrice}>S/ {Number(precio).toFixed(2)}</span>
              <span className={styles.giftRegularPrice}>S/ {Number(cardProduct.price).toFixed(2)}</span>
            </>
          ) : (
            <span className={styles.giftSalePrice}>S/ {Number(precio).toFixed(2)}</span>
          )}
        </div>

        {/* Botón fallback: regala directo usando la fecha seleccionada. */}
        {!yaRegalado && (
          <GlassButton
            variant="primary"
            fullWidth
            disabled={sinFecha}
            onClick={onGift}
            className={styles.giftBtn}
            title={sinFecha ? 'Elige primero una fecha de entrega' : undefined}
          >
            Regalar este 🎁
          </GlassButton>
        )}
      </div>
    </div>
  );
};

const GiftRegistryPage = () => {
  const { referralCode } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToast } = useGlobalToast();

  // Catálogo completo para enriquecer precio/imagen de cada item de la
  // wishlist (mismo enfoque que WishlistPublic: evita N lecturas por item).
  const { data: allProducts, isLoading: productsLoading } = useProducts([]);

  const [registry, setRegistry] = useState(null); // { ownerName, dates, wishlistItems }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(null);
  // ── Asignaciones por fecha (modelo nuevo): NO va directo al carrito. ──
  // { [dateKey]: [ { productId, name, image, cardProduct, item } ] }
  const [assignments, setAssignments] = useState({});

  // ── Carga de datos vía Cloud Function (lectura mínima y segura) ─────────
  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      setLoading(true);
      setError('');
      try {
        const callable = httpsCallable(getFunctions(), 'getPublicGiftRegistry');
        const res = await callable({ referralCode });
        const data = res?.data || {};

        if (!activo) return;

        // La CF devuelve { ok:false } si el código no existe → "no encontrado".
        if (!data.ok) {
          setError('No encontramos este registro de regalos. Revisa que el enlace sea correcto.');
          return;
        }

        // Normalizamos: garantizamos arrays aunque la CF devuelva campos sueltos.
        const dates = Array.isArray(data.dates) ? data.dates : [];
        const wishlistItems = Array.isArray(data.wishlistItems) ? data.wishlistItems : [];

        setRegistry({
          ownerName: data.ownerName || 'Alguien',
          dates,
          wishlistItems,
        });

        // Preseleccionamos la primera fecha disponible para agilizar la compra.
        if (dates.length > 0) {
          const primera = dates[0];
          setSelectedEventId(primera.id || primera.eventId || `${primera.date}-0`);
        }
      } catch (e) {
        if (!activo) return;
        console.error('Error al cargar el registro de regalos:', e);
        setError(e?.message || 'No se pudo cargar el registro de regalos.');
      } finally {
        if (activo) setLoading(false);
      }
    };

    if (referralCode) {
      cargar();
    } else {
      setError('Enlace inválido.');
      setLoading(false);
    }

    return () => {
      activo = false;
    };
  }, [referralCode]);

  // Lista de fechas con un id estable para el selector (cumpleaños/aniversarios…).
  const fechas = useMemo(() => {
    const list = registry?.dates || [];
    return list.map((d, i) => ({
      ...d,
      _key: d.id || d.eventId || `${d.date}-${i}`,
      _label: construirLabel(d),
    }));
  }, [registry]);

  // Fecha actualmente seleccionada (objeto completo) para el flujo "Regalar este".
  const selectedEvent = useMemo(
    () => fechas.find((d) => d._key === selectedEventId) || null,
    [fechas, selectedEventId]
  );

  // ── Helper: arma el productMock de regalo y lo agrega al carrito ─────────
  // Centraliza la construcción del objeto (id/name/mainImage/price + flags de
  // regalo + contexto de entrega) para reutilizarlo desde proceedDate (silent)
  // y handleGift (con toast). No toca pago ni totales.
  const addGiftToCart = (cardProduct, item, evento, { silent } = {}) => {
    const price = cardProduct?.salePrice || cardProduct?.price || 0;
    // GUARD (dinero): un producto fuera del catálogo cacheado (p.ej. visible===false)
    // cae al fallback con price:0 y se podría regalar/pagar a S/0.00. Si el precio
    // no es válido (<= 0), NO lo agregamos al carrito: avisamos y devolvemos null
    // para que el llamador (proceedDate / handleGift) lo saltee.
    if (!(price > 0)) {
      addToast('Este producto no está disponible para regalar ahora.', 'warning');
      return null;
    }
    const productMock = {
      // Identidad del producto (igual que WishlistPublic).
      id: cardProduct?.id || item?.productId,
      name: cardProduct?.name || item?.productName,
      mainImage: cardProduct?.mainImage || item?.productImage,
      price,
      // Flags de regalo de wishlist (mecanismo YA existente en el checkout).
      isWishlistGift: true,
      wishlistUserCode: String(referralCode || '').trim().toUpperCase(), // alinear casing con la CF (markItemAsGifted)
      // NUEVO — contexto de fecha de entrega (aditivo, viaja en el item del carrito).
      deliveryDate: evento.date, // 'YYYY-MM-DD' — qué día entregar
      deliveryEventLabel: evento._label, // contexto humano del evento
      deliveryRecipient: registry?.ownerName || 'Alguien', // dueño = destinatario
    };
    addToCart(productMock, {}, null, 1, null, { silent });
    return productMock;
  };

  // ── Acción "Regalar este" (fallback directo) ────────────────────────────
  // Agrega 1 regalo con la fecha seleccionada (o la fecha override del drop) y
  // navega al carrito. Mantiene las guardas de fecha y de producto disponible.
  const handleGift = (cardProduct, item, eventOverride) => {
    const evento = eventOverride || selectedEvent;
    if (!evento) {
      addToast('Primero elige una fecha de entrega (o arrastra el producto sobre una).', 'info');
      return;
    }
    if (!cardProduct) {
      addToast('Ese producto ya no está disponible en el catálogo.', 'warning');
      return;
    }
    // Si el producto no tiene precio válido, addGiftToCart devuelve null y ya avisó:
    // no agregamos, no mostramos éxito ni navegamos al carrito.
    const res = addGiftToCart(cardProduct, item, evento, { silent: false });
    if (!res) return;
    addToast(
      `¡Regalo agregado! Se entregará el ${formatearFecha(evento.date)} para ${registry?.ownerName || 'Alguien'}.`,
      'success'
    );
    navigate('/carrito');
  };

  // ── Asignar / desasignar productos a una fecha ──────────────────────────
  const assignToDate = (dateKey, cardProduct, item) => {
    const productId = cardProduct?.id || item?.productId;
    setAssignments((prev) => {
      const actuales = prev[dateKey] || [];
      // Evita duplicar el mismo producto en la misma fecha.
      if (actuales.some((a) => a.productId === productId)) return prev;
      const nueva = {
        productId,
        name: cardProduct?.name || item?.productName || 'Producto',
        image: cardProduct?.mainImage || item?.productImage || '',
        cardProduct,
        item,
      };
      return { ...prev, [dateKey]: [...actuales, nueva] };
    });
  };

  const unassign = (dateKey, productId) => {
    setAssignments((prev) => {
      const actuales = prev[dateKey] || [];
      const filtradas = actuales.filter((a) => a.productId !== productId);
      const next = { ...prev };
      if (filtradas.length > 0) next[dateKey] = filtradas;
      else delete next[dateKey];
      return next;
    });
  };

  // ── "Proceder a regalar (N)" de una fecha ───────────────────────────────
  // Recién aquí los regalos van al carrito (en silencio) y se navega al
  // checkout. Limpia las asignaciones de esa fecha.
  const proceedDate = (fecha) => {
    const lista = assignments[fecha._key] || [];
    if (lista.length === 0) return;
    // addGiftToCart devuelve null si el producto no tiene precio válido (price<=0):
    // esas asignaciones se SALTAN (con su propio aviso) y no se cuentan como agregadas.
    let agregados = 0;
    lista.forEach((a) => {
      const res = addGiftToCart(a.cardProduct, a.item, fecha, { silent: true });
      if (res) agregados += 1;
    });
    // Si ninguno se pudo agregar (todos sin precio), no navegamos: el guard ya avisó.
    if (agregados === 0) return;
    addToast(`${agregados} regalo(s) para ${fecha._label} agregados al carrito`, 'success');
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[fecha._key];
      return next;
    });
    navigate('/carrito');
  };

  // ── Drag & drop: soltar un producto sobre una fecha lo ASIGNA a ese día ──
  // useGiftDrag ya resolvió la columna [data-date-key] bajo el puntero y nos
  // pasa su key. En el modelo nuevo NO agregamos al carrito: solo creamos la
  // asignación. (Lógica producto->fecha intacta: assignToDate.)
  const handleCardDrop = useCallback((dateKey, cardProduct, item) => {
    const evt = fechas.find((f) => f._key === dateKey);
    if (!evt) return;
    setSelectedEventId(evt._key); // refleja la fecha sobre la que se soltó
    assignToDate(evt._key, cardProduct, item);
    addToast(`Asignado a ${evt._label}`, 'success');
  }, [fechas, addToast]);

  // Hook de arrastre por Pointer Events (drag = ghost activo; dropTargetKey =
  // fecha resaltada; start = pointerdown de la zona de imagen).
  const { drag, dropTargetKey, start: startDrag, ghostRef } = useGiftDrag({ onDrop: handleCardDrop });

  // ── Estados: carga ──────────────────────────────────────────────────────
  if (loading || productsLoading) {
    return (
      <div className={styles.page}>
        <AuroraBackground fixed variant="violet" />
        <div className={styles.container}>
          <GlassCard variant="soft" padding="lg" className={styles.stateCard}>
            <div className={styles.spinner} aria-hidden="true" />
            <p>Cargando el registro de regalos…</p>
          </GlassCard>
        </div>
      </div>
    );
  }

  // ── Estados: error / no encontrado ──────────────────────────────────────
  if (error || !registry) {
    return (
      <div className={styles.page}>
        <AuroraBackground fixed variant="subtle" />
        <div className={styles.container}>
          <GlassCard variant="solid" padding="lg" className={styles.stateCard}>
            <div className={styles.stateEmoji} aria-hidden="true">🔍</div>
            <h2 className={styles.stateTitle}>Registro no encontrado</h2>
            <p className={styles.stateText}>
              El enlace que seguiste no es válido o el registro ya no está disponible.
            </p>
            <GlassButton as={Link} to="/tienda" variant="primary">
              Ir a la tienda
            </GlassButton>
          </GlassCard>
        </div>
      </div>
    );
  }

  const ownerName = registry.ownerName;
  const items = registry.wishlistItems || [];

  return (
    <div className={styles.page}>
      <AuroraBackground fixed variant="violet" />

      <div className={styles.container}>
        {/* Cabecera */}
        <GlassCard variant="intense" padding="lg" className={styles.hero} animate>
          <div className={styles.heroEmoji} aria-hidden="true">🎁</div>
          <h1 className={styles.heroTitle}>Regálale a {ownerName}</h1>
          <p className={styles.heroSubtitle}>
            Elige una de sus fechas especiales como día de entrega y sorpréndele
            con un regalo de su lista de deseos.
          </p>
        </GlassCard>

        {/* Paso 1 — Fechas como COLUMNAS (zonas de drop) */}
        <GlassCard
          variant="soft"
          padding="lg"
          className={styles.section}
          title="1. Elige la fecha de entrega"
          subtitle="Arrastra productos sobre una fecha para asignarlos."
          animate
        >
          {fechas.length === 0 ? (
            <p className={styles.emptyInline}>
              {ownerName} todavía no registró fechas especiales. Aun así puedes
              regalarle algo de su lista más abajo.
            </p>
          ) : (
            <div className={styles.dateGrid} role="radiogroup" aria-label="Fechas de entrega">
              {fechas.map((d) => {
                const seleccionada = d._key === selectedEventId;
                const asignados = assignments[d._key] || [];
                // drag != null -> hay un arrastre activo: todas las columnas se
                // marcan como zona de drop. dropTargetKey -> la columna que está
                // justo bajo el puntero recibe el resalte fuerte (.dateColumnOver).
                const arrastrando = drag != null;
                const encima = dropTargetKey === d._key;
                return (
                  // ── COLUMNA de fecha = zona de drop (data-date-key) ──────
                  <div
                    key={d._key}
                    data-date-key={d._key}
                    className={[
                      styles.dateColumn,
                      arrastrando ? styles.dateColumnDroppable : '',
                      encima ? styles.dateColumnOver : '',
                      seleccionada ? styles.dateColumnActive : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {/* a) ARRIBA: botón "Proceder a regalar (N)" si hay asignaciones */}
                    {asignados.length > 0 && (
                      <button
                        type="button"
                        className={styles.proceedBtn}
                        onClick={() => proceedDate(d)}
                      >
                        Proceder a regalar ({asignados.length}) 🎁
                      </button>
                    )}

                    {/* b) EN MEDIO: chip de fecha seleccionable (flujo fallback) */}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={seleccionada}
                      onClick={() => setSelectedEventId(d._key)}
                      className={`${styles.dateChip} ${seleccionada ? styles.dateChipActive : ''}`}
                    >
                      <span className={styles.dateChipLabel}>{d._label}</span>
                      <span className={styles.dateChipDate}>{formatearFecha(d.date)}</span>
                      {seleccionada && <span className={styles.dateChipCheck} aria-hidden="true">✓</span>}
                    </button>

                    {/* c) ABAJO: tira de miniaturas asignadas, cada una con "×" */}
                    {asignados.length > 0 && (
                      <div className={styles.assignedStrip}>
                        {asignados.map((a) => (
                          <div key={a.productId} className={styles.assignedThumb}>
                            <img
                              src={a.image}
                              alt={a.name}
                              className={styles.assignedThumbImg}
                              draggable={false}
                              loading="lazy"
                            />
                            <button
                              type="button"
                              className={styles.assignedRemove}
                              onClick={() => unassign(d._key, a.productId)}
                              aria-label={`Quitar ${a.name} de ${d._label}`}
                              title={`Quitar ${a.name}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Paso 2 — Wishlist del dueño (tarjetas arrastrables) */}
        <GlassCard
          variant="soft"
          padding="lg"
          className={styles.section}
          title="2. Elige el regalo"
          subtitle={`Lista de deseos de ${ownerName}.`}
          animate
        >
          {items.length > 0 && (
            <p className={styles.dragHint}>
              💡 <strong>Arrastra</strong> un producto (desde su imagen) sobre una fecha de arriba para asignarlo, o elige una fecha y pulsa “Regalar este”. Toca el <strong>nombre</strong> para ver el producto.
            </p>
          )}
          {items.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.stateEmoji} aria-hidden="true">📭</div>
              <p>Esta lista está vacía por ahora. Vuelve más tarde.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {items.map((item, idx) => {
                // Enriquecemos precio/imagen desde el catálogo (igual que WishlistPublic).
                const fullProduct = allProducts?.find((p) => p.id === item.productId);

                // Fallback defensivo: si el producto no está en el catálogo
                // cacheado, construimos una tarjeta mínima con lo que trae la CF.
                const cardProduct = fullProduct || {
                  id: item.productId,
                  name: item.productName,
                  mainImage: item.productImage,
                  price: item.price || 0,
                  inStock: 1,
                };

                const yaRegalado = item.isGifted === true;
                const sinFecha = !selectedEvent;
                // ¿Es ESTA la tarjeta que se está arrastrando ahora mismo? Si lo
                // es, atenuamos el origen con .dragging (NO lo desmontamos ni le
                // cambiamos la key): el ghost en <body> es quien sigue al puntero.
                const enArrastre = drag?.productId === (item.productId || idx);

                return (
                  // El wrapper NO se mueve ni cambia de key durante el arrastre.
                  // El gesto lo dispara onPointerDown de la zona de imagen
                  // (GiftProductCard -> onDragStart) y lo conduce useGiftDrag.
                  <div
                    key={item.productId || idx}
                    className={`${styles.cardWrapper} ${enArrastre ? styles.dragging : ''}`}
                  >
                    {yaRegalado && (
                      <div className={styles.giftedOverlay}>¡Ya regalado! 🎉</div>
                    )}

                    <GiftProductCard
                      cardProduct={cardProduct}
                      item={item}
                      yaRegalado={yaRegalado}
                      sinFecha={sinFecha}
                      onGift={() => handleGift(cardProduct, item)}
                      onDragStart={(e) =>
                        startDrag(e, {
                          productId: item.productId || idx,
                          cardProduct,
                          item,
                          image: cardProduct.mainImage || item.productImage || '',
                          name: cardProduct.name || item.productName || 'Producto',
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Recordatorio de la fecha elegida (refuerza el contexto antes de comprar). */}
          {selectedEvent && items.length > 0 && (
            <p className={styles.deliveryHint}>
              Con “Regalar este” se entregará el <strong>{formatearFecha(selectedEvent.date)}</strong>{' '}
              ({selectedEvent._label}) a <strong>{ownerName}</strong>.
            </p>
          )}
        </GlassCard>
      </div>

      {/* GHOST de arrastre: clon que sigue al puntero (portal en <body>). Solo
          existe mientras hay un arrastre activo; no parpadea porque su posición
          se actualiza por transform directo, no por re-render. */}
      <DragGhost drag={drag} ghostRef={ghostRef} />
    </div>
  );
};

export default GiftRegistryPage;
