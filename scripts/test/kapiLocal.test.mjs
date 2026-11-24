import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog, mapProduct, rankProducts } from '../kapi-local/catalog.mjs';
import { createAssistant as createRealAssistant, validateReply, validInput } from '../kapi-local/assistant.mjs';
import { allowedRequest } from '../kapi-local/plugin.mjs';
import { askKapi, localGesture } from '../../src/components/kapi-local/chatClient.mjs';
import { readConversation, saveConversation, localProductPath, productIdFromPath } from '../../src/components/kapi-local/session.mjs';

const raw = { id: 'product-1', name: 'Polo Naruto', price: 70, salePrice: 0, inStock: 3, visible: true, tags: ['anime'] };
const product = mapProduct(raw);
const reply = (patch = {}) => ({ in_scope: true, message: 'Encontré esta opción que encaja con tus gustos.', gesture: 'talk', guide: null, product_ids: ['product-1'], ...patch });
const final = value => ({ status: 'completed', usage: { input_tokens: 20, output_tokens: 10 }, output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
const call = (name, args) => ({ status: 'completed', output: [{ type: 'function_call', name, call_id: 'call-1', arguments: JSON.stringify(args) }] });
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const catalogStub = { search: async () => ({ products: [product], partial: false }), get: async () => product, status: () => ({ source: 'test' }) };
// Tool-loop tests stub retrieval; semantic retrieval has its own integration tests.
const createAssistant = options => createRealAssistant({ ...options, semanticSearch: false });

test('public catalog excludes hidden, deleted, replaced and unpublished customization products', () => {
  for (const patch of [{ visible: false }, { deleted: true }, { reemplazadoPor: 'new' }, { esPrendaBase: true }, { esComboCrear: true, enTienda: true }]) {
    assert.equal(mapProduct({ ...raw, ...patch }), null);
  }
  assert.ok(mapProduct({ ...raw, esPrendaBase: true, enTienda: true }));
  assert.ok(mapProduct({ ...raw, esComboCrear: true, visible: false, enTienda: true, comboCrear: { publicado: true } }));
});
test('catalog applies canonical sale pricing, strips HTML and only exports public attributes', () => {
  const p = mapProduct({ ...raw, salePrice: 40, cost: 10, adminNotes: 'private', description: '<b>Algodón</b>', mainImage: 'javascript:alert(1)' });
  assert.equal(p.price, 40); assert.equal(product.price, 70); assert.equal(p.description, 'Algodón');
  assert.equal(p.image, ''); assert.equal(p.cost, undefined); assert.equal(p.adminNotes, undefined);
  assert.equal(mapProduct({ ...raw, price: undefined }).price, null);
  assert.equal(mapProduct({ ...raw, customizable: false, customizationViews: [{ id: 'front' }] }).customizable, true);
});
test('recommendations enforce budget, availability and all meaningful terms', () => {
  const items = [product, mapProduct({ ...raw, id: 'expensive', price: 120 }), mapProduct({ ...raw, id: 'out', inStock: 0 }), mapProduct({ ...raw, id: 'other', name: 'Polo Stitch' })];
  assert.deepEqual(rankProducts(items, { query: 'polo Naruto', max_price: 80 }).map(p => p.id), ['product-1']);
  assert.deepEqual(rankProducts(items, { query: 'Naruto', max_price: 50 }), []);
});

test('catalog bounds queries, shares concurrent load and refreshes final candidates', async () => {
  let queries = 0, reads = 0;
  const doc = { name: 'projects/test/databases/(default)/documents/productos_wala/product-1', fields: {
    name: { stringValue: 'Polo Naruto' }, price: { integerValue: '70' }, inStock: { integerValue: '3' }, visible: { booleanValue: true },
  } };
  const catalog = createCatalog({ projectId: 'test', limit: 2, fetchImpl: async (url, options) => {
    if (url.endsWith(':runQuery')) {
      queries++; const q = JSON.parse(options.body).structuredQuery;
      assert.ok(q.limit <= 200);
      return json(q.from[0].collectionId === 'productos_wala' ? [{ document: doc }] : []);
    }
    reads++; return json({ ...doc, fields: { ...doc.fields, price: { integerValue: '90' } } });
  } });
  await Promise.all([catalog.snapshot(), catalog.snapshot()]);
  assert.equal(queries, 5);
  const result = await catalog.search({ query: 'Naruto', max_price: 80 });
  assert.equal(reads, 1); assert.equal(result.products.length, 0);
  assert.equal(await catalog.get('../users/private'), null);
});
test('assistant rejects ungrounded IDs, arbitrary gestures and DOM selectors', () => {
  for (const patch of [{ product_ids: ['invented'] }, { gesture: 'run-javascript' }, { guide: '#pay-now' }]) {
    assert.throws(() => validateReply(reply(patch), new Map([['product-1', product]])));
  }
  assert.throws(() => validInput({ message: 'x'.repeat(1001) }));
  assert.throws(() => validInput({ message: 'hola', sessionId: '../other' }));
});
test('AI tool loop and session follow-up use grounded IDs, private key and no provider storage', async () => {
  const requests = [];
  const responses = [call('search_catalog', { query: 'Naruto', min_price: null, max_price: 80 }), final(reply()),
    call('get_product', { id: 'product-1' }), final(reply({ message: 'Puedes revisar sus opciones aquí.', product_ids: [] }))];
  const assistant = createAssistant({ catalog: catalogStub, getKey: async () => 'test-only', fetchImpl: async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    const body = JSON.parse(options.body); assert.equal(body.store, false); requests.push(body);
    return json(responses.shift());
  } });
  const first = await assistant.chat({ message: 'Naruto hasta 80' }, new AbortController().signal);
  assert.equal(first.products[0].price, 70); assert.equal(first.usage.inputTokens, 20);
  const second = await assistant.chat({ message: 'Cuéntame sobre el primero', sessionId: first.sessionId }, new AbortController().signal);
  assert.equal(second.products[0].id, 'product-1');
  assert.ok(requests[2].input.some(item => item.role === 'assistant' && item.content.includes('product-1')));
  assert.ok(requests[1].input.some(item => item.type === 'function_call_output'));
  assert.equal(JSON.stringify(first).includes('test-only'), false);
});
test('unavailable products between model selection and rendering are removed', async () => {
  const responses = [call('search_catalog', { query: 'Naruto', min_price: null, max_price: null }), final(reply())];
  const assistant = createAssistant({ catalog: { ...catalogStub, get: async () => null }, getKey: async () => 'test-only', fetchImpl: async () => json(responses.shift()) });
  const response = await assistant.chat({ message: 'Naruto' }, new AbortController().signal);
  assert.deepEqual(response.products, []); assert.equal(response.gesture, 'confused');
});
test('a final price increase cannot escape the requested recommendation budget', async () => {
  const responses = [call('search_catalog', { query: 'Naruto', min_price: null, max_price: 80 }), final(reply())];
  const assistant = createAssistant({ catalog: { ...catalogStub, get: async () => ({ ...product, price: 100 }) },
    getKey: async () => 'test-only', fetchImpl: async () => json(responses.shift()) });
  const response = await assistant.chat({ message: 'Naruto máximo 80 soles' }, new AbortController().signal);
  assert.deepEqual(response.products, []); assert.match(response.message, /cambió de precio/);
});
test('provider errors expose a useful message without echoing credentials or raw errors', async () => {
  const assistant = createAssistant({ catalog: catalogStub, getKey: async () => 'test-only', fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'insufficient_quota', message: 'private diagnostic' } }), { status: 429 }) });
  await assert.rejects(assistant.chat({ message: 'hola' }, new AbortController().signal), error => error.code === 'quota' && !error.message.includes('private'));
});
test('cancelling a request prevents a late response and releases the session', async () => {
  const controller = new AbortController();
  const assistant = createAssistant({ catalog: catalogStub, getKey: async () => 'test-only', fetchImpl: async () => {
    controller.abort(); return json(final(reply({ product_ids: [] })));
  } });
  await assert.rejects(assistant.chat({ message: 'hola' }, controller.signal));
});
test('local API rejects non-local clients, foreign origins and DNS rebinding hosts', () => {
  const req = { headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(allowedRequest(req), true);
  for (const headers of [{ ...req.headers, origin: 'https://evil.example' }, { host: 'evil.example' }, { ...req.headers, 'sec-fetch-site': 'cross-site' }]) assert.equal(allowedRequest({ ...req, headers }), false);
  assert.equal(allowedRequest({ ...req, socket: { remoteAddress: '192.168.1.20' } }), false);
});
test('browser client uses only same-origin local API and preserves cancellation', async () => {
  const controller = new AbortController();
  await askKapi({ message: 'hola', sessionId: null, signal: controller.signal, fetchImpl: async (url, options) => {
    assert.equal(url, '/__kapi/chat'); assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.signal, controller.signal); assert.equal(options.headers['X-Kapi-Local'], '1');
    return json({ message: 'hola' });
  } });
});
test('simple mascot commands stay local without intercepting product questions', () => {
  assert.deepEqual(localGesture('Kapi, camina por favor'), { move: true });
  assert.equal(localGesture('Siéntate').gesture, 'sit');
  assert.equal(localGesture('Quiero comprar una silla para sentarme'), null);
  assert.equal(localGesture('Saluda y recomiéndame un polo'), null);
});

