import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PackageSearch, PauseCircle, AlertTriangle, XCircle } from 'lucide-react';
import { usePedidos } from '../../hooks/usePedidos';
import { useAuth } from '../../contexts/AuthContext';
import { useProducts } from '../../hooks/useProducts';
// Sistema de diseño Walá: superficie de vidrio + botón + envoltorios de movimiento.
// SOLO estética; NO se altera la búsqueda de pedidos por DNI ni el flujo del hook.
import { GlassCard, GlassButton, Reveal, Stagger, StaggerItem } from '../../components/ui';
// Rastreo por fases: REUTILIZAMOS el mismo stepper de 8 pasos de "Mis Compras".
import Timeline from '../../components/Timeline';
// Helpers REALES de fase (los mismos que usa PedidoCard) — NO reinventar.
import {
  getEtapaBadgeLabel,
  estadoToKey,
  getQueueStage,
  ESTADOS_COLORS,
} from '../../utils/constants';
// Fallback de estado propio de WALA (espejo) cuando el ERP borró el doc del pedido.
import { estadoWalaADisplay } from '../../services/walaOrders';
import { getProductosPedido, getCodigoPedido, derivarEstadoCompra } from '../../utils/estadoCompra';
import { toThumbnailImageUrl } from '../../utils/imageUrl';
import { PLACEHOLDER_IMG } from '../../constants/placeholder';
// CSS Module compartido: reutilizamos .content / .profileCard / skeletons.
import styles from '../PedidosPage.module.css';
// CSS Module propio de esta vista (aditivo, glass) para las tarjetas de rastreo.
import glass from './CuentaRastreoPage.module.css';

/**
 * Paleta de color de fase reutilizando ESTADOS_COLORS (misma fuente que el resto
 * de la app). Devuelve un color válido para el badge según la key de etapa.
 */
function colorDeFase(estadoKey) {
  if (!estadoKey) return ESTADOS_COLORS['pendiente'];
  return ESTADOS_COLORS[estadoKey] || ESTADOS_COLORS['pendiente'];
}

/**
 * Resuelve la miniatura de un producto del catálogo (mismo orden de prioridad
 * que "Mis Compras": mainImage -> images[0]). Devuelve '' si no hay.
 */
function thumbDeProductoCatalogo(producto) {
  if (!producto || typeof producto !== 'object') return '';
  const url = producto.mainImage || (Array.isArray(producto.images) ? producto.images[0] : '') || '';
  return url ? toThumbnailImageUrl(url) : '';
}

/**
 * Construye el resumen de RASTREO de un pedido: número visible, mini-línea del
 * producto (thumbnail + nombre cruzando con el catálogo), fase actual y las
 * señales especiales (pausa por stock, deuda, anulado, fallback de espejo).
 *
 * @param {object} pedido  Pedido normalizado por usePedidos (con _raw adjunto).
 * @param {Map<string,object>} indiceCatalogo  productoId -> producto del catálogo.
 */
