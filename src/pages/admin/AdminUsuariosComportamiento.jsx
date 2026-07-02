import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  listUsers,
  getUserFicha,
  getWishlistAggregate,
  getCartsAggregate,
  getDatosPersonalesAggregate,
} from '../../services/adminUserInsights';
import KpiRow from '../../components/dashboard/KpiRow';
import RankingConMiniaturas from '../../components/dashboard/RankingConMiniaturas';
import { GlassCard, GlassButton, GlassInput, Badge } from '../../components/ui';
import styles from './AdminUsuariosComportamiento.module.css';

/* ============================================================================
 * AdminUsuariosComportamiento — "👥 Ver qué hacen los usuarios"
 * ----------------------------------------------------------------------------
 * Panel SOLO-ADMIN (vive bajo AdminRoute) con DOS niveles:
 *
 *   NIVEL DASHBOARD (arriba): KPIs agregados + tarjetas "Qué apartan más"
 *   (wishlists), "Qué hay en los carritos" (foto del momento) y "Próximos
 *   cumpleaños" (30 días, titular o persona agendada).
 *
 *   NIVEL USUARIOS (abajo): buscador + lista paginada con cursor ("Cargar
 *   más") y ficha expandible por usuario con tabs 💝 / 🛒 / 📅 / 📈.
 *
 * LECTURAS BARATAS (reglas duras respetadas):
 *   - TODO va envuelto en react-query con staleTime alto (agregados 10 min,
 *     listado/fichas 5 min): navegar, abrir/cerrar fichas o re-render NUNCA
 *     relanza lecturas mientras la caché esté fresca.
 *   - getCartsAggregate + getDatosPersonalesAggregate comparten internamente
 *     UNA sola pasada por portal_clientes_users (caché del servicio, TTL 5
 *     min): pedirlas juntas cuesta una lectura de perfiles, no dos.
 *   - La búsqueda filtra CLIENT-SIDE sobre las páginas YA cargadas (0 lecturas
 *     al teclear) y la UI avisa honestamente que solo busca en lo cargado.
 *   - Los agregados llegan con topes (truncated) y la UI lo dice claro:
 *     "analizando los primeros N".
 *
 * ACTIVIDAD POR USUARIO: NO se duplica el panel existente. La tab 📈 muestra
 * un resumen con datos que YA están en la ficha (0 lecturas extra) y enlaza a
 * /admin/usuarios-analytics (getUserAnalytics, adminAnalytics.js:616-666).
 * ========================================================================== */

/* ------------------------------ constantes -------------------------------- */

// Frescura de caché: agregados 10 min (pedido explícito), listado/fichas 5 min.
const STALE_AGREGADOS_MS = 10 * 60 * 1000;
const STALE_USUARIOS_MS = 5 * 60 * 1000;
const GC_MS = 30 * 60 * 1000;

// Topes de lectura de los agregados (el servicio avisa con truncated si hay más).
const MAX_WISHLISTS = 500;
const MAX_PERFILES = 800;

// Tamaño de página del listado de usuarios (botón "Cargar más").
const PAGE_SIZE = 25;

// Máximo de cumpleaños listados en la tarjeta (el resto se resume en una línea).
const MAX_CUMPLES_VISIBLES = 14;

/* ----------------------------- formateadores ------------------------------ */

const fmtInt = (v) => new Intl.NumberFormat('es-PE').format(Math.round(Number(v) || 0));

