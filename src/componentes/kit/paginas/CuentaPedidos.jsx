import React, { useState } from 'react';
import { ShoppingBag, Package, RotateCcw, IdCard, ChevronRight, MapPin, Receipt, Truck, MessageCircle, Wallet } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Aviso, EstadoVacio } from '../Feedback';
import { Etiqueta } from '../Etiquetas';
import { Pestanas } from '../Navegacion';
import { SeguimientoPedido } from '../Pedido';
import { CarruselProductos } from '../Secciones';
import { soles } from '../TarjetaProducto';
import { CabezaCuenta, TarjetaCuenta, ListaDatos } from '../piezas/Cuenta';
import { FotoProducto } from '../piezas/FotoProducto';
import { PedidosPorVerificar } from '../piezas/PedidosPorVerificar';
import { LineaProduccion, PagosPedido } from '../piezas/DetallePedido';
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
 *  - onIrATienda
 */
export function PaginaPedidos({ pedidos = [], porVerificar, cargando = false, error, onReintentar, sinDocumento = false, urlCompletar = '/completar-perfil', onIrATienda }) {
  const terminado = (p) => p.anulado || p.paso >= (p.pasos?.length || 5) - 1;
  const terminados = pedidos.filter(terminado);
  const activos = pedidos.filter((p) => !terminado(p));
  const [pestana, setPestana] = useState(activos.length || !terminados.length ? 'activos' : 'terminados');
  const lista = pestana === 'activos' ? activos : terminados;
  const cabeza = <CabezaCuenta icono={<Package />} titulo="Mis pedidos" subtitulo="Por dónde va cada uno, del pago a tu puerta." />;

  if (sinDocumento) {
    return (
      <>
        {cabeza}
        <EstadoVacio imagen="/assets/kapi/kapi-happy.webp" titulo="Completa tu perfil para rastrear" texto="Para ubicar tus pedidos necesitamos tu DNI o carnet de extranjería.">
          <Boton to={urlCompletar} icono={<IdCard aria-hidden="true" />}>Completar perfil</Boton>
        </EstadoVacio>
      </>
    );
  }
  if (error) {
    return (
      <>
        {cabeza}
        <Aviso tipo="error" titulo="No pudimos cargar tus pedidos" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}>
          {typeof error === 'string' ? error : 'Revisa tu conexión e inténtalo de nuevo.'}
        </Aviso>
      </>
    );
  }
  return (
    <>
      {cabeza}
      {porVerificar && <PedidosPorVerificar {...porVerificar} />}
      {cargando ? (
        <ul className={s.pedidos} aria-busy="true">
          {[0, 1].map((k) => <li key={k} className={s.esqueleto} aria-hidden="true" />)}
        </ul>
      ) : !pedidos.length && !porVerificar?.pendientes?.length ? (
        <EstadoVacio imagen="/assets/kapi/kapi-happy.webp" titulo="Aún no tienes pedidos" texto="Cuando compres algo, aquí verás por dónde va, paso a paso.">
          {onIrATienda && <Boton icono={<ShoppingBag aria-hidden="true" />} onClick={onIrATienda}>Ir a la tienda</Boton>}
        </EstadoVacio>
      ) : pedidos.length > 0 && (
        <>
          <div className={s.pestanas}>
            <Pestanas
              etiqueta="Filtrar pedidos"
              valor={pestana}
              onChange={setPestana}
              opciones={[
                { id: 'activos', texto: 'En curso', cuenta: activos.length },
                { id: 'terminados', texto: 'Terminados', cuenta: terminados.length },
              ]}
            />
          </div>
          {lista.length ? (
            <ul className={s.pedidos}>
              {lista.map((p) => <li key={p.id || p.codigo}><SeguimientoPedido {...p} /></li>)}
            </ul>
          ) : (
            <p className={s.nada}>{pestana === 'activos' ? 'No tienes pedidos en curso ahora.' : 'Tus pedidos entregados aparecerán aquí.'}</p>
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
 *    fechasPasos, anulado, deuda, productos: [{ id, nombre, imagen, talla,
 *    color, personalizado, cantidad, subtotal }], direccion: { linea, lugar },
 *    resumen: { productos, descuentoMonedas, envio, total } }
 *  - pagos: props de PagosPedido (historial, onBoletas, onFotosEnvio, monedas…)
 *  - onPagar · whatsapp: [{ texto, url }] · recomendados, catalogo, onAgregar
 *  - cargando · noEncontrado · urlVolver
 */
export function PaginaDetallePedido({
  pedido, pagos = {}, onPagar, whatsapp = [], recomendados = [], catalogo, onAgregar,
  cargando = false, noEncontrado = false, urlVolver = '/cuenta/pedidos',
}) {
  const migas = (
    <nav className={s.migas} aria-label="Estás en">
      <Enlace to={urlVolver}>Mis pedidos</Enlace>
      <ChevronRight aria-hidden="true" />
      <span aria-current="page">Estado de la compra</span>
    </nav>
  );
  if (cargando) {
    return (
      <>
        {migas}
        <div className={s.esqueleto} style={{ height: 120 }} aria-hidden="true" />
        <div className={s.esqueleto} style={{ height: 260 }} aria-hidden="true" />
      </>
    );
  }
  if (noEncontrado || !pedido) {
    return (
      <>
        {migas}
        <EstadoVacio titulo="No encontramos esta compra" texto="Es posible que el pedido ya no esté disponible o que no pertenezca a tu cuenta.">
          <Boton to={urlVolver}>Volver a Mis pedidos</Boton>
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
              titulo={`Pedido #${pedido.codigo}`}
              subtitulo={sub}
              accion={pedido.estado && <Etiqueta tono={pedido.estado.tono || 'violeta'} punto>{pedido.estado.texto}</Etiqueta>}
            />
            {pedido.pago?.texto && (
              <p className={[s.pago, pedido.pago.pagado && s.pagoOk].filter(Boolean).join(' ')}><Wallet aria-hidden="true" /> {pedido.pago.texto}</p>
            )}
          </section>

          {!pedido.anulado && (
            <TarjetaCuenta icono={<Truck />} titulo={pedido.produccion ? 'Seguimiento de producción' : 'Seguimiento general'}
              subtitulo={pedido.produccion ? undefined : 'El detalle por etapas (8 pasos) aparece cuando el taller registra el pedido.'}>
              <LineaProduccion pasos={pedido.pasos} paso={pedido.paso} fechas={pedido.fechasPasos} deuda={pedido.deuda > 0} />
            </TarjetaCuenta>
          )}

          <TarjetaCuenta icono={<ShoppingBag />} titulo={productos.length === 1 ? 'Tu producto' : 'Tus productos'}>
            {productos.length ? (
              <ul className={s.productos}>
                {productos.map((p, i) => (
                  <li key={p.id || i} className={s.producto}>
                    <FotoProducto className={s.foto} src={p.imagen} relleno="4px" respaldo={<Package className={s.sinFoto} aria-hidden="true" />} />
                    <div className={s.productoTextos}>
                      <strong>{p.nombre}</strong>
                      <span className={s.chips}>
                        {p.talla && <Etiqueta tono="neutro">Talla {p.talla}</Etiqueta>}
                        {p.color && <Etiqueta tono="neutro">{p.color}</Etiqueta>}
                        {p.personalizado && <Etiqueta tono="violeta">Tu diseño</Etiqueta>}
                      </span>
                      <small>Cantidad: {p.cantidad || 1}</small>
                    </div>
                    {p.subtotal != null && <span className={s.subtotal}>{soles(p.subtotal)}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className={s.nada}>No hay detalle de productos para este pedido.</p>}
          </TarjetaCuenta>

          {pedido.direccion?.linea && (
            <TarjetaCuenta icono={<MapPin />} titulo="Dirección de entrega">
              <p className={s.direccion}><strong>{pedido.direccion.linea}</strong>{pedido.direccion.lugar && <span>{pedido.direccion.lugar}</span>}</p>
            </TarjetaCuenta>
          )}
        </div>

        <aside className={s.lado}>
          <TarjetaCuenta icono={<Receipt />} titulo="Detalle de la compra">
            <ListaDatos datos={[
              { etiqueta: 'Productos', valor: soles(resumen.productos ?? resumen.total ?? 0) },
              ...(resumen.descuentoMonedas > 0 ? [{ etiqueta: 'Descuento (monedas)', valor: `−${soles(resumen.descuentoMonedas)}` }] : []),
              ...(resumen.envio != null ? [{ etiqueta: 'Envío', valor: resumen.envio > 0 ? soles(resumen.envio) : 'Gratis' }] : []),
            ]}
            />
            <p className={s.total}><span>Total</span><strong>{soles(resumen.total ?? 0)}</strong></p>
          </TarjetaCuenta>
          {!pedido.anulado && (
            <TarjetaCuenta icono={<Wallet />} titulo="Pagos y documentos">
              <PagosPedido total={resumen.total ?? 0} deuda={pedido.deuda} pagado={pedido.pago?.pagado} estadoPago={pedido.pago?.texto} onPagar={onPagar} {...pagos} />
            </TarjetaCuenta>
          )}
          {whatsapp.length > 0 && (
            <TarjetaCuenta icono={<MessageCircle />} tono="menta" titulo="¿Dudas con tu pedido?" subtitulo="Te respondemos por WhatsApp.">
              <div className={s.whatsapp}>
                {whatsapp.map((w) => <Boton key={w.url} to={w.url} variante="contorno" bloque icono={<MessageCircle aria-hidden="true" />}>{w.texto}</Boton>)}
              </div>
            </TarjetaCuenta>
          )}
        </aside>
      </div>

      {recomendados.length > 0 && (
        <div className={s.recomendados}>
          <CarruselProductos ajustes={{ title: 'También te puede interesar', visibleItems: 4 }} productos={recomendados} onAgregar={onAgregar} catalogo={catalogo} />
        </div>
      )}
    </>
  );
}