function resumirRastreo(pedido, indiceCatalogo) {
  const fuente = (pedido && pedido._raw) || pedido;
  const lineas = getProductosPedido(fuente);
  const codigo = getCodigoPedido(fuente) || pedido?.id;

  // ── Mini-línea del producto: nombre + miniatura del 1er producto ────────────
  let miniatura = '';
  let nombrePrincipal = '';
  if (lineas.length > 0) {
    const primera = lineas[0];
    const prodCat = primera?.productoId != null ? indiceCatalogo.get(String(primera.productoId)) : null;
    miniatura = thumbDeProductoCatalogo(prodCat);
    // Fallback: la línea guarda la imagen del producto al comprar (urlImagen).
    if (!miniatura && primera?.urlImagen) miniatura = toThumbnailImageUrl(primera.urlImagen);
    nombrePrincipal = primera?.producto || prodCat?.name || '';
  }
  // Fallbacks de miniatura: imagen de diseño del propio pedido -> placeholder.
  if (!miniatura) {
    const diseno = Array.isArray(fuente?.imageURLs) ? fuente.imageURLs[0]
      : (Array.isArray(pedido?.imageURLs) ? pedido.imageURLs[0] : '');
    miniatura = diseno ? toThumbnailImageUrl(diseno) : PLACEHOLDER_IMG;
  }

  // Texto del producto: nombre del 1ro + "y N más" si hay varias líneas.
  let textoProductos;
  if (lineas.length > 0) {
    const total = lineas.length;
    const base = nombrePrincipal || 'Producto';
    textoProductos = total > 1 ? `${base} y ${total - 1} más` : base;
  } else if (fuente?.marca || pedido?.marca) {
    textoProductos = String(fuente?.marca || pedido?.marca);
  } else {
    textoProductos = 'Tu pedido Walá';
  }

  // ── Fase actual: MISMOS helpers que PedidoCard (getQueueStage||estadoToKey) ──
  const estadoGeneral = String(fuente?.estadoGeneral ?? pedido?.estadoGeneral ?? '').trim();
  const estadoStr = estadoGeneral.toUpperCase();
  const faseKey = estadoGeneral ? (getQueueStage(estadoGeneral) || estadoToKey(estadoGeneral)) : null;

  // ── ¿El pedido tiene una fase REAL de producción del ERP? ───────────────────
  // OJO: usePedidos normaliza estadoGeneral a 'Pendiente' por defecto, así que
  // NO basta con que exista. Hay fase real si la key es una etapa de producción,
  // si hay fechas de etapa, o si el texto nombra una etapa/estado terminal/stock.
  const ETAPAS_PROD = ['diseno', 'impresion', 'preparacion', 'estampado', 'empaquetado', 'reparto', 'finalizado', 'entregado'];
  const hayFechasEtapa = pedido?.fechas && typeof pedido.fechas === 'object' && Object.keys(pedido.fechas).length > 0;
  const hayFaseErpReal =
    (!!faseKey && ETAPAS_PROD.includes(faseKey)) ||
    !!hayFechasEtapa ||
    /stock|anul|cancel|entreg|final|listo|reparto|estamp|empaq|impres|dise|prepar/i.test(estadoGeneral.toLowerCase());

  // ── Señales especiales (reutilizando la detección real del PedidoCard) ──────
  const isProblemaStock = estadoStr.includes('STOCK');
  const montoPendiente = pedido?.montoDeuda != null ? Number(pedido.montoDeuda) : NaN;
  const tieneDeuda = !!pedido?.conDeuda && !Number.isNaN(montoPendiente) && montoPendiente > 0;
  const esAnulado = /anul|cancel/.test(estadoGeneral.toLowerCase());

  // Semáforo del espejo → paleta de fase (para labels de estadoWala/derivado).
  const semaforo = {
    warning: '#d97706',
    info: ESTADOS_COLORS['impresion'],
    primary: '#6f42c1',
    success: ESTADOS_COLORS['finalizado'],
    danger: ESTADOS_COLORS['anulado'],
  };

  let badgeLabel;
  let badgeColor;
  let coarse = null; // { label, color, paso 0-4 (-1 cancelado) } para el stepper reducido

  if (hayFaseErpReal) {
    // Fase GRANULAR del ERP (Diseño/Impresión/Estampado/Empaquetado/Reparto…).
    badgeLabel = getEtapaBadgeLabel(estadoGeneral);
    badgeColor = colorDeFase(faseKey);
    if (tieneDeuda && isProblemaStock) { badgeLabel = 'PAGAR DEUDA'; badgeColor = ESTADOS_COLORS['anulado']; }
    if (esAnulado) { badgeLabel = 'Anulado'; badgeColor = ESTADOS_COLORS['anulado']; }
  } else {
    // Sin fase real del ERP (solo espejo o recién creado): estado propio de WALA
    // o el estado combinado (mismo que "Mis Compras"). Nunca "Pendiente" en falso.
    const estadoWalaRaw = fuente?.estadoWala || pedido?.estadoWala || pedido?._raw?.estadoWala || null;
    if (estadoWalaRaw) {
      const disp = estadoWalaADisplay(estadoWalaRaw); // { label, color, paso }
      coarse = { label: disp.label, color: semaforo[disp.color] || ESTADOS_COLORS['pendiente'], paso: disp.paso };
    } else {
      // Estado combinado autoritativo (fusiona ERP+WALA, elige el más avanzado).
      const der = derivarEstadoCompra(fuente)?.estado || null;
      const mapaPaso = { por_confirmar_pago: 0, pago_confirmado: 1, en_preparacion: 2, entregado: 4, anulado: -1 };
      coarse = der
        ? { label: der.label, color: der.color, paso: mapaPaso[der.key] ?? 0 }
        : { label: 'Pendiente de pago', color: semaforo.warning, paso: 0 };
    }
    badgeLabel = coarse.label;
    badgeColor = coarse.color;
  }

  return {
    id: pedido?.id,
    codigo,
    miniatura,
    textoProductos,
    badgeLabel,
    badgeColor,
    isProblemaStock,
    tieneDeuda,
    montoPendiente,
    esAnulado,
    hayFaseErpReal,
    coarse,
  };
}

// Pasos del stepper REDUCIDO (estado propio de Walá) cuando el ERP aún no reporta
// la fase de producción detallada. Espeja el orden de estadoWalaADisplay (paso 0-4).
const PASOS_COARSE = ['Pago', 'Pagado', 'En preparación', 'Enviado', 'Entregado'];

