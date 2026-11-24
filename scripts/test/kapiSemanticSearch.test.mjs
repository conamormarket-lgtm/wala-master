import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticSearch, validateSelection, EMBEDDING_DIMENSIONS } from '../kapi-local/semanticSearch.mjs';
import { mapProduct, rankProducts } from '../kapi-local/catalog.mjs';
import { createAssistant } from '../kapi-local/assistant.mjs';

const p = (id, name, price = 40) => mapProduct({ id, name, price, visible: true, inStock: 4, description: 'Ficha pública del producto.' });
const sword = p('sword', 'Espada dron con luces LED');
const keyboard = p('keyboard', 'Teclado y mouse inalámbricos');
const vector = index => Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => i === index ? 1 : 0);
const args = (query, max_price = null) => ({ query, min_price: null, max_price });
const catalogOf = products => ({ snapshot: async () => ({ products, partial: false }), get: async id => products.find(p => p.id === id), status: () => ({}) });
const selectAll = async ({ candidates }) => ({ decision: { matches: candidates.map(p => ({ id: p.id, evidence: p.name })), clarification: null }, usage: { inputTokens: 7, outputTokens: 3 } });

test('semantic retrieval supplies candidates even when no query words match, preserving the entire request', async () => {
  const query = 'algo para mi compu sin cables y que no sea Bluetooth';
  assert.deepEqual(rankProducts([keyboard], args(query)), []);
  let received;
  const search = createSemanticSearch({ catalog: catalogOf([keyboard]), embed: async texts => ({ vectors: texts.map(() => vector(0)), tokens: 5 }),
    select: async payload => { received = payload; return selectAll(payload); } });
  const result = await search.search(args(query), new AbortController().signal);
  assert.equal(received.query, query);
  assert.equal(result.products[0].id, keyboard.id);
  assert.equal(result.usage.embeddingTokens, 10);
  assert.equal(result.usage.inputTokens, 7);
});

test('index caches unchanged products, updates descriptions, prunes removals and survives server recreation', async () => {
  let products = [sword, keyboard], saved, calls = [];
  const catalog = { ...catalogOf([]), snapshot: async () => ({ products, partial: false }), get: async id => products.find(p => p.id === id) };
  const options = { catalog, embed: async texts => { calls.push(texts); return { vectors: texts.map(() => vector(0)), tokens: texts.length }; },
    select: selectAll, loadCache: async () => saved, saveCache: async cache => { saved = cache; } };
  let search = createSemanticSearch(options);
  const signal = new AbortController().signal;
  await search.search(args('algo divertido'), signal);
  assert.equal(calls.length, 2); assert.equal(calls[0].length, 2);
  await search.search(args('algo divertido'), signal);
  assert.equal(calls.length, 2, 'no embedding call for identical data/query');
  products = [{ ...sword, description: 'Una descripción actualizada.' }];
  await search.search(args('algo divertido'), signal);
  assert.equal(calls.length, 3); assert.equal(calls[2].length, 1); assert.equal(saved.entries.length, 1);
  search = createSemanticSearch(options);
  await search.search(args('algo distinto'), signal);
  assert.equal(calls.length, 4); assert.deepEqual(calls[3], ['algo distinto']);
});

test('price/stock filters run before ranking and again after rereading candidates', async () => {
  const products = [sword, { ...keyboard, price: 200 }, { ...sword, id: 'sold', stock: 'out' }];
  let selected = false;
  const catalog = { ...catalogOf(products), get: async () => ({ ...sword, price: 100 }) };
  const search = createSemanticSearch({ catalog, embed: async texts => ({ vectors: texts.map(() => vector(0)) }), select: async () => { selected = true; } });
  const result = await search.search(args('espada voladora', 50), new AbortController().signal);
  assert.deepEqual(result.products, []); assert.equal(selected, false);
});

test('brand searches retain shared vectors without exposing products outside their scope', async () => {
  let saved; const batches=[];
  const options={embed:async texts=>{batches.push(texts);return {vectors:texts.map(()=>vector(0))};},
    select:selectAll,loadCache:async()=>saved,saveCache:async value=>{saved=value;}};
  const signal=new AbortController().signal;
  await createSemanticSearch({...options,catalog:catalogOf([sword,keyboard])}).search(args('regalo'),signal);
  const result=await createSemanticSearch({...options,catalog:catalogOf([sword]),pruneMissing:false}).search(args('juguete'),signal);
  assert.deepEqual(result.products.map(p=>p.id),['sword']);assert.equal(saved.entries.length,2);
  await createSemanticSearch({...options,catalog:catalogOf([sword,keyboard])}).search(args('teclado'),signal);
  assert.deepEqual(batches.map(b=>b.length),[2,1,1,1],'only the first call embeds products; handoffs embed just the new query');
});

