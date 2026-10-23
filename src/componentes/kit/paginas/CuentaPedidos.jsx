import React, { useEffect, useRef, useState } from 'react';
import { ShoppingBag, Package, RotateCcw, IdCard, ChevronRight, MapPin, Receipt, Truck, MessageCircle, Wallet, SearchX, AlertTriangle, Star } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Aviso, EstadoVacio, HojaInferior } from '../Feedback';
import { Etiqueta } from '../Etiquetas';
import { Pestanas } from '../Navegacion';
import { SeguimientoPedido } from '../Pedido';
import { CarruselProductos } from '../Secciones';
import { soles } from '../TarjetaProducto';
import { CabezaCuenta, TarjetaCuenta, ListaDatos } from '../piezas/Cuenta';
import { FotoProducto } from '../piezas/FotoProducto';
import { PedidosPorVerificar } from '../piezas/PedidosPorVerificar';
import { LineaProduccion, PagosPedido } from '../piezas/DetallePedido';
import { EsqueletoPedido, EsqueletoTarjeta } from '../Esqueletos';
import { Hueso } from '../Esqueletos';
import { Texto, useTexto } from '../Traduccion';
import s from './CuentaPedidos.module.css';

/*
 * Mis pedidos (/cuenta/pedidos) y el detalle de una compra
 * (/cuenta/pedidos/:id). Van dentro de MarcoCuenta.
 */

/**
 * Mis pedidos: los que van en curso y los terminados (entregados o
 * anulados), cada uno con su seguimiento. Arriba, los pedidos por verificar.
 *  - pedidos: props de SeguimientoPedido con `id` (pedidoDesdeVista)
 *  - porVerificar: props de PedidosPorVerificar
 *  - cargando · error, onReintentar
 *  - sinDocumento: falta el DNI o CE (no se pueden ubicar) · urlCompletar
 *  - urlTienda (o onIrATienda)
 * Abre en "En curso"; si no hay ninguno en curso, en "Terminados" (también
 * cuando los pedidos llegan después de cargar).
 */
export function PaginaPedidos({ pedidos = [], porVerificar, cargando = false, error, onReintentar, sinDocumento = false, urlCompletar = '/completar-perfil', urlTienda, onIrATienda }) {
  const terminado = (p) => p.anulado || p.paso >= (p.pasos?.length || 5) - 1;
  const terminados = pedidos.filter(terminado);
  const activos = pedidos.filter((p) => !terminado(p));
  // Hasta que la persona elige, la pestaña sale de los pedidos (antes se
  // fijaba al montar, con la lista vacía, y quedaba en un "En curso" sin nada).
  const [elegida, setElegida] = useState(null);
  const pestana = elegida || (activos.length || !terminados.length ? 'activos' : 'terminados');
  const lista = pestana === 'activos' ? activos : terminados;
  const cabeza = <CabezaCuenta icono={<Package />} titulo={<Texto>Mis pedidos</Texto>} subtitulo={<Texto>Por dónde va cada uno, del pago a tu puerta.</Texto>} />;

  if (sinDocumento) {
    return (
      <>
        {cabeza}
        {/* Sin la cara de Kapi: en la tienda ya está el flotante (un solo Kapi a la vista). */}
        <EstadoVacio imagen={null} icono={<IdCard />} titulo={<Texto>Completa tu perfil para rastrear</Texto>} texto={<Texto>Para ubicar tus pedidos necesitamos tu DNI o carnet de extranjería.</Texto>}>
          <Boton to={urlCompletar} icono={<IdCard aria-hidden="true" />}><Texto>Completar perfil</Texto></Boton>
        </EstadoVacio>
      </>
    );
  }
  if (error) {
    return (
      <>
        {cabeza}
        <Aviso tipo="error" titulo={<Texto>No pudimos cargar tus pedidos</Texto>} accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}><Texto>Reintentar</Texto></Boton>}>
          <Texto>{typeof error === 'string' ? error : 'Revisa tu conexión e inténtalo de nuevo.'}</Texto>
        </Aviso>
      </>
    );
  }
  return (
    <>
      {cabeza}
      {porVerificar && <PedidosPorVerificar {...porVerificar} />}
      {cargando ? (
        // La forma de lo que viene: las pestañas y cuatro pedidos (como EsqueletoPagina).
        <>
          <div className={s.pestanas}><Hueso forma="pildora" alto={44} ancho={260} /></div>
          <ul className={s.pedidos} aria-busy="true">
            {[0, 1, 2, 3].map((k) => <li key={k}><EsqueletoPedido /></li>)}
          </ul>
        </>
      ) : !pedidos.length && !porVerificar?.pendientes?.length ? (
        <EstadoVacio imagen={null} icono={<Package />} titulo={<Texto>Aún no tienes pedidos</Texto>} texto={<Texto>Cuando compres algo, aquí verás por dónde va, paso a paso.</Texto>}>
          {(urlTienda || onIrATienda) && <Boton to={urlTienda} icono={<ShoppingBag aria-hidden="true" />} onClick={onIrATienda}><Texto>Ir a la tienda</Texto></Boton>}
        </EstadoVacio>
      ) : pedidos.length > 0 && (
        <>
          <div className={s.pestanas}>
            <Pestanas
              etiqueta="Filtrar pedidos"
              valor={pestana}
              onChange={setElegida}
              opciones={[
                { id: 'activos', texto: <Texto>En curso</Texto>, cuenta: activos.length },
                { id: 'terminados', texto: <Texto>Terminados</Texto>, cuenta: terminados.length },
              ]}
            />
          </div>
          {lista.length ? (
            <ul className={s.pedidos}>
              {lista.map((p) => <li key={p.id || p.codigo}><SeguimientoPedido {...p} /></li>)}
            </ul>
          ) : (
            <p className={s.nada}><Texto>{pestana === 'activos' ? 'No tienes pedidos en curso ahora.' : 'Tus pedidos entregados aparecerán aquí.'}</Texto></p>
          )}
        </>
      )}
    </>
  );
}

