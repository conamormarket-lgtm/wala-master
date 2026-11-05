import React from 'react';
import { CalendarDays, Copy, Database, Gift, MapPin, MessageCircle, Sparkles, User } from 'lucide-react';
import Boton from '../../Boton';
import { Etiqueta } from '../../Etiquetas';
import { Hueso } from '../../Esqueletos';
import { useToast } from '../../Feedback';
import { InsigniaEstado } from './Datos';
import { ESTADOS_RECEPCION, direccionParaCopiar } from '../../adaptadoresAdmin';
import { urlWhatsApp } from '../../../../utils/whatsappLink';
import s from './Pedidos.module.css';

/*
 * Un pedido visto para el envío (Recepción de pedidos, D3a): lo primero es
 * a dónde va. Los datos llegan como los deja normalizarPedidoRecepcion.
 */

const soles = (n) => `S/ ${(Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Una fecha sola ("2026-11-14") es de ese día aquí, no a medianoche UTC (antes salía un día antes).
function fechaDeEntrega(valor) {
  if (!valor) return '';
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor));
  const ms = dia ? new Date(+dia[1], dia[2] - 1, +dia[3]).getTime() : Date.parse(valor);
  if (Number.isNaN(ms)) return String(valor);
  return new Date(ms).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'long' });
}

/**
 * La tarjeta de un pedido.
 *  - pedido: { id, codigo, fechaCompraLabel, clienteNombre, clienteContacto, clienteDocumento,
 *    entrega: { direccion, distrito, departamento }, productos: [{ cantidad, nombre, color, talla, personalizado }],
 *    cantidadTotal, montoTotal, costoEnvio, estado: { key, label }, esRegalo, regalo, deliveryDate, _procesadoErp }
 *  - detalle: a dónde lleva "Ver detalle" (to)
 */
export function TarjetaEnvio({ pedido: p, detalle }) {
  const toast = useToast();
  const wa = urlWhatsApp(p.clienteContacto, `Hola ${p.clienteNombre || ''}, te escribimos de WALA sobre tu pedido ${p.codigo || ''}.`);
  const entrega = fechaDeEntrega(p.deliveryDate);
  const zona = [p.entrega?.distrito, p.entrega?.departamento].filter(Boolean).join(' · ');
  const copiar = () => {
    navigator.clipboard?.writeText(direccionParaCopiar(p)).catch(() => {});
    toast({ tipo: 'exito', titulo: 'Dirección copiada', texto: p.codigo });
  };

  return (
    <article className={s.tarjeta} data-componente="TarjetaEnvio">
      <header className={s.cabeza}>
        <div className={s.codigo}>
          <strong>{p.codigo || 'Sin código'}</strong>
          {p.fechaCompraLabel && <span>{p.fechaCompraLabel}</span>}
        </div>
        <div className={s.insignias}>
          {p._procesadoErp && <span title="Ya lo procesó el ERP; se ve desde la copia de respaldo de Walá."><Etiqueta tono="neutro" icono={<Database aria-hidden="true" />}>Procesado en ERP</Etiqueta></span>}
          <InsigniaEstado estado={p.estado?.key} estados={ESTADOS_RECEPCION}>{p.estado?.label}</InsigniaEstado>
        </div>
      </header>

      <section className={s.entrega} aria-label="Entrega">
        <div className={s.entregaTitulo}>
          <MapPin aria-hidden="true" />
          <span>Dirección de entrega</span>
          {p.esRegalo && <Etiqueta tono="violeta" icono={<Gift aria-hidden="true" />}>Regalo</Etiqueta>}
          <Boton soloIcono tamano="sm" variante="fantasma" icono={<Copy aria-hidden="true" />} aria-label="Copiar la dirección" onClick={copiar} disabled={!p.entrega?.direccion} />
        </div>
        <p className={s.direccion}>{p.entrega?.direccion || 'Sin dirección registrada'}</p>
        {zona && <p className={s.zona}>{zona}</p>}
        {p.esRegalo && p.regalo?.destinatario && <p className={s.extra}><b>Para:</b> {p.regalo.destinatario}</p>}
        {entrega && <p className={s.extra}><CalendarDays aria-hidden="true" /> <b>Entregar:</b> {entrega}</p>}
        {p.esRegalo && p.regalo?.mensaje && <p className={s.mensaje}>“{p.regalo.mensaje}”</p>}
      </section>

      <div className={s.cliente}>
        <User aria-hidden="true" />
        <div>
          <strong>{p.clienteNombre || 'Sin nombre'}</strong>
          <span>{p.clienteContacto || 'Sin teléfono'}{p.clienteDocumento ? ` · Doc. ${p.clienteDocumento}` : ''}</span>
        </div>
      </div>

      <ul className={s.productos}>
        {(p.productos || []).map((x, i) => (
          <li key={i}>
            <span className={s.cantidad}>{x.cantidad}×</span>
            <span className={s.producto}>{x.nombre}{x.personalizado && <Sparkles className={s.perso} aria-label="Personalizado" />}</span>
            {(x.color || x.talla) && <span className={s.variante}>{[x.color, x.talla].filter(Boolean).join(' / ')}</span>}
          </li>
        ))}
        {!p.productos?.length && <li className={s.sinProductos}>Sin detalle de productos.</li>}
      </ul>

      <div className={s.montos}>
        <span><small>Total</small><strong>{soles(p.montoTotal)}</strong></span>
        <span><small>Envío</small>{soles(p.costoEnvio)}</span>
        {/* Pagó una parte: cuánto ya entró y cuánto falta cobrar. */}
        {p.montoPendiente > 0 && (
          <>
            <span><small>Pagado</small>{soles(p.montoPagado || Math.max(0, (p.montoTotal || 0) - p.montoPendiente))}</span>
            <span className={s.falta}><small>Falta</small><strong>{soles(p.montoPendiente)}</strong></span>
          </>
        )}
        <span className={s.unidades}>{p.cantidadTotal || 0} und.</span>
      </div>

      <footer className={s.acciones}>
        <Boton tamano="sm" variante="primario" icono={<MessageCircle aria-hidden="true" />} to={wa || undefined} disabled={!wa}>
          WhatsApp
        </Boton>
        {detalle && <Boton tamano="sm" variante="secundario" to={detalle}>Ver detalle</Boton>}
      </footer>
    </article>
  );
}

/** La tarjeta mientras carga. */
export function EsqueletoEnvio() {
  return (
    <div className={s.tarjeta} aria-hidden="true">
      <Hueso ancho="40%" alto={14} />
      <Hueso forma="bloque" alto={86} />
      <Hueso ancho="70%" alto={12} />
      <Hueso ancho="55%" alto={12} />
      <Hueso ancho="35%" alto={32} />
    </div>
  );
}
