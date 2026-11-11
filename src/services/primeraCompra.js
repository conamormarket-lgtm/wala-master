// =========================================================================
// Promo "Tu primera compra puede salir gratis" (saldo de bienvenida)
// -------------------------------------------------------------------------
// Todo lo calcula el servidor (functions/primeraCompra.js): la fase de cada
// cuenta, el saldo, la pausa de monedas y cupones y el premio de S/ 10 por
// amigo. Aquí solo se llama a sus funciones.
// =========================================================================

import { getFunctions, httpsCallable } from 'firebase/functions';

const llamar = async (nombre, datos = {}) => (await httpsCallable(getFunctions(), nombre)(datos)).data;

/**
 * La fase de la cuenta (la empieza si es nueva y la promo está prendida):
 * { promo, fase: { estado, venceMs, … } | null, saldo, pendiente, enPausa, premios }.
 */
export const estadoPrimeraCompra = () => llamar('primeraCompraEstadoSecure');

/**
 * Para el checkout: { enPausa, saldo, topeSaldo, invitador } con los productos
 * del pedido (el mismo mapa que orderPayload.productos o { id: { productoId,
 * precio, cantidad } }). `saldo`: lo que se va a usar (para el aviso de quien invitó).
 */
export const cotizarPrimeraCompra = (productos, saldo = 0) => llamar('primeraCompraCotizarSecure', { productos, saldo });

/* ── Admin ── */
export const configPrimeraCompra = (config) => llamar('primeraCompraConfigSecure', config ? { config } : {});
export const listaPrimeraCompra = () => llamar('primeraCompraListaSecure');
export const revertirPremioPrimeraCompra = (invitadorUid, premioId) => llamar('primeraCompraRevertirSecure', { invitadorUid, premioId });