/** Stepper reducido de 5 nodos para pedidos sin fase granular del ERP. */
function StepperCoarse({ coarse }) {
  if (!coarse) return null;
  if (coarse.paso === -1) {
    return (
      <div className={glass.coarseStepper}>
        <span className={glass.coarseCancel} style={{ color: coarse.color }}>Pedido cancelado</span>
      </div>
    );
  }
  return (
    <ol className={glass.coarseStepper} aria-label="Progreso del pedido">
      {PASOS_COARSE.map((label, i) => {
        const done = i < coarse.paso;
        const actual = i === coarse.paso;
        return (
          <li
            key={label}
            className={`${glass.coarseNode} ${done ? glass.coarseDone : ''} ${actual ? glass.coarseActual : ''}`}
          >
            <span
              className={glass.coarseDot}
              style={done || actual ? { backgroundColor: coarse.color, borderColor: coarse.color } : undefined}
              aria-hidden="true"
            />
            <span className={glass.coarseLabel}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Contenido de "Rastreo" dentro de Mi cuenta.
 * Página pública NUEVA enfocada en la FASE DE PRODUCCIÓN del ERP: por cada
 * pedido muestra su fase actual y, de forma prominente, el stepper de 8 pasos
 * (Compra→…→Finalizado) reutilizando el componente <Timeline>.
 *
 * Carga clonada de "Mis Compras" (CuentaPedidosPage): usePedidos(dni, uid) con
 * userProfile.dni + user.uid, cruzando con useProducts para imagen/nombre.
 */
const CuentaRastreoPage = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const hasDni = !!(userProfile?.dni && String(userProfile.dni).trim());
  const dni = userProfile?.dni ? String(userProfile.dni).trim() : '';
  // UID del usuario: se hila al hook para recuperar también pedidos del espejo.
  const uid = user?.uid || undefined;
  const { loading, error, data, buscar } = usePedidos(dni, uid);
  const [hasFetched, setHasFetched] = useState(false);

  // Catálogo para enriquecer cada pedido con imagen/nombre del 1er producto.
  const { data: productos } = useProducts([], { includeHidden: true });

  useEffect(() => {
    if (!user || (!hasDni && !authLoading) || hasFetched) return;
    setHasFetched(true);
    buscar(dni, uid);
  }, [user, hasDni, dni, uid, hasFetched, buscar, authLoading]);

  // Índice productoId -> producto del catálogo (memoizado).
  const indiceCatalogo = useMemo(() => {
    const idx = new Map();
    if (Array.isArray(productos)) {
      for (const p of productos) {
        if (p && p.id != null) idx.set(String(p.id), p);
      }
    }
    return idx;
  }, [productos]);

  // Cabecera reutilizable de la sección (misma en todos los estados).
  const Cabecera = () => (
    <Reveal className={glass.header}>
      <h2 className={glass.headerTitle}>
        <PackageSearch size={22} aria-hidden="true" /> Rastrea la fase de producción de tu pedido
      </h2>
      <p className={glass.headerSub}>
        Sigue en tiempo real en qué etapa está cada pedido: desde el diseño y la
        impresión hasta el estampado, el empaquetado y el reparto final.
      </p>
    </Reveal>
  );

  // ── Cargando (auth o primera carga sin caché) ──────────────────────────────
  if (authLoading || (loading && !data)) {
    return (
      <div className={styles.content}>
        <div className={styles.skeletonList}>
          {[1, 2, 3].map((n) => (
            <div key={n} className={styles.skeletonOrder} />
          ))}
        </div>
      </div>
    );
  }

  // ── Sin login / sin DNI: estado vacío amable (CuentaLayout ya cubre el login,
  // pero mostramos una guía por si acaso). ───────────────────────────────────
  if (!user || !userProfile || !hasDni) {
    return (
      <div className={styles.content}>
        <Cabecera />
        <Reveal className={`${styles.profileCard} ${glass.card}`}>
          <h2>Completa tu perfil para rastrear</h2>
          <p>Para ubicar y rastrear tus pedidos necesitamos tu DNI o CE en tu perfil.</p>
          <GlassButton as={Link} to="/completar-perfil" variant="primary">Completar perfil</GlassButton>
        </Reveal>
      </div>
    );
  }

  // ── Error de carga ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={styles.content}>
        <Cabecera />
        <Reveal className={`${styles.profileCard} ${glass.card}`}>
          <h2>Error al cargar el rastreo</h2>
          <p className={styles.errorText}>{error}</p>
          <GlassButton variant="primary" onClick={() => setHasFetched(false)}>
            Reintentar
          </GlassButton>
        </Reveal>
      </div>
    );
  }

  const pedidos = data?.pedidos ?? [];
  const showEmpty = !loading && hasFetched && pedidos.length === 0;

  // ── Estado vacío ────────────────────────────────────────────────────────────
  if (showEmpty) {
    return (
      <div className={styles.content}>
        <Cabecera />
        <Reveal className={`${styles.profileCard} ${glass.card}`}>
          <h2>Aún no tienes pedidos para rastrear</h2>
          <p>Cuando hagas un pedido, aquí podrás seguir su fase de producción paso a paso.</p>
          <GlassButton as={Link} to="/tienda" variant="primary">Ir a la tienda</GlassButton>
        </Reveal>
      </div>
    );
  }

  // ── Lista de tarjetas de rastreo ────────────────────────────────────────────
  return (
    <div className={styles.content}>
      <Cabecera />

      <Stagger as="ul" className={glass.grid}>
        {pedidos.map((pedido) => {
          const r = resumirRastreo(pedido, indiceCatalogo);
          return (
            <StaggerItem as="li" key={r.id} className={glass.gridItem}>
              <GlassCard
                as="article"
                variant="solid"
                padding="md"
                animate={false}
                className={glass.rastreoCard}
                bodyClassName={glass.rastreoBody}
              >
                {/* Cabecera de la tarjeta: nº de pedido + badge de fase. */}
                <div className={glass.cardTop}>
                  <div className={glass.pedidoIdWrap}>
                    <span className={glass.pedidoIdLabel}>Pedido</span>
                    <span className={glass.pedidoId}>#{r.codigo}</span>
                  </div>
                  <span
                    className={glass.faseBadge}
                    style={{
                      color: r.badgeColor,
                      backgroundColor: `${r.badgeColor}1A`,
                      borderColor: `${r.badgeColor}33`,
                    }}
                  >
                    <span className={glass.faseDot} style={{ backgroundColor: r.badgeColor }} aria-hidden="true" />
                    {r.badgeLabel}
                  </span>
                </div>

                {/* Mini-línea del producto: thumbnail + nombre. */}
                <div className={glass.productoRow}>
                  <div className={glass.thumbWrap}>
                    <img
                      className={glass.thumb}
                      src={r.miniatura}
                      alt={r.textoProductos}
                      loading="lazy"
                      onError={(e) => {
                        if (e.currentTarget.src !== PLACEHOLDER_IMG) {
                          e.currentTarget.src = PLACEHOLDER_IMG;
                        }
                      }}
                    />
                  </div>
                  <p className={glass.productoNombre} title={r.textoProductos}>
                    {r.textoProductos}
                  </p>
                </div>

                {/* Señales especiales visibles (pausa / deuda / anulado). */}
                {(r.isProblemaStock || r.tieneDeuda || r.esAnulado) && (
                  <div className={glass.alertas}>
                    {r.isProblemaStock && (
                      <span className={`${glass.alerta} ${glass.alertaWarn}`}>
                        <PauseCircle size={15} aria-hidden="true" /> Pausa por stock
                      </span>
                    )}
                    {r.tieneDeuda && (
                      <Link to={`/cuenta/pedidos/${r.id}`} className={`${glass.alerta} ${glass.alertaDeuda}`}>
                        <AlertTriangle size={15} aria-hidden="true" />
                        Pagar deuda: S/ {r.montoPendiente.toFixed(2)}
                      </Link>
                    )}
                    {r.esAnulado && (
                      <span className={`${glass.alerta} ${glass.alertaAnulado}`}>
                        <XCircle size={15} aria-hidden="true" /> Pedido anulado
                      </span>
                    )}
                  </div>
                )}

                {/* RASTREO PROMINENTE: si hay fase real del ERP, el stepper granular
                    de 8 pasos; si no (solo espejo / recién creado), el stepper reducido
                    de Walá con una nota aclaratoria (evita un timeline vacío engañoso). */}
                {r.hayFaseErpReal ? (
                  <div className={glass.timelineWrap}>
                    <Timeline
                      fechas={pedido.fechas}
                      fechaCompra={pedido.fechaCompra}
                      pedido={pedido}
                    />
                  </div>
                ) : (
                  <div className={glass.timelineWrap}>
                    <p className={glass.fallbackNota}>
                      La fase detallada de producción (diseño, estampado, empaquetado…)
                      aparecerá aquí cuando el taller la registre.
                    </p>
                    <StepperCoarse coarse={r.coarse} />
                  </div>
                )}

                {/* Enlace al detalle completo de la compra. */}
                <div className={glass.cardActions}>
                  <GlassButton
                    as={Link}
                    to={`/cuenta/pedidos/${r.id}`}
                    variant="ghost"
                    size="sm"
                    fullWidth
                  >
                    Ver detalle
                  </GlassButton>
                </div>
              </GlassCard>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
};

export default CuentaRastreoPage;
