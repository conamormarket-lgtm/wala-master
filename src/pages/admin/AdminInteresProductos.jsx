import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getProductInterestLeads } from '../../services/adminProductInterest';
import { useProducts } from '../../hooks/useProducts';
import { PLACEHOLDER_IMG } from '../../constants/placeholder';
import { urlWhatsApp, telefonoDePerfil, aceptoWhatsApp } from '../../utils/whatsappLink';
import { GlassCard, GlassButton, Badge } from '../../components/ui';
import styles from './AdminInteresProductos.module.css';

/* ============================================================================
 * AdminInteresProductos — "🔥 Interés por producto"
 * ----------------------------------------------------------------------------
 * Quién pasó tiempo mirando qué producto (route_dwell en /producto/:id), para
 * escribirle por WhatsApp con ese producto o uno parecido. El botón abre
 * WhatsApp con el número del cliente y el mensaje listo; lo envía una persona.
 *
 * Solo se muestra el botón verde a quien aceptó recibir ofertas por WhatsApp
 * en "Mi perfil" (marketingConsent.whatsapp). A los demás se les puede
 * escribir igual, pero la fila lo avisa: la ley de datos personales pide
 * consentimiento para mensajes comerciales.
 * ========================================================================== */

const PERIODOS = [
  { dias: 3, label: '3 días' },
  { dias: 7, label: '7 días' },
  { dias: 14, label: '14 días' },
  { dias: 30, label: '30 días' },
];
const MINIMOS = [
  { ms: 30000, label: '30 s' },
  { ms: 60000, label: '1 min' },
  { ms: 180000, label: '3 min' },
];

