import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import Boton from '../Boton';
import { Cabecera, BarraInferior, Pestanas } from '../Navegacion';
import { ItemCarrito, BarraEnvioGratis, ResumenPedido, SeguimientoPedido } from '../Pedido';
import { EstadoVacio } from '../Feedback';
import { EASE } from '../Efectos';
import { BloqueSeccion, TituloSeccion } from '../Seccion';
import { RenderSecciones, CarruselProductos } from '../Secciones';
import { PiePagina } from '../SeccionesExtra';
import s from './Paginas.module.css';

/*
 * Páginas: el último eslabón de la cadena piezas → secciones → páginas.
 * Cada página se arma solo con secciones y piezas del kit; los datos entran
 * por props (en la tienda: CartContext, pedidos de Firestore, la config del
 * builder…).
 */

/**
 * Marco de cualquier página de la tienda: cabecera arriba, contenido y pie
 * de página; en el celular, la barra inferior.
 *  - cabecera: props de <Cabecera> (o null para landings sin menú)
 *  - pie: ajustes de footer_columns (o null)
 *  - barraInferior: props de <BarraInferior> (o null)
 */
export function MarcoTienda({ cabecera, pie, barraInferior, children }) {
  return (
    <div className={s.marco}>
      {cabecera && <div className={s.cabecera}><Cabecera {...cabecera} /></div>}
      <main className={s.contenido}>{children}</main>
      {pie && (
        <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '1.5rem' }}>
          <PiePagina ajustes={pie} />
        </BloqueSeccion>
      )}
      {barraInferior && <div className={s.barraInferior}><BarraInferior {...barraInferior} /></div>}
    </div>
  );
}

/**
 * Página del builder (home, tienda, landings): el marco + las secciones
 * guardadas en Firestore. Recibe lo mismo que <RenderSecciones>.
 */
export function PaginaTienda({ cabecera, pie, barraInferior, ...secciones }) {
  return (
    <MarcoTienda cabecera={cabecera} pie={pie} barraInferior={barraInferior}>
      <RenderSecciones {...secciones} />
    </MarcoTienda>
  );
}

const sumar = (items, f) => items.reduce((a, it) => a + f(it), 0);

/**
 * Carrito: barra de envío gratis, productos, resumen con cupón y, debajo,
 * el carrusel de productos (la misma sección del builder) para completar.
 *  - items: [{ id, imagen, nombre, variante, precio, precioAntes, cantidad, personalizado }]
 *  - onCantidad(id, n), onQuitar(id), onPagar, onSeguirComprando
 *  - metaEnvio, costoEnvio, cupones
 *  - recomendados: productos_wala para "También te puede gustar"; onAgregar(producto)
 */
export function PaginaCarrito({
  items = [], onCantidad, onQuitar, onPagar, onSeguirComprando,
  metaEnvio = 150, costoEnvio = 12, cupones, recomendados = [], onAgregar, vacio,
}) {
  const cuentas = useMemo(() => {
    const bruto = sumar(items, (it) => (it.precioAntes ?? it.precio) * it.cantidad);
    const neto = sumar(items, (it) => it.precio * it.cantidad);
    return { bruto, neto, descuento: bruto - neto, envio: neto >= metaEnvio || neto === 0 ? 0 : costoEnvio, unidades: sumar(items, (it) => it.cantidad) };
  }, [items, metaEnvio, costoEnvio]);

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '1rem' }}>
        <div className={s.cabezaPagina}>
          <TituloSeccion
            nivel={1}
            antetitulo={cuentas.unidades ? `${cuentas.unidades} ${cuentas.unidades === 1 ? 'producto' : 'productos'}` : undefined}
            titulo="Tu carrito"
          />
          {onSeguirComprando && <Boton variante="fantasma" icono={<ArrowLeft aria-hidden="true" />} onClick={onSeguirComprando}>Seguir comprando</Boton>}
        </div>
        {items.length === 0 ? (
          <EstadoVacio titulo={vacio?.titulo || 'Tu carrito está vacío'} texto={vacio?.texto || 'Toca "Agregar" en lo que te guste y aparece aquí.'}>
            {vacio?.accion || (onSeguirComprando && <Boton icono={<ShoppingBag aria-hidden="true" />} onClick={onSeguirComprando}>Ver la tienda</Boton>)}
          </EstadoVacio>
        ) : (
          <div className={s.carrito}>
            <div className={s.carritoLista}>
              <BarraEnvioGratis actual={cuentas.neto} meta={metaEnvio} />
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
                    <ItemCarrito {...it} onCantidad={(n) => onCantidad?.(it.id, n)} onQuitar={() => onQuitar?.(it.id)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className={s.carritoResumen}>
              <ResumenPedido
                subtotal={cuentas.bruto}
                descuento={cuentas.descuento}
                envio={cuentas.envio}
                monedas={Math.round(cuentas.neto)}
                cupones={cupones}
                onPagar={onPagar}
              />
            </div>
          </div>
        )}
      </BloqueSeccion>
      {recomendados.length > 0 && (
        <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '2rem' }}>
          <CarruselProductos
            ajustes={{ eyebrow: 'Para completar tu pedido', title: 'También te puede gustar', visibleItems: 4 }}
            productos={recomendados}
            onAgregar={onAgregar}
          />
        </BloqueSeccion>
      )}
    </>
  );
}

/**
 * Mis pedidos: pestañas Activos / Entregados con cuántos hay, cada pedido con
 * su seguimiento y, si una pestaña está vacía, Kapi.
 *  - pedidos: [{ codigo, fecha, paso (0-4), total, items, pagoPendiente, entregaEstimada }]
 *  - onIrATienda
 */
export function PaginaPedidos({ pedidos = [], onIrATienda }) {
  const entregados = pedidos.filter((p) => p.paso >= 4);
  const activos = pedidos.filter((p) => p.paso < 4);
  const [pestana, setPestana] = useState(activos.length ? 'activos' : 'entregados');
  const lista = pestana === 'activos' ? activos : entregados;

  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '2rem' }}>
      <div className={s.cabezaPagina}>
        <TituloSeccion nivel={1} antetitulo="Tu cuenta" titulo="Mis pedidos" />
      </div>
      <div className={s.pestanas}>
        <Pestanas
          etiqueta="Filtrar pedidos"
          valor={pestana}
          onChange={setPestana}
          opciones={[
            { id: 'activos', texto: 'En curso', cuenta: activos.length },
            { id: 'entregados', texto: 'Entregados', cuenta: entregados.length },
          ]}
        />
      </div>
      {lista.length ? (
        <div className={s.pedidos}>
          {lista.map((p) => <SeguimientoPedido key={p.codigo} {...p} />)}
        </div>
      ) : (
        <EstadoVacio
          imagen={pestana === 'activos' ? '/assets/kapi/kapi-happy.webp' : undefined}
          titulo={pestana === 'activos' ? 'No tienes pedidos en curso' : 'Aún no recibes pedidos'}
          texto={pestana === 'activos' ? 'Cuando compres algo, aquí verás por dónde va.' : 'Tus pedidos entregados aparecerán aquí.'}
        >
          {onIrATienda && <Boton icono={<ShoppingBag aria-hidden="true" />} onClick={onIrATienda}>Ir a la tienda</Boton>}
        </EstadoVacio>
      )}
    </BloqueSeccion>
  );
}
