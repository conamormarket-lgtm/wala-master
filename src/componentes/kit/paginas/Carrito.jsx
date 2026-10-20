import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Trash2, Clock } from 'lucide-react';
import Boton from '../Boton';
import { ItemCarrito, BarraEnvioGratis, ResumenPedido } from '../Pedido';
import { EstadoVacio, Aviso } from '../Feedback';
import { EASE } from '../Efectos';
import { BloqueSeccion, TituloSeccion } from '../Seccion';
import { CarruselProductos } from '../Secciones';
import { Casilla } from '../Formulario';
import { Texto } from '../Traduccion';
import s from './Carrito.module.css';

/*
 * El carrito (/carrito). En su propio archivo (antes en Paginas.jsx) para que
 * la tienda baje solo esto al abrirlo, sin el resto de las páginas; Paginas.jsx
 * lo vuelve a exportar.
 */

const sumar = (items, f) => items.reduce((a, it) => a + f(it), 0);

/**
 * Carrito: qué se compra esta vez (una casilla por producto, "Seleccionar
 * todo" y "Eliminar elegidos"), la barra de envío gratis, los productos y el
 * resumen; debajo, el carrusel de productos (la misma sección del builder)
 * para completar. Avisa si hay un pedido esperando la confirmación del pago y
 * si a algún producto le falta el color o la talla.
 *  - items: [{ id, imagen, nombre, variante, detalles, combo, piezas, precio,
 *    precioAntes, cantidad, personalizado, url, seleccionado (true si no se
 *    dice), incompleto, urlElegir }] (props de ItemCarrito)
 *  - onCantidad(id, n), onQuitar(id), onSeleccionar(id, bool),
 *    onSeleccionarTodo(bool), onQuitarSeleccionados(), onVaciar()
 *  - onPagar, onSeguirComprando
 *  - pendiente: { codigo } un pedido por WhatsApp esperando la confirmación
 *    del pago (no se puede volver a pagar; "Vaciar" pasa a "Cancelar pedido")
 *  - metaEnvio, costoEnvio (constants/envio: gratis en compras de MÁS de S/ 200)
 *  - saldoMonedas · cupones (solo para probar; en la tienda van en el checkout)
 *  - recomendados: productos_wala para "También te puede gustar"; onAgregar(producto)
 *    · tarjeta: otra tarjeta (la de la tienda) · catalogo: { marcas, categorias }
 *  - onVerAbajo(): una vez, cuando "También te puede gustar" se acerca a la
 *    vista (la tienda pide los recomendados recién ahí)
 *  - notaPago: la línea bajo el botón de pagar (los medios de pago de la tienda)
 */
