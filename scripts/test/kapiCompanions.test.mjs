import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { KAPI_PROFILE, normalizeCompanionConfig, profilesFromBrands, profileForPath, publicProfile, scopedCatalog, selectCompanion } from '../../functions/kapi/companions.mjs';
import { createAssistant, validInput } from '../../functions/kapi/assistant.mjs';
import { sealSession, openSession } from '../../functions/kapi/sessionToken.mjs';
const profiles = profilesFromBrands([{id:'lumi-id',name:'Lumi',slug:'lumi'}]);
const lumi = profiles[1];
test('brand profiles default only Lumi, honor disable and omit orientation from public API payloads', () => {
  assert.equal(profiles.length,2); assert.equal(lumi.assetPack,'lumi');
  assert.equal(profilesFromBrands([{id:'other',name:'Other'}]).length,1);
  assert.equal(profilesFromBrands([{id:'lumi-id',name:'Lumi',companion:{enabled:false}}]).length,1);
  assert.equal(publicProfile(lumi).instructions,undefined);
  assert.equal(profileForPath(profiles,'/lumi').id,lumi.id);
  assert.equal(profileForPath(profiles,'/admin').id,'kapi');
  assert.equal(profilesFromBrands([{id:'x',name:'New',companion:{enabled:true,name:'Test',specialty:'Books',assetPack:'custom'}}]).length,1);
  const config = normalizeCompanionConfig({color:'url(evil)',portrait:'javascript:alert(1)',animations:{walk:{src:'http://unsafe/1.webp'}}});
  assert.equal(config.color,'#7741b2');assert.equal(config.portrait,'');assert.deepEqual(config.animations,{});
});

test('profile configuration stays identical across isolated Vercel and Functions builds', async () => {
  const client = await readFile(new URL('../../src/components/kapi-local/companionProfiles.mjs', import.meta.url), 'utf8');
  const server = await readFile(new URL('../../functions/kapi/companionProfiles.mjs', import.meta.url), 'utf8');
  assert.equal(client, server);
  for (const file of ['src/components/kapi-local/companions.mjs','src/services/brands.js','src/componentes/kit/paginas/admin/Marcas.jsx','src/componentes/kit/paginas/admin/CamposMascota.jsx']) {
    assert.doesNotMatch(await readFile(new URL('../../' + file, import.meta.url), 'utf8'), /from\s+['"][^'"]*functions\//);
  }
});
test('semantic router receives history and specialties and cannot select invented or disabled roles', async () => {
  const base={profiles,session:{companionId:lumi.id},message:'¿Y otro por menos?',history:[{role:'user',content:'Tengo 100 soles'}],pathname:'/',currentProduct:null};
  const result=await selectCompanion({...base,select:async(schema,payload)=>{
    assert.deepEqual(schema.properties.companion_id.enum,['kapi',lumi.id]);
    assert.equal(payload.current,lumi.id);assert.match(payload.profiles[1].specialty,/Skincare/);
    assert.match(payload.history[0].content,/100/);return {companion_id:'invented'};
  }});
  assert.equal(result.id,lumi.id);
  const routeOnly={...lumi,byTopic:false};
  assert.equal((await selectCompanion({...base,profiles:[KAPI_PROFILE,routeOnly],session:{},select:async()=>({companion_id:lumi.id})})).id,'kapi');
  assert.equal((await selectCompanion({...base,pathname:'/lumi',profiles:[KAPI_PROFILE,routeOnly],session:{},select:async()=>({companion_id:lumi.id})})).id,lumi.id);
  assert.throws(()=>validInput({message:'Hola',pathname:'https://evil.example'}));
});
test('brand scope applies to discovery, direct IDs and final rereads', async () => {
  const products=[{id:'skin',brandId:'lumi-id'},{id:'gift',brandId:'other'}];
  const catalog={snapshot:async()=>({products,partial:false}),search:async()=>({products}),get:async id=>products.find(p=>p.id===id)};
  const scoped=scopedCatalog(catalog,lumi);
  assert.deepEqual((await scoped.snapshot()).products,[products[0]]);
  assert.deepEqual((await scoped.search({})).products,[products[0]]);
  assert.equal(await scoped.get('gift'),null);
  assert.equal((await scoped.get('skin')).id,'skin');
  assert.equal(scopedCatalog(catalog,KAPI_PROFILE),catalog);
});

test('entering a brand establishes its specialist for greetings without trapping explicit topic changes', async () => {
  const base={profiles,message:'Hola, ¿me ayudas a empezar?',history:[],pathname:'/lumi',currentProduct:null};
  const first=await selectCompanion({...base,session:{companionId:'kapi',pathname:'/'},select:async(_schema,payload)=>{
    assert.equal(payload.current,lumi.id);return {companion_id:lumi.id};
  }});
  assert.equal(first.id,lumi.id);
  const changed=await selectCompanion({...base,message:'Ahora busco un juguete',session:{companionId:lumi.id,pathname:'/lumi'},select:async()=>({companion_id:'kapi'})});
  assert.equal(changed.id,'kapi');
  await selectCompanion({...base,session:{companionId:'kapi',pathname:'/lumi'},select:async(_schema,payload)=>{
    assert.equal(payload.current,'kapi');return {companion_id:'kapi'};
  }});
});
test('handoffs preserve the same conversation and encrypted specialist state across server instances', async () => {
  let saved, selected=lumi.id, charges=0;
  const catalog={companions:async()=>profiles,get:async()=>null,search:async()=>({products:[]}),status:()=>({source:'test'})};
  const fetchImpl=async(_url,options)=>{
    const request=JSON.parse(options.body);
    if(request.text.format.name==='companion_route') return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({companion_id:selected})}]}]});
    if(selected===lumi.id)assert.match(request.instructions,/Lumita/);
    else {assert.match(request.instructions,/Eres Kapi/);assert.ok(request.input.some(m=>m.role==='user'&&m.content==='Skincare con 100 soles'));}
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({in_scope:true,message:'Seguimos con tus preferencias y presupuesto.',gesture:'talk',guide:null,product_ids:[],comparison:null})}]}]});
  };
  const options={catalog,getKey:async()=>'test-key',fetchImpl,semanticSearch:false,charge:async()=>charges++,onSession:(id,session)=>{saved={id,session};}};
  const first=await createAssistant(options).chat({message:'Skincare con 100 soles'},new AbortController().signal);
  assert.equal(first.companion.id,lumi.id);assert.equal(first.handoff.from,'kapi');assert.ok(first.handoff.greeting);
  const restored=openSession(sealSession(saved,'secret'),'secret');
  assert.equal(restored.session.companionId,lumi.id);assert.ok(restored.session.introduced.includes(lumi.id));
  selected='kapi';
  const next=await createAssistant({...options,initialSession:restored}).chat({message:'Ahora busco un regalo geek',sessionId:first.sessionId},new AbortController().signal);
  assert.equal(next.sessionId,first.sessionId);assert.equal(next.handoff.from,lumi.id);assert.equal(next.companion.id,'kapi');
  assert.equal(charges,4,'routing and answering both obey the shared provider budget');
});
