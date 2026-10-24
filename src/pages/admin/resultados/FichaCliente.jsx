import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserFicha } from '../../../services/adminUserInsights';
import { getUserAnalytics } from '../../../services/adminAnalytics';
import { recomendarSimilares } from '../../../services/analytics/productInterest.mjs';
import { useProducts } from '../../../hooks/useProducts';
import { urlWhatsApp, telefonoDePerfil, aceptoWhatsApp } from '../../../utils/whatsappLink';
import { PLACEHOLDER_IMG } from '../../../constants/placeholder';
import { fmtInt, fmtDuration } from '../dashboard/dashShared';
import { Cifras, Vacio } from './piezas';
import styles from './FichaCliente.module.css';

/*
 * Ficha de un cliente (Resultados › Clientes): lo que antes estaba repartido
 * en "Ver qué hacen los usuarios", "Usuarios y métricas" y "Usuarios de la
 * App". Perfil, carrito y deseos salen de getUserFicha (2 lecturas); la
 * actividad, de getUserAnalytics, solo al abrir esa pestaña.
 */

const soles = (v) => `S/ ${(Number(v) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
};

const PESTANAS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'mira', label: 'Lo que mira' },
  { id: 'deseos', label: 'Lista de deseos' },
  { id: 'carrito', label: 'Carrito' },
  { id: 'fechas', label: 'Fechas y personas' },
];

function Producto({ imagen, nombre, detalle, extra }) {
  return (
    <li className={styles.producto}>
      <img src={imagen || PLACEHOLDER_IMG} alt="" loading="lazy" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
      <span className={styles.productoTexto}>
        <span className={styles.productoNombre} title={nombre}>{nombre}</span>
        {detalle && <span className={styles.productoDetalle}>{detalle}</span>}
      </span>
      {extra}
    </li>
  );
}

export default function FichaCliente({ uid, email }) {
  const [pestana, setPestana] = useState('resumen');

  const fichaQ = useQuery({
    queryKey: ['adminUserInsights', 'ficha', uid],
    queryFn: async () => {
      const { data, error } = await getUserFicha(uid);
      if (error && !data) throw new Error(error);
      return data;
    },
    enabled: Boolean(uid),
    staleTime: 5 * 60 * 1000,
  });
  const actividadQ = useQuery({
    queryKey: ['admin-analytics-user-detail', uid, email || null],
    queryFn: async () => {
      const { data, error } = await getUserAnalytics(uid, email || null);
      if (error) throw new Error(error);
      return data;
    },
    enabled: Boolean(uid) && (pestana === 'resumen' || pestana === 'mira'),
    staleTime: 5 * 60 * 1000,
  });
  const { data: catalogo } = useProducts([], { includeHidden: true });
  const porId = useMemo(() => new Map((catalogo || []).map((p) => [String(p.id), p])), [catalogo]);
  const recomendados = useMemo(
    () => recomendarSimilares(actividadQ.data?.productInterest || [], catalogo || [], 6),
    [actividadQ.data, catalogo]
  );

  if (fichaQ.isLoading) return <div className={styles.ficha}><Vacio>Cargando ficha…</Vacio></div>;
  if (fichaQ.isError || !fichaQ.data) {
    return <div className={styles.ficha}><Vacio>No se pudo cargar la ficha: {fichaQ.error?.message || 'no se encontró el perfil'}.</Vacio></div>;
  }

  const f = fichaQ.data;
  const telefono = telefonoDePerfil({ phone: f.phone, phoneIntl: f.phoneIntl });
  const permiso = aceptoWhatsApp(f);
  const primerNombre = String(f.nombre || '').split(' ')[0];
  const urlEscribir = telefono && permiso ? urlWhatsApp(telefono, `¡Hola${primerNombre ? ` ${primerNombre}` : ''}! Te escribimos de Walá.`) : null;
  const act = actividadQ.data;
  const m = act?.metrics || {};
  const sesionesApp = (act?.sessions || []).filter((s) => s.clientType === 'APP').length;
  const historico = act?.estimatedSummary?.isEstimated ? act.estimatedSummary : null;

  return (
    <div className={styles.ficha}>
      <div className={styles.cabecera}>
        <div className={styles.identidad}>
          <strong>{f.nombre}</strong>
          <span>
            {[f.email, f.dni && `${f.tipoDocumento || 'Doc.'} ${f.dni}`, telefono, f.country].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </span>
          <span className={styles.chips}>
            <span className={styles.chip}>{fmtInt(f.monedas)} monedas</span>
            <span className={styles.chip}>{f.hasCompletedSurvey ? 'Completó la encuesta' : 'Sin encuesta'}</span>
            <span className={styles.chip}>{permiso ? 'Acepta WhatsApp' : 'No aceptó WhatsApp'}</span>
          </span>
        </div>
        {urlEscribir && (
          <a href={urlEscribir} target="_blank" rel="noopener noreferrer" className={styles.whatsapp}>Escribir por WhatsApp</a>
        )}
      </div>

      <div className={styles.pestanas} role="tablist" aria-label="Secciones de la ficha">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            className={pestana === p.id ? styles.pestanaActiva : styles.pestana}
            onClick={() => setPestana(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {pestana === 'resumen' && (
        <div className={styles.panel}>
          {actividadQ.isLoading ? (
            <Vacio>Cargando actividad…</Vacio>
          ) : actividadQ.isError ? (
            <Vacio>No se pudo cargar la actividad: {actividadQ.error?.message}</Vacio>
          ) : (
            <Cifras items={[
              { label: 'Visitas', valor: fmtInt(m.totalSessions || 0) },
              { label: 'Páginas vistas', valor: fmtInt(m.totalPageViews || 0) },
              { label: 'Tiempo en la tienda', valor: fmtDuration(m.totalDwellMs || 0) },
              { label: 'Días que entró', valor: fmtInt(m.activeDays || 0) },
              { label: 'Última vez', valor: fecha(m.lastAccessAtMs) || '—' },
              { label: 'Usa la app', valor: sesionesApp ? 'Sí' : 'No', sub: sesionesApp ? `${fmtInt(sesionesApp)} ${sesionesApp === 1 ? "visita" : "visitas"} desde la app` : undefined },
            ]}
            />
          )}
          <p className={styles.nota}>
            {[
              fecha(f.createdAtMs) && `Cuenta creada el ${fecha(f.createdAtMs)}`,
              `${fmtInt(f.wishlist.count)} en su lista de deseos`,
              `${fmtInt(f.cart.count)} en su carrito`,
              `${fmtInt(f.giftRecipients.length)} personas agendadas`,
            ].filter(Boolean).join(' · ')}
          </p>
          {historico && (
            <p className={styles.nota}>
              Compras de antes de medir (estimado con los pedidos del ERP): {fmtInt(historico.orderCount)} pedidos por{' '}
              {soles(historico.totalSpent)}, del {fecha(historico.firstOrderAtMs) || '—'} al {fecha(historico.lastOrderAtMs) || '—'}.
            </p>
          )}
        </div>
      )}

      {pestana === 'mira' && (
        <div className={styles.panel}>
          {actividadQ.isLoading ? <Vacio>Cargando…</Vacio> : (
            <div className={styles.dosColumnas}>
              <div>
                <h3 className={styles.subtitulo}>Productos donde más tiempo pasa</h3>
                {(act?.productInterest || []).length === 0 ? <Vacio>Todavía no miró productos.</Vacio> : (
                  <ul className={styles.productos}>
                    {act.productInterest.slice(0, 8).map((r) => {
                      const p = porId.get(String(r.productId));
                      return (
                        <Producto
                          key={r.productId}
                          imagen={p?.mainImage || p?.images?.[0]}
                          nombre={p?.name || r.name || 'Producto'}
                          detalle={`${fmtDuration(r.dwellMs)} · ${fmtInt(r.views)} ${r.views === 1 ? 'vista' : 'vistas'}`}
                        />
                      );
                    })}
                  </ul>
                )}
              </div>
              <div>
                <h3 className={styles.subtitulo}>Para recomendarle</h3>
                <p className={styles.nota}>De las mismas líneas que más mira y que todavía no vio.</p>
                {recomendados.length === 0 ? <Vacio>Sin datos suficientes para recomendar.</Vacio> : (
                  <ul className={styles.productos}>
                    {recomendados.map((p) => (
                      <Producto key={p.id} imagen={p.mainImage || p.images?.[0]} nombre={p.name} detalle={`S/ ${p.salePrice || p.price}`} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {pestana === 'deseos' && (
        <div className={styles.panel}>
          {f.wishlist.count === 0 ? <Vacio>Todavía no tiene lista de deseos.</Vacio> : (
            <ul className={styles.productos}>
              {f.wishlist.items.map((it, i) => (
                <Producto
                  key={`${it.productId || 'p'}-${i}`}
                  imagen={it.productImage}
                  nombre={it.productName}
                  detalle={[it.price > 0 ? soles(it.price) : null, fecha(it.addedAt) && `agregado el ${fecha(it.addedAt)}`].filter(Boolean).join(' · ')}
                  extra={it.isGifted ? <span className={styles.chip}>Ya se lo regalaron{it.giftedBy ? ` (${it.giftedBy})` : ''}</span> : null}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {pestana === 'carrito' && (
        <div className={styles.panel}>
          {f.cart.items.length === 0 ? <Vacio>Su carrito está vacío en este momento.</Vacio> : (
            <>
              <p className={styles.nota}>
                {fmtInt(f.cart.unidades)} unidades por unos {soles(f.cart.totalEstimado)}. Es lo que tiene ahora: cambia cada vez que navega o compra.
              </p>
              <ul className={styles.productos}>
                {f.cart.items.map((it, i) => (
                  <Producto
                    key={`${it.productId || 'p'}-${i}`}
                    imagen={it.productImage}
                    nombre={it.productName}
                    detalle={`${fmtInt(it.quantity)} × ${soles(it.price)} = ${soles(it.subtotal)}`}
                    extra={!it.selected ? <span className={styles.chip}>Lo dejó para después</span> : null}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {pestana === 'fechas' && (
        <div className={styles.panel}>
          <p className={styles.nota}>{f.birthdayLegible ? `Su cumpleaños: ${f.birthdayLegible}` : 'No registró su cumpleaños.'}</p>
          {f.giftRecipients.length === 0 ? <Vacio>Todavía no agendó personas ni fechas.</Vacio> : (
            <ul className={styles.personas}>
              {f.giftRecipients.map((p, i) => (
                <li key={p.id || `persona-${i}`}>
                  <strong>{p.name}</strong> <span className={styles.chip}>{p.roleDisplay}</span>
                  <span className={styles.productoDetalle}>
                    {p.events.length ? p.events.map((ev) => `${ev.label}: ${ev.dateLegible || ev.date || 'sin fecha'}`).join(' · ') : 'Sin fechas'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
