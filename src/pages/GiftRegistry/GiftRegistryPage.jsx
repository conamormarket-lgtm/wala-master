// =========================================================================
// Walá — GiftRegistryPage (Feature B "Mis fechas especiales")
// -------------------------------------------------------------------------
// Registro público de regalos por fecha. Vive en la ruta
// /regalar/:referralCode (la cablea el orquestador en App.jsx).
//
// Quien abre el enlace ve:
//   1) Las fechas especiales del dueño (cumpleaños / aniversarios / fechas
//      especiales) como SELECTOR DE FECHA DE ENTREGA.
//   2) La wishlist del dueño con precio/imagen reales del catálogo.
// Elige una fecha + un producto y compra ese regalo para ese día.
//
// SEGURIDAD (decisión del usuario — enfoque SEGURO):
//   La página NO lee Firestore directamente. Pide los datos mínimos a la
//   Cloud Function `getPublicGiftRegistry({ referralCode })`, que devuelve
//   SOLO { ownerName, dates, wishlistItems } — nunca email, teléfono ni el
//   perfil completo del dueño ni datos de terceros.
//
// REUTILIZACIÓN (cambios ADITIVOS):
//   Copia el patrón de src/pages/WishlistPublic/WishlistPublic.jsx para
//   "regalar de la wishlist de alguien": arma un productMock con los flags
//   isWishlistGift + wishlistUserCode y lo manda al carrito → checkout.
//   AÑADE, sin tocar la lógica de pago/totales del checkout, el contexto de
//   fecha de entrega: deliveryDate + deliveryEventLabel + deliveryRecipient.
//   El checkout ya consume isWishlistGift/wishlistUserCode; estos campos
//   viajan en el mismo objeto del carrito (mecanismo idéntico).
// =========================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { useProducts } from '../../hooks/useProducts';
import AuroraBackground from '../../components/ui/AuroraBackground';
import GlassCard from '../../components/ui/GlassCard';
import GlassButton from '../../components/ui/GlassButton';
import ProductCard from '../Tienda/components/ProductCard/ProductCard';
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

        // La CF devuelve { ok:false } si el código no existe → mostramos "no encontrado"
        // (antes la página quedaba vacía porque no validaba este campo).
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

  // Fecha actualmente seleccionada (objeto completo) para pasarla al checkout.
  const selectedEvent = useMemo(
    () => fechas.find((d) => d._key === selectedEventId) || null,
    [fechas, selectedEventId]
  );

  // ── Acción "Regalar este" ──────────────────────────────────────────────
  // Mismo mecanismo que WishlistPublic.handleGift, AÑADIENDO el contexto de
  // fecha de entrega y el dueño como destinatario. No toca pago ni totales.
  const handleGift = (fullProduct, wishlistItem) => {
    if (!selectedEvent) {
      addToast('Primero elige una fecha de entrega.', 'info');
      return;
    }
    // Si el producto ya no está en el catálogo, no lo agregamos con precio 0.
    if (!fullProduct) {
      addToast('Ese producto ya no está disponible en el catálogo.', 'warning');
      return;
    }

    const price = fullProduct.salePrice || fullProduct.price || 0;

    const productMock = {
      // Identidad del producto (igual que WishlistPublic).
      id: fullProduct?.id || wishlistItem?.productId,
      name: fullProduct?.name || wishlistItem?.productName,
      mainImage: fullProduct?.mainImage || wishlistItem?.productImage,
      price,
      // Flags de regalo de wishlist (mecanismo YA existente en el checkout).
      isWishlistGift: true,
      wishlistUserCode: referralCode,
      // NUEVO — contexto de fecha de entrega (aditivo, viaja en el item del carrito).
      deliveryDate: selectedEvent.date, // 'YYYY-MM-DD' — qué día entregar
      deliveryEventLabel: selectedEvent._label, // contexto humano del evento
      deliveryRecipient: registry?.ownerName || 'Alguien', // dueño = destinatario
    };

    addToCart(productMock, {}, null, 1);
    addToast(
      `¡Regalo agregado! Se entregará el ${formatearFecha(selectedEvent.date)} para ${productMock.deliveryRecipient}.`,
      'success'
    );
    navigate('/carrito');
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

        {/* Paso 1 — Selector de fecha de entrega */}
        <GlassCard
          variant="soft"
          padding="lg"
          className={styles.section}
          title="1. Elige la fecha de entrega"
          subtitle="Estas son las fechas especiales de su registro."
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
                return (
                  <button
                    type="button"
                    key={d._key}
                    role="radio"
                    aria-checked={seleccionada}
                    onClick={() => setSelectedEventId(d._key)}
                    className={`${styles.dateChip} ${seleccionada ? styles.dateChipActive : ''}`}
                  >
                    <span className={styles.dateChipLabel}>{d._label}</span>
                    <span className={styles.dateChipDate}>{formatearFecha(d.date)}</span>
                    {seleccionada && <span className={styles.dateChipCheck} aria-hidden="true">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Paso 2 — Wishlist del dueño */}
        <GlassCard
          variant="soft"
          padding="lg"
          className={styles.section}
          title="2. Elige el regalo"
          subtitle={`Lista de deseos de ${ownerName}.`}
          animate
        >
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
                  <div key={item.productId || idx} className={styles.cardWrapper}>
                    {yaRegalado && (
                      <div className={styles.giftedOverlay}>¡Ya regalado! 🎉</div>
                    )}

                    <ProductCard
                      product={cardProduct}
                      onAddToCartOverride={
                        yaRegalado ? () => {} : () => handleGift(cardProduct, item)
                      }
                    />

                    {!yaRegalado && (
                      <GlassButton
                        variant="primary"
                        fullWidth
                        disabled={sinFecha}
                        onClick={() => handleGift(cardProduct, item)}
                        className={styles.giftBtn}
                        title={sinFecha ? 'Elige primero una fecha de entrega' : undefined}
                      >
                        Regalar este 🎁
                      </GlassButton>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Recordatorio de la fecha elegida (refuerza el contexto antes de comprar). */}
          {selectedEvent && items.length > 0 && (
            <p className={styles.deliveryHint}>
              Se entregará el <strong>{formatearFecha(selectedEvent.date)}</strong>{' '}
              ({selectedEvent._label}) a <strong>{ownerName}</strong>.
            </p>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default GiftRegistryPage;
