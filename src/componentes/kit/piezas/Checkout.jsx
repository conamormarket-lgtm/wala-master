import React, { useState } from 'react';
import { ChevronDown, Tag, Check, X, Package } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Texto, useTexto } from '../Traduccion';
import { Moneda } from '../Etiquetas';
import { Interruptor } from '../Formulario';
import { Sello } from '../Marca';
import { soles } from '../TarjetaProducto';
import { FotoProducto } from './FotoProducto';
import s from './Checkout.module.css';

/*
 * Las partes del checkout (/checkout): los pasos, el resumen de la compra
 * (con las monedas y el cupón) y cada forma de pagar.
 */

/**
 * Los pasos de la compra: sellos con su número unidos por una costura. El
 * hecho lleva un visto; el actual, el degradado.
 *  - pasos: ['Envío', 'Pago'] · actual (índice)
 */
export function PasosCompra({ pasos = ['Envío', 'Pago'], actual = 0 }) {
  const etiqueta = useTexto('Pasos de la compra');
  return (
    <ol className={s.pasos} aria-label={etiqueta} data-componente="PasosCompra">
      {pasos.map((p, i) => {
        const hecho = i < actual;
        return (
          <li key={p} className={[s.paso, hecho && s.pasoHecho, i === actual && s.pasoActual].filter(Boolean).join(' ')} aria-current={i === actual ? 'step' : undefined}>
            <Sello tamano={28} girar={i % 2 ? 6 : -8} tono={i <= actual ? 'degradado' : 'suave'}>
              {hecho ? <Check aria-hidden="true" /> : <b className={s.pasoNumero}>{i + 1}</b>}
            </Sello>
            <span><Texto>{p}</Texto></span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Pagar parte con monedas: hasta la mitad del precio de los productos, a
 * S/ 1 la moneda. Dice por qué no se puede si no se puede.
 *  - saldo · maximo (la mitad del subtotal) · usar · onUsar(bool) · cargando
 *  - sesion · urlLogin · bloqueado (mientras se procesa)
 */
export function FilaMonedas({ saldo = 0, maximo = 0, usar = false, onUsar, cargando = false, sesion = true, urlLogin = '/login', bloqueado = false }) {
  const usables = Math.min(saldo, maximo);
  let cuerpo;
  if (cargando) cuerpo = <span className={s.monedasTexto}><span className={s.cargandoLinea} /><span className={s.oculto}><Texto>Cargando tus monedas…</Texto></span></span>;
  else if (!sesion) cuerpo = <span className={s.monedasTexto}><strong><Texto>Monedas Walá</Texto></strong><small><Enlace to={urlLogin}><Texto>Inicia sesión</Texto></Enlace> <Texto>y paga parte de tu compra con tus monedas.</Texto></small></span>;
  else if (!saldo) cuerpo = <span className={s.monedasTexto}><strong><Texto>Monedas Walá</Texto></strong><small><Texto>Aún no tienes monedas. Gánalas en los minijuegos y retos.</Texto></small></span>;
  else if (usables < 1) cuerpo = <span className={s.monedasTexto}><strong><Texto>{`Tienes ${saldo} monedas`}</Texto></strong><small><Texto>Puedes pagar con monedas hasta la mitad del precio de tus productos; en esta compra no alcanza.</Texto></small></span>;
  else {
    cuerpo = (
      <span className={s.monedasInterruptor}>
        <Interruptor
          activo={usar}
          onChange={(v) => !bloqueado && onUsar?.(v)}
          etiqueta={<><Texto>{`Usar ${usables} monedas`}</Texto> <b className={s.menos}>−{soles(usables)}</b></>}
          descripcion={<Texto>{usables < saldo ? `Tienes ${saldo}; en esta compra puedes usar hasta la mitad del precio.` : `Tienes ${saldo} monedas. 1 moneda = S/ 1.00`}</Texto>}
        />
      </span>
    );
  }
  return (
    <div className={[s.monedas, bloqueado && s.bloqueado].filter(Boolean).join(' ')} data-componente="FilaMonedas" aria-disabled={bloqueado || undefined}>
      <Moneda tamano={30} className={s.moneda} />
      {cuerpo}
    </div>
  );
}

/**
 * El cupón: el código y "Aplicar" (o Enter); aplicado, su texto y "Quitar".
 *  - aplicado: { codigo, texto, aviso? } (aviso: lo que dice el servidor del
 *    cupón, debajo) · onAplicar(codigo): promesa (si no vale, lanza un Error
 *    con el mensaje) · onQuitar (sin él, el aplicado no se quita)
 */
export function CampoCupon({ aplicado, onAplicar, onQuitar }) {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [validando, setValidando] = useState(false);
  const textos = { placeholder: useTexto('¿Tienes un cupón?'), etiqueta: useTexto('Código de cupón') };
  if (aplicado) {
    return (
      <>
        <div className={s.cuponAplicado} data-componente="CampoCupon">
          <Tag aria-hidden="true" />
          <span><strong>{aplicado.codigo}</strong>{aplicado.texto && <> · <Texto>{aplicado.texto}</Texto></>}</span>
          {onQuitar && <button type="button" onClick={onQuitar}><X aria-hidden="true" /> <Texto>Quitar</Texto></button>}
        </div>
        {aplicado.aviso && <p className={s.cuponMensaje} role="status"><Texto>{aplicado.aviso}</Texto></p>}
      </>
    );
  }
  const aplicar = async (e) => {
    e.preventDefault();
    const c = codigo.trim().toUpperCase();
    if (!c) return;
    setValidando(true);
    setError('');
    try {
      await onAplicar?.(c);
      setCodigo('');
    } catch (err) {
      setError(err?.message || 'Este cupón no es válido.');
    } finally {
      setValidando(false);
    }
  };
  return (
    <form className={[s.cupon, error && s.cuponError].filter(Boolean).join(' ')} onSubmit={aplicar} data-componente="CampoCupon">
      <div className={s.cuponCaja}>
        <Tag aria-hidden="true" />
        <input value={codigo} onChange={(e) => { setCodigo(e.target.value); setError(''); }} placeholder={textos.placeholder} aria-label={textos.etiqueta} autoCapitalize="characters" />
        <Boton type="submit" tamano="sm" variante="contorno" cargando={validando} disabled={!codigo.trim()}><Texto>Aplicar</Texto></Boton>
      </div>
      {error && <p className={s.cuponMensaje} role="alert"><Texto>{error}</Texto></p>}
    </form>
  );
}

/**
 * El resumen de la compra: los productos, el subtotal, las monedas, el cupón,
 * el envío (con cuánto falta para que sea gratis) y el total. En el celular
 * va arriba, plegado en una línea con el total (onAlternar).
 *  - items: [{ id, imagen, nombre, variante, precio, cantidad }]
 *  - subtotal · descuentoMonedas · cupon: { codigo, descuento, envioGratis } ·
 *    envio · gratisDesde · total
 *  - monedas: props de FilaMonedas · cupones: props de CampoCupon
 *  - abierto · onAlternar (solo celular) · pie: lo que va al final (invitación,
 *    equivalencia en otra moneda)
 */
export function ResumenCompra({
  items = [], subtotal = 0, descuentoMonedas = 0, cupon, envio = 0, gratisDesde, total = 0,
  monedas, cupones, abierto = false, onAlternar, pie,
}) {
  const unidades = items.reduce((n, it) => n + it.cantidad, 0);
  // El envío es gratis en compras de MÁS de gratisDesde (con S/ 200 justos se cobra).
  const avisoEnvio = gratisDesde && envio > 0 && !cupon?.envioGratis;
  const falta = Math.max(0, (gratisDesde || 0) - subtotal);
  const etiqueta = useTexto('Resumen del pedido');
  return (
    <section className={[s.resumen, abierto && s.resumenAbierto].filter(Boolean).join(' ')} aria-label={etiqueta} data-componente="ResumenCompra">
      <button type="button" className={s.resumenCabeza} onClick={onAlternar} aria-expanded={abierto}>
        <span><Texto>Tu pedido</Texto> <em>({unidades})</em></span>
        <strong>{soles(total)}</strong>
        <ChevronDown aria-hidden="true" />
      </button>
      <h2 className={s.resumenTitulo}>{etiqueta}</h2>
      <div className={s.resumenCuerpo}>
        <ul className={s.items}>
          {items.map((it) => (
            <li key={it.id}>
              <span className={s.itemFoto}>
                <FotoProducto src={it.imagen} relleno="6%" respaldo={<Package aria-hidden="true" />} />
                <b>{it.cantidad}</b>
              </span>
              <span className={s.itemTexto}>
                <strong><Texto>{it.nombre}</Texto></strong>
                {it.variante && <small><Texto>{it.variante}</Texto></small>}
              </span>
              <span className={s.itemPrecio}>{soles(it.precio * it.cantidad)}</span>
            </li>
          ))}
        </ul>
        {monedas && <FilaMonedas {...monedas} />}
        {cupones && <CampoCupon {...cupones} />}
        <dl className={s.cuentas}>
          <div><dt><Texto>Subtotal</Texto></dt><dd>{soles(subtotal)}</dd></div>
          {descuentoMonedas > 0 && <div className={s.ahorro}><dt><Texto>Monedas Walá</Texto></dt><dd>−{soles(descuentoMonedas)}</dd></div>}
          {cupon?.descuento > 0 && !cupon?.envioGratis && <div className={s.ahorro}><dt><Texto>Cupón</Texto> {cupon.codigo}</dt><dd>−{soles(cupon.descuento)}</dd></div>}
          <div><dt><Texto>Envío</Texto></dt><dd>{envio === 0 ? <span className={s.gratis}><Texto>Gratis</Texto></span> : soles(envio)}</dd></div>
        </dl>
        {avisoEnvio && (
          <p className={s.falta}>
            <Texto>{falta > 0 ? `Te faltan ${soles(falta)} para el envío gratis (compras de más de ${soles(gratisDesde)}).` : `El envío es gratis en compras de más de ${soles(gratisDesde)}.`}</Texto>
          </p>
        )}
        <div className={s.total}>
          <span><Texto>Total a pagar</Texto></span>
          <strong>{soles(total)}</strong>
        </div>
        {pie}
      </div>
    </section>
  );
}

/**
 * Una forma de pagar: su sello, su nombre, qué pasa después y su botón.
 *  - icono · titulo · texto · children (el botón y lo que haga falta)
 *  - destacado: la recomendada (borde violeta)
 */
export function MetodoPago({ icono, titulo, texto, destacado = false, children }) {
  return (
    <article className={[s.metodo, destacado && s.metodoDestacado].filter(Boolean).join(' ')} data-componente="MetodoPago">
      <header className={s.metodoCabeza}>
        <Sello tamano={40} girar={-8} tono={destacado ? 'degradado' : 'suave'}>{icono}</Sello>
        <span>
          <strong><Texto>{titulo}</Texto></strong>
          {texto && <small><Texto>{texto}</Texto></small>}
        </span>
      </header>
      {children}
    </article>
  );
}
