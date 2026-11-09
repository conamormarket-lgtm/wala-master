'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const enabled=process.env.FIRESTORE_EMULATOR_HOST==='127.0.0.1:8091';
test('Firestore emulator: atomic concurrent confirmations and cross-order proof claims', {skip:!enabled}, async()=>{
 const admin=require('firebase-admin');
 const {parse,hash,orderVersion}=require('../kentaReceiptContract');
 const {createService}=require('../kentaReceiptService');
 const app=admin.initializeApp({projectId:'demo-kenta-receipts'},'receipt-isolated-'+Date.now());
 const db=app.firestore(),suffix=String(Date.now()),id='test_'+suffix,raw=Buffer.from('%PDF-1.4\nfixture '+suffix);
 const files=new Map(),bucket={name:'fake-private-bucket',file:path=>({
  save:async(bytes,opts)=>{if(files.has(path))throw Object.assign(Error('exists'),{code:412});files.set(path,{bytes,metadata:opts.metadata.metadata,size:bytes.length});},
  getMetadata:async()=>[{metadata:files.get(path).metadata,size:files.get(path).size}],
 })};
 const service=createService({db,bucket,FieldValue:admin.firestore.FieldValue});
 const order={tenant_id:'con-amor',numeroPedido:id,clienteContacto:'999888777',clienteNombre:'Emulator',estadoGeneral:'En Produccion',montoTotal:100,montoAdelanto:20,tipoEnvio:'agencia',cobranza:{}};
 await db.collection('fp_config').doc('general').set({accounts:[{id:'test-account',name:'Emulator only',currency:'PEN'}]});
 await db.collection('pedidos').doc(id).set(order);
 const snap=await db.collection('pedidos').doc(id).get();
 const input={action:'confirm',tenant:'wala',sourceTenant:'con-amor',lineKey:'test',receiptKey:'kenta:wala:'+suffix,
  orderId:id,customerPhone:'999888777',amount:'80.00',currency:'PEN',paymentDate:new Date(Date.now()-5*3600000).toISOString().slice(0,10),operationNumber:'TEST'+suffix,
  accountId:'test-account',actor:{kentaUserId:1,name:'Emulator'},original:{sha256:hash(raw),mime:'application/pdf',base64:raw.toString('base64')},expectedOrderVersion:orderVersion(snap)};
 const p=parse(input,{owner:'con-amor',lineKeys:['test']});
 const results=await Promise.all([service(p),service(p)]);
 assert.deepEqual(new Set(results.map(r=>r.status)),new Set(['registered','already_registered']));
 assert.equal((await db.collection('pedidos').doc(id).get()).data().cobranza.historialPagos.length,1);
 assert.equal((await db.collection('fp_transactions').doc(results[0].paymentId).get()).data().amount,80);
 const otherId=id+'_other';await db.collection('pedidos').doc(otherId).set({...order,numeroPedido:otherId});
 const other=parse({...input,orderId:otherId,receiptKey:'kenta:wala:'+String(Number(suffix)+1),expectedOrderVersion:orderVersion(await db.collection('pedidos').doc(otherId).get())},{owner:'con-amor',lineKeys:['test']});
 await assert.rejects(service(other),/duplicate_receipt/);
 assert.equal((await db.collection('pedidos').doc(otherId).get()).data().cobranza.historialPagos,undefined);
 assert.equal(files.size,1);
 await app.delete();
});
