import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { Check, Copy, CreditCard, Truck, Trash2, Gift, ChevronDown, Clock, Tag, Sparkles, Package, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import Boton from './Boton';
import { Enlace } from './Enlace';
import { Texto, useTexto } from './Traduccion';
import { TextoResaltado } from './piezas/TextoResaltado';
import { Etiqueta, Moneda } from './Etiquetas';
import { Visto } from './Marca';
import { FotoProducto } from './piezas/FotoProducto';
import { Cantidad } from './Formulario';
import { soles } from './TarjetaProducto';
import { EASE, Estallido, useContador } from './Efectos';
import s from './Pedido.module.css';

export const PASOS_PEDIDO = ['Recibido', 'Pago confirmado', 'En producción', 'En camino', 'Entregado'];
/** Las 8 etapas del taller (ETAPAS_TIMELINE de utils/constants). */
export const ETAPAS_PRODUCCION = ['Compra', 'Diseño', 'Impresión', 'Preparación', 'Estampado', 'Empaquetado', 'Reparto', 'Finalizado'];

/** Precio que corre hasta su valor nuevo. */
function Monto({ valor, className }) {
  const v = useContador(valor);
  return <span className={className}>{soles(v)}</span>;
}

/**
 * Tarjeta de "Mis pedidos": resumen + línea de tiempo + acción principal.
 * La línea se llena paso a paso al entrar en pantalla; el paso actual late.
 * Si falta pagar, el pago es la acción que manda (y el paso se marca en ámbar).
 *  - codigo, fecha, total, items: [{ nombre, imagen, variante, cantidad, precio }]
 *    (sin precio en la línea —los pedidos hechos en el taller—: no se muestra;
 *    sin fecha o sin total, la línea de arriba los omite)
 *  - paso (0…) · pasos: nombres (PASOS_PEDIDO; con más de 5, p. ej.
 *    ETAPAS_PRODUCCION, va como barra compacta "Paso 5 de 8 · Estampado")
 *  - estado: { texto, tono } la etiqueta de arriba (si no, sale del paso)
 *  - pagoPendiente: aún sin pagar (se separa 72 h) · deuda: saldo por pagar
 *    (S/) · onPagar · anulado
 *  - entregaEstimada · urlDetalle: "Ver detalle" (/cuenta/pedidos/:id)
 */
export function SeguimientoPedido({
  codigo, fecha, paso, total, items = [], pagoPendiente = false, entregaEstimada,
  pasos = PASOS_PEDIDO, estado, deuda = 0, anulado = false, onPagar, urlDetalle,
}) {
  const lineaRef = useRef(null);
  const visible = useInView(lineaRef, { once: true, margin: '0px 0px -40px 0px' });
  const tCopiar = useTexto('Copiar número de pedido');
  const tEstado = useTexto('Estado del pedido');
  const meta = [fecha, `${items.length} ${items.length === 1 ? 'producto' : 'productos'}`].filter(Boolean).join(' · ');
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const entregado = !anulado && paso >= pasos.length - 1;
  const compacta = pasos.length > 5;

  const copiar = () => {
    navigator.clipboard?.writeText(codigo).catch(() => {});
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <article className={[s.pedido, pagoPendiente && s.pedidoPendiente].filter(Boolean).join(' ')}>
      <header className={s.cabeza}>
        <div className={s.miniaturas}>
          {items.slice(0, 3).map((it, i) => (
            <FotoProducto respaldo={<Package className={s.sinFoto} aria-hidden="true" />} key={i} className={s.miniatura} src={it.imagen} relleno="3px" />
          ))}
          {items.length > 3 && <span className={`${s.miniatura} ${s.miniaturaMas}`}>+{items.length - 3}</span>}
        </div>
        <div className={s.datos}>
          <p className={s.codigo}>
            <TextoResaltado resaltar={[`#${codigo}`]}>{`Pedido #${codigo}`}</TextoResaltado>
            <button type="button" onClick={copiar} aria-label={tCopiar} className={s.copiar}>
              {copiado ? <Check key="ok" className={s.copiadoIcono} aria-hidden="true" /> : <Copy key="copiar" aria-hidden="true" />}
              <AnimatePresence>
                {copiado && (
                  <motion.span
                    className={s.burbuja}
                    initial={{ opacity: 0, y: 6, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.22, ease: EASE }}
                  >
                    <Texto>¡Copiado!</Texto>
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </p>
          <p className={s.meta}><Texto>{meta}</Texto>{total > 0 && <> · {soles(total)}</>}</p>
        </div>
        {/* En tarjetas angostas se oculta: la línea de tiempo ya dice el estado. */}
        <span className={s.estado}>
          {estado ? (
            <Etiqueta tono={estado.tono || 'violeta'}><Texto>{estado.texto}</Texto></Etiqueta>
          ) : anulado ? (
            <Etiqueta tono="neutro" icono={<XCircle aria-hidden="true" />}><Texto>Anulado</Texto></Etiqueta>
          ) : pagoPendiente ? (
            <Etiqueta tono="aviso" icono={<Clock aria-hidden="true" />}><Texto>Falta pagar</Texto></Etiqueta>
          ) : entregado ? (
            <Etiqueta tono="exito" icono={<Check aria-hidden="true" />}><Texto>Entregado</Texto></Etiqueta>
          ) : (
            <Etiqueta tono="violeta"><Texto>{pasos[paso]}</Texto></Etiqueta>
          )}
        </span>
      </header>

      {compacta || anulado ? (
        <div ref={lineaRef} className={[s.barraPasos, anulado && s.barraAnulada].filter(Boolean).join(' ')}>
          <span className={s.barraPista} role="progressbar" aria-valuemin={1} aria-valuemax={pasos.length} aria-valuenow={Math.min(paso + 1, pasos.length)}>
            {pasos.map((nombre, i) => (
              <span key={nombre} className={[s.segmento, !anulado && i <= paso && s.segmentoOn, !anulado && i === paso && !entregado && s.segmentoActual].filter(Boolean).join(' ')} />
            ))}
          </span>
          <span className={s.barraTexto}>
            {anulado ? <Texto>Pedido cancelado</Texto> : <><TextoResaltado resaltar={[Math.min(paso + 1, pasos.length)]}>{`Paso ${Math.min(paso + 1, pasos.length)} de ${pasos.length}`}</TextoResaltado> · <Texto>{pasos[Math.min(paso, pasos.length - 1)]}</Texto></>}
          </span>
        </div>
      ) : (
      <ol ref={lineaRef} className={[s.linea, visible && s.lineaVisible].filter(Boolean).join(' ')} style={{ '--pasos': pasos.length }} aria-label={tEstado}>
        {pasos.map((nombre, i) => {
          const hecho = i < paso || (entregado && i === paso);
          const actual = i === paso && !entregado;
          const espera = pagoPendiente && i === 1;
          return (
            <li
              key={nombre}
              className={[s.paso, hecho && s.hecho, actual && s.actual, espera && s.espera].filter(Boolean).join(' ')}
              style={{ '--i': i }}
              aria-current={actual ? 'step' : undefined}
            >
              <span className={s.punto}>{hecho ? <Check aria-hidden="true" /> : null}</span>
              <span className={s.nombrePaso}><Texto>{nombre}</Texto></span>
            </li>
          );
        })}
      </ol>
      )}

      {!entregado && !pagoPendiente && !anulado && entregaEstimada && (
        <p className={s.estimado}>
          <span className={s.camion}><Truck aria-hidden="true" /></span>
          <Texto>Llega aprox.</Texto> <strong><Texto>{entregaEstimada}</Texto></strong>
        </p>
      )}

      {pagoPendiente && !anulado && (
        <div className={s.pagoAviso}>
          <p><Texto>Tu pedido se separa por 72 h. Paga para que pase a producción.</Texto></p>
          <Boton brillo icono={<CreditCard aria-hidden="true" />} onClick={onPagar}><Texto>Pagar</Texto> {soles(total)}</Boton>
        </div>
      )}

      {deuda > 0 && !pagoPendiente && !anulado && (
        <div className={`${s.pagoAviso} ${s.deudaAviso}`}>
          <p><AlertTriangle aria-hidden="true" /><span><TextoResaltado resaltar={[soles(deuda)]}>{`Te falta pagar ${soles(deuda)} para que tu pedido siga avanzando.`}</TextoResaltado></span></p>
          <Boton icono={<CreditCard aria-hidden="true" />} onClick={onPagar} to={onPagar ? undefined : urlDetalle}><Texto>Pagar deuda</Texto></Boton>
        </div>
      )}

      {anulado && (
        <p className={s.anuladoAviso}><XCircle aria-hidden="true" /> <Texto>Este pedido se anuló.</Texto></p>
      )}

      <div className={s.pieSeguimiento}>
        <button type="button" className={s.verDetalle} aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
          <Texto>{abierto ? 'Ocultar productos' : 'Ver productos'}</Texto>
          <ChevronDown aria-hidden="true" />
        </button>
        {urlDetalle && (
          <Boton to={urlDetalle} variante="contorno" tamano="sm" iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Ver detalle</Texto></Boton>
        )}
      </div>

      <AnimatePresence initial={false}>
        {abierto && (
          <motion.ul
            className={s.detalle}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {items.map((it, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i + 0.1, duration: 0.35, ease: EASE }}
              >
                <FotoProducto respaldo={<Package className={s.sinFoto} aria-hidden="true" />} className={s.detalleFoto} src={it.imagen} relleno="3px" />
                <span className={s.detalleNombre}><Texto>{it.nombre}</Texto><small>{[it.variante, `x${it.cantidad}`].filter(Boolean).join(' · ')}</small></span>
                {/* Sin precio en la línea (pedido hecho en el taller): nada, no "Gratis". */}
                {it.precio != null && <strong>{it.precio === 0 ? <Texto>Gratis</Texto> : soles(it.precio * it.cantidad)}</strong>}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </article>
  );
}

/**
 * Fila de producto en el carrito. Controlada (cantidad/onCantidad/onQuitar)
 * o, si no se pasan, con estado propio.
 *  - imagen, nombre, variante (una línea suelta), precio, precioAntes
 *  - url: la foto y el nombre llevan al producto (o a la creación o al combo)
 *  - detalles: [{ etiqueta: 'Color', valor, hex }] (con su bolita de color)
 *  - combo: lleva la etiqueta "Combo" · piezas: [{ texto, hex }] (cada prenda)
 *  - personalizado: "Con tu diseño"
 *  - seleccionado + onSeleccionar(bool): la casilla de "comprar esta vez";
 *    sin marcar, la fila se apaga y dice que no se cobra
 *  - incompleto: 'color' | 'talla' | 'color y talla' · urlElegir
 *  - srcSet: copias de la foto en varios tamaños (la fila mide 84px)
 */
export function ItemCarrito({
  imagen, srcSet, nombre: nombreOriginal, variante, precio, precioAntes, personalizado = false, url, detalles = [], combo = false, piezas = [],
  seleccionado, onSeleccionar, incompleto, urlElegir,
  cantidad: cantidadControlada, onCantidad, onQuitar, cantidadInicial = 1,
}) {
  const nombre = useTexto(nombreOriginal);
  const textoQuitar = useTexto(`Quitar ${nombreOriginal || ''}`);
  const [propia, setPropia] = useState(cantidadInicial);
  const cantidad = cantidadControlada ?? propia;
  const cambiar = onCantidad ?? setPropia;
  const conCasilla = typeof seleccionado === 'boolean';
  const foto = <FotoProducto respaldo={<Package className={s.sinFoto} aria-hidden="true" />} como="div" className={s.itemImgCaja} src={imagen} srcSet={srcSet} sizes="96px" relleno="8px" />;
  return (
    <div className={[s.item, conCasilla && s.itemConCasilla, seleccionado === false && s.itemApagado].filter(Boolean).join(' ')} data-componente="ItemCarrito">
      {conCasilla && (
        <label className={s.itemCasilla}>
          <input type="checkbox" checked={seleccionado} onChange={(e) => onSeleccionar?.(e.target.checked)} />
          {/* El visto del kit, el mismo de "Seleccionar todo" (Casilla). */}
          <Visto activo={seleccionado} forma="cuadro" className={s.itemCaja} />
          <span className={s.oculto}><Texto>{`Comprar ${nombreOriginal || ''} esta vez`}</Texto></span>
        </label>
      )}
      {url ? <Enlace to={url} className={s.itemFotoEnlace} aria-label={nombre}>{foto}</Enlace> : foto}
      <div className={s.itemInfo}>
        <p className={s.itemNombre}>
          {url ? <Enlace to={url}>{nombre}</Enlace> : nombre}
          {combo && <Etiqueta tono="violeta"><Texto>Combo</Texto></Etiqueta>}
        </p>
        {variante && <p className={s.itemVariante}><Texto>{variante}</Texto></p>}
        {detalles.length > 0 && (
          <p className={s.itemDetalles}>
            {detalles.map((d) => (
              <span key={d.etiqueta}>{d.hex && <i style={{ background: d.hex }} aria-hidden="true" />}<Texto>{d.etiqueta}</Texto>: <b><Texto>{d.valor}</Texto></b></span>
            ))}
          </p>
        )}
        {piezas.length > 0 && (
          <ul className={s.itemPiezas}>
            {piezas.map((p, i) => <li key={i}>{p.hex && <i style={{ background: p.hex }} aria-hidden="true" />}<Texto>{p.texto}</Texto></li>)}
          </ul>
        )}
        {personalizado && <Etiqueta tono="violeta" icono={<Sparkles aria-hidden="true" />}><Texto>Con tu diseño</Texto></Etiqueta>}
        {incompleto && (
          <p className={s.itemFalta}><AlertTriangle aria-hidden="true" /> <Texto>{`Falta elegir ${incompleto}`}</Texto>{urlElegir && <> · <Enlace to={urlElegir}><Texto>Elegir ahora</Texto></Enlace></>}</p>
        )}
        {seleccionado === false && <p className={s.itemVariante}><Texto>No se cobra en esta compra.</Texto></p>}
        <div className={s.itemAcciones}>
          <Cantidad valor={cantidad} onChange={cambiar} tamano="sm" max={99} />
          <button type="button" className={s.quitar} aria-label={textoQuitar} onClick={onQuitar}>
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className={s.itemPrecio}>
        <Monto valor={precio * cantidad} className={s.itemPrecioActual} />
        {precioAntes && <s>{soles(precioAntes * cantidad)}</s>}
        {cantidad > 1 && <small>{soles(precio)} c/u</small>}
      </div>
    </div>
  );
}

/**
 * Barra hacia el envío gratis: el camión avanza con el total y al llegar sale confeti.
 *  - actual, meta · compacta: más baja y sin caja (menú del carrito en la cabecera)
 *  - estricto: gratis solo si pasa de la meta (con la meta justa todavía se cobra)
 */
export function BarraEnvioGratis({ actual, meta, compacta = false, estricto = false }) {
  const falta = Math.max(0, meta - actual);
  const pct = Math.min(100, (actual / meta) * 100);
  // estricto: gratis en compras de MÁS de la meta (la regla de la tienda).
  const logrado = estricto ? actual > meta : falta === 0;
  const [fiesta, setFiesta] = useState(0);
  const antes = useRef(logrado);

  useEffect(() => {
    if (logrado && !antes.current) setFiesta((n) => n + 1);
    antes.current = logrado;
  }, [logrado]);

  return (
    <div className={[s.envio, logrado && s.envioOk, compacta && s.envioCompacta].filter(Boolean).join(' ')}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={logrado ? 'ok' : 'falta'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {logrado ? (
            <><Gift aria-hidden="true" /><span><strong><Texto>¡Tienes envío gratis!</Texto></strong></span></>
          ) : (
            falta > 0
              ? <><Truck aria-hidden="true" /><span><TextoResaltado resaltar={[soles(falta)]} envolver={(_, k) => <Monto key={k} valor={falta} className={s.fuerte} />}>{`Te faltan ${soles(falta)} para el envío gratis`}</TextoResaltado></span></>
              : <><Truck aria-hidden="true" /><span><TextoResaltado resaltar={[soles(meta)]} envolver={(parte, k) => <strong key={k} className={s.fuerte}>{parte}</strong>}>{`Pasa de ${soles(meta)} y el envío es gratis`}</TextoResaltado></span></>
          )}
        </motion.p>
      </AnimatePresence>
      <div className={s.pista} role="progressbar" aria-valuemin={0} aria-valuemax={meta} aria-valuenow={Math.min(actual, meta)}>
        <motion.span
          className={s.relleno}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          <span className={s.marcador}>
            {logrado ? <Check aria-hidden="true" /> : <Truck aria-hidden="true" />}
            <Estallido disparo={fiesta} forma="confeti" cantidad={16} distancia={46} />
          </span>
        </motion.span>
      </div>
    </div>
  );
}

/**
 * Resumen del pedido con el total que corre.
 *  - subtotal, descuento (precios de antes), envio · etiquetaSubtotal
 *  - cupones: { CODIGO: monto } para probar un cupón aquí (en la tienda el
 *    cupón va en el checkout; sin esta prop no sale)
 *  - monedas: las que ganas con la compra · saldoMonedas: las que ya tienes
 *    ("podrás usarlas al pagar")
 *  - onPagar · textoBoton · deshabilitado · nota (bajo el botón; por defecto
 *    los medios de pago de la tienda: tarjeta con Culqi, y Yape, Plin o
 *    transferencia acordando por WhatsApp)
 */
export function ResumenPedido({
  subtotal, descuento = 0, envio = 0, monedas = 0, saldoMonedas = 0, cupones, onPagar,
  etiquetaSubtotal = 'Subtotal', textoBoton = 'Ir a pagar', deshabilitado = false, nota = 'Pago seguro con tarjeta, Yape, Plin o transferencia',
}) {
  const etiquetaResumen = useTexto('Resumen del pedido');
  const tCupon = { ejemplo: useTexto(cupones ? 'Prueba WALA10' : undefined), nombre: useTexto(cupones ? 'Código de cupón' : undefined) };
  const [cupon, setCupon] = useState('');
  const [aplicado, setAplicado] = useState(null);
  const [errorCupon, setErrorCupon] = useState(false);
  const [chispas, setChispas] = useState(0);
  const descCupon = aplicado && cupones ? cupones[aplicado] : 0;
  const total = Math.max(0, subtotal - descuento - descCupon + envio);

  const aplicar = (e) => {
    e.preventDefault();
    const codigo = cupon.trim().toUpperCase();
    if (!codigo) return;
    if (cupones?.[codigo]) {
      setAplicado(codigo);
      setErrorCupon(false);
      setChispas((n) => n + 1);
    } else {
      setErrorCupon(true);
      window.setTimeout(() => setErrorCupon(false), 500);
    }
  };

  return (
    <section className={s.resumen} aria-label={etiquetaResumen}>
      <h3><Texto>Resumen</Texto></h3>
      <dl>
        <div><dt><Texto>{etiquetaSubtotal}</Texto></dt><dd><Monto valor={subtotal} /></dd></div>
        {descuento > 0 && <div className={s.ahorro}><dt><Texto>Descuentos</Texto></dt><dd>−<Monto valor={descuento} /></dd></div>}
        <AnimatePresence initial={false}>
          {aplicado && (
            <motion.div
              className={s.ahorro}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <dt><Texto>{`Cupón ${aplicado}`}</Texto></dt><dd>−{soles(descCupon)}</dd>
            </motion.div>
          )}
        </AnimatePresence>
        <div><dt><Texto>Envío</Texto></dt><dd>{envio === 0 ? <span className={s.gratis}><Texto>Gratis</Texto></span> : soles(envio)}</dd></div>
      </dl>

      {cupones && (
        <form className={[s.cupon, aplicado && s.cuponOk, errorCupon && s.cuponError].filter(Boolean).join(' ')} onSubmit={aplicar}>
          <Tag aria-hidden="true" />
          <input
            value={cupon}
            onChange={(e) => { setCupon(e.target.value); setAplicado(null); }}
            placeholder={tCupon.ejemplo}
            aria-label={tCupon.nombre}
          />
          <button type="submit" disabled={!cupon.trim() || !!aplicado}>
            {aplicado ? <><Check aria-hidden="true" /> <Texto>Listo</Texto></> : <Texto>Aplicar</Texto>}
            <Estallido disparo={chispas} cantidad={10} distancia={30} />
          </button>
        </form>
      )}

      <div className={s.total}>
        <span><Texto>Total</Texto></span>
        <Monto valor={total} className={s.totalMonto} />
      </div>
      {monedas > 0 && (
        <p className={s.ganas}><Moneda tamano={18} /><span><TextoResaltado resaltar={[`${monedas} monedas`, monedas]}>{`Con esta compra ganas ${monedas} monedas`}</TextoResaltado></span></p>
      )}
      {saldoMonedas > 0 && (
        <p className={s.ganas}><Moneda tamano={18} /><span><TextoResaltado resaltar={[`${saldoMonedas} monedas`, saldoMonedas]}>{`Tienes ${saldoMonedas} monedas: podrás usarlas al pagar.`}</TextoResaltado></span></p>
      )}
      <Boton tamano="lg" bloque brillo={!deshabilitado} disabled={deshabilitado} onClick={onPagar}><Texto>{textoBoton}</Texto></Boton>
      {nota && <p className={s.seguro}><Texto>{nota}</Texto></p>}
    </section>
  );
}
