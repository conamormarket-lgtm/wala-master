/**
 * Carga SEGURA de "Mis Pedidos": los pedidos llegan del servidor
 * (functions: misPedidosSecure), que solo devuelve completos los que la cuenta
 * demuestra que son suyos — comprados con ella, con su correo verificado o
 * vinculados con número de pedido + teléfono. Los que solo coinciden por DNI
 * llegan como `pendientes` (fecha y fase, sin datos personales).
 *
 * Antes el navegador buscaba directamente por el DNI del perfil, que nadie
 * comprueba: registrándose con un DNI ajeno se veían los pedidos de otra
 * persona. Ver functions/misPedidosLogic.js.
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Timestamp } from 'firebase/firestore';
import { fusionarVivosYEspejo } from './erp/firebase';
import { normalizarEspejoParaVista } from './walaOrders';

const llamar = (nombre, datos) => httpsCallable(getFunctions(), nombre)(datos);

/** El servidor manda las fechas como { __ts: millis }: se vuelven Timestamp. */
function revivirFechas(valor) {
  if (Array.isArray(valor)) return valor.map(revivirFechas);
  if (valor && typeof valor === 'object') {
    if (typeof valor.__ts === 'number' && Object.keys(valor).length === 1) {
      return Timestamp.fromMillis(valor.__ts);
    }
    const out = {};
    for (const [k, v] of Object.entries(valor)) out[k] = revivirFechas(v);
    return out;
  }
  return valor;
}

/**
 * @returns {Promise<{ pedidos: Array<object>, pendientes: Array<object>, emailVerificado: boolean }>}
 *   `pedidos` en el mismo formato crudo que antes devolvía searchOrdersByDniInERP
 *   (vivos + espejo fusionados), así la vista no cambia.
 */
export async function cargarMisPedidos() {
  const { data } = await llamar('misPedidosSecure', {});
  const crudos = (Array.isArray(data?.pedidos) ? data.pedidos : []).map(revivirFechas);
  const vivos = crudos.filter((p) => p._coleccion !== 'wala_pedidos');
  const espejo = crudos
    .filter((p) => p._coleccion === 'wala_pedidos')
    .map((p) => normalizarEspejoParaVista(p.id, p));
  return {
    pedidos: fusionarVivosYEspejo(vivos, espejo),
    pendientes: Array.isArray(data?.pendientes) ? data.pendientes : [],
    emailVerificado: data?.emailVerificado === true,
  };
}

/**
 * Despierta la función por detrás (sin esperar respuesta) para que la primera
 * carga de "Mis Pedidos" no pague el arranque en frío del servidor.
 * Una sola vez por pestaña.
 */
let calentada = false;
export function calentarMisPedidos() {
  if (calentada) return;
  calentada = true;
  llamar('misPedidosSecure', { ping: true }).catch(() => { calentada = false; });
}

/** Vincula un pedido pendiente probando número de pedido + teléfono. */
export async function vincularPedido({ ref, numeroPedido, telefono }) {
  try {
    await llamar('vincularPedidoSecure', { ref, numeroPedido, telefono });
    return { error: null };
  } catch (e) {
    const code = String(e?.code || '');
    if (code.includes('permission-denied') || code.includes('resource-exhausted') || code.includes('invalid-argument')) {
      return { error: e.message };
    }
    console.warn('[Mis Pedidos] vincularPedidoSecure:', e);
    return { error: 'No se pudo vincular el pedido. Revisa tu conexión e inténtalo de nuevo.' };
  }
}
