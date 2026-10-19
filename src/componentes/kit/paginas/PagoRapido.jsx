import React, { useState } from 'react';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import Boton from '../Boton';
import { EstadoVacio } from '../Feedback';
import { LogoWala, Trazo } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { Texto } from '../Traduccion';
import { PagoTarjeta, PagoPaypal } from '../piezas/Pago';
import s from './PagoRapido.module.css';

/*
 * Pago rápido (/pago-rapido/:id): el enlace que manda un asesor por el chat
 * para pagar un monto (un adelanto, un saldo, un pedido por WhatsApp). Es
 * público: en soles se paga con tarjeta (Culqi); en dólares, con PayPal.
 */

const importe = (monto, moneda) => `${moneda === 'USD' ? 'US$' : 'S/'} ${Number(monto || 0).toFixed(2)}`;

/**
 * La página.
 *  - enlace: { concepto, monto, moneda ('PEN' | 'USD'), vence ("Vence hoy a
 *    las 18:30"), pagado, transaccion }
 *  - onTarjeta(): promesa · onPaypal(): promesa · botonesPaypal (los del SDK)
 *  - tarjeta: { procesando, error } para PagoTarjeta controlado (la tienda:
 *    onTarjeta abre la ventana de Culqi y, al cobrar, el enlace llega pagado)
 *  - paypal: { procesando, error } mientras la tienda captura
 *  - sin cuenta: el enlace se paga con solo tener el link (no pide sesión)
 *  - urlWhatsApp: para pedir un enlace nuevo
 *  - estado: 'cargando' | 'noEncontrado' | 'vencido'
 */
export function PaginaPagoRapido({ enlace = {}, onTarjeta, onPaypal, botonesPaypal, urlWhatsApp, estado, tarjeta, paypal }) {
  const [pagado, setPagado] = useState(false);
  if (estado === 'cargando') return <EsqueletoPagina forma="formulario" />;
  if (estado === 'noEncontrado' || estado === 'vencido') {
    const vencido = estado === 'vencido';
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.tarjeta}>
          <EstadoVacio
            imagen={CARAS_KAPI.triste}
            titulo={<Texto>{vencido ? 'Este enlace ya venció' : 'No encontramos este enlace'}</Texto>}
            texto={<Texto>{vencido ? 'Por seguridad, los enlaces de pago duran poco. Pídele uno nuevo a tu asesor.' : 'Revisa que esté completo o pídele a tu asesor que te lo mande otra vez.'}</Texto>}
          >
            {urlWhatsApp && <Boton to={urlWhatsApp} icono={<MessageCircle aria-hidden="true" />}><Texto>Escribir al asesor</Texto></Boton>}
          </EstadoVacio>
        </div>
      </BloqueSeccion>
    );
  }

  const usd = enlace.moneda === 'USD';
  const listo = pagado || enlace.pagado;
  return (
    <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
      <div className={s.tarjeta} data-componente="PaginaPagoRapido">
        <LogoWala tamano={34} />
        {listo ? (
          <div className={s.listo}>
            <img src={CARAS_KAPI.feliz} alt="" width="110" height="110" />
            <h1 className={s.titulo}><Texto>¡Pago recibido!</Texto><Trazo className={s.trazo} /></h1>
            <p><Texto>Tu pago de</Texto> <strong>{importe(enlace.monto, enlace.moneda)}</strong> <Texto>se hizo correctamente. Tu asesor ya lo ve.</Texto></p>
            {enlace.transaccion && <p className={s.transaccion}><CheckCircle2 aria-hidden="true" /> <Texto>Operación</Texto> {enlace.transaccion}</p>}
          </div>
        ) : (
          <>
            <h1 className={s.titulo}><Texto>Pago rápido</Texto><Trazo className={s.trazo} /></h1>
            <dl className={s.detalle}>
              <div>
                <dt><Texto>Concepto</Texto></dt>
                <dd><Texto>{enlace.concepto}</Texto></dd>
              </div>
              <div className={s.total}>
                <dt><Texto>Total a pagar</Texto></dt>
                <dd>{importe(enlace.monto, enlace.moneda)}</dd>
              </div>
            </dl>
            {enlace.vence && <p className={s.vence}><Texto>{enlace.vence}</Texto></p>}
            {usd ? (
              <PagoPaypal montoUsd={Number(enlace.monto) || 0} mostrarMonto={false} botones={botonesPaypal} procesando={paypal?.procesando} error={paypal?.error} onPagar={async () => { await onPaypal?.(); setPagado(true); }} />
            ) : (
              <PagoTarjeta
                monto={Number(enlace.monto) || 0}
                {...(tarjeta ? { procesando: Boolean(tarjeta.procesando), error: tarjeta.error, onPagar: onTarjeta } : { onPagar: async () => { await onTarjeta?.(); setPagado(true); } })}
              />
            )}
          </>
        )}
      </div>
    </BloqueSeccion>
  );
}