test('semantic closeness alone cannot force a card, and ambiguity asks for clarification', async () => {
  for (const clarification of [null, '¿Buscas ropa o un accesorio?']) {
    const search = createSemanticSearch({ catalog: catalogOf([sword]), embed: async texts => ({ vectors: texts.map(() => vector(0)) }),
      select: async () => ({ decision: { matches: [], clarification } }) });
    const result = await search.search(args('un artículo que no está en el catálogo'), new AbortController().signal);
    assert.deepEqual(result.products, []); assert.equal(result.clarification, clarification);
  }
});

test('selection rejects invented IDs/evidence and never treats catalog text as code', () => {
  for (const match of [{ id: 'invented', evidence: sword.name }, { id: sword.id, evidence: 'Tiene GPS y cámara 4K' }]) {
    assert.throws(() => validateSelection({ matches: [match], clarification: null }, [sword]), /SEARCH_INVALID_SELECTION/);
  }
  const result = validateSelection({ matches: [{ id: sword.id, evidence: sword.name }], clarification: '¿Con luces o sin ellas?' }, [sword]);
  assert.deepEqual(result.products, []);
});

test('index caps embedding batches, rejects corrupt vectors and stops on cancellation', async () => {
  let selected = false;
  const controller = new AbortController();
  const search = createSemanticSearch({ catalog: catalogOf(Array.from({ length: 70 }, (_, i) => p(`p-${i}`, `Artículo ${i}`))),
    embed: async texts => { assert.equal(texts.length, 64); controller.abort(); return { vectors: texts.map(() => vector(0)) }; },
    select: async () => { selected = true; } });
  await assert.rejects(search.search(args('regalo especial'), controller.signal), { name: 'AbortError' });
  assert.equal(selected, false);
  const invalid = createSemanticSearch({ catalog: catalogOf([sword]), embed: async () => ({ vectors: [[NaN]] }), select: selectAll });
  await assert.rejects(invalid.search(args('voladora'), new AbortController().signal), /SEARCH_INVALID_EMBEDDING/);
});

test('budget-only browsing does not spend embeddings or extra model calls', async () => {
  const search = createSemanticSearch({ catalog: catalogOf([sword, { ...keyboard, price: 70 }]),
    embed: async () => { throw Error('Unexpected embeddings'); }, select: async () => { throw Error('Unexpected review'); } });
  const result = await search.search(args('', 50), new AbortController().signal);
  assert.equal(result.mode, 'browse'); assert.deepEqual(result.products.map(p => p.id), ['sword']);
});

test('full assistant uses embeddings and evidence review before recommending, charging every provider call', async () => {
  const json = body => new Response(JSON.stringify(body));
  const final = body => ({ status: 'completed', usage: { input_tokens: 10, output_tokens: 5 }, output: [{ content: [{ type: 'output_text', text: JSON.stringify(body) }] }] });
  let charged = 0, chatCalls = 0, reviews = 0;
  const assistant = createAssistant({ catalog: catalogOf([sword]), getKey: async () => 'test-private', charge: async () => { charged++; },
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body);
      if (url.endsWith('/embeddings')) {
        assert.equal(body.model, 'text-embedding-3-small');
        return json({ data: body.input.map((_, index) => ({ index, embedding: vector(0) })), usage: { total_tokens: 4 } });
      }
      assert.equal(body.store, false);
      if (body.text.format.name === 'kapi_search_matches') {
        reviews++;
        assert.equal(JSON.parse(body.input[0].content).query, 'espada voladora');
        return json(final({ matches: [{ id: sword.id, evidence: sword.name }], clarification: null }));
      }
      if (chatCalls++ === 0) return json({ status: 'completed', output: [{ type: 'function_call', name: 'search_catalog', call_id: 'find', arguments: JSON.stringify(args('espada voladora', 50)) }] });
      return json(final({ in_scope: true, message: 'Encontré la espada de juguete.', gesture: 'talk', guide: null, product_ids: ['sword'] }));
    } });
  const result = await assistant.chat({ message: 'Quiero una espada voladora hasta 50 soles.' }, new AbortController().signal);
  assert.equal(result.products[0].id, 'sword'); assert.equal(reviews, 1); assert.equal(charged, 5);
  assert.equal(result.usage.embeddingTokens, 8); assert.equal(result.usage.inputTokens, 20);
  assert.equal(JSON.stringify(result).includes('test-private'), false);
});