test('vertical movement commands stay local and leave catalog questions to the assistant', () => {
  for (const message of ['Sube', 'Kapi, sube un poco por favor', 'Muévete hacia arriba', 'más arriba']) {
    assert.deepEqual(localGesture(message), { move: true, direction: 'up' });
  }
  for (const message of ['Baja', 'Kapi, baja un poco', 'Camina hacia abajo', 'más abajo']) {
    assert.deepEqual(localGesture(message), { move: true, direction: 'down' });
  }
  for (const message of ['¿Baja de precio?', 'Sube mi presupuesto a 100 soles', 'Quiero el producto de arriba', 'Baja y recomienda un polo']) {
    assert.equal(localGesture(message), null);
  }
});

test('current product is verified server-side and replaces previous page context', async () => {
  const seen = [];
  const assistant = createAssistant({ catalog: { ...catalogStub, get: async id => ({ ...product, id, name: `Producto ${id}` }) },
    getKey: async () => 'test-only', fetchImpl: async (_url, options) => {
      const input = JSON.parse(options.body).input;
      seen.push(input.filter(m => m.role === 'developer'));
      return json(final(reply({ product_ids: [], message: 'Te explico la ficha que estás viendo.' })));
    } });
  const first = await assistant.chat({ message: 'Explícame este', currentProductId: 'product-1' }, new AbortController().signal);
  await assistant.chat({ message: '¿Y este?', sessionId: first.sessionId, currentProductId: 'product-2' }, new AbortController().signal);
  assert.equal(seen[1].length, 1);
  assert.match(seen[1][0].content, /Producto product-2/);
  assert.doesNotMatch(seen[1][0].content, /product-1/);
  assert.throws(() => validInput({ message: 'hola', currentProductId: '../users/private' }));
});

