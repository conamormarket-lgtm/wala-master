import React, { useState } from 'react';
import { Check, CheckCircle2, AlertTriangle, Receipt, FileText, Camera, Coins, CreditCard, Send, Loader2, ImageOff } from 'lucide-react';
import Boton from '../Boton';
import { HojaInferior } from '../Feedback';
import { Moneda } from '../Etiquetas';
import { soles } from '../TarjetaProducto';
import s from './DetallePedido.module.css';

/*
 * Piezas del detalle de una compra (/cuenta/pedidos/:id): la línea de
 * producción con sus fechas, los pagos y documentos (con sus hojas) y la
 * hoja para pagar el saldo. Datos por props; lo que va al servidor, promesas.
 */

/**
 * Línea de tiempo del pedido: en una fila donde entra (700px o más, container
 * query) y en columna en el celular. Cada paso hecho lleva su visto y su
 * fecha; el actual, el sello del logo.
 *  - pasos: nombres (ETAPAS_PRODUCCION u otros) · paso: índice del actual
 *  - fechas: { [índice]: '12 oct' } · deuda: el paso actual en rojo (se detuvo)
 */
export function LineaProduccion({ pasos = [], paso = 0, fechas = {}, deuda = false }) {
  const fin = paso >= pasos.length - 1;
  return (
    <div className={s.lineaCaja} data-componente="LineaProduccion">
      <ol className={s.linea} style={{ '--pasos': pasos.length }}>
        {pasos.map((nombre, i) => {
          const hecho = i < paso || (fin && i === paso);
          const actual = i === paso && !fin;
          return (
            <li key={nombre} className={[s.paso, hecho && s.hecho, actual && s.actual, actual && deuda && s.detenido].filter(Boolean).join(' ')} aria-current={actual ? 'step' : undefined}>
              <span className={s.punto}>{hecho ? <Check aria-hidden="true" /> : actual ? <span className={s.latido} /> : null}</span>
              <span className={s.pasoTextos}>
                <span className={s.pasoNombre}>{nombre}</span>
                {fechas[i] && <small>{fechas[i]}</small>}
                {actual && deuda && <small className={s.pasoAviso}>Esperando tu pago</small>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Galeria({ estado, imagenes, vacio }) {
  if (estado === 'cargando') return <p className={s.estadoHoja}><Loader2 className={s.girando} aria-hidden="true" /> Buscando…</p>;
  if (estado === 'error') return <p className={s.estadoHoja}><ImageOff aria-hidden="true" /> No pudimos cargarlas. Inténtalo de nuevo.</p>;
  if (!imagenes?.length) return <p className={s.estadoHoja}>{vacio}</p>;
  return (
    <ul className={s.galeria}>
      {imagenes.map((url) => (
        <li key={url}><a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" loading="lazy" /></a></li>
      ))}
    </ul>
  );
}

/**
 * Pagos y documentos de un pedido: si está pagado o cuánto falta, el botón de
 * pagar, el historial de pagos, las boletas y las fotos de envío (cada una en
 * su hoja) y, entregado, reclamar las monedas del pedido.
 *  - total · abonado · deuda · pagado · estadoPago: "Por validar (Yape/Plin)"
 *  - onPagar · historial: [{ monto, fecha }]
 *  - onBoletas(), onFotosEnvio(): promesas → [url] (se piden al abrir)
 *  - monedas: { cantidad, reclamadas, onReclamar() promesa } (pedido entregado)
 */
export function PagosPedido({ total = 0, abonado, deuda = 0, pagado = false, estadoPago, onPagar, historial = [], onBoletas, onFotosEnvio, monedas }) {
  const [hoja, setHoja] = useState(null);
  const [galeria, setGaleria] = useState({ estado: 'cargando', imagenes: [] });
  const [reclamando, setReclamando] = useState(false);
  const abrirGaleria = async (cual, pedir) => {
    setHoja(cual);
    setGaleria({ estado: 'cargando', imagenes: [] });
    try { setGaleria({ estado: 'listo', imagenes: (await pedir?.()) || [] }); } catch { setGaleria({ estado: 'error', imagenes: [] }); }
  };
  const pagadoTotal = abonado ?? historial.reduce((a, h) => a + Number(h.monto || 0), 0);
  let banner;
  if (deuda > 0) {
    banner = (
      <div className={`${s.banner} ${s.bannerDeuda}`}>
        <AlertTriangle aria-hidden="true" />
        <span className={s.bannerTextos}><small>Saldo pendiente</small><strong>{soles(deuda)}</strong></span>
        {onPagar && <Boton tamano="sm" icono={<CreditCard aria-hidden="true" />} onClick={onPagar}>Pagar</Boton>}
      </div>
    );
  } else if (!pagado) {
    banner = (
      <div className={`${s.banner} ${s.bannerEspera}`}>
        <Receipt aria-hidden="true" />
        <span className={s.bannerTextos}><small>{estadoPago || 'Pendiente de pago'}</small><strong>{soles(total)}</strong></span>
      </div>
    );
  } else {
    banner = (
      <div className={`${s.banner} ${s.bannerOk}`}>
        <CheckCircle2 aria-hidden="true" />
        <span className={s.bannerTextos}><small>Pedido pagado</small><strong>{soles(total)}</strong></span>
      </div>
    );
  }
  return (
    <div className={s.pagos} data-componente="PagosPedido">
      {banner}
      <div className={s.enlaces}>
        <button type="button" className={s.enlace} onClick={() => setHoja('historial')}><Receipt aria-hidden="true" /> Historial de pagos</button>
        {onBoletas && <button type="button" className={s.enlace} onClick={() => abrirGaleria('boletas', onBoletas)}><FileText aria-hidden="true" /> Boleta y recibos</button>}
        {onFotosEnvio && <button type="button" className={s.enlace} onClick={() => abrirGaleria('fotos', onFotosEnvio)}><Camera aria-hidden="true" /> Fotos de envío</button>}
      </div>
      {monedas && (
        monedas.reclamadas ? (
          <p className={s.reclamadas}><CheckCircle2 aria-hidden="true" /> Reclamaste las {monedas.cantidad} monedas de este pedido.</p>
        ) : (
          <Boton
            variante="contorno"
            bloque
            icono={<Coins aria-hidden="true" />}
            cargando={reclamando}
            onClick={async () => { setReclamando(true); try { await monedas.onReclamar?.(); } finally { setReclamando(false); } }}
          >
            Reclamar {monedas.cantidad} monedas
          </Boton>
        )
      )}

      <HojaInferior abierta={hoja === 'historial'} onCerrar={() => setHoja(null)} titulo="Historial de pagos">
        <dl className={s.cuentas}>
          <div><dt>Total comprado</dt><dd>{soles(total)}</dd></div>
          <div><dt>Total abonado</dt><dd>{soles(pagadoTotal)}</dd></div>
          <div className={deuda > 0 ? s.falta : undefined}><dt>Falta pagar</dt><dd>{soles(Math.max(0, deuda))}</dd></div>
        </dl>
        <h4 className={s.subtitulo}>Movimientos</h4>
        {historial.length ? (
          <ul className={s.movimientos}>
            {historial.map((h, i) => (
              <li key={i}><span>{h.fecha}</span><strong>+{soles(h.monto)}</strong></li>
            ))}
          </ul>
        ) : <p className={s.estadoHoja}>Aún no hay pagos registrados para este pedido.</p>}
      </HojaInferior>
      <HojaInferior abierta={hoja === 'boletas'} onCerrar={() => setHoja(null)} titulo="Boleta y recibos">
        <Galeria {...galeria} vacio="Aún no hay boletas adjuntas a este pedido." />
      </HojaInferior>
      <HojaInferior abierta={hoja === 'fotos'} onCerrar={() => setHoja(null)} titulo="Fotos de envío">
        <Galeria {...galeria} vacio="Aún no hay fotos del envío." />
      </HojaInferior>
    </div>
  );
}

/**
 * Pagar el saldo de un pedido: con tarjeta (el formulario de Culqi o PayPal
 * entra como `tarjeta`) o por transferencia (Yape, Plin) mandando el
 * comprobante por WhatsApp.
 *  - abierta, onCerrar · monto · tarjeta: nodo
 *  - yape, plin: { numero, nombre } · urlComprobante: wa.me con el mensaje
 *  - cargando: aún no llegan los datos de pago
 */
export function HojaPagarSaldo({ abierta, onCerrar, monto = 0, tarjeta, yape, plin, urlComprobante, cargando = false }) {
  const cuentas = [yape && { ...yape, metodo: 'Yape' }, plin && { ...plin, metodo: 'Plin' }].filter(Boolean);
  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo="Pagar el saldo">
      <div className={s.pagar}>
        <p className={s.monto}><small>Monto a pagar</small><strong>{soles(monto)}</strong></p>
        {cargando ? <p className={s.estadoHoja}><Loader2 className={s.girando} aria-hidden="true" /> Cargando los datos de pago…</p> : (
          <>
            {tarjeta && (
              <section className={s.metodo}>
                <h4><CreditCard aria-hidden="true" /> Con tarjeta <span>Recomendado</span></h4>
                <p>Se aprueba al instante; no necesitas enviar comprobante.</p>
                {tarjeta}
              </section>
            )}
            <p className={s.separador}><span>o por transferencia</span></p>
            {cuentas.length ? (
              <ul className={s.cuentasPago}>
                {cuentas.map((c) => (
                  <li key={c.metodo}>
                    <span className={`${s.marcaPago} ${s[`marca${c.metodo}`]}`}>{c.metodo}</span>
                    <span className={s.cuentaTextos}><strong>{c.numero}</strong>{c.nombre && <small>A nombre de {c.nombre}</small>}</span>
                  </li>
                ))}
              </ul>
            ) : <p className={s.estadoHoja}>Las transferencias no están disponibles ahora.</p>}
            {urlComprobante && cuentas.length > 0 && (
              <Boton to={urlComprobante} bloque icono={<Send aria-hidden="true" />}>Enviar comprobante por WhatsApp</Boton>
            )}
            <p className={s.notaMonedas}><Moneda /> Al entregarse tu pedido, reclamas tus monedas aquí mismo.</p>
          </>
        )}
      </div>
    </HojaInferior>
  );
}
