import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import GlassCard from '../../../components/dashboard/GlassCard';
import KpiRow from '../../../components/dashboard/KpiRow';
import { Badge, GlassButton, GlassInput, Reveal, Stagger, StaggerItem } from '../../../components/ui';
import { useAdminWalaOrders } from '../../../hooks/useAdminWalaOrders';
import styles from './RecepcionPedidos.module.css';

/* ============================================================================
 * RecepcionPedidos — área admin para ORGANIZAR ENVÍOS del portal WALA.
 *
 * Es SOLO-LECTURA: consume el hook useAdminWalaOrders (que lee del ERP las
 * colecciones pedidos_web + pedidos vía la capa adminOrders.js) y pinta:
 *   1) un dashboard general con KPIs (por entregar, pendientes de pago, en
 *      producción, entregados, monto total),
 *   2) una grilla de tarjetas por pedido orientada al ENVÍO: lo más resaltado
 *      es la dirección de entrega + datos de contacto del cliente. Cada tarjeta
 *      ofrece "WhatsApp al cliente" y un enlace al detalle del pedido.
 *   3) filtros simples (estado + buscar por nombre/código) y orden por fecha.
 *
 * NO toca carrito/precios/cobro: solo muestra el estado ya derivado.
 *
 * Se embebe DEBAJO del dashboard de analítica (src/pages/admin/AdminDashboard.jsx)
 * y, opcionalmente, se monta también en su propia ruta /admin/dashboard/recepcion.
 * ========================================================================== */

// Formateador de soles (es-PE). Tolerante a no-números.
const fmtSoles = (n) =>
  `S/ ${(Number(n) || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Acentos de marca para los KPIs (alineados con el dashboard de analítica).
const ACENTO = {
  porEntregar: '#6D28D9',
  pendientesPago: '#EF4444',
  enProduccion: '#F59E0B',
  entregados: '#10B981',
  monto: '#8B5CF6',
};

// Mapea el estado.key del pedido al `tone` del Badge del sistema de diseño.
// (El color hex real ya viene en estado.color desde derivarEstadoCompra; usamos
// el tono semántico del Badge para el fondo suave, y reservamos el hex como
// respaldo visual del puntito.)
const TONO_POR_ESTADO = {
  entregado: 'success',
  en_preparacion: 'warning',
  pago_confirmado: 'violet',
  por_confirmar_pago: 'warning',
  anulado: 'danger',
};

/**
 * Construye la URL de WhatsApp (wa.me) a partir de un teléfono libre.
 * Limpia todo lo que no sea dígito; si no empieza con código de país, antepone
 * 51 (Perú), el mercado de WALA. Devuelve null si no hay número usable.
 */
function urlWhatsApp(telefono, mensaje) {
  const soloDigitos = String(telefono || '').replace(/\D/g, '');
  if (!soloDigitos) return null;
  // Si ya trae 11+ dígitos asumimos que incluye código de país; si son 9
  // (celular peruano), anteponemos 51.
  const numero = soloDigitos.length === 9 ? `51${soloDigitos}` : soloDigitos;
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/${numero}${texto}`;
}

// Filtros de estado disponibles (chips). 'todos' = sin filtro.
const FILTROS_ESTADO = [
  { key: 'todos', label: 'Todos' },
  { key: 'por_entregar', label: 'Por entregar' },
  { key: 'en_preparacion', label: 'En producción' },
  { key: 'por_confirmar_pago', label: 'Pago pendiente' },
  { key: 'entregado', label: 'Entregados' },
];

/* ---------------------------------------------------------------------------
 * Tarjeta de un pedido (orientada al ENVÍO).
 * ------------------------------------------------------------------------- */
