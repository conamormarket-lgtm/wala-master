import React, { useState } from 'react';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import Boton from '../Boton';
import { EstadoVacio } from '../Feedback';
import { LogoWala, Trazo } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
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
 *  - urlWhatsApp: para pedir un enlace nuevo
 *  - estado: 'cargando' | 'noEncontrado' | 'vencido'
 */
export function PaginaPagoRapido({ enlace = {}, onTarjeta, onPaypal, botonesPaypal, urlWhatsApp, estado }) {
  const [pagado, setPagado] = useState(false);
  if (estado === 'cargando') return <EsqueletoPagina forma="formulario" />;
  if (estado === 'noEncontrado' || estado === 'vencido') {
    const vencido = estado === 'vencido';
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.tarjeta}>
          <EstadoVacio
            imagen={CARAS_KAPI.triste}
            titulo={vencido ? 'Este enlace ya venció' : 'No encontramos este enlace'}
            texto={vencido ? 'Por seguridad, los enlaces de pago duran poco. Pídele uno nuevo a tu asesor.' : 'Revisa que esté completo o pídele a tu asesor que te lo mande otra vez.'}
          >
            {urlWhatsApp && <Boton to={urlWhatsApp} icono={<MessageCircle aria-hidden="true" />}>Escribir al asesor</Boton>}
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
            <h1 className={s.titulo}>¡Pago recibido!<Trazo className={s.trazo} /></h1>
            <p>Tu pago de <strong>{importe(enlace.monto, enlace.moneda)}</strong> se hizo correctamente. Tu asesor ya lo ve.</p>
            {enlace.transaccion && <p className={s.transaccion}><CheckCircle2 aria-hidden="true" /> Operación {enlace.transaccion}</p>}
          </div>
        ) : (
          <>
            <h1 className={s.titulo}>Pago rápido<Trazo className={s.trazo} /></h1>
            <dl className={s.detalle}>
              <div>
                <dt>Concepto</dt>
                <dd>{enlace.concepto}</dd>
              </div>
              <div className={s.total}>
                <dt>Total a pagar</dt>
                <dd>{importe(enlace.monto, enlace.moneda)}</dd>
              </div>
            </dl>
            {enlace.vence && <p className={s.vence}>{enlace.vence}</p>}
            {usd ? (
              <PagoPaypal montoUsd={Number(enlace.monto) || 0} mostrarMonto={false} botones={botonesPaypal} onPagar={async () => { await onPaypal?.(); setPagado(true); }} />
            ) : (
              <PagoTarjeta monto={Number(enlace.monto) || 0} onPagar={async () => { await onTarjeta?.(); setPagado(true); }} />
            )}
          </>
        )}
      </div>
    </BloqueSeccion>
  );
}
