/* Tarjetas guardadas en Culqi: Walá solo recibe la marca y los últimos 4
   números (functions/tarjetasGuardadas.js). Las guarda processCulqiPayment
   con guardarTarjeta; aquí se listan y se quitan. */

import { getFunctions, httpsCallable } from 'firebase/functions';

/** { puede, maximo, tarjetas: [{ id, marca, ultimos4, tipo, banco }] }. Sin sesión o si falla: puede false. */
export async function misTarjetas() {
  try {
    const r = await httpsCallable(getFunctions(), 'misTarjetasSecure')({});
    return { puede: Boolean(r?.data?.puede), maximo: r?.data?.maximo || 5, tarjetas: r?.data?.tarjetas || [] };
  } catch (e) {
    console.warn('misTarjetas:', e?.message || e);
    return { puede: false, maximo: 5, tarjetas: [] };
  }
}

/** La quita en Culqi y de la lista. */
export async function borrarTarjeta(id) {
  await httpsCallable(getFunctions(), 'borrarTarjetaSecure')({ id });
}