export function PaginaCarrito({
  items = [], onCantidad, onQuitar, onSeleccionar, onSeleccionarTodo, onQuitarSeleccionados, onVaciar, onPagar, onSeguirComprando,
  pendiente, metaEnvio = 200, costoEnvio = 15, saldoMonedas = 0, cupones, recomendados = [], onAgregar, vacio,
  tarjeta, catalogo, onVerAbajo, notaPago,
}) {
  const [confirmar, setConfirmar] = useState(null);
  // Lo de abajo (recomendados) se pide cuando se acerca a la vista.
  const abajoRef = useRef(null);
  const verAbajo = useRef(onVerAbajo);
  verAbajo.current = onVerAbajo;
  const conItems = items.length > 0;
  useEffect(() => {
    const el = abajoRef.current;
    if (!el || !verAbajo.current || !conItems) return undefined;
    if (typeof IntersectionObserver === 'undefined') { verAbajo.current(); return undefined; }
    const ojo = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) { ojo.disconnect(); verAbajo.current?.(); }
    }, { rootMargin: '300px 0px' });
    ojo.observe(el);
    return () => ojo.disconnect();
  }, [conItems]);
  const elegidos = items.filter((it) => it.seleccionado !== false);
  const cuentas = useMemo(() => {
    const lista = items.filter((it) => it.seleccionado !== false);
    const bruto = sumar(lista, (it) => (it.precioAntes ?? it.precio) * it.cantidad);
    const neto = sumar(lista, (it) => it.precio * it.cantidad);
    return { bruto, neto, descuento: bruto - neto, envio: !lista.length || neto > metaEnvio ? 0 : costoEnvio, unidades: sumar(items, (it) => it.cantidad) };
  }, [items, metaEnvio, costoEnvio]);
  const conSeleccion = Boolean(onSeleccionar);
  const todos = elegidos.length === items.length;
  const faltan = elegidos.filter((it) => it.incompleto);
  const textoFalta = faltan.length ? (new Set(faltan.map((it) => it.incompleto)).size > 1 ? 'color o talla' : faltan[0].incompleto) : '';
  const conArticulo = { color: 'el color', talla: 'la talla' }[textoFalta] || 'el color o la talla';
  let textoBoton = `Ir a pagar (${elegidos.length})`;
  if (pendiente) textoBoton = 'Esperando la confirmación…';
  else if (!elegidos.length) textoBoton = 'Elige algún producto';
  else if (faltan.length) textoBoton = `Falta elegir ${textoFalta}`;
  const preguntas = {
    vaciar: { texto: pendiente ? '¿Cancelar el pedido y vaciar el carrito?' : '¿Vaciar el carrito?', boton: pendiente ? 'Sí, cancelar' : 'Sí, vaciar', accion: onVaciar },
    elegidos: { texto: `¿Quitar del carrito ${elegidos.length === 1 ? 'el producto elegido' : `los ${elegidos.length} productos elegidos`}?`, boton: 'Sí, quitar', accion: onQuitarSeleccionados },
  };
  const pregunta = confirmar && preguntas[confirmar];

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '1rem' }}>
        <div className={s.cabeza}>
          {/* Cuántos productos: un dato de la página, en texto (no en etiqueta). */}
          <TituloSeccion
            nivel={1}
            titulo="Tu carrito"
            subtitulo={cuentas.unidades ? `${cuentas.unidades} ${cuentas.unidades === 1 ? 'producto' : 'productos'}` : undefined}
          />
          <span className={s.carritoAcciones}>
            {items.length > 0 && onVaciar && (
              <Boton variante="fantasma" tamano="sm" icono={<Trash2 aria-hidden="true" />} onClick={() => setConfirmar('vaciar')}><Texto>{pendiente ? 'Cancelar pedido' : 'Vaciar carrito'}</Texto></Boton>
            )}
            {/* Vacío, la salida ya está en el aviso ("Ver la tienda"). */}
            {items.length > 0 && onSeguirComprando && <Boton variante="fantasma" icono={<ArrowLeft aria-hidden="true" />} onClick={onSeguirComprando}><Texto>Seguir comprando</Texto></Boton>}
          </span>
        </div>
        {items.length === 0 ? (
          <EstadoVacio titulo={<Texto>{vacio?.titulo || 'Tu carrito está vacío'}</Texto>} texto={<Texto>{vacio?.texto || 'Toca "Agregar" en lo que te guste y aparece aquí.'}</Texto>}>
            {vacio?.accion || (onSeguirComprando && <Boton icono={<ShoppingBag aria-hidden="true" />} onClick={onSeguirComprando}><Texto>Ver la tienda</Texto></Boton>)}
          </EstadoVacio>
        ) : (
          <div className={s.carrito}>
            <div className={s.carritoLista}>
              {pregunta && (
                <Aviso
                  tipo="error"
                  titulo={pregunta.texto}
                  accion={(
                    <span className={s.carritoAcciones}>
                      <Boton tamano="sm" variante="fantasma" onClick={() => setConfirmar(null)}><Texto>No</Texto></Boton>
                      <Boton tamano="sm" variante="peligro" onClick={() => { pregunta.accion?.(); setConfirmar(null); }}><Texto>{pregunta.boton}</Texto></Boton>
                    </span>
                  )}
                />
              )}
              {pendiente && (
                <Aviso tipo="aviso" titulo="Tu pedido está esperando el pago" icono={<Clock aria-hidden="true" />}>
                  {`Lo enviaste por WhatsApp (código ${pendiente.codigo}). Cuando el asesor confirme el pago, este carrito se vacía solo.`}
                </Aviso>
              )}
              {faltan.length > 0 && (
                <Aviso tipo="error" compacto>
                  {`${faltan.length === 1 ? `A un producto le falta ${conArticulo}.` : `A ${faltan.length} productos les falta ${conArticulo}.`} Ábrelo y elígelo para poder pagar.`}
                </Aviso>
              )}
              <BarraEnvioGratis actual={cuentas.neto} meta={metaEnvio} estricto />
              {conSeleccion && (
                <div className={s.seleccion}>
                  <Casilla
                    activo={todos}
                    onChange={(v) => onSeleccionarTodo?.(v)}
                    etiqueta={todos ? 'Quitar todo de esta compra' : 'Seleccionar todo'}
                  />
                  <span className={s.seleccionCuenta}><Texto>{`${elegidos.length} de ${items.length} ${items.length === 1 ? 'elegido' : 'elegidos'}`}</Texto></span>
                  {elegidos.length > 0 && onQuitarSeleccionados && (
                    <button type="button" className={s.textoBoton} onClick={() => setConfirmar('elegidos')}><Texto>Eliminar elegidos</Texto></button>
                  )}
                </div>
              )}
              <AnimatePresence initial={false}>
                {items.map((it) => (
                  <motion.div
                    key={it.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0, x: -40 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    style={{ overflow: 'hidden' }}
                  >
                    <ItemCarrito
                      {...it}
                      seleccionado={conSeleccion ? it.seleccionado !== false : undefined}
                      onSeleccionar={(v) => onSeleccionar?.(it.id, v)}
                      onCantidad={(n) => onCantidad?.(it.id, n)}
                      onQuitar={() => onQuitar?.(it.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className={s.carritoResumen}>
              <ResumenPedido
                subtotal={cuentas.bruto}
                descuento={cuentas.descuento}
                envio={cuentas.envio}
                etiquetaSubtotal={`Subtotal (${elegidos.length} ${elegidos.length === 1 ? 'producto' : 'productos'})`}
                saldoMonedas={saldoMonedas}
                cupones={cupones}
                onPagar={onPagar}
                textoBoton={textoBoton}
                deshabilitado={Boolean(pendiente) || !elegidos.length || faltan.length > 0}
                {...(notaPago ? { nota: notaPago } : {})}
              />
            </div>
          </div>
        )}
      </BloqueSeccion>
      {/* Desde aquí, lo de abajo: se pide al acercarse (onVerAbajo). */}
      <div ref={abajoRef} aria-hidden="true" />
      {recomendados.length > 0 && (
        <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '2rem' }}>
          <CarruselProductos
            ajustes={{ eyebrow: 'Para completar tu pedido', title: 'También te puede gustar', visibleItems: 4 }}
            productos={recomendados}
            onAgregar={onAgregar}
            catalogo={catalogo}
            {...(tarjeta ? { tarjeta } : {})}
          />
        </BloqueSeccion>
      )}
    </>
  );
}
