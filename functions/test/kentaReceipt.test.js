'use strict';
const test=require('node:test'), assert=require('node:assert/strict'),crypto=require('node:crypto');
const contract=require('../kentaReceiptContract'), {plan}=require('../kentaReceiptPlan');
const {createService,claimRefs,archiveOriginal}=require('../kentaReceiptService');
const {createHandler}=require('../kentaReceiptHandler');
const now=new Date('2026-11-09T20:00:00Z'), config={owner:'con-amor',lineKeys:['qr_test']};
const raw=Buffer.from('%PDF-1.4\noriginal voucher preserved'), sha=contract.hash(raw);
const body={action:'confirm',tenant:'wala',sourceTenant:'con-amor',lineKey:'qr_test',receiptKey:'kenta:wala:123',
 orderId:'001',customerPhone:'999888777',amount:'80.00',currency:'PEN',paymentDate:'2026-11-09',operationNumber:'OP-123',accountId:'acc_1',
 actor:{kentaUserId:131,name:'Operador',email:'operator@example.test'},original:{sha256:sha,mime:'application/pdf',base64:raw.toString('base64')},expectedOrderVersion:'1794254400000000000'};
const order={tenant_id:'con-amor',numeroPedido:'1',clienteContacto:'999888777',clienteNombre:'Prueba',estadoGeneral:'En Produccion',montoTotal:100,montoAdelanto:20,tipoEnvio:'agencia',cobranza:{}};
const parsed=extra=>contract.parse({...body,...extra},config,now);
const proof={url:'https://example.test/original',path:'private/original'};
test('HMAC authenticates raw bytes, rejects changed body/replay without IO',()=>{
 const data=Buffer.from(JSON.stringify(body)), timestamp=String(now.getTime()/1000),secret='test-local-only';
 const headers={'x-wala-timestamp':timestamp,'x-wala-signature':crypto.createHmac('sha256',secret).update(timestamp+'.').update(data).digest('hex')};
 contract.authenticate({rawBody:data,get:k=>headers[k]},secret,now.getTime());
 assert.throws(()=>contract.authenticate({rawBody:Buffer.from('{}'),get:k=>headers[k]},secret,now.getTime()),/invalid_signature/);
 assert.throws(()=>contract.authenticate({rawBody:data,get:k=>headers[k]},secret,now.getTime()+301000),/invalid_signature/);
});
test('scope, exact order, amount, human, date and original fail closed',()=>{
 for(const change of [{tenant:'other'},{lineKey:'qr_other'},{sourceTenant:'other'},{orderId:'../1'},{amount:'NaN'},{amount:'1.001'},{currency:'USD'},
 {paymentDate:'2026-02-30'},{paymentDate:'2027-01-01'},{actor:{kentaUserId:0,name:'Bot'}},{original:{...body.original,sha256:'0'.repeat(64)}},
 {original:{...body.original,mime:'image/jpeg'}},{expectedOrderVersion:''}]) assert.throws(()=>parsed(change));
 assert.equal(parsed().customerPhone,'51999888777'); assert.equal(parsed().operationNumber,'OP123');
 assert.equal(parsed().bytes.compare(raw),0);
});
test('a human payment preserves original, history and pending financial status',()=>{
 const r=plan(order,parsed(), 'tx',proof,now,true);
 assert.equal(r.debtAfter,0);assert.equal(r.movimiento.amount,80);assert.equal(r.movimiento.status,'pending');
 assert.equal(r.movimiento.verified,false);assert.equal(r.movimiento.comprobanteUrl,proof.url);
 assert.equal(r.updates.cobranza.estado,'Habilitado');assert.equal(r.updates.cobranza.historialPagos[0].paymentId,'tx');
 assert.equal(order.cobranza.historialPagos,undefined);
});
test('partial payment and legacy balances never lose existing entries',()=>{
 const before={...order,cobranza:{pago1:10,pago2:5,arbitrary:'keep'}};
 const r=plan(before,parsed({amount:'20'}),'tx',proof,now,false);
 assert.equal(r.debtAfter,45);assert.equal(r.updates.cobranza.historialPagos.length,3);assert.equal(r.updates.cobranza.arbitrary,'keep');
 assert.equal(r.updates.cobranza.estado,'Abonado');
});
test('deposit includes exactly the required delivery, without silently adding money',()=>{
 const before={...order,tipoEnvio:'delivery',cobranza:{delivery:[{monto:10,integrarEnRestante:true}]}};
 assert.throws(()=>plan(before,parsed(),'tx',proof,now,false),/include_remaining_delivery/);
 const r=plan(before,parsed({amount:'90'}),'tx',proof,now,false);
 assert.equal(r.orderAmount,80);assert.equal(r.deliveryAmount,10);assert.equal(r.movimiento.amount,90);
 assert.equal(r.updates.cobranza.delivery[0].paymentId,'tx');assert.equal(r.updates.cobranza.estado,'Abonado');
});
test('wrong owner/phone, annulment, overpayment and duplicate history rejected',()=>{
 for(const change of [{tenant_id:'other'},{clienteContacto:'988777666'},{estadoGeneral:'Anulado'},{deletedAt:'x'},{montoAdelanto:100},
 {cobranza:{historialPagos:[{monto:1,comprobanteHashes:[sha]}]}}]) assert.throws(()=>plan({...order,...change},parsed(),'tx',proof,now));
 assert.throws(()=>plan(order,parsed({amount:'81'}),'tx',proof,now),/amount_exceeds_balance/);
});
function fakeDb() {
 const docs=new Map([['pedidos/001',structuredClone(order)],['fp_config/general',{accounts:[{id:'acc_1',name:'Cuenta',currency:'PEN'}]}]]);
 let serial=Promise.resolve(),reads=0,writes=0;
 const snapshot=path=>({exists:docs.has(path),id:path.split('/').at(-1),data:()=>structuredClone(docs.get(path)),updateTime:{seconds:1794254400,nanoseconds:0}});
 const reference=path=>({path,collection:name=>collection(path+'/'+name),get:async()=>{reads++;return snapshot(path);}});
 const collection=path=>({doc:id=>reference(path+'/'+id),where:(key,op,value)=>query(path,key,op,value)});
 const query=(path,key,op,value)=>({select:()=>query(path,key,op,value),limit:n=>({get:async()=>{
  const hits=[...docs].filter(([k,v])=>k.startsWith(path+'/')&&(op==='array-contains'?(v[key]||[]).includes(value):op==='in'?value.includes(v[key]):v[key]===value)).slice(0,n).map(([k])=>snapshot(k));reads+=Math.max(1,hits.length);return {docs:hits,size:hits.length};
 }})});
 return {docs,collection,getAll:async(...args)=>Promise.all(args.filter(x=>x.path).map(x=>x.get())),
  stats:()=>({reads,writes}),runTransaction:fn=>{ const run=serial.then(async()=>{
   const pending=[];const result=await fn({get:r=>r.get(),update:(r,v)=>pending.push(()=>docs.set(r.path,{...docs.get(r.path),...v})),
    create:(r,v)=>{if(docs.has(r.path))throw Error('already exists');pending.push(()=>docs.set(r.path,v));}});
   pending.forEach(f=>{f();writes++;});return result;
  });serial=run.catch(()=>{});return run;}};
}
function fakeBucket(){const files=new Map();return {name:'test-bucket',files,file:path=>({
 save:async(bytes,opts)=>{if(files.has(path))throw Object.assign(Error('exists'),{code:412});files.set(path,{bytes:Buffer.from(bytes),metadata:opts.metadata.metadata,size:bytes.length});},
 getMetadata:async()=>[{metadata:files.get(path).metadata,size:files.get(path).size}],download:async()=>[files.get(path).bytes],
})};}
function service(){const db=fakeDb(),bucket=fakeBucket();return {db,bucket,run:createService({db,bucket,FieldValue:{serverTimestamp:()=>now.toISOString()},now:()=>now})};}
test('preview is read-only and exact-order; accounts only returns enabled PEN',async()=>{
 const s=service();const preview=await s.run(parsed({action:'preview'}));
 assert.equal(preview.debtAfter,0);assert.equal(preview.orderVersion,body.expectedOrderVersion);assert.equal(s.db.stats().writes,0);assert.equal(s.bucket.files.size,0);
 assert.deepEqual((await s.run({action:'accounts'})).accounts,[{id:'acc_1',name:'Cuenta',currency:'PEN'}]);
});
test('concurrent confirms and timeout replay create one movement and preserve identical bytes',async()=>{
 const s=service(),p=parsed();const [a,b]=await Promise.all([s.run(p),s.run(p)]);
 assert.deepEqual(new Set([a.status,b.status]),new Set(['registered','already_registered']));
 assert.equal([...s.db.docs.keys()].filter(k=>k.startsWith('fp_transactions/')).length,1);
 assert.equal(s.db.docs.get('pedidos/001').cobranza.historialPagos.length,1);
 assert.equal([...s.bucket.files.values()][0].bytes.compare(raw),0);
 assert.equal((await s.run({action:'status',receiptKey:p.receiptKey})).status,'already_registered');
 const writes=s.db.stats().writes;assert.equal((await s.run(p)).status,'already_registered');assert.equal(s.db.stats().writes,writes);
 await assert.rejects(s.run(parsed({amount:'79'})),/receipt_key_conflict/);
});
test('changed order version, removed account and shared CRM claims cannot create payment',async()=>{
 for(const cause of ['version','account','claim']){
  const s=service(),p=parsed();if(cause==='version')p.expectedOrderVersion='1794254400000000001';
  if(cause==='account')s.db.docs.set('fp_config/general',{accounts:[]});
  if(cause==='claim')s.db.docs.set(claimRefs(s.db,p)[1].path,{case_id:'old-crm'});
  await assert.rejects(s.run(p));assert.equal([...s.db.docs.keys()].filter(k=>k.startsWith('fp_transactions/')).length,0);
 }
});
test('failed archive never changes financial state; archive cannot overwrite original',async()=>{
 const s=service();s.bucket.file=()=>({save:async()=>{throw Error('storage down');}});
 await assert.rejects(s.run(parsed()),/storage down/);assert.equal(s.db.stats().writes,0);
 const bucket=fakeBucket(),p=parsed();const a=await archiveOriginal(bucket,p),b=await archiveOriginal(bucket,p);assert.equal(a.url,b.url);assert.equal(bucket.files.size,1);
});
test('forwarded proof on another order races safely through global claims',async()=>{
 const s=service();s.db.docs.set('pedidos/002',{...structuredClone(order),numeroPedido:'2'});
 const results=await Promise.allSettled([s.run(parsed()),s.run(parsed({orderId:'002',receiptKey:'kenta:wala:124'}))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 assert.equal([...s.db.docs.keys()].filter(k=>k.startsWith('fp_transactions/')).length,1);
});
test('unauthorized HTTP calls never construct/use a database service',async()=>{
 let calls=0; const handler=createHandler({getSecret:()=>'',getConfig:()=>config,service:async()=>{calls++;},logger:{error(){},info(){}}});
 const res={set(){},status(n){this.code=n;return this;},json(x){this.body=x;return this;}};
 await handler({method:'POST'},res);assert.equal(res.code,503);assert.equal(calls,0);
});
