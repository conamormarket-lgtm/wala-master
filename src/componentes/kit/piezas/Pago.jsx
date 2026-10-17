import React, { useState } from 'react';
import { Lock, Globe2 } from 'lucide-react';
import Boton from '../Boton';
import { Aviso } from '../Feedback';
import { CapaCargando } from '../Cargando';
import { Texto } from '../Traduccion';
import s from './Pago.module.css';

/*
 * Pagar con tarjeta (Culqi) y con PayPal: el botón, la nota de seguridad, lo
 * que se ve mientras se cobra y el error. Los formularios de la tarjeta y de
 * PayPal no son del kit: Culqi abre su propia ventana (Checkout v4) y PayPal
 * pinta sus botones (su SDK). Aquí va lo de alrededor, igual en el checkout,
 * en el pago rápido y al pagar el saldo de un pedido.
 */

const importe = (monto, moneda) => `${moneda === 'USD' ? 'US$' : 'S/'} ${Number(monto || 0).toFixed(2)}`;

/**
 * Pagar con tarjeta. Al tocar el botón se abre la ventana de Culqi
 * (onPagar); mientras el servidor cobra, una capa "Confirmando tu pago".
 *  - monto · moneda: 'PEN' | 'USD' · onPagar(): promesa (lanza un Error si
 *    no se cobró) · onCerrado: la ventana se cerró sin pagar
 *  - texto: el del botón ("Pagar S/ 95.60" por defecto)
 *  - minimo: S/ 3 o US$ 1 (los de Culqi)
 *  - procesando: lo pone la tienda (controlado). Con él, tocar el botón solo
 *    llama a onPagar (abre la ventana de Culqi, que cobra después) y la capa
 *    "Confirmando tu pago" la dibuja la tienda: si no, quedaría encima de la
 *    ventana mientras se escribe la tarjeta. · error: el de la tienda
 */
export function PagoTarjeta({ monto = 0, moneda = 'PEN', onPagar, texto, minimo, procesando, error: errorProp }) {
  const [cobrandoPropio, setCobrando] = useState(false);
  const [errorPropio, setError] = useState('');
  const controlado = procesando !== undefined;
  const cobrando = controlado ? procesando : cobrandoPropio;
  const error = errorProp || errorPropio;
  const min = minimo ?? (moneda === 'USD' ? 1 : 3);
  const pagar = async () => {
    setError('');
    if (controlado) { onPagar?.(); return; }
    setCobrando(true);
    try {
      await onPagar?.();
    } catch (err) {
      setError(err?.message || 'El pago no pudo completarse.');
    } finally {
      setCobrando(false);
    }
  };
  if (monto < min) {
    return <Aviso tipo="info" compacto>{`El monto mínimo para pagar con tarjeta es ${importe(min, moneda)}. Coordina este pago por WhatsApp.`}</Aviso>;
  }
  return (
    <div className={s.pago} data-componente="PagoTarjeta">
      <Boton bloque tamano="lg" icono={<Lock aria-hidden="true" />} cargando={cobrando} onClick={pagar}>
        {cobrando ? <Texto>Procesando tu pago…</Texto> : texto ? <Texto>{texto}</Texto> : <><Texto>Pagar</Texto> {importe(monto, moneda)}</>}
      </Boton>
      <p className={s.nota}><Texto>Pago seguro con Culqi. Walá no guarda los datos de tu tarjeta.</Texto></p>
      {error && <Aviso tipo="error" compacto>{error}</Aviso>}
      {cobrando && !controlado && <CapaCargando pantallaCompleta texto="Confirmando tu pago" detalle="Estamos confirmando el cobro con tu banco. No cierres ni recargues esta página." />}
    </div>
  );
}

/**
 * Pagar con PayPal, en dólares. En la tienda `botones` son los de su SDK
 * (PayPalButtons); sin ellos, un botón que llama a onPagar (la demo).
 *  - montoUsd · equivalente: "≈ S/ 95.60" o en la moneda del cliente ·
 *    mostrarMonto: false si la página ya muestra el total
 *  - botones (nodo) · onPagar(): promesa · procesando (lo pone la tienda
 *    mientras captura) · error · minimo (US$ 1)
 */
export function PagoPaypal({ montoUsd = 0, equivalente, mostrarMonto = true, botones, onPagar, procesando: procesandoProp = false, error: errorProp, minimo = 1 }) {
  const [procesandoPropio, setProcesando] = useState(false);
  const [errorPropio, setError] = useState('');
  const procesando = procesandoProp || procesandoPropio;
  const error = errorProp || errorPropio;
  if (montoUsd < minimo) {
    return <Aviso tipo="info" compacto>{`El monto mínimo para pagar con PayPal es US$ ${minimo.toFixed(2)}. Coordina este pago por WhatsApp.`}</Aviso>;
  }
  const pagar = async () => {
    setError('');
    setProcesando(true);
    try {
      await onPagar?.();
    } catch (err) {
      setError(err?.message || 'No se pudo completar el pago con PayPal. Inténtalo otra vez.');
    } finally {
      setProcesando(false);
    }
  };
  return (
    <div className={s.pago} data-componente="PagoPaypal">
      {mostrarMonto && (
        <p className={s.monto}>
          <Texto>Pagarás</Texto> <strong>US$ {montoUsd.toFixed(2)}</strong>
          {equivalente && <span> ({equivalente})</span>}
        </p>
      )}
      {procesando && (
        <div className={s.procesando} role="status">
          <strong><Texto>Procesando el pago…</Texto></strong>
          <span><Texto>Lo estamos confirmando de forma segura. No cierres esta ventana.</Texto></span>
        </div>
      )}
      {/* Los botones del SDK quedan montados (ocultos) mientras se captura:
          desmontarlos a mitad del pago cortaba su aviso de vuelta. */}
      {botones ? <div hidden={procesando}>{botones}</div> : !procesando && (
        <Boton bloque tamano="lg" icono={<Globe2 aria-hidden="true" />} onClick={pagar}><Texto>Pagar con PayPal</Texto></Boton>
      )}
      {error && <Aviso tipo="error" compacto>{error}</Aviso>}
    </div>
  );
}
