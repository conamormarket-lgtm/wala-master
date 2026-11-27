import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { HojaInferior } from '../../componentes/kit/Feedback';
import Boton from '../../componentes/kit/Boton';
import { LUMI_PAYMENT, solesLumi, whatsappComprobanteLumi } from '../../utils/lumiPayment.mjs';
import s from './PagoLumi.module.css';

export default function PagoLumi({ resumen, onCerrar }) {
  const [copiado, setCopiado] = useState('');
  const [error, setError] = useState('');
  const copiar = async (cuenta) => {
    try {
      await navigator.clipboard.writeText(cuenta.numero.replace(/-/g, ''));
      setCopiado(cuenta.nombre);
      setError('');
    } catch {
      setError('No se pudo copiar. Puedes seleccionar el número y copiarlo.');
    }
  };
  return <HojaInferior abierta={Boolean(resumen)} onCerrar={onCerrar} titulo="Medios de pago de Lumi" tamano="lg">
    {resumen && <div className={s.pago}>
      <Boton bloque className={s.contacto} accion="whatsapp" to={whatsappComprobanteLumi(resumen)} target="_blank" rel="noopener noreferrer">Enviar comprobante por WhatsApp</Boton>
      <p>Después del depósito, abre WhatsApp y adjunta la foto de tu comprobante. Lumi confirmará el pago y coordinará la entrega contigo.</p>
      <div className={s.total}>
        <span>Total a depositar</span><strong>{solesLumi(resumen.total)}</strong>
        <small>Productos: {solesLumi(resumen.subtotal)} · Envío: {solesLumi(resumen.envio)}</small>
      </div>
      <p>Elige tu medio de pago. Todas las cuentas están a nombre de <strong>{LUMI_PAYMENT.titular}</strong>.</p>
      <div className={s.cuentas}>
        {LUMI_PAYMENT.cuentas.map((cuenta) => <div className={s.cuenta} key={cuenta.nombre}>
          <div><strong>{cuenta.nombre}</strong><span>{cuenta.numero}</span></div>
          <Boton variante="contorno" soloIcono aria-label={`Copiar ${cuenta.nombre}`} icono={copiado === cuenta.nombre ? <Check /> : <Copy />} onClick={() => copiar(cuenta)} />
        </div>)}
      </div>
      <span className={s.estado} role="status">{error || (copiado ? `${copiado}: número copiado` : '')}</span>
    </div>}
  </HojaInferior>;
}
