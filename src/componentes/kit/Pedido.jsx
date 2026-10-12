import React, { useState } from 'react';
import { Check, Copy, CreditCard, Truck, Trash2, Gift, ChevronDown, Clock, Tag } from 'lucide-react';
import Boton from './Boton';
import { Etiqueta } from './Etiquetas';
import { Cantidad } from './Formulario';
import { soles } from './TarjetaProducto';
import s from './Pedido.module.css';

export const PASOS_PEDIDO = ['Recibido', 'Pago confirmado', 'En producción', 'En camino', 'Entregado'];

/**
 * Tarjeta de "Mis pedidos": resumen + línea de tiempo + acción principal.
 * Si falta pagar, el pago es la acción que manda (y el paso se marca en ámbar).
 */
export function SeguimientoPedido({ codigo, fecha, paso, total, items, pagoPendiente = false, entregaEstimada }) {
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const entregado = paso >= PASOS_PEDIDO.length - 1;

  const copiar = () => {
    navigator.clipboard?.writeText(codigo).catch(() => {});
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <article className={s.pedido}>
      <header className={s.cabeza}>
        <div className={s.miniaturas}>
          {items.slice(0, 3).map((it, i) => (
            <img key={i} src={it.imagen} alt="" />
          ))}
          {items.length > 3 && <span>+{items.length - 3}</span>}
        </div>
        <div className={s.datos}>
          <p className={s.codigo}>
            Pedido <strong>#{codigo}</strong>
            <button type="button" onClick={copiar} aria-label="Copiar número de pedido" className={s.copiar}>
              {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </button>
          </p>
          <p className={s.meta}>{fecha} · {items.length} {items.length === 1 ? 'producto' : 'productos'} · {soles(total)}</p>
        </div>
        {/* En tarjetas angostas se oculta: la línea de tiempo ya dice el estado. */}
        <span className={s.estado}>
          {pagoPendiente ? (
            <Etiqueta tono="aviso" icono={<Clock aria-hidden="true" />}>Falta pagar</Etiqueta>
          ) : entregado ? (
            <Etiqueta tono="exito" icono={<Check aria-hidden="true" />}>Entregado</Etiqueta>
          ) : (
            <Etiqueta tono="violeta">{PASOS_PEDIDO[paso]}</Etiqueta>
          )}
        </span>
      </header>

      <ol className={s.linea} aria-label="Estado del pedido">
        {PASOS_PEDIDO.map((nombre, i) => {
          const hecho = i < paso || (entregado && i === paso);
          const actual = i === paso && !entregado;
          const espera = pagoPendiente && i === 1;
          return (
            <li
              key={nombre}
              className={[s.paso, hecho && s.hecho, actual && s.actual, espera && s.espera].filter(Boolean).join(' ')}
              aria-current={actual ? 'step' : undefined}
            >
              <span className={s.punto}>{hecho ? <Check aria-hidden="true" /> : null}</span>
              <span className={s.nombrePaso}>{nombre}</span>
            </li>
          );
        })}
      </ol>

      {!entregado && !pagoPendiente && entregaEstimada && (
        <p className={s.estimado}>
          <Truck aria-hidden="true" /> Llega aprox. <strong>{entregaEstimada}</strong>
        </p>
      )}

      {pagoPendiente && (
        <div className={s.pagoAviso}>
          <p>Tu pedido se separa por 24 h. Paga para que pase a producción.</p>
          <Boton icono={<CreditCard aria-hidden="true" />}>Pagar {soles(total)}</Boton>
        </div>
      )}

      <button type="button" className={s.verDetalle} aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        {abierto ? 'Ocultar productos' : 'Ver productos'}
        <ChevronDown aria-hidden="true" />
      </button>

      {abierto && (
        <ul className={s.detalle}>
          {items.map((it, i) => (
            <li key={i}>
              <img src={it.imagen} alt="" />
              <span className={s.detalleNombre}>{it.nombre}<small>{it.variante} · x{it.cantidad}</small></span>
              <strong>{soles(it.precio * it.cantidad)}</strong>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** Fila de producto en el carrito. */
export function ItemCarrito({ imagen, nombre, variante, precio, precioAntes, cantidadInicial = 1, personalizado = false }) {
  const [cantidad, setCantidad] = useState(cantidadInicial);
  return (
    <div className={s.item}>
      <img src={imagen} alt="" className={s.itemImg} />
      <div className={s.itemInfo}>
        <p className={s.itemNombre}>{nombre}</p>
        <p className={s.itemVariante}>{variante}</p>
        {personalizado && <Etiqueta tono="violeta">Con tu diseño</Etiqueta>}
        <div className={s.itemAcciones}>
          <Cantidad valor={cantidad} onChange={setCantidad} tamano="sm" />
          <button type="button" className={s.quitar} aria-label={`Quitar ${nombre}`}>
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className={s.itemPrecio}>
        <strong>{soles(precio * cantidad)}</strong>
        {precioAntes && <s>{soles(precioAntes * cantidad)}</s>}
      </div>
    </div>
  );
}

/** Barra de progreso hacia el envío gratis. */
export function BarraEnvioGratis({ actual, meta }) {
  const falta = Math.max(0, meta - actual);
  const pct = Math.min(100, (actual / meta) * 100);
  return (
    <div className={[s.envio, falta === 0 && s.envioOk].filter(Boolean).join(' ')}>
      <p>
        <Truck aria-hidden="true" />
        {falta > 0 ? (
          <span>Te faltan <strong>{soles(falta)}</strong> para el envío gratis</span>
        ) : (
          <span><strong>¡Tienes envío gratis!</strong></span>
        )}
      </p>
      <div className={s.pista} role="progressbar" aria-valuemin={0} aria-valuemax={meta} aria-valuenow={Math.min(actual, meta)}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Resumen del pedido con cupón y total. */
export function ResumenPedido({ subtotal, descuento = 0, envio = 0, monedas = 0 }) {
  const [cupon, setCupon] = useState('');
  const [aplicado, setAplicado] = useState(false);
  const total = subtotal - descuento + envio;
  return (
    <section className={s.resumen} aria-label="Resumen del pedido">
      <h3>Resumen</h3>
      <dl>
        <div><dt>Subtotal</dt><dd>{soles(subtotal)}</dd></div>
        {descuento > 0 && <div className={s.ahorro}><dt>Descuentos</dt><dd>−{soles(descuento)}</dd></div>}
        <div><dt>Envío</dt><dd>{envio === 0 ? <span className={s.gratis}>Gratis</span> : soles(envio)}</dd></div>
      </dl>

      <form
        className={s.cupon}
        onSubmit={(e) => { e.preventDefault(); if (cupon.trim()) setAplicado(true); }}
      >
        <Tag aria-hidden="true" />
        <input
          value={aplicado ? cupon.toUpperCase() : cupon}
          onChange={(e) => { setCupon(e.target.value); setAplicado(false); }}
          placeholder="Código de cupón"
          aria-label="Código de cupón"
        />
        <button type="submit" disabled={!cupon.trim() || aplicado}>{aplicado ? 'Aplicado' : 'Aplicar'}</button>
      </form>

      <div className={s.total}>
        <span>Total</span>
        <strong>{soles(total)}</strong>
      </div>
      {monedas > 0 && (
        <p className={s.ganas}><Gift aria-hidden="true" /> Con esta compra ganas <strong>{monedas} monedas</strong></p>
      )}
      <Boton tamano="lg" bloque>Ir a pagar</Boton>
      <p className={s.seguro}>Pago seguro con tarjeta, Yape o PayPal</p>
    </section>
  );
}
