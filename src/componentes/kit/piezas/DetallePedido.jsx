import React, { useRef, useState } from 'react';
import { Check, CheckCircle2, AlertTriangle, Receipt, FileText, Camera, Coins, CreditCard, Send, Loader2, ImageOff } from 'lucide-react';
import Boton from '../Boton';
import { HojaInferior } from '../Feedback';
import { Moneda } from '../Etiquetas';
import { soles } from '../TarjetaProducto';
import { Texto, useTexto } from '../Traduccion';
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
 *    (-1: ninguno)
 *  - fechas: { [índice]: '12 oct' }
 *  - hechos: [bool] por paso: hecho es el que tiene fecha, sin importar el
 *    orden (como la línea del taller); sin él, hechos son los de antes del actual
 *  - deuda: la línea en rojo y el paso actual "Esperando tu pago" (se detuvo)
 */
export function LineaProduccion({ pasos = [], paso = 0, fechas = {}, deuda = false, hechos }) {
  const fin = paso >= pasos.length - 1;
  return (
    <div className={s.lineaCaja} data-componente="LineaProduccion">
      <ol className={[s.linea, deuda && s.lineaDeuda].filter(Boolean).join(' ')} style={{ '--pasos': pasos.length }}>
        {pasos.map((nombre, i) => {
          const hecho = hechos ? Boolean(hechos[i]) && i !== paso : (i < paso || (fin && i === paso));
          const actual = hechos ? i === paso : (i === paso && !fin);
          return (
            <li key={nombre} className={[s.paso, hecho && s.hecho, actual && s.actual, actual && deuda && s.detenido].filter(Boolean).join(' ')} aria-current={actual ? 'step' : undefined}>
              <span className={s.punto}>{hecho ? <Check aria-hidden="true" /> : actual ? <span className={s.latido} /> : null}</span>
              <span className={s.pasoTextos}>
                <span className={s.pasoNombre}><Texto>{nombre}</Texto></span>
                {fechas[i] && <small>{fechas[i]}</small>}
                {actual && deuda && <small className={s.pasoAviso}><Texto>Esperando tu pago</Texto></small>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Galeria({ estado, imagenes, vacio, nombre = 'Imagen' }) {
  const tNombre = useTexto(nombre);
  if (estado === 'cargando') return <p className={s.estadoHoja}><Loader2 className={s.girando} aria-hidden="true" /> <Texto>Buscando…</Texto></p>;
  if (estado === 'error') return <p className={s.estadoHoja}><ImageOff aria-hidden="true" /> <Texto>No pudimos cargarlas. Inténtalo de nuevo.</Texto></p>;
  if (!imagenes?.length) return <p className={s.estadoHoja}><Texto>{vacio}</Texto></p>;
  return (
    <ul className={s.galeria}>
      {imagenes.map((url, i) => (
        // Cada una se abre en grande en otra pestaña; el enlace dice cuál es.
        <li key={url}><a href={url} target="_blank" rel="noreferrer" aria-label={`${tNombre} ${i + 1}`}><img src={url} alt={`${tNombre} ${i + 1}`} loading="lazy" /></a></li>
      ))}
    </ul>
  );
}

/**
 * Pagos y documentos de un pedido: si está pagado o cuánto falta, el botón de
 * pagar, el historial de pagos, las boletas y las fotos de envío (cada una en
 * su hoja) y, entregado, reclamar las monedas del pedido.
 *  - total · abonado · deuda · pagado · estadoPago: "Por validar (Yape/Plin)"
 *  - onPagar · historial: [{ monto, fecha, hora }] (el más nuevo primero;
 *    sin fecha dice "Sin fecha")
 *  - onBoletas(), onFotosEnvio(): promesas → [url] (se piden al abrir la
 *    primera vez; si fallan, se vuelven a pedir al abrir otra vez)
 *  - monedas: { cantidad, reclamadas, onReclamar(boton) promesa } (pedido
 *    entregado; `boton`: de ahí salen volando las monedas)
 */
export function PagosPedido({ total = 0, abonado, deuda = 0, pagado = false, estadoPago, onPagar, historial = [], onBoletas, onFotosEnvio, monedas }) {
  const [hoja, setHoja] = useState(null);
  const [galeria, setGaleria] = useState({ estado: 'cargando', imagenes: [] });
  const [reclamando, setReclamando] = useState(false);
  // Lo que ya se trajo no se vuelve a pedir (como antes).
  const vistas = useRef({});
  const abrirGaleria = async (cual, pedir) => {
    setHoja(cual);
    if (vistas.current[cual]) { setGaleria({ estado: 'listo', imagenes: vistas.current[cual] }); return; }
    setGaleria({ estado: 'cargando', imagenes: [] });
    try {
      const imagenes = (await pedir?.()) || [];
      vistas.current[cual] = imagenes;
      setGaleria({ estado: 'listo', imagenes });
    } catch { setGaleria({ estado: 'error', imagenes: [] }); }
  };
  const pagadoTotal = abonado ?? historial.reduce((a, h) => a + Number(h.monto || 0), 0);
  let banner;
  if (deuda > 0) {
    banner = (
      <div className={`${s.banner} ${s.bannerDeuda}`}>
        <AlertTriangle aria-hidden="true" />
        <span className={s.bannerTextos}><small><Texto>Saldo pendiente</Texto></small><strong>{soles(deuda)}</strong></span>
        {onPagar && <Boton tamano="sm" icono={<CreditCard aria-hidden="true" />} onClick={onPagar}><Texto>Pagar</Texto></Boton>}
      </div>
    );
  } else if (!pagado) {
    banner = (
      <div className={`${s.banner} ${s.bannerEspera}`}>
        <Receipt aria-hidden="true" />
        <span className={s.bannerTextos}><small><Texto>{estadoPago || 'Pendiente de pago'}</Texto></small><strong>{soles(total)}</strong></span>
      </div>
    );
  } else {
    banner = (
      <div className={`${s.banner} ${s.bannerOk}`}>
        <CheckCircle2 aria-hidden="true" />
        <span className={s.bannerTextos}><small><Texto>Pedido pagado</Texto></small><strong>{soles(total)}</strong></span>
      </div>
    );
  }
  return (
    <div className={s.pagos} data-componente="PagosPedido">
      {banner}
      <div className={s.enlaces}>
        <button type="button" className={s.enlace} onClick={() => setHoja('historial')}><Receipt aria-hidden="true" /> <Texto>Historial de pagos</Texto></button>
        {onBoletas && <button type="button" className={s.enlace} onClick={() => abrirGaleria('boletas', onBoletas)}><FileText aria-hidden="true" /> <Texto>Boleta y recibos</Texto></button>}
        {onFotosEnvio && <button type="button" className={s.enlace} onClick={() => abrirGaleria('fotos', onFotosEnvio)}><Camera aria-hidden="true" /> <Texto>Fotos de envío</Texto></button>}
      </div>
      {monedas && (
        monedas.reclamadas ? (
          <p className={s.reclamadas}><CheckCircle2 aria-hidden="true" /> <Texto>{`Reclamaste las ${monedas.cantidad} monedas de este pedido.`}</Texto></p>
        ) : (
          <Boton
            variante="contorno"
            bloque
            icono={<Coins aria-hidden="true" />}
            cargando={reclamando}
            onClick={async (e) => { const boton = e.currentTarget; setReclamando(true); try { await monedas.onReclamar?.(boton); } finally { setReclamando(false); } }}
          >
            <Texto>{`Reclamar ${monedas.cantidad} monedas`}</Texto>
          </Boton>
        )
      )}

      <HojaInferior abierta={hoja === 'historial'} onCerrar={() => setHoja(null)} titulo="Historial de pagos">
        <dl className={s.cuentas}>
          <div><dt><Texto>Total comprado</Texto></dt><dd>{soles(total)}</dd></div>
          <div><dt><Texto>Total abonado</Texto></dt><dd>{soles(pagadoTotal)}</dd></div>
          <div className={deuda > 0 ? s.falta : undefined}><dt><Texto>Falta pagar</Texto></dt><dd>{soles(Math.max(0, deuda))}</dd></div>
        </dl>
        <h4 className={s.subtitulo}><Texto>Movimientos</Texto></h4>
        {historial.length ? (
          <ul className={s.movimientos}>
            {historial.map((h, i) => (
              <li key={i}><span>{h.fecha ? [h.fecha, h.hora].filter(Boolean).join(' · ') : <Texto>Sin fecha</Texto>}{h.metodo && <small> · {h.metodo}</small>}</span><strong>+{soles(h.monto)}</strong></li>
            ))}
          </ul>
        ) : <p className={s.estadoHoja}><Texto>Aún no hay pagos registrados para este pedido.</Texto></p>}
      </HojaInferior>
      <HojaInferior abierta={hoja === 'boletas'} onCerrar={() => setHoja(null)} titulo="Boleta y recibos">
        <Galeria {...galeria} nombre="Boleta" vacio="Aún no hay boletas adjuntas a este pedido." />
      </HojaInferior>
      <HojaInferior abierta={hoja === 'fotos'} onCerrar={() => setHoja(null)} titulo="Fotos de envío">
        <Galeria {...galeria} nombre="Foto de envío" vacio="Aún no hay fotos del envío." />
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
 *    (sin él, "Enviar comprobante" se ve apagado: falta el número de pagos)
 *  - cargando: aún no llegan los datos de pago
 */
export function HojaPagarSaldo({ abierta, onCerrar, monto = 0, tarjeta, yape, plin, urlComprobante, cargando = false }) {
  const cuentas = [yape && { ...yape, metodo: 'Yape' }, plin && { ...plin, metodo: 'Plin' }].filter(Boolean);
  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo="Pagar el saldo">
      <div className={s.pagar}>
        <p className={s.monto}><small><Texto>Monto a pagar</Texto></small><strong>{soles(monto)}</strong></p>
        {cargando ? <p className={s.estadoHoja}><Loader2 className={s.girando} aria-hidden="true" /> <Texto>Cargando los datos de pago…</Texto></p> : (
          <>
            {tarjeta && (
              <section className={s.metodo}>
                <h4><CreditCard aria-hidden="true" /> <Texto>Con tarjeta</Texto> <span><Texto>Recomendado</Texto></span></h4>
                <p><Texto>Se aprueba al instante; no necesitas enviar comprobante.</Texto></p>
                {tarjeta}
              </section>
            )}
            <p className={s.separador}><span><Texto>o por transferencia</Texto></span></p>
            {cuentas.length ? (
              <ul className={s.cuentasPago}>
                {cuentas.map((c) => (
                  <li key={c.metodo}>
                    <span className={`${s.marcaPago} ${s[`marca${c.metodo}`]}`}>{c.metodo}</span>
                    <span className={s.cuentaTextos}><strong>{c.numero}</strong>{c.nombre && <small><Texto>A nombre de</Texto> {c.nombre}</small>}</span>
                  </li>
                ))}
              </ul>
            ) : <p className={s.estadoHoja}><Texto>Las transferencias no están disponibles ahora.</Texto></p>}
            {/* Como antes: siempre está; sin número de pagos, apagado. */}
            <Boton to={urlComprobante || undefined} disabled={!urlComprobante} bloque icono={<Send aria-hidden="true" />}><Texto>Enviar comprobante por WhatsApp</Texto></Boton>
            <p className={s.notaMonedas}><Moneda /> <Texto>Al entregarse tu pedido, reclamas tus monedas aquí mismo.</Texto></p>
          </>
        )}
      </div>
    </HojaInferior>
  );
}
