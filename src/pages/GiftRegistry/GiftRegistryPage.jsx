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

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
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

// Construye el label humano de una fecha si la CF no lo trae ya armado.
// Ej: "Cumpleaños de Mamá" o, si no hay nombre, solo el tipo de evento.
const construirLabel = (date) => {
  if (date?.label) return date.label;
  const tipo = date?.type || 'Fecha especial';
  const nombre = date?.customName ? ` de ${date.customName}` : '';
  return `${tipo}${nombre}`;
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
//     el drag nativo. El arrastre real lo gestiona el <motion.div drag> padre.
//   - El NOMBRE es un <Link> al detalle del producto: tocarlo navega.
// =========================================================================
const GiftProductCard = ({ cardProduct, item, yaRegalado, sinFecha, onGift }) => {
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
          La <img> tiene draggable={false} y reglas CSS que matan el drag
          nativo; el contenedor lleva cursor:grab. */}
      <div className={`${styles.giftImageZone} ${yaRegalado ? styles.giftImageZoneStatic : ''}`}>
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
  // Producto que se está arrastrando (para resaltar las fechas como zonas de drop).
  const [draggingId, setDraggingId] = useState(null);
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
    const productMock = {
      // Identidad del producto (igual que WishlistPublic).
      id: cardProduct?.id || item?.productId,
      name: cardProduct?.name || item?.productName,
      mainImage: cardProduct?.mainImage || item?.productImage,
      price,
      // Flags de regalo de wishlist (mecanismo YA existente en el checkout).
      isWishlistGift: true,
      wishlistUserCode: referralCode,
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
    addGiftToCart(cardProduct, item, evento, { silent: false });
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
    lista.forEach((a) => addGiftToCart(a.cardProduct, a.item, fecha, { silent: true }));
    addToast(`${lista.length} regalo(s) para ${fecha._label} agregados al carrito`, 'success');
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[fecha._key];
      return next;
    });
    navigate('/carrito');
  };

  // ── Drag & drop: soltar un producto sobre una fecha lo ASIGNA a ese día ──
  // Detectamos sobre qué columna [data-date-key] quedó el puntero al soltar.
  // En el modelo nuevo NO agregamos al carrito: solo creamos la asignación.
  const handleCardDrop = (nativeEvent, cardProduct, item) => {
    setDraggingId(null);
    const point =
      typeof nativeEvent?.clientX === 'number'
        ? { x: nativeEvent.clientX, y: nativeEvent.clientY }
        : nativeEvent?.changedTouches?.[0]
          ? { x: nativeEvent.changedTouches[0].clientX, y: nativeEvent.changedTouches[0].clientY }
          : null;
    if (!point) return;
    const zonas = document.querySelectorAll('[data-date-key]');
    for (const zona of zonas) {
      const r = zona.getBoundingClientRect();
      if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) {
        const key = zona.getAttribute('data-date-key');
        const evt = fechas.find((f) => f._key === key);
        if (evt) {
          setSelectedEventId(evt._key); // refleja la fecha sobre la que se soltó
          assignToDate(evt._key, cardProduct, item);
          addToast(`Asignado a ${evt._label}`, 'success');
        }
        return;
      }
    }
  };

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
                return (
                  // ── COLUMNA de fecha = zona de drop (data-date-key) ──────
                  <div
                    key={d._key}
                    data-date-key={d._key}
                    className={`${styles.dateColumn} ${draggingId ? styles.dateColumnDroppable : ''} ${seleccionada ? styles.dateColumnActive : ''}`}
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

                return (
                  // El ARRASTRE lo gestiona este motion.div (no la imagen): así
                  // arrastrar la tarjeta no dispara el drag nativo del navegador.
                  <motion.div
                    key={item.productId || idx}
                    className={styles.cardWrapper}
                    drag={!yaRegalado}
                    dragSnapToOrigin
                    whileDrag={{ scale: 1.05, zIndex: 60, boxShadow: '0 18px 40px -12px rgba(109, 40, 217, 0.45)' }}
                    onDragStart={() => setDraggingId(item.productId)}
                    onDragEnd={(e) => handleCardDrop(e, cardProduct, item)}
                    style={{
                      touchAction: !yaRegalado ? 'none' : undefined,
                    }}
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
                    />
                  </motion.div>
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
    </div>
  );
};

export default GiftRegistryPage;