test('script requests and out-of-scope model output never render code or products', async () => {
  let requests = 0;
  const assistant = createAssistant({ catalog: catalogStub, getKey: async () => 'test-only', fetchImpl: async () => { requests++; throw Error('Unexpected API call'); } });
  const response = await assistant.chat({ message: 'y el script?' }, new AbortController().signal);
  assert.equal(requests, 0); assert.deepEqual(response.products, []); assert.equal(response.usage.inputTokens, 0);
  assert.match(response.message, /Walá/);
  for (const patch of [{ in_scope: false }, { message: 'Aquí tienes: ```python import matplotlib```' }]) {
    const result = validateReply(reply(patch), new Map([['product-1', product]]));
    assert.deepEqual(result.product_ids, []); assert.doesNotMatch(result.message, /```|python/);
  }
});

test('same-tab product routes and session restore keep conversation but expire it', () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const data = { sessionId: '00000000-0000-0000-0000-000000000000', chatMessage: 'Recuerdo tu presupuesto.', userMessage: 'Hasta 80', products: [product], mode: 'chat' };
  saveConversation(storage, data);
  assert.equal(readConversation(storage).sessionId, data.sessionId);
  assert.equal(readConversation(storage).products[0].id, product.id);
  const key = [...memory.keys()][0];
  memory.set(key, JSON.stringify({ ...data, at: Date.now() - 3600001 }));
  assert.equal(readConversation(storage), null);
  assert.equal(localProductPath(product.id), '/producto/product-1?kapiDemo=1');
  assert.equal(productIdFromPath('/producto/product-1'), product.id);
  assert.equal(productIdFromPath('/admin/product-1'), null);
});
