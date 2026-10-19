import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDocument } from '../../services/firebase/firestore';
import { getMessage } from '../../services/messages';
import CulqiCustomCheckout from '../CulqiCustomCheckout';
import { PaginaPagoRapido } from '../../componentes/kit/paginas/PagoRapido';
import { enlacePagoDesde } from '../../componentes/kit/adaptadores';

// PayPal (su SDK) baja solo para los enlaces en dólares.
const PaypalEnlaceCheckout = lazy(() => import('../PaypalCheckout/PaypalEnlaceCheckout'));

// El número principal de WhatsApp (el mismo del checkout), con su respaldo.
const NUMERO_PRINCIPAL = '51924426791';
const limpiarNumero = (n) => {
  const limpio = String(n || '').replace(/[\s\-()+]/g, '');
  return limpio && !limpio.startsWith('51') && limpio.length <= 9 ? `51${limpio}` : limpio;
};

/**
 * Pago rápido con el kit (paso 6 de la migración): PaginaPagoRapido con el
 * enlace de enlaces_pago (enlacePagoDesde). Mismo cobro que PagoRapidoPage:
 * en soles, la ventana de Culqi de CulqiCustomCheckout (con el botón del kit
 * por renderBoton); en dólares, los botones de PayPalEnlaceCheckout. No pide
 * cuenta: basta con tener el link (el servidor cobra el enlace sin sesión).
 * El interruptor pagosViejo (en PagoRapidoPage) vuelve a la página de antes.
 */
export default function PagoRapidoDeTienda() {
  const { id } = useParams();
  // undefined: cargando · null: no existe
  const [doc, setDoc] = useState(undefined);
  // El pago recién hecho en esta visita (el documento lo marca el servidor).
  const [pagadoAhora, setPagadoAhora] = useState(null);
  const [paypal, setPaypal] = useState({ procesando: false, error: '' });

  useEffect(() => {
    if (!id) return undefined;
    let vivo = true;
    setDoc(undefined);
    getDocument('enlaces_pago', id).then(({ data, error }) => {
      if (vivo) setDoc(error || !data ? null : data);
    });
    return () => { vivo = false; };
  }, [id]);

  const { enlace, estado } = enlacePagoDesde(doc);
  const sinSalida = doc === null || estado === 'vencido';
  // "Escribir al asesor": solo hace falta si el enlace no sirve.
  const { data: numero } = useQuery({
    queryKey: ['whatsapp-principal'],
    queryFn: async () => limpiarNumero((await getMessage('whatsapp_number_principal')).data) || NUMERO_PRINCIPAL,
    enabled: sinSalida,
    staleTime: 10 * 60 * 1000,
  });
  const urlWhatsApp = sinSalida
    ? `https://wa.me/${numero || NUMERO_PRINCIPAL}?text=${encodeURIComponent(`Hola, mi enlace de pago (${id}) ${estado === 'vencido' ? 'ya venció' : 'no abre'}. ¿Me mandas uno nuevo?`)}`
    : undefined;

  const cargando = doc === undefined;
  const listo = Boolean(pagadoAhora) || enlace.pagado;
  const enlaceVista = pagadoAhora ? { ...enlace, pagado: true, transaccion: pagadoAhora.transaccion || enlace.transaccion } : enlace;

  const pagina = (extra = {}) => (
    <PaginaPagoRapido
      enlace={enlaceVista}
      estado={cargando ? 'cargando' : (doc === null ? 'noEncontrado' : estado)}
      urlWhatsApp={urlWhatsApp}
      {...extra}
    />
  );

  // Sin poder pagar todavía (cargando, pagado, vencido): solo la página.
  if (cargando || !doc || estado || listo) return pagina();

  // En dólares: los botones de PayPal (el kit muestra "Procesando…" y el error).
  if (enlace.moneda === 'USD') {
    return pagina({
      paypal,
      botonesPaypal: (
        <Suspense fallback={null}>
          <PaypalEnlaceCheckout
            enlace={doc}
            soloBotones
            onProcesando={(procesando) => setPaypal((p) => ({ ...p, procesando }))}
            onError={(error) => setPaypal((p) => ({ ...p, error }))}
            onSuccess={(detalle) => setPagadoAhora({ transaccion: detalle?.id })}
          />
        </Suspense>
      ),
    });
  }

  // En soles: la ventana de Culqi; el botón es el del kit (PagoTarjeta controlado).
  return (
    <CulqiCustomCheckout
      enlace={doc}
      onSuccess={(resultado) => setPagadoAhora({ transaccion: resultado?.charge_id })}
      renderBoton={({ abrir, procesando }) => pagina({ onTarjeta: abrir, tarjeta: { procesando } })}
    />
  );
}