const fmtDuracion = (ms) => {
  const s = Math.round((Number(ms) || 0) / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60 ? `${s % 60} s` : ''}`.trim();
  return `${Math.floor(m / 60)} h ${m % 60} min`;
};
const fmtFecha = (ms) => (ms ? new Date(ms).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

const mensajeWhatsApp = (nombre, producto) => {
  const primerNombre = String(nombre || '').trim().split(' ')[0];
  const url = `${window.location.origin}/producto/${producto.id}`;
  const precio = producto.salePrice || producto.price;
  return [
    `Hola${primerNombre ? ` ${primerNombre}` : ''} 👋`,
    `Vimos que te gustó *${producto.name}*${precio ? ` (S/ ${precio})` : ''}. ¡Todavía está disponible!`,
    url,
    '¿Te ayudamos con tu pedido?',
  ].join('\n');
};

const AdminInteresProductos = () => {
  const [dias, setDias] = useState(7);
  const [minMs, setMinMs] = useState(60000);
  const [soloConPermiso, setSoloConPermiso] = useState(false);

  const consulta = useQuery({
    queryKey: ['admin-interes-productos', dias, minMs],
    queryFn: async () => {
      const { data, error } = await getProductInterestLeads({ days: dias, minMs });
      if (error) throw new Error(error);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Catálogo con ocultos/borrados: un producto dado de baja igual tiene que
  // mostrar su nombre en el historial de interés.
  const { data: catalogo } = useProducts([], { includeHidden: true });
  const porId = useMemo(() => new Map((catalogo || []).map((p) => [String(p.id), p])), [catalogo]);

  const leads = useMemo(() => {
    const todos = consulta.data?.leads || [];
    return soloConPermiso ? todos.filter((l) => aceptoWhatsApp(l.perfil)) : todos;
  }, [consulta.data, soloConPermiso]);

  const ranking = consulta.data?.ranking || [];

  return (
    <div className={styles.pagina}>
      <header className={styles.encabezado}>
        <div>
          <h1 className={styles.titulo}>🔥 Interés por producto</h1>
          <p className={styles.subtitulo}>
            Clientes con cuenta que pasaron tiempo mirando un producto. Escríbeles por WhatsApp
            mientras todavía lo tienen en mente.
          </p>
        </div>
        <GlassButton variant="glass" size="sm" onClick={() => consulta.refetch()} disabled={consulta.isFetching}>
          {consulta.isFetching ? '⟳ Actualizando…' : '⟳ Actualizar'}
        </GlassButton>
      </header>

      <div className={styles.filtros}>
        <div className={styles.grupoFiltro} role="group" aria-label="Período">
          <span className={styles.filtroLabel}>Período</span>
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              type="button"
              className={`${styles.chip} ${dias === p.dias ? styles.chipActivo : ''}`}
              onClick={() => setDias(p.dias)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className={styles.grupoFiltro} role="group" aria-label="Tiempo mínimo">
          <span className={styles.filtroLabel}>Mínimo en el producto</span>
          {MINIMOS.map((m) => (
            <button
              key={m.ms}
              type="button"
              className={`${styles.chip} ${minMs === m.ms ? styles.chipActivo : ''}`}
              onClick={() => setMinMs(m.ms)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <label className={styles.check}>
          <input type="checkbox" checked={soloConPermiso} onChange={(e) => setSoloConPermiso(e.target.checked)} />
          Solo quienes aceptaron WhatsApp
        </label>
      </div>

      {consulta.isError && <p className={styles.error}>No se pudo cargar: {consulta.error.message}</p>}
      {consulta.isLoading && <p className={styles.meta}>Cargando…</p>}
      {consulta.data?.truncated && (
        <p className={styles.meta}>
          Se analizaron los {consulta.data.eventsRead} registros más recientes del período; elige un período más corto para verlo completo.
        </p>
      )}

      {consulta.data && (
        <div className={styles.layout}>
          <GlassCard title="Productos que más miran" subtitle={`Tiempo total en la ficha, últimos ${dias} días`} className={styles.cardRanking}>
            {ranking.length === 0 ? (
              <p className={styles.meta}>Sin visitas a productos en este período.</p>
            ) : (
              <ol className={styles.ranking}>
                {ranking.map((r) => {
                  const p = porId.get(String(r.productId));
                  return (
                    <li key={r.productId} className={styles.rankingItem}>
                      <img src={p?.images?.[0] || PLACEHOLDER_IMG} alt="" className={styles.miniatura} loading="lazy" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
                      <div className={styles.rankingTexto}>
                        <Link to={`/producto/${r.productId}`} target="_blank" className={styles.nombreProducto}>
                          {p?.name || r.productId}
                        </Link>
                        <span className={styles.meta}>
                          {fmtDuracion(r.dwellMs)} · {r.users} con cuenta{r.anon ? ` · ${r.anon} visitas anónimas` : ''}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </GlassCard>

          <GlassCard
            title="Clientes interesados"
            subtitle="Cada fila es un cliente y un producto donde pasó al menos el tiempo mínimo"
            className={styles.cardLeads}
          >
            {leads.length === 0 ? (
              <p className={styles.meta}>
                {soloConPermiso
                  ? 'Nadie de este período aceptó todavía recibir ofertas por WhatsApp.'
                  : 'Nadie superó el tiempo mínimo en este período.'}
              </p>
            ) : (
              <ul className={styles.leads}>
                {leads.map((l) => {
                  const p = porId.get(String(l.productId));
                  const nombre = l.perfil?.displayName || l.displayName || 'Cliente';
                  const telefono = telefonoDePerfil(l.perfil);
                  const permiso = aceptoWhatsApp(l.perfil);
                  const url = p && telefono ? urlWhatsApp(telefono, mensajeWhatsApp(nombre, p)) : null;
                  return (
                    <li key={`${l.uid}|${l.productId}`} className={styles.lead}>
                      <img src={p?.images?.[0] || PLACEHOLDER_IMG} alt="" className={styles.miniatura} loading="lazy" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
                      <div className={styles.leadTexto}>
                        <strong>{nombre}</strong>
                        <span className={styles.meta}>
                          {p?.name || l.productId} · {fmtDuracion(l.dwellMs)} en {l.visits} {l.visits === 1 ? 'visita' : 'visitas'} · {fmtFecha(l.lastSeenMs)}
                        </span>
                        <div className={styles.badges}>
                          {permiso
                            ? <Badge tone="success" variant="soft" size="sm">✅ Acepta WhatsApp</Badge>
                            : <Badge tone="warning" variant="soft" size="sm">Sin permiso de WhatsApp</Badge>}
                          {p?.deleted && <Badge tone="neutral" variant="outline" size="sm">Producto retirado</Badge>}
                        </div>
                      </div>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${styles.btnWhatsapp} ${permiso ? '' : styles.btnWhatsappSinPermiso}`}
                          title={permiso ? 'Abrir WhatsApp con el mensaje listo' : 'Este cliente no aceptó ofertas por WhatsApp'}
                        >
                          WhatsApp
                        </a>
                      ) : (
                        <span className={styles.meta}>{telefono ? '—' : 'Sin teléfono'}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default AdminInteresProductos;