function TarjetaPedido({ pedido }) {
  const {
    id,
    codigo,
    fechaCompraLabel,
    clienteNombre,
    clienteContacto,
    clienteDocumento,
    entrega,
    productos,
    cantidadTotal,
    montoTotal,
    costoEnvio,
    estado,
    esRegalo,
    regalo,
    deliveryDate,
  } = pedido;

  const tono = TONO_POR_ESTADO[estado?.key] || 'neutral';

  // Mensaje precargado de WhatsApp (saludo + código del pedido).
  const mensajeWa = `Hola ${clienteNombre || ''}, te escribimos de WALA sobre tu pedido ${codigo || ''}.`;
  const waUrl = urlWhatsApp(clienteContacto, mensajeWa);

  // Fecha de entrega programada (solo en pedidos regalo). Formato legible.
  const fechaEntregaLabel = useMemo(() => {
    if (!deliveryDate) return '';
    const ms = Date.parse(deliveryDate);
    if (Number.isNaN(ms)) return String(deliveryDate);
    try {
      return new Date(ms).toLocaleDateString('es-PE', {
        weekday: 'short',
        day: '2-digit',
        month: 'long',
      });
    } catch {
      return String(deliveryDate);
    }
  }, [deliveryDate]);

  // Nombre a quien va dirigido el envío (destinatario del regalo o el cliente).
  const destino = esRegalo && regalo?.destinatario ? regalo.destinatario : clienteNombre;

  return (
    <article className={styles.card}>
      {/* Cabecera: código + fecha + estado con su color de marca. */}
      <header className={styles.cardHead}>
        <div className={styles.cardHeadTexts}>
          <span className={styles.codigo}>{codigo || 's/código'}</span>
          {fechaCompraLabel && <span className={styles.fecha}>{fechaCompraLabel}</span>}
        </div>
        <Badge tone={tono} variant="soft" size="sm" dot>
          {estado?.label || 'Sin estado'}
        </Badge>
      </header>

      {/* DIRECCIÓN DE ENTREGA — lo más importante para el envío (resaltado). */}
      <div className={styles.entrega}>
        <div className={styles.entregaTop}>
          <span className={styles.entregaIcon} aria-hidden="true">📍</span>
          <span className={styles.entregaTitulo}>Dirección de entrega</span>
          {esRegalo && (
            <Badge tone="violet" variant="solid" size="sm" className={styles.regaloBadge}>
              🎁 Regalo
            </Badge>
          )}
        </div>

        <p className={styles.entregaDireccion}>
          {entrega?.direccion || 'Sin dirección registrada'}
        </p>
        {(entrega?.distrito || entrega?.departamento) && (
          <p className={styles.entregaZona}>
            {[entrega?.distrito, entrega?.departamento].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Datos extra de envío: destinatario (si regalo) + fecha programada. */}
        {esRegalo && destino && (
          <p className={styles.entregaExtra}>
            <span className={styles.extraLabel}>Para:</span> {destino}
          </p>
        )}
        {fechaEntregaLabel && (
          <p className={styles.entregaExtra}>
            <span className={styles.extraLabel}>Entregar:</span> {fechaEntregaLabel}
          </p>
        )}
        {esRegalo && regalo?.mensaje && (
          <p className={styles.entregaMensaje}>“{regalo.mensaje}”</p>
        )}
      </div>

      {/* CLIENTE — nombre + contacto + documento. */}
      <div className={styles.cliente}>
        <span className={styles.clienteIcon} aria-hidden="true">👤</span>
        <div className={styles.clienteTexts}>
          <span className={styles.clienteNombre}>{clienteNombre}</span>
          <span className={styles.clienteMeta}>
            {clienteContacto || 'Sin teléfono'}
            {clienteDocumento ? ` · Doc. ${clienteDocumento}` : ''}
          </span>
        </div>
      </div>

      {/* PRODUCTOS vendidos. */}
      <ul className={styles.productos}>
        {(productos || []).map((p, i) => (
          <li key={`${id}-prod-${i}`} className={styles.producto}>
            <span className={styles.prodCant}>{p.cantidad}×</span>
            <span className={styles.prodNombre}>{p.nombre}</span>
            {(p.color || p.talla) && (
              <span className={styles.prodVariante}>
                {[p.color, p.talla].filter(Boolean).join(' / ')}
              </span>
            )}
            {p.personalizado && (
              <span className={styles.prodPerso} title="Producto personalizado">✨</span>
            )}
          </li>
        ))}
        {(!productos || productos.length === 0) && (
          <li className={styles.productoVacio}>Sin detalle de productos.</li>
        )}
      </ul>

      {/* MONTO — total + envío. */}
      <div className={styles.montos}>
        <div className={styles.montoTotal}>
          <span className={styles.montoLabel}>Total</span>
          <span className={styles.montoValor}>{fmtSoles(montoTotal)}</span>
        </div>
        <div className={styles.montoEnvio}>
          <span className={styles.montoLabel}>Envío</span>
          <span className={styles.montoValorSec}>{fmtSoles(costoEnvio)}</span>
        </div>
        <div className={styles.montoUnidades}>
          {cantidadTotal} und.
        </div>
      </div>

      {/* ACCIONES — WhatsApp + detalle del pedido. */}
      <footer className={styles.acciones}>
        <GlassButton
          as="a"
          variant={waUrl ? 'primary' : 'glass'}
          size="sm"
          href={waUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          disabled={!waUrl}
          icon={<span aria-hidden="true">💬</span>}
          className={styles.accionWa}
        >
          WhatsApp
        </GlassButton>
        <GlassButton
          as={Link}
          to={`/cuenta/pedidos/${id}`}
          variant="glass"
          size="sm"
          className={styles.accionDetalle}
        >
          Ver detalle
        </GlassButton>
      </footer>
    </article>
  );
}

/* ---------------------------------------------------------------------------
 * Tarjeta-esqueleto para el estado de carga.
 * ------------------------------------------------------------------------- */
function TarjetaSkeleton() {
  return (
    <div className={`${styles.card} ${styles.skeleton}`} aria-hidden="true">
      <div className={styles.skLine} style={{ width: '40%' }} />
      <div className={styles.skBlock} />
      <div className={styles.skLine} style={{ width: '70%' }} />
      <div className={styles.skLine} style={{ width: '55%' }} />
      <div className={styles.skRow}>
        <div className={styles.skPill} />
        <div className={styles.skPill} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * RecepcionPedidos — sección completa.
 *
 * @param {boolean} [embebido=true] Si true, no muestra encabezado de página
 *   propio (se embebe bajo el dashboard). Si false, agrega título (modo ruta).
 * ------------------------------------------------------------------------- */
export default function RecepcionPedidos({ embebido = true }) {
  const { data, isLoading, isFetching, isError, refetch } = useAdminWalaOrders();

  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  const pedidos = data?.pedidos || [];
  const resumen = data?.resumen || {
    total: 0,
    porEntregar: 0,
    pendientesPago: 0,
    enProduccion: 0,
    entregados: 0,
    montoTotal: 0,
  };
  const disponible = data?.available !== false;

  // KPIs del dashboard general (de resumen). Orientados al ENVÍO.
  const kpis = useMemo(
    () => [
      { label: 'Por entregar', value: resumen.porEntregar, accent: ACENTO.porEntregar },
      { label: 'Pendientes de pago', value: resumen.pendientesPago, accent: ACENTO.pendientesPago },
      { label: 'En producción', value: resumen.enProduccion, accent: ACENTO.enProduccion },
      { label: 'Entregados', value: resumen.entregados, accent: ACENTO.entregados },
      {
        label: 'Monto total',
        value: resumen.montoTotal,
        accent: ACENTO.monto,
        format: fmtSoles,
      },
    ],
    [resumen]
  );

  // Lista filtrada: por estado (chip) + búsqueda libre (nombre/código/dirección).
  const pedidosFiltrados = useMemo(() => {
    let lista = pedidos;

    if (filtroEstado !== 'todos') {
      if (filtroEstado === 'por_entregar') {
        // "Por entregar" = no entregado y no anulado (igual que el resumen).
        lista = lista.filter(
          (p) => p.estado?.key !== 'entregado' && p.estado?.key !== 'anulado'
        );
      } else {
        lista = lista.filter((p) => p.estado?.key === filtroEstado);
      }
    }

    const q = busqueda.trim().toLowerCase();
    if (q) {
      lista = lista.filter((p) => {
        const campos = [
          p.codigo,
          p.clienteNombre,
          p.clienteContacto,
          p.clienteDocumento,
          p.entrega?.direccion,
          p.entrega?.distrito,
          p.entrega?.departamento,
        ];
        return campos.some((c) => String(c || '').toLowerCase().includes(q));
      });
    }

    // Ya viene ordenado por fecha desc desde la capa de datos; lo respetamos.
    return lista;
  }, [pedidos, filtroEstado, busqueda]);

  return (
    <section className={styles.seccion} aria-label="Recepción de pedidos">
      {/* Encabezado de la sección. */}
      <header className={styles.head}>
        <div>
          <h2 className={styles.titulo}>
            <span aria-hidden="true">📦</span> Recepción de Pedidos
          </h2>
          <p className={styles.subtitulo}>
            Organiza los envíos del portal WALA. La dirección de entrega es lo más
            importante de cada tarjeta.
          </p>
        </div>
        <button
          type="button"
          className={styles.refresh}
          onClick={() => refetch()}
          disabled={isFetching}
          title="Actualizar pedidos"
        >
          <span className={`${styles.refreshIcon} ${isFetching ? styles.spinning : ''}`} aria-hidden="true">
            ↻
          </span>
          Actualizar
        </button>
      </header>

      {/* (1) Dashboard general: KPIs. */}
      <Reveal>
        <KpiRow items={kpis} className={styles.kpis} />
      </Reveal>

      {/* Filtros: chips de estado + búsqueda. */}
      <div className={styles.filtros}>
        <div className={styles.chips} role="group" aria-label="Filtrar por estado">
          {FILTROS_ESTADO.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`${styles.chip} ${filtroEstado === f.key ? styles.chipActivo : ''}`}
              onClick={() => setFiltroEstado(f.key)}
              aria-pressed={filtroEstado === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className={styles.buscar}>
          <GlassInput
            type="search"
            placeholder="Buscar por nombre, código o dirección…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icon={<span aria-hidden="true">🔎</span>}
            aria-label="Buscar pedidos"
          />
        </div>
      </div>

      {/* (2) Tarjetas por pedido (grid). Carga / error / vacío. */}
      {isError || !disponible ? (
        <GlassCard className={styles.aviso}>
          <p className={styles.avisoTexto}>
            No se pudieron cargar los pedidos del ERP en este momento.{' '}
            {data?.error ? <span className={styles.avisoDetalle}>({data.error})</span> : null}
          </p>
          <GlassButton variant="glass" size="sm" onClick={() => refetch()}>
            Reintentar
          </GlassButton>
        </GlassCard>
      ) : isLoading ? (
        <div className={styles.grid} aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <TarjetaSkeleton key={`sk-${i}`} />
          ))}
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <GlassCard className={styles.aviso}>
          <p className={styles.avisoTexto}>
            {pedidos.length === 0
              ? 'Aún no hay pedidos del portal para organizar.'
              : 'Ningún pedido coincide con el filtro o la búsqueda.'}
          </p>
          {pedidos.length > 0 && (
            <GlassButton
              variant="glass"
              size="sm"
              onClick={() => {
                setFiltroEstado('todos');
                setBusqueda('');
              }}
            >
              Limpiar filtros
            </GlassButton>
          )}
        </GlassCard>
      ) : (
        <Stagger className={styles.grid}>
          {pedidosFiltrados.map((p) => (
            <StaggerItem key={p.id || p.codigo}>
              <TarjetaPedido pedido={p} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </section>
  );
}
