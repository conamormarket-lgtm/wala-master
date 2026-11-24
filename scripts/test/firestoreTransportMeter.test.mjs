import test from 'node:test';
import assert from 'node:assert/strict';
import { installFirestoreTransportMeter } from '../../src/observability/firestore-transport-meter.mjs';

const url = 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?database=projects/test-project/databases/(default)&key=not-logged';
function fixture(fetch, customObserve) {
  class XHR extends EventTarget {
    responseType = ''; responseText = ''; status = 200;
    open(...args) { this.args = args; this.responseText = ''; return 'open-result'; }
    send(body) { this.body = body; return 'send-result'; }
    progress(text) { this.responseText = text; this.dispatchEvent(new Event('progress')); }
    finish() { this.dispatchEvent(new Event('loadend')); }
  }
  const events = [], realm = { XMLHttpRequest: XHR, fetch }, state = { enabled: true };
  const options = { enabled: () => state.enabled, screen: () => '/test', observe: customObserve || ((scope, operation, counts) => events.push({scope, operation, counts})) };
  const meter = installFirestoreTransportMeter(options, realm);
  return { realm, events, meter, state, options };
}
test('XHR counts UTF-8 progressive bodies once, preserves arguments and supports request reuse', () => {
  const { realm, events, meter, options } = fixture();
  assert.equal(installFirestoreTransportMeter(options, realm), meter);
  const xhr = new realm.XMLHttpRequest(), body = new Uint8Array([1,2]);
  assert.equal(xhr.open('POST',url,true), 'open-result');
  assert.equal(xhr.send(body), 'send-result'); assert.equal(xhr.body,body);
  assert.deepEqual(xhr.args,['POST',url,true]);
  xhr.progress('á\ud83d'); xhr.progress('á😀'); xhr.progress('á😀'); xhr.finish(); xhr.finish();
  assert.deepEqual(meter.snapshot(), {transportRequests:1,transportResponseBytes:6,transportResponses:1});
  xhr.open('GET',url); xhr.send(); xhr.progress('abc'); xhr.status=0; xhr.finish();
  assert.equal(meter.snapshot().transportResponseBytes,9);
  assert.equal(meter.snapshot().transportResponses,2);
  assert.equal(meter.snapshot().transportFailedResponses,1);
  assert.ok(events.every(e=>e.scope.project==='test-project'&&e.scope.database==='(default)'&&e.operation==='http.Listen'));
  assert.ok(!JSON.stringify(events).includes('not-logged'));
});
test('unrelated requests, cache-only work and disabled telemetry produce no events', () => {
  const { realm, events, state } = fixture(); const xhr = new realm.XMLHttpRequest();
  xhr.open('GET','https://example.com/projects/test/databases/private');xhr.send();xhr.progress('private');xhr.finish();
  state.enabled=false;
  xhr.open('GET',url);xhr.send();xhr.progress('abc');xhr.finish();
  assert.equal(events.length,0);
});
test('observer exceptions do not alter normal XHR calls and original errors propagate', () => {
  const { realm, options }=fixture(undefined,()=>{throw Error('diagnostic');});
  const xhr=new realm.XMLHttpRequest();xhr.open('GET',url);assert.equal(xhr.send(),'send-result');xhr.progress('data');xhr.finish();
  const error=new Error('business network error');
  class Broken { open(){throw error} send(){throw error} }
  const other={XMLHttpRequest:Broken};installFirestoreTransportMeter(options,other);
  assert.throws(()=>new other.XMLHttpRequest().open('GET',url),e=>e===error);
  assert.throws(()=>new other.XMLHttpRequest().send(),e=>e===error);
});
test('fetch returns the identical promise/response, measures bytes once and never issues another request', async () => {
  const response = new Response('á😀'), pending=Promise.resolve(response), calls=[];
  const f=fixture(function(...args){calls.push({self:this,args});return pending;});
  const request=new Request('https://firestore.googleapis.com/v1/projects/test-project/databases/named-db/documents:runQuery');
  const init={method:'POST',body:'query'};
  const result=f.realm.fetch(request,init);assert.equal(result,pending);assert.equal(await result,response);
  assert.equal(await response.text(),'á😀');
  for(let i=0;i<30&&!f.meter.snapshot().transportResponses;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.meter.snapshot(),{transportRequests:1,transportResponseBytes:6,transportResponses:1});
  assert.equal(calls.length,1);assert.equal(calls[0].self,f.realm);assert.deepEqual(calls[0].args,[request,init]);
  assert.equal(f.events[0].scope.database,'named-db');assert.equal(f.events[0].operation,'http.runQuery');
});
test('fetch rejection and unreadable diagnostic clones preserve the business result', async () => {
  const error=new Error('offline');const f=fixture(()=>Promise.reject(error));
  await assert.rejects(f.realm.fetch(url),e=>e===error);
  assert.equal(f.meter.snapshot().transportFailedResponses,1);
  const response={clone(){throw new Error('already consumed')},ok:true};
  const g=fixture(()=>Promise.resolve(response));assert.equal(await g.realm.fetch(url),response);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(g.meter.snapshot().transportMeasurementErrors,1);
});