const fmtSoles = (v) =>
  `S/ ${(Number(v) || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Fecha+hora corta legible ("15 mar 2026, 10:45") a partir de ms o de un valor
// parseable por Date (ISO). Devuelve null si no se puede interpretar.
function fmtFechaHora(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// "en cuántos días" → texto humano para la tarjeta de cumpleaños.
function textoEnDias(enDias) {
  if (enDias === 0) return 'Hoy';
  if (enDias === 1) return 'Mañana';
  return `En ${enDias} días`;
}

// Inicial para avatares/miniaturas sin foto.
function inicialDe(texto) {
  const s = String(texto || '?').trim();
  return s ? s[0].toUpperCase() : '?';
}

/* --------------------------- queries compartidas --------------------------- */

// Envuelve una llamada del servicio (que NUNCA lanza) para react-query:
// si hubo error y NO llegó nada útil, lanzamos (react-query reintenta);
// si llegó data parcial con error, la devolvemos con un aviso suave.
async function cargarAgregado(fetcher, opciones) {
  const { data, error } = await fetcher(opciones);
  const sinDatos = !data || (typeof data.docsLeidos === 'number' && data.docsLeidos === 0);
  if (error && sinDatos) throw new Error(error);
  return { ...data, avisoError: error || null };
}

/* ============================ sub-componentes UI ============================ */

/**
 * Miniatura de producto con fallback a inicial: hay productos "tombstone"
 * (deleted:true) y snapshots antiguos sin imagen, así que la imagen puede
 * fallar; onError la oculta y queda la inicial de respaldo debajo.
 */
function MiniaturaProducto({ src, nombre }) {
  return (
    <span className={styles.thumb} aria-hidden="true">
      <span className={styles.thumbFallback}>{inicialDe(nombre)}</span>
      {src && (
        <img
          className={styles.thumbImg}
          src={src}
          alt=""
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
    </span>
  );
}

/** Aviso honesto reutilizable (truncados, foto del momento, errores suaves). */
function Aviso({ tone = 'neutral', children }) {
  if (!children) return null;
  return (
    <p className={`${styles.aviso} ${tone === 'warning' ? styles.avisoWarning : ''}`}>
      {children}
    </p>
  );
}

/** Estado vacío limpio y compacto para listas/tabs. */
function EstadoVacio({ icono = '📭', children }) {
  return (
    <div className={styles.vacio}>
      <span className={styles.vacioIcono} aria-hidden="true">{icono}</span>
      <span>{children}</span>
    </div>
  );
}

/* ------------------------------ tarjeta cumpleaños ------------------------- */

function TarjetaCumpleanos({ datos, isLoading, error }) {
  const lista = datos?.proximosCumpleanos || [];
  const visibles = lista.slice(0, MAX_CUMPLES_VISIBLES);
  const ocultos = lista.length - visibles.length;

  return (
    <GlassCard
      title="🎂 Próximos cumpleaños"
      subtitle="Ventana de 30 días: del titular o de sus personas agendadas"
      className={styles.cardCumples}
      actions={
        <GlassButton as={Link} to="/admin/fechas-importantes" variant="ghost" size="sm">
          📅 Fechas Importantes
        </GlassButton>
      }
    >
      {error && <Aviso tone="warning">No se pudieron cargar los cumpleaños: {error}</Aviso>}
      {isLoading && !datos && <div className={styles.cargando}>Cargando cumpleaños…</div>}

      {datos && (
        <>
          {/* Mini-resumen de datos personales del mismo agregado (misma lectura). */}
          <div className={styles.chipsDatos}>
            <Badge tone="violet" variant="soft">🎂 {fmtInt(datos.conCumpleanos)} con cumpleaños</Badge>
            <Badge tone="success" variant="soft">📋 {fmtInt(datos.conEncuesta)} con encuesta</Badge>
            <Badge tone="neutral" variant="soft">
              👥 {fmtInt(datos.conPersonasAgendadas)} con personas agendadas ({fmtInt(datos.totalPersonasAgendadas)} en total)
            </Badge>
            <Badge tone="neutral" variant="outline">de {fmtInt(datos.totalPerfiles)} perfiles</Badge>
          </div>

          {datos.truncated && (
            <Aviso tone="warning">
              ⚠️ Analizando los primeros {fmtInt(datos.docsLeidos)} perfiles (hay más usuarios que no entran en este resumen).
            </Aviso>
          )}
          {datos.avisoError && <Aviso tone="warning">Datos parciales: {datos.avisoError}</Aviso>}

          {visibles.length === 0 ? (
            <EstadoVacio icono="🎈">No hay cumpleaños en los próximos 30 días.</EstadoVacio>
          ) : (
            <ul className={styles.listaCumples}>
              {visibles.map((c, i) => (
                <li key={`${c.uid}-${c.fecha}-${c.dePersona}-${i}`} className={styles.filaCumple}>
                  <Badge
                    tone={c.enDias === 0 ? 'danger' : c.enDias <= 7 ? 'warning' : 'neutral'}
                    variant="soft"
                    className={styles.badgeDias}
                  >
                    {textoEnDias(c.enDias)}
                  </Badge>
                  <span className={styles.cumpleInfo}>
                    <span className={styles.cumpleQuien}>
                      {c.esTitular ? `🎂 ${c.nombre}` : `🎁 ${c.dePersona}`}
                    </span>
                    <span className={styles.cumpleDetalle}>
                      {c.fechaLegible || c.fecha}
                      {!c.esTitular && ` · cuenta de ${c.nombre}`}
                      {c.email && ` · ${c.email}`}
                    </span>
                  </span>
                  <Badge tone={c.esTitular ? 'violet' : 'neutral'} variant="outline" size="sm">
                    {c.esTitular ? 'Titular' : 'Agendado'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {ocultos > 0 && (
            <Aviso>…y {fmtInt(ocultos)} cumpleaños más dentro de la ventana de 30 días.</Aviso>
          )}
        </>
      )}
    </GlassCard>
  );
}

/* ------------------------------ ficha de usuario --------------------------- */

const TABS_FICHA = [
  { id: 'deseos', label: '💝 Lista de deseos' },
  { id: 'carrito', label: '🛒 Carrito' },
  { id: 'fechas', label: '📅 Fechas y personas' },
  { id: 'actividad', label: '📈 Actividad' },
];

function FichaUsuario({ uid }) {
  const [tab, setTab] = useState('deseos');

  // Ficha bajo react-query: reabrir el mismo usuario dentro de 5 min NO relee.
  const fichaQuery = useQuery({
    queryKey: ['adminUserInsights', 'ficha', uid],
    queryFn: async () => {
      const { data, error } = await getUserFicha(uid);
      if (error && !data) throw new Error(error);
      return data;
    },
    enabled: Boolean(uid),
    staleTime: STALE_USUARIOS_MS,
    gcTime: GC_MS,
  });

  if (fichaQuery.isLoading) {
    return <div className={`${styles.ficha} ${styles.cargando}`}>Cargando ficha…</div>;
  }
  if (fichaQuery.isError || !fichaQuery.data) {
    return (
      <div className={styles.ficha}>
        <Aviso tone="warning">
          No se pudo cargar la ficha: {fichaQuery.error?.message || 'perfil no encontrado'}.
        </Aviso>
      </div>
    );
  }

  const f = fichaQuery.data;

  return (
    <div className={styles.ficha}>
      {/* Cabecera de la ficha: identidad + datos de contacto (solo-admin). */}
      <div className={styles.fichaCabecera}>
        <span className={styles.avatar} aria-hidden="true">{inicialDe(f.nombre)}</span>
        <div className={styles.fichaIdentidad}>
          <strong className={styles.fichaNombre}>{f.nombre}</strong>
          <span className={styles.fichaMeta}>
            {[f.email, f.dni && `${f.tipoDocumento || 'Doc'}: ${f.dni}`, f.phone, f.country]
              .filter(Boolean)
              .join(' · ') || 'Sin datos de contacto'}
          </span>
        </div>
        <div className={styles.fichaChips}>
          <Badge tone="warning" variant="soft" title="Monedas de fidelización">🪙 {fmtInt(f.monedas)}</Badge>
          <Badge tone={f.hasCompletedSurvey ? 'success' : 'neutral'} variant="soft">
            {f.hasCompletedSurvey ? '✓ Encuesta' : '✗ Sin encuesta'}
          </Badge>
        </div>
      </div>

      {/* Tabs de la ficha. */}
      <div className={styles.tabs} role="tablist" aria-label="Secciones de la ficha">
        {TABS_FICHA.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.tabBtn} ${tab === t.id ? styles.tabActiva : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 💝 Lista de deseos ── */}
      {tab === 'deseos' && (
        <div role="tabpanel" className={styles.tabPanel}>
          {f.wishlist.count === 0 ? (
            <EstadoVacio icono="💝">Este usuario aún no tiene lista de deseos.</EstadoVacio>
          ) : (
            <>
              <div className={styles.chipsDatos}>
                <Badge tone="violet" variant="soft">{fmtInt(f.wishlist.count)} deseos</Badge>
                {f.wishlist.giftedCount > 0 && (
                  <Badge tone="success" variant="soft">🎁 {fmtInt(f.wishlist.giftedCount)} ya regalados</Badge>
                )}
              </div>
              <ul className={styles.listaItems}>
                {f.wishlist.items.map((it, i) => (
                  <li key={`${it.productId || 'p'}-${i}`} className={styles.filaItem}>
                    <MiniaturaProducto src={it.productImage} nombre={it.productName} />
                    <span className={styles.itemInfo}>
                      <span className={styles.itemNombre} title={it.productName}>{it.productName}</span>
                      <span className={styles.itemDetalle}>
                        {it.price > 0 ? fmtSoles(it.price) : 'Sin precio guardado'}
                        {fmtFechaHora(it.addedAt) && ` · añadido ${fmtFechaHora(it.addedAt)}`}
                      </span>
                    </span>
                    {it.isGifted && (
                      <Badge tone="success" variant="soft" title={it.giftedBy ? `Regalado por ${it.giftedBy}` : 'Ya regalado'}>
                        🎁 Regalado{it.giftedBy ? ` por ${it.giftedBy}` : ''}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* ── 🛒 Carrito ── */}
      {tab === 'carrito' && (
        <div role="tabpanel" className={styles.tabPanel}>
          {f.cart.items.length === 0 ? (
            <EstadoVacio icono="🛒">Su carrito está vacío en este momento.</EstadoVacio>
          ) : (
            <>
              <div className={styles.chipsDatos}>
                <Badge tone="violet" variant="soft">{fmtInt(f.cart.count)} líneas · {fmtInt(f.cart.unidades)} uds</Badge>
                <Badge tone="success" variant="soft">≈ {fmtSoles(f.cart.totalEstimado)}</Badge>
              </div>
              <Aviso>
                📸 Foto del momento: el carrito se reescribe cada vez que el usuario navega o compra.
                {fmtFechaHora(f.cart.cartUpdatedAt) && ` Última actualización: ${fmtFechaHora(f.cart.cartUpdatedAt)}.`}
              </Aviso>
              <ul className={styles.listaItems}>
                {f.cart.items.map((it, i) => (
                  <li
                    key={`${it.productId || 'p'}-${i}`}
                    className={`${styles.filaItem} ${!it.selected ? styles.filaDeseleccionada : ''}`}
                  >
                    <MiniaturaProducto src={it.productImage} nombre={it.productName} />
                    <span className={styles.itemInfo}>
                      <span className={styles.itemNombre} title={it.productName}>{it.productName}</span>
                      <span className={styles.itemDetalle}>
                        {fmtInt(it.quantity)} × {fmtSoles(it.price)} = {fmtSoles(it.subtotal)}
                      </span>
                    </span>
                    {!it.selected && (
                      <Badge tone="warning" variant="soft" title='El usuario lo dejó marcado como "no comprar esta vez"'>
                        ⏸ No comprar esta vez
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* ── 📅 Fechas y personas ── */}
      {tab === 'fechas' && (
        <div role="tabpanel" className={styles.tabPanel}>
          <div className={styles.chipsDatos}>
            <Badge tone="violet" variant="soft">
              🎂 {f.birthdayLegible ? `Cumpleaños: ${f.birthdayLegible}` : 'Sin cumpleaños registrado'}
            </Badge>
            <Badge tone={f.hasCompletedSurvey ? 'success' : 'neutral'} variant="soft">
              {f.hasCompletedSurvey ? '✓ Completó la encuesta' : '✗ No completó la encuesta'}
            </Badge>
          </div>

          {f.giftRecipients.length === 0 ? (
            <EstadoVacio icono="👥">Este usuario aún no ha agendado personas ni fechas.</EstadoVacio>
          ) : (
            <ul className={styles.listaPersonas}>
              {f.giftRecipients.map((p, i) => (
                <li key={p.id || `persona-${i}`} className={styles.filaPersona}>
                  <span className={styles.avatarPersona} aria-hidden="true">
                    <span className={styles.thumbFallback}>{inicialDe(p.name)}</span>
                    {p.photoUrl && (
                      <img
                        className={styles.thumbImg}
                        src={p.photoUrl}
                        alt=""
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </span>
                  <span className={styles.itemInfo}>
                    <span className={styles.itemNombre}>
                      {p.name} <Badge tone="neutral" variant="outline" size="sm">{p.roleDisplay}</Badge>
                    </span>
                    {p.events.length === 0 ? (
                      <span className={styles.itemDetalle}>Sin fechas registradas</span>
                    ) : (
                      <span className={styles.eventosPersona}>
                        {p.events.map((ev, j) => (
                          <span key={ev.id || `ev-${j}`} className={styles.eventoChip}>
                            {ev.label}: {ev.dateLegible || ev.date || 'sin fecha'}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── 📈 Actividad — resumen SIN lecturas extra + enlace al panel ya
             existente (getUserAnalytics). NO duplicamos ese panel aquí. ── */}
      {tab === 'actividad' && (
        <div role="tabpanel" className={styles.tabPanel}>
          <div className={styles.chipsDatos}>
            {fmtFechaHora(f.updatedAtMs) && (
              <Badge tone="neutral" variant="soft">🕐 Perfil actualizado: {fmtFechaHora(f.updatedAtMs)}</Badge>
            )}
            {fmtFechaHora(f.createdAtMs) && (
              <Badge tone="neutral" variant="soft">✨ Creado: {fmtFechaHora(f.createdAtMs)}</Badge>
            )}
            <Badge tone="violet" variant="soft">💝 {fmtInt(f.wishlist.count)} deseos</Badge>
            <Badge tone="violet" variant="soft">🛒 {fmtInt(f.cart.count)} en carrito</Badge>
            <Badge tone="violet" variant="soft">👥 {fmtInt(f.giftRecipients.length)} personas</Badge>
          </div>
          <Aviso>
            El detalle de sesiones, páginas vistas y métricas de este usuario vive en el panel
            "Usuarios y métricas" (no se duplica aquí para no repetir lecturas).
          </Aviso>
          <GlassButton as={Link} to="/admin/usuarios-analytics" variant="primary" size="sm">
            📈 Ver actividad completa en Usuarios y métricas
          </GlassButton>
        </div>
      )}
    </div>
  );
}

/* ================================ página ================================== */

export default function AdminUsuariosComportamiento() {
  const queryClient = useQueryClient();

  // Usuario con la ficha abierta (expandible bajo su fila). null = ninguna.
  const [uidAbierto, setUidAbierto] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  /* ---- NIVEL DASHBOARD: agregados (staleTime 10 min, refresco solo manual) ---- */

  const wishlistAgg = useQuery({
    queryKey: ['adminUserInsights', 'wishlist', MAX_WISHLISTS],
    queryFn: () => cargarAgregado(getWishlistAggregate, { maxDocs: MAX_WISHLISTS }),
    staleTime: STALE_AGREGADOS_MS,
    gcTime: GC_MS,
  });

  // Carritos y datos personales comparten UNA lectura interna de perfiles
  // (caché del servicio): montarlas juntas es barato a propósito.
  const cartsAgg = useQuery({
    queryKey: ['adminUserInsights', 'carts', MAX_PERFILES],
    queryFn: () => cargarAgregado(getCartsAggregate, { maxDocs: MAX_PERFILES }),
    staleTime: STALE_AGREGADOS_MS,
    gcTime: GC_MS,
  });

  const datosAgg = useQuery({
    queryKey: ['adminUserInsights', 'datos', MAX_PERFILES],
    queryFn: () => cargarAgregado(getDatosPersonalesAggregate, { maxDocs: MAX_PERFILES }),
    staleTime: STALE_AGREGADOS_MS,
    gcTime: GC_MS,
  });

  /* ---- NIVEL USUARIOS: listado paginado con cursor opaco (Cargar más) ---- */

  const usersQuery = useInfiniteQuery({
    // La búsqueda NO entra en la queryKey: filtra client-side sobre lo ya
    // cargado, así teclear en el buscador cuesta CERO lecturas nuevas.
    queryKey: ['adminUserInsights', 'users', PAGE_SIZE],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await listUsers({ pageSize: PAGE_SIZE, cursor: pageParam || null });
      if (error) throw new Error(error);
      return data;
    },
    initialPageParam: null,
    // El cursor es OPACO (lastDoc de Firestore): se pasa tal cual a la página siguiente.
    getNextPageParam: (ultima) => (ultima.hasMore && ultima.cursor ? ultima.cursor : undefined),
    staleTime: STALE_USUARIOS_MS,
    gcTime: GC_MS,
  });

  // Filas acumuladas de todas las páginas cargadas (el agregado NO se recalcula
  // en cada render: useMemo sobre data de react-query). Se DEDUPLICA por uid:
  // el cursor pagina sobre updatedAt con datos vivos, así que un mismo usuario
  // puede colarse en dos páginas (su updatedAt cambió entre lecturas) y
  // duplicaría keys de React. Se conserva la PRIMERA aparición.
  const usuariosCargados = useMemo(() => {
    const porUid = new Map(); // uid -> user (primera aparición gana)
    (usersQuery.data?.pages || []).forEach((p) => {
      (p.users || []).forEach((u) => {
        if (!porUid.has(u.uid)) porUid.set(u.uid, u);
      });
    });
    return [...porUid.values()];
  }, [usersQuery.data]);

  // Búsqueda client-side (contiene, sin mayúsculas) sobre nombre/email/dni de
  // TODO lo cargado. Limitación honesta: solo encuentra dentro de lo cargado.
  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuariosCargados;
    return usuariosCargados.filter((u) =>
      (u.nombre || '').toLowerCase().includes(q) ||
      (u.email || '').includes(q) ||
      (u.dni || '').includes(q));
  }, [usuariosCargados, busqueda]);

  /* ---- KPIs del dashboard (derivados memoizados, no en cada render) ---- */

  const kpis = useMemo(() => {
    const w = wishlistAgg.data;
    const c = cartsAgg.data;
    const d = datosAgg.data;
    return [
      {
        label: 'Usuarios con lista de deseos',
        value: w?.totales?.usuariosConLista || 0,
        icon: '💝',
        info: 'Cuántos usuarios tienen al menos un producto apartado en su lista de deseos.',
      },
      {
        label: 'Usuarios con carrito activo',
        value: c?.totales?.usuariosConCarrito || 0,
        icon: '🛒',
        accent: '#8B5CF6',
        info: 'Cuántos usuarios tienen productos en el carrito AHORA (foto del momento; cambia cuando navegan).',
      },
      {
        label: 'Valor estimado en carritos',
        value: c?.totales?.valorTotalEstimado || 0,
        format: fmtSoles,
        icon: '💰',
        accent: '#10B981',
        info: 'Suma estimada de lo que hay en todos los carritos. Es solo referencia visual, NO dinero contable.',
      },
      {
        label: 'Cumpleaños en 30 días',
        value: d?.proximosCumpleanos?.length || 0,
        icon: '🎂',
        accent: '#F59E0B',
        info: 'Cumpleaños próximos del titular o de sus personas agendadas: oro para campañas de regalo.',
      },
    ];
  }, [wishlistAgg.data, cartsAgg.data, datosAgg.data]);

  // Refresco manual: invalida TODO el árbol de este panel. Nota honesta: el
  // servicio cachea la pasada de perfiles 5 min, así que refrescar antes de
  // ese TTL puede devolver la misma foto (sin costo extra de lecturas).
  const algoCargando = wishlistAgg.isFetching || cartsAgg.isFetching || datosAgg.isFetching;
  const refrescarTodo = () => {
    queryClient.invalidateQueries({ queryKey: ['adminUserInsights'] });
  };

  /* ---- helpers de render del listado ---- */

  // Nº de deseos por usuario: SOLO si su ficha ya está en caché (0 lecturas).
  const deseosEnCache = (uid) =>
    queryClient.getQueryData(['adminUserInsights', 'ficha', uid])?.wishlist?.count;

  return (
    <div className={styles.pagina}>
      {/* ── Encabezado ── */}
      <header className={styles.encabezado}>
        <div>
          <h1 className={styles.titulo}>👥 Ver qué hacen los usuarios</h1>
          <p className={styles.subtitulo}>
            Listas de deseos, carritos y fechas especiales de los clientes.
            Los carritos son una <strong>foto del momento</strong> y los montos son solo referencia visual.
          </p>
        </div>
        <GlassButton variant="glass" size="sm" onClick={refrescarTodo} disabled={algoCargando}>
          {algoCargando ? '⟳ Actualizando…' : '⟳ Actualizar'}
        </GlassButton>
      </header>

      {/* ── NIVEL DASHBOARD ── */}
      {(wishlistAgg.isError || cartsAgg.isError || datosAgg.isError) && (
        <Aviso tone="warning">
          ⚠️ Algún resumen no cargó:{' '}
          {[wishlistAgg.error?.message, cartsAgg.error?.message, datosAgg.error?.message]
            .filter(Boolean)
            .join(' · ')}. Prueba con "Actualizar".
        </Aviso>
      )}

      <KpiRow items={kpis} className={styles.kpis} />

      <div className={styles.gridTops}>
        {/* Qué apartan más (wishlists) */}
        <GlassCard
          title="💝 Qué apartan más"
          subtitle="Productos presentes en más listas de deseos"
          className={styles.cardTop}
        >
          {wishlistAgg.isLoading && <div className={styles.cargando}>Cargando listas de deseos…</div>}
          {wishlistAgg.data && (
            <>
              {wishlistAgg.data.truncated && (
                <Aviso tone="warning">
                  ⚠️ Analizando las primeras {fmtInt(wishlistAgg.data.docsLeidos)} listas (hay más).
                </Aviso>
              )}
              {wishlistAgg.data.avisoError && (
                <Aviso tone="warning">Datos parciales: {wishlistAgg.data.avisoError}</Aviso>
              )}
              <RankingConMiniaturas
                items={(wishlistAgg.data.top || []).map((p) => ({
                  id: p.productId,
                  label: p.productName,
                  image: p.productImage,
                  value: p.count,
                  sub: p.giftedCount > 0 ? `🎁 ${fmtInt(p.giftedCount)} ya regalado(s)` : undefined,
                }))}
                valueLabel="listas"
                emptyIcon="💝"
                emptyText="Todavía nadie apartó productos en su lista de deseos."
                max={8}
              />
              <Aviso>
                {fmtInt(wishlistAgg.data.totales.usuariosConLista)} usuarios con lista ·{' '}
                {fmtInt(wishlistAgg.data.totales.itemsTotales)} deseos en total.
              </Aviso>
            </>
          )}
        </GlassCard>

        {/* Qué hay en los carritos (foto del momento) */}
        <GlassCard
          title="🛒 Qué hay en los carritos"
          subtitle="📸 Foto del momento: se reescribe cuando el usuario navega o compra"
          className={styles.cardTop}
        >
          {cartsAgg.isLoading && <div className={styles.cargando}>Cargando carritos…</div>}
          {cartsAgg.data && (
            <>
              {cartsAgg.data.truncated && (
                <Aviso tone="warning">
                  ⚠️ Analizando los primeros {fmtInt(cartsAgg.data.docsLeidos)} perfiles (hay más).
                </Aviso>
              )}
              {cartsAgg.data.avisoError && (
                <Aviso tone="warning">Datos parciales: {cartsAgg.data.avisoError}</Aviso>
              )}
              <RankingConMiniaturas
                items={(cartsAgg.data.top || []).map((p) => ({
                  id: p.productId,
                  label: p.productName,
                  image: p.productImage,
                  value: p.enCarritos,
                  sub: `${fmtInt(p.unidades)} uds · ≈ ${fmtSoles(p.valorEstimado)}`,
                }))}
                valueLabel="carritos"
                emptyIcon="🛒"
                emptyText="Ahora mismo no hay productos en ningún carrito."
                max={8}
              />
              <Aviso>
                {fmtInt(cartsAgg.data.totales.usuariosConCarrito)} usuarios con carrito ·{' '}
                {fmtInt(cartsAgg.data.totales.itemsTotales)} líneas · valor estimado{' '}
                {fmtSoles(cartsAgg.data.totales.valorTotalEstimado)} (solo display).
              </Aviso>
            </>
          )}
        </GlassCard>
      </div>

      <TarjetaCumpleanos
        datos={datosAgg.data}
        isLoading={datosAgg.isLoading}
        error={datosAgg.isError ? datosAgg.error?.message : null}
      />

      {/* ── NIVEL USUARIOS ── */}
      <GlassCard
        title="🔎 Usuarios uno a uno"
        subtitle="Haz clic en un usuario para abrir su ficha (deseos, carrito, fechas y actividad)"
        className={styles.cardUsuarios}
      >
        <div className={styles.buscadorZona}>
          <GlassInput
            type="search"
            icon="🔎"
            placeholder="Buscar por nombre, email o DNI…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar usuarios por nombre, email o DNI"
            className={styles.buscador}
          />
          {busqueda.trim() && (
            <Aviso tone="warning">
              ⚠️ Buscando solo entre los {fmtInt(usuariosCargados.length)} usuarios ya cargados
              {usersQuery.hasNextPage ? ' — pulsa "Cargar más" para ampliar la búsqueda.' : '.'}
            </Aviso>
          )}
        </div>

        {usersQuery.isLoading && <div className={styles.cargando}>Cargando usuarios…</div>}
        {usersQuery.isError && (
          <Aviso tone="warning">No se pudo cargar el listado: {usersQuery.error?.message}</Aviso>
        )}

        {!usersQuery.isLoading && !usersQuery.isError && (
          <>
            {usuariosFiltrados.length === 0 ? (
              <EstadoVacio icono="🔎">
                {busqueda.trim()
                  ? 'Nadie coincide entre los usuarios cargados. Carga más páginas o ajusta la búsqueda.'
                  : 'Todavía no hay usuarios registrados en el portal.'}
              </EstadoVacio>
            ) : (
              <>
              {/* Cabecera de la "tabla" (se oculta en móvil; las filas se apilan). */}
              <div className={`${styles.filaUsuario} ${styles.filaCabecera}`} aria-hidden="true">
                <span>Usuario</span>
                <span>💝 Deseos</span>
                <span>🛒 Carrito</span>
                <span>👥 Personas</span>
                <span>📋 Encuesta</span>
              </div>

              <ul className={styles.listaUsuarios}>
                {usuariosFiltrados.map((u) => {
                  const abierta = uidAbierto === u.uid;
                  const deseos = deseosEnCache(u.uid);
                  return (
                    <li key={u.uid} className={styles.itemUsuario}>
                      <button
                        type="button"
                        className={`${styles.filaUsuario} ${styles.filaClicable} ${abierta ? styles.filaAbierta : ''}`}
                        onClick={() => setUidAbierto(abierta ? null : u.uid)}
                        aria-expanded={abierta}
                      >
                        <span className={styles.celdaUsuario}>
                          <span className={styles.avatarMini} aria-hidden="true">{inicialDe(u.nombre)}</span>
                          <span className={styles.itemInfo}>
                            <span className={styles.itemNombre}>{u.nombre}</span>
                            <span className={styles.itemDetalle}>
                              {[u.email, u.dni && `DNI ${u.dni}`].filter(Boolean).join(' · ') || 'Sin contacto'}
                            </span>
                          </span>
                        </span>
                        <span className={styles.celda}>
                          <span className={styles.celdaEtiqueta}>💝 Deseos</span>
                          {typeof deseos === 'number'
                            ? fmtInt(deseos)
                            : <span title="Abre la ficha para cargar su lista de deseos (1 lectura)">—</span>}
                        </span>
                        <span className={styles.celda}>
                          <span className={styles.celdaEtiqueta}>🛒 Carrito</span>
                          {u.cartCount > 0
                            ? `${fmtInt(u.cartCount)} (${fmtSoles(u.cartTotal)})`
                            : '—'}
                        </span>
                        <span className={styles.celda}>
                          <span className={styles.celdaEtiqueta}>👥 Personas</span>
                          {u.giftRecipientsCount > 0 ? fmtInt(u.giftRecipientsCount) : '—'}
                        </span>
                        <span className={styles.celda}>
                          <span className={styles.celdaEtiqueta}>📋 Encuesta</span>
                          <Badge tone={u.hasCompletedSurvey ? 'success' : 'neutral'} variant="soft" size="sm">
                            {u.hasCompletedSurvey ? '✓' : '✗'}
                          </Badge>
                        </span>
                        <span className={styles.chevron} aria-hidden="true">{abierta ? '▾' : '▸'}</span>
                      </button>

                      {/* Ficha expandible bajo la fila (solo carga al abrir). */}
                      {abierta && <FichaUsuario uid={u.uid} />}
                    </li>
                  );
                })}
              </ul>
              </>
            )}

            {/* Pie de paginación SIEMPRE visible (haya o no coincidencias): con
                búsqueda activa y 0 resultados, los avisos invitan a "Cargar más"
                para ampliar la búsqueda, así que el botón no puede desaparecer. */}
            <div className={styles.piePaginacion}>
              {usersQuery.hasNextPage ? (
                <GlassButton
                  variant="glass"
                  size="sm"
                  onClick={() => usersQuery.fetchNextPage()}
                  loading={usersQuery.isFetchingNextPage}
                >
                  ⬇ Cargar más usuarios
                </GlassButton>
              ) : (
                <Aviso>No hay más usuarios por cargar ({fmtInt(usuariosCargados.length)} en total).</Aviso>
              )}
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}
