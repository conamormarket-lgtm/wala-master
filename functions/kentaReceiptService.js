"use strict";
const crypto = require('node:crypto');
const { hash, requireThat, ReceiptError, orderVersion } = require('./kentaReceiptContract');
const { plan, validateOrder } = require('./kentaReceiptPlan');
const erp = require('./erpCobranzaLogic');
const ORDER_FIELDS = ['tenant_id','clienteContacto','clienteTelefono','clienteNombre','numeroPedido','estadoGeneral',
  'deletedAt','deleted_at','eliminado','anulado','montoTotal','montoAdelanto','cobranza','diseño','tipoEnvio','importado',
  'esMostacero','historialModificaciones','envioDepartamento','envioProvincia','clienteDepartamento','clienteProvincia','pagoOnline'];
const configRef = db => db.collection('fp_config').doc('general');
const requestRef = (db,key) => db.collection('tenants').doc('con-amor').collection('kenta_receipt_requests').doc(hash(key));
function accountsFrom(snapshot) {
  const data = snapshot.exists ? snapshot.data() : {};
  return (Array.isArray(data.accounts) ? data.accounts : []).filter(a => a && a.id && !a.deletedAt && a.active !== false && a.activo !== false && (!a.currency || ['PEN','S/','SOLES'].includes(String(a.currency).toUpperCase())));
}
function selectedAccount(snapshot,id) {
  const rows = accountsFrom(snapshot).filter(a=>String(a.id)===id);
  requireThat(rows.length===1,'account_unavailable',409); return rows[0];
}
async function archiveOriginal(bucket,p) {
  const ext = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'}[p.mime];
  const path = `comprobantes_pago/${p.orderId}/kenta_${p.sha256}.${ext}`;
  const file=bucket.file(path), token=crypto.randomUUID();
  let storedToken=token;
  try {
    await file.save(p.bytes,{resumable:false,contentType:p.mime,preconditionOpts:{ifGenerationMatch:0},
      metadata:{cacheControl:'private, max-age=0',metadata:{sha256:p.sha256,firebaseStorageDownloadTokens:token,kentaReceiptKey:p.receiptKey}}});
  } catch(e) {
    if(Number(e.code)!==412) throw e;
    const [metadata]=await file.getMetadata();
    requireThat(metadata.metadata?.sha256===p.sha256 && Number(metadata.size)===p.bytes.length,'archived_original_conflict',409);
    storedToken=String(metadata.metadata.firebaseStorageDownloadTokens||'').split(',')[0];
    requireThat(storedToken,'archived_original_unavailable',409);
  }
  return {path,url:`https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${storedToken}`};
}
function claimRefs(db,p) {
  const root=db.collection('tenants').doc('con-amor');
  // The hash claim is also honored by the old CRM: forwarding between systems cannot credit twice.
  const crmValues=['sha256:'+p.sha256,'operation:'+hash(JSON.stringify([p.operationNumber.toLowerCase(),p.paymentDate]))];
  return [
    root.collection('kenta_payment_claims').doc(hash(JSON.stringify(['bank',p.accountId,p.paymentDate,p.operationNumber]))),
    ...crmValues.map(value=>root.collection('wala_payment_claims').doc(hash(JSON.stringify(value)))),
    db.collection('cobranzaPaymentKeys').doc(hash(JSON.stringify(['pedidos',p.orderId,p.sha256]))),
  ];
}
function sameOperation(row,p) {
  return erp.normalizarOperacion(row.operationNumber || row.nroOperacion)===p.operationNumber &&
    (row.date || row.fecha || row.createdAtLocal)===p.paymentDate && (!row.accountId || row.accountId===p.accountId);
}
function owned(row) { return !row.tenant_id || row.tenant_id==='con-amor'; }
async function checkExistingPayments(db,p,order) {
  const refs = ['abono_ia_wala_'+p.sha256];
  const ids=[...new Set([p.orderId,String(order.numeroPedido || p.orderId)])];
  const [hashMatches,operationMatches,orderPayments,oldPayment] = await Promise.all([
    db.collection('fp_transactions').where('comprobanteHashes','array-contains',p.sha256).select('tenant_id').limit(3).get(),
    db.collection('fp_transactions').where('operationNumber','==',p.operationNumber).select('tenant_id','operationNumber','date','fecha','createdAtLocal','accountId').limit(31).get(),
    db.collection('fp_transactions').where('sourcePedidoId','in',ids).select('tenant_id','operationNumber','nroOperacion','date','fecha','createdAtLocal','accountId','comprobanteHashes','comprobanteUrl').limit(51).get(),
    db.collection('fp_transactions').doc(refs[0]).get(),
  ]);
  requireThat(!oldPayment.exists,'duplicate_legacy_receipt',409);
  requireThat(!hashMatches.docs.some(d=>owned(d.data())) && !operationMatches.docs.some(d=>owned(d.data()) && sameOperation(d.data(),p)), 'duplicate_receipt',409);
  requireThat(hashMatches.size<3 && operationMatches.size<31 && orderPayments.size<51,'history_requires_review',409);
  const history=order.cobranza?.historialPagos || [];
  const proofUrls=new Set();
  for(const row of [...history,...orderPayments.docs.filter(d=>owned(d.data())).map(d=>d.data())]) {
    requireThat(!sameOperation(row,p) && !(row.comprobanteHashes || []).includes(p.sha256),'duplicate_receipt',409);
    if(row.comprobanteUrl && !row.comprobanteHashes?.length) proofUrls.add(row.comprobanteUrl);
  }
  for(const row of order.comprobantesPago || []) { const url=typeof row==='string'?row:row?.url; if(url)proofUrls.add(url); }
  return [...proofUrls];
}
async function checkLegacyOriginals(bucket,urls,p) {
  requireThat(urls.length<=10,'legacy_receipts_require_review',409);
  for(const value of urls) {
    let url; try { url=new URL(value); } catch { throw new ReceiptError('legacy_receipts_require_review'); }
    const prefix='/v0/b/'+bucket.name+'/o/';
    requireThat(url.protocol==='https:' && url.hostname==='firebasestorage.googleapis.com' && url.pathname.startsWith(prefix),'legacy_receipts_require_review',409);
    const file=bucket.file(decodeURIComponent(url.pathname.slice(prefix.length)));
    const [meta]=await file.getMetadata();
    requireThat(Number(meta.size)>0 && Number(meta.size)<=5*1024*1024,'legacy_receipts_require_review',409);
    const [bytes]=await file.download();
    requireThat(hash(bytes)!==p.sha256,'duplicate_legacy_receipt',409);
  }
}
function responseFor(p,paymentId,result,proof,status='registered') {
  return {ok:true,status,paymentId,orderId:p.orderId,receiptKey:p.receiptKey,amount:p.amount,
    orderAmount:result.orderAmount,deliveryAmount:result.deliveryAmount,debtAfter:result.debtAfter,receiptUrl:proof.url,receiptPath:proof.path};
}
function createService({db,bucket,FieldValue,now=()=>new Date()}) {
  return async p => {
    if(p.action==='accounts') {
      const [snapshot]=await db.getAll(configRef(db),{fieldMask:['accounts']});
      return {ok:true,accounts:accountsFrom(snapshot).map(a=>({id:String(a.id),name:String(a.name || a.nombre || a.id),currency:'PEN'}))};
    }
    const reqRef=requestRef(db,p.receiptKey);
    if(p.action==='status') {
      const row=await reqRef.get(); return row.exists ? {...row.data().result,status:'already_registered'} : {ok:true,status:'not_registered'};
    }
    const prior=await reqRef.get();
    if(prior.exists) {
      requireThat(prior.data().fingerprint===p.fingerprint,'receipt_key_conflict',409);
      return {...prior.data().result,status:'already_registered'};
    }
    const orderRef=db.collection('pedidos').doc(p.orderId);
    const [orderSnap,accountSnap]=await Promise.all([
      db.getAll(orderRef,{fieldMask:[...ORDER_FIELDS,'comprobantesPago']}).then(rows=>rows[0]),
      db.getAll(configRef(db),{fieldMask:['accounts']}).then(rows=>rows[0]),
    ]);
    requireThat(orderSnap.exists,'order_not_found',404);
    const order=orderSnap.data(), account=selectedAccount(accountSnap,p.accountId), amounts=validateOrder(order,p);
    const version=orderVersion(orderSnap);
    if(p.action==='preview') return {ok:true,status:'preview',orderId:p.orderId,orderVersion:version,
      customerName:String(order.clienteNombre||''),numeroPedido:String(order.numeroPedido||p.orderId),account:{id:p.accountId,name:String(account.name||account.nombre||p.accountId)},...amounts};
    requireThat(version===p.expectedOrderVersion,'order_changed_preview_again',409);
    const proofUrls=await checkExistingPayments(db,p,order);
    await checkLegacyOriginals(bucket,proofUrls,p);
    const proof=await archiveOriginal(bucket,p), paymentId='cobro_kenta_'+hash(p.receiptKey);
    const movementRef=db.collection('fp_transactions').doc(paymentId);
    const proofRef=db.collection('comprobantes_pago').doc(paymentId);
    const keys=claimRefs(db,p);
    return db.runTransaction(async tx=>{
      const previous=await tx.get(reqRef);
      if(previous.exists) {
        requireThat(previous.data().fingerprint===p.fingerprint,'receipt_key_conflict',409);
        return {...previous.data().result,status:'already_registered'};
      }
      const fresh=await tx.get(orderRef);
      const freshAccounts=await tx.get(configRef(db));
      const flags=await tx.get(db.collection('configuracion').doc('featureFlags'));
      const movement=await tx.get(movementRef), storedProof=await tx.get(proofRef);
      const claims=[]; for(const ref of keys) claims.push(await tx.get(ref));
      requireThat(fresh.exists && orderVersion(fresh)===p.expectedOrderVersion,'order_changed_preview_again',409);
      selectedAccount(freshAccounts,p.accountId);
      requireThat(!movement.exists && !storedProof.exists,'payment_requires_reconciliation',409);
      requireThat(!claims.some(c=>c.exists),'duplicate_receipt',409);
      const orderNow=fresh.data();
      const noLima=flags.exists ? flags.data().cobranzaLimaSinAutoHabilitar!==false : true;
      const result=plan(orderNow,p,paymentId,proof,now(),erp.permiteAutoHabilitado(orderNow,noLima));
      const response=responseFor(p,paymentId,result,proof);
      tx.update(orderRef,{...result.updates,updatedAt:FieldValue.serverTimestamp()});
      tx.create(movementRef,result.movimiento);
      tx.create(proofRef,{paymentId,pedidoId:p.orderId,numeroPedido:String(orderNow.numeroPedido||p.orderId),url:proof.url,storagePath:proof.path,
        contentType:p.mime,sha256:p.sha256,monto:p.amount,nroOperacion:p.operationNumber,fecha:p.paymentDate,registradoPor:p.actor.email||p.actor.name,createdAt:now().toISOString(),tenant_id:'con-amor'});
      tx.create(reqRef,{fingerprint:p.fingerprint,result:response,actor:p.actor,lineKey:p.lineKey,createdAt:FieldValue.serverTimestamp()});
      for(const ref of keys) tx.create(ref,{paymentId,receiptKey:p.receiptKey,source:'kenta',createdAt:FieldValue.serverTimestamp()});
      return response;
    });
  };
}
module.exports={createService,archiveOriginal,claimRefs,accountsFrom,selectedAccount,checkExistingPayments,checkLegacyOriginals};