/**
 * Detalle de una compra: encabezado con el estado y el pago, el seguimiento
 * (8 etapas del taller, o 5 generales mientras el taller no lo registra), los
 * productos, la dirección; al costado el detalle de la compra, los pagos y
 * documentos y WhatsApp; abajo, recomendados.
 *  - pedido: { codigo, numeroProduccion, fecha, estado: { texto, tono },
 *    pago: { texto, pagado }, produccion (8 etapas o no), pasos, paso,
 *    fechasPasos, hechos (por fecha, LineaProduccion), anulado, deuda,
 *    avisoDeuda: el aviso del taller (impresión con deuda) que se abre solo al
 *    entrar y lleva a pagar, productos: [{ id, nombre, imagen, talla, color,
 *    personalizado, cantidad, subtotal (sin él no hay precio), combo ("Combo
 *    Pareja · 1 de 2"), piezas: [texto] }], direccion: { linea, lugar },
 *    resumen: { productos, descuentoMonedas, envio (sin él no hay fila),
 *    total, pago: el texto del pago bajo el total } }
 *  - pagos: props de PagosPedido (historial, onBoletas, onFotosEnvio, monedas…)
 *  - onPagar · whatsapp: [{ texto, url }] (sin url: el botón apagado)
 *  - opinar: { url, monedas } "¿Cómo te fue con este pedido?" (pedido entregado)
 *  - recomendados, catalogo, onAgregar · tarjeta: la de la tienda ·
 *    onVerAbajo(): una vez, al acercarse a los recomendados (se piden ahí)
 *  - cargando · noEncontrado · urlVolver
 */
