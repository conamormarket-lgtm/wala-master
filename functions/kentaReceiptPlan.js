"use strict";
// Manual voucher adapter. Financial primitives are shared with the existing ERP payment writer.
const erp = require('./erpCobranzaLogic');
const { requireThat, phone } = require('./kentaReceiptContract');
const cents = v => Math.round(Number(v) * 100);
function validateOrder(order, p) {
  requireThat(order?.tenant_id === 'con-amor', 'order_not_in_scope', 403);
  requireThat(!order.deletedAt && !order.deleted_at && !order.eliminado && !order.anulado && !/^anulad[oa]$/i.test(String(order.estadoGeneral || '').trim()), 'order_unavailable', 409);
  requireThat(phone(order.clienteContacto || order.clienteTelefono) === p.customerPhone, 'order_phone_mismatch', 409);
  requireThat((typeof order.montoTotal === 'number' && Number.isFinite(order.montoTotal)) ||
    (typeof order.montoTotal === 'string' && /[0-9]/.test(order.montoTotal) && Number.isFinite(erp.parseMontoRobust(order.montoTotal))), 'unknown_order_amount', 409);
  const debt = erp.calcularSaldoTotal(order);
  requireThat(Number.isFinite(debt) && debt > 0, 'order_already_paid', 409);
  const delivery = erp.deliveryPendiente(order.cobranza);
  requireThat(Number.isFinite(delivery) && delivery >= 0, 'invalid_delivery_amount', 409);
  const total = cents(debt) + cents(delivery);
  requireThat(cents(p.amount) <= total, 'amount_exceeds_balance', 409);
  requireThat(cents(p.amount) < cents(debt) || cents(p.amount) === total, 'include_remaining_delivery', 409);
  const orderAmount = cents(p.amount) === total ? debt : p.amount;
  const cob = order.cobranza || {};
  const history = Array.isArray(cob.historialPagos) && cob.historialPagos.length ? cob.historialPagos :
    [{monto:erp.parseMontoRobust(cob.pago1)},{monto:erp.parseMontoRobust(cob.pago2)}];
  // Preserve the ERP's one-cent settlement tolerance in preview and confirmation.
  const debtAfter = erp.calcularSaldoTotal({...order,cobranza:{...cob,historialPagos:[...history,{monto:orderAmount}]}});
  requireThat(debtAfter > 0 || delivery === 0 || cents(p.amount) === total, 'include_remaining_delivery', 409);
  return { debtBefore: debt, debtAfter,
    amount: p.amount, orderAmount, deliveryAmount: cents(p.amount) === total ? delivery : 0 };
}
function plan(order, p, paymentId, proof, now = new Date(), autoHabilitar = false) {
  const amounts = validateOrder(order, p);
  const previous = order.cobranza || {};
  const history = Array.isArray(previous.historialPagos) ? previous.historialPagos.map(h=>({...h})) : [];
  requireThat(!history.some(h => (h.comprobanteHashes || []).includes(p.sha256) || (erp.normalizarOperacion(h.operationNumber) === p.operationNumber && (h.fecha || h.date) === p.paymentDate && (!h.accountId || h.accountId === p.accountId))), 'duplicate_order_receipt', 409);
  if (!history.length) for (const field of ['pago1','pago2']) {
    const monto = erp.parseMontoRobust(previous[field]);
    if (monto > 0) history.push({ monto, usuarioEmail: 'migrado-'+field, fecha: previous['fecha'+field[0].toUpperCase()+field.slice(1)] || null });
  }
  const user = p.actor.email || 'kenta-user:' + p.actor.kentaUserId;
  const hora = new Date(now.getTime()-5*3600000).toISOString().slice(11,19);
  const fecha = new Date(p.paymentDate+'T'+hora+'-05:00');
  const sourceType = amounts.debtAfter === 0 ? 'restante' : 'abono';
  history.push({ monto: amounts.orderAmount, fecha:p.paymentDate, hora, timestamp:fecha.toISOString(), usuarioEmail:user,
    paymentId, operationNumber:p.operationNumber, accountId:p.accountId, comprobanteHashes:[p.sha256],
    comprobanteUrl:proof.url, comprobantePath:proof.path, sourceType, esRestante:amounts.debtAfter===0,
    kentaReceiptKey:p.receiptKey, kentaActorId:p.actor.kentaUserId });
  let cobranza = { ...previous, historialPagos:history, fechaUltimoPago:fecha };
  if (amounts.debtAfter === 0) cobranza = erp.adjuntarDelivery(cobranza,history.length-1,paymentId);
  cobranza.estado = previous.estado === 'Habilitado' || (amounts.debtAfter === 0 && autoHabilitar) ? 'Habilitado' : 'Abonado';
  if (amounts.debtAfter === 0 && !cobranza.fechaPagoCero) cobranza.fechaPagoCero = now;
  const total = erp.parseMontoRobust(order.montoTotal);
  const paid = erp.parseMontoRobust(order.montoAdelanto)+history.reduce((sum,h)=>sum+erp.parseMontoRobust(h.monto),0);
  const updates = { cobranza, montoPendiente:amounts.debtAfter, deudaTotal:amounts.debtAfter,
    esMostacero:order.importado === true ? (order.esMostacero ?? false) : total>0 && paid<(order.tipoEnvio==='delivery'?0.27:0.30)*total,
    historialModificaciones:[...(order.historialModificaciones || []),{timestamp:now,usuarioId:'kenta:'+p.actor.kentaUserId,usuarioEmail:user,accion:'Pago Registrado',paymentId,
      detalle:`Pago verificado en Kenta de S/ ${p.amount.toFixed(2)} registrado con fecha ${p.paymentDate}. Nuevo saldo: S/ ${amounts.debtAfter.toFixed(2)}`}], updatedAt:now };
  const movimiento = { ...erp.crearMovimientoAbono({pedidoId:p.orderId,numeroPedido:order.numeroPedido || p.orderId,
    clienteContacto:order.clienteContacto || order.clienteTelefono || '',clienteNombre:order.clienteNombre || '',
    monto:amounts.orderAmount,fechaVentaPedido:fecha,fechaPago:p.paymentDate,sourceType,usuarioEmail:user,
    operationNumber:p.operationNumber,accountId:p.accountId,now}),
    ...erp.camposDeposito(cobranza.historialPagos.at(-1)),id:paymentId,paymentId,sourceCollection:'pedidos',tenant_id:'con-amor',
    comprobanteHashes:[p.sha256],comprobanteUrl:proof.url,comprobantePath:proof.path,kentaReceiptKey:p.receiptKey,kentaActorId:p.actor.kentaUserId };
  requireThat(cents(movimiento.amount) === cents(p.amount), 'deposit_plan_mismatch', 409);
  return { updates, movimiento, ...amounts };
}
module.exports = { validateOrder, plan };