export function PaginaDetallePedido({
  pedido, pagos = {}, onPagar, whatsapp = [], recomendados = [], catalogo, onAgregar, tarjeta, onVerAbajo, opinar,
  cargando = false, noEncontrado = false, urlVolver = '/cuenta/pedidos',
}) {
  // El aviso del taller se abre solo, una vez por pedido.
  const [aviso, setAviso] = useState(false);
  const avisado = useRef(null);
  useEffect(() => {
    if (pedido?.avisoDeuda && avisado.current !== pedido.codigo) {
      avisado.current = pedido.codigo;
      setAviso(true);
    }
  }, [pedido?.avisoDeuda, pedido?.codigo]);
  // Lo de abajo (recomendados) se pide al acercarse.
  const abajoRef = useRef(null);
  const verAbajo = useRef(onVerAbajo);
  verAbajo.current = onVerAbajo;
  const hayPedido = Boolean(pedido) && !cargando;
  useEffect(() => {
    const el = abajoRef.current;
    if (!el || !verAbajo.current || !hayPedido) return undefined;
    if (typeof IntersectionObserver === 'undefined') { verAbajo.current(); return undefined; }
    const ojo = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) { ojo.disconnect(); verAbajo.current?.(); }
    }, { rootMargin: '300px 0px' });
    ojo.observe(el);
    return () => ojo.disconnect();
  }, [hayPedido]);
  const estasEn = useTexto('Estás en');

  const migas = (
    <nav className={s.migas} aria-label={estasEn}>
      <Enlace to={urlVolver}><Texto>Mis pedidos</Texto></Enlace>
      <ChevronRight aria-hidden="true" />
      <span aria-current="page"><Texto>Estado de la compra</Texto></span>
    </nav>
  );
  if (cargando) {
    // La forma de lo que viene: el pedido y sus productos; al costado, el detalle y los pagos.
    return (
      <>
        {migas}
        <div className={s.detalle} aria-busy="true">
          <div className={s.principal}>
            <EsqueletoPedido />
            <EsqueletoTarjeta lineas={4} alto={240} boton={false} />
          </div>
          <aside className={s.lado}>
            <EsqueletoTarjeta lineas={3} alto={190} boton={false} />
            <EsqueletoTarjeta lineas={2} alto={170} />
          </aside>
        </div>
      </>
    );
  }
  if (noEncontrado || !pedido) {
    return (
      <>
        {migas}
        {/* Sin la cara de Kapi: en la tienda ya está el flotante (un solo Kapi a la vista). */}
        <EstadoVacio imagen={null} icono={<SearchX />} titulo={<Texto>No encontramos esta compra</Texto>} texto={<Texto>Es posible que el pedido ya no esté disponible o que no pertenezca a tu cuenta.</Texto>}>
          <Boton to={urlVolver}><Texto>Volver a Mis pedidos</Texto></Boton>
        </EstadoVacio>
      </>
    );
  }
  const { resumen = {}, productos = [] } = pedido;
  const sub = [pedido.fecha && `Realizado el ${pedido.fecha}`, pedido.numeroProduccion && `N.º de producción ${pedido.numeroProduccion}`].filter(Boolean).join(' · ');
  return (
    <>
      {migas}
      <div className={s.detalle}>
        <div className={s.principal}>
          <section className={s.encabezado} data-componente="EncabezadoPedido">
            <CabezaCuenta
              icono={<Package />}
              titulo={<><Texto>Pedido</Texto> #{pedido.codigo || '—'}</>}
              subtitulo={sub ? <Texto>{sub}</Texto> : undefined}
              accion={pedido.estado && <Etiqueta tono={pedido.estado.tono || 'violeta'} punto><Texto>{pedido.estado.texto}</Texto></Etiqueta>}
            />
            {pedido.pago?.texto && (
              <p className={[s.pago, pedido.pago.pagado && s.pagoOk].filter(Boolean).join(' ')}><Wallet aria-hidden="true" /> <Texto>{pedido.pago.texto}</Texto></p>
            )}
          </section>

          {opinar?.url && (
            <TarjetaCuenta icono={<Star />} titulo={<Texto>¿Cómo te fue con este pedido?</Texto>}
              subtitulo={<Texto>{`Cuéntanos en 30 segundos${opinar.monedas > 0 ? ` y gana ${opinar.monedas} monedas` : ''}.`}</Texto>}>
              <Boton to={opinar.url} icono={<Star aria-hidden="true" />}><Texto>Calificar mi pedido</Texto></Boton>
            </TarjetaCuenta>
          )}

          {!pedido.anulado && (
            <TarjetaCuenta icono={<Truck />} titulo={<Texto>{pedido.produccion ? 'Seguimiento de producción' : 'Seguimiento general'}</Texto>}
              subtitulo={pedido.produccion ? undefined : <Texto>El detalle por etapas (8 pasos) aparece cuando el taller registra el pedido.</Texto>}>
              <LineaProduccion pasos={pedido.pasos} paso={pedido.paso} fechas={pedido.fechasPasos} hechos={pedido.hechos} deuda={pedido.deuda > 0} />
            </TarjetaCuenta>
          )}

          <TarjetaCuenta icono={<ShoppingBag />} titulo={<Texto>{productos.length === 1 ? 'Tu producto' : 'Tus productos'}</Texto>}>
            {productos.length ? (
              <ul className={s.productos}>
                {productos.map((p, i) => (
                  <li key={p.id || i} className={s.producto}>
                    <FotoProducto className={s.foto} src={p.imagen} relleno="4px" respaldo={<Package className={s.sinFoto} aria-hidden="true" />} />
                    <div className={s.productoTextos}>
                      {p.combo && <small className={s.productoCombo}><Texto>{p.combo}</Texto></small>}
                      <strong><Texto>{p.nombre}</Texto></strong>
                      {p.piezas?.length > 0 && (
                        <ul className={s.piezas}>
                          {p.piezas.map((t, k) => <li key={k}><Texto>{t}</Texto></li>)}
                        </ul>
                      )}
                      <span className={s.chips}>
                        {p.talla && <Etiqueta tono="neutro"><Texto>Talla</Texto> {p.talla}</Etiqueta>}
                        {p.color && <Etiqueta tono="neutro"><Texto>{p.color}</Texto></Etiqueta>}
                        {p.personalizado && <Etiqueta tono="violeta"><Texto>Tu diseño</Texto></Etiqueta>}
                      </span>
                      <small><Texto>Cantidad:</Texto> {p.cantidad || 1}</small>
                    </div>
                    {p.subtotal != null && <span className={s.subtotal}>{soles(p.subtotal)}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className={s.nada}><Texto>No hay detalle de productos para este pedido.</Texto></p>}
          </TarjetaCuenta>

          {pedido.direccion?.linea && (
            <TarjetaCuenta icono={<MapPin />} titulo={<Texto>Dirección de entrega</Texto>}>
              <p className={s.direccion}><strong>{pedido.direccion.linea}</strong>{pedido.direccion.lugar && <span>{pedido.direccion.lugar}</span>}</p>
            </TarjetaCuenta>
          )}
        </div>

        <aside className={s.lado}>
          <TarjetaCuenta icono={<Receipt />} titulo={<Texto>Detalle de la compra</Texto>}>
            <ListaDatos datos={[
              { etiqueta: productos.length === 1 ? 'Producto' : 'Productos', valor: soles(resumen.productos ?? resumen.total ?? 0) },
              ...(resumen.descuentoMonedas > 0 ? [{ etiqueta: 'Descuento (monedas)', valor: `−${soles(resumen.descuentoMonedas)}` }] : []),
              ...(resumen.envio != null ? [{ etiqueta: 'Envío', valor: resumen.envio > 0 ? soles(resumen.envio) : <Texto>Gratis</Texto> }] : []),
            ]}
            />
            <p className={s.total}><span><Texto>Total</Texto></span><strong>{soles(resumen.total ?? 0)}</strong></p>
            {resumen.pago && <p className={s.pagoResumen}><Texto>{resumen.pago}</Texto></p>}
          </TarjetaCuenta>
          {!pedido.anulado && (
            <TarjetaCuenta icono={<Wallet />} titulo={<Texto>Pagos y documentos</Texto>}>
              <PagosPedido total={resumen.total ?? 0} deuda={pedido.deuda} pagado={pedido.pago?.pagado} estadoPago={pedido.pago?.texto} onPagar={onPagar} {...pagos} />
            </TarjetaCuenta>
          )}
          {whatsapp.length > 0 && (
            <TarjetaCuenta icono={<MessageCircle />} tono="menta" titulo={<Texto>¿Dudas con tu pedido?</Texto>} subtitulo={<Texto>Te respondemos por WhatsApp.</Texto>}>
              <div className={s.whatsapp}>
                {/* Sin número, el botón se ve apagado (como antes). */}
                {whatsapp.map((w) => <Boton key={w.url || w.texto} to={w.url || undefined} disabled={!w.url} variante="contorno" bloque icono={<MessageCircle aria-hidden="true" />}><Texto>{w.texto}</Texto></Boton>)}
              </div>
            </TarjetaCuenta>
          )}
        </aside>
      </div>

      {/* Desde aquí, lo de abajo: se pide al acercarse (onVerAbajo). */}
      <div ref={abajoRef} aria-hidden="true" />
      {recomendados.length > 0 && (
        <div className={s.recomendados}>
          <CarruselProductos ajustes={{ title: 'También te puede interesar', visibleItems: 4 }} productos={recomendados} onAgregar={onAgregar} catalogo={catalogo} {...(tarjeta ? { tarjeta } : {})} />
        </div>
      )}

      {/* El aviso del taller: se detuvo en la impresión por la deuda. */}
      <HojaInferior abierta={aviso} onCerrar={() => setAviso(false)} titulo="Aviso de impresión">
        <div className={s.avisoDeuda}>
          <p><AlertTriangle aria-hidden="true" /> <Texto>{pedido.avisoDeuda || ''}</Texto></p>
          {onPagar && <Boton bloque onClick={() => { setAviso(false); onPagar(); }}><Texto>Ver detalles de pago</Texto></Boton>}
        </div>
      </HojaInferior>
    </>
  );
}
