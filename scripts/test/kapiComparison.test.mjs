import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonFacts, validateComparison } from '../kapi-local/comparison.mjs';
import { createAssistant } from '../kapi-local/assistant.mjs';
import { mapProduct } from '../kapi-local/catalog.mjs';

const make = (id, price) => mapProduct({ id, name: `Producto ${id}`, description: `Características publicadas de ${id}.`, price, inStock: 3, visible: true });
const products = [make('basic', 54.9), make('middle', 79.5), make('premium', 89)];
const ids = products.map(p => p.id);
const comparison = (winner = 'middle') => ({ recommended_id: winner, rows: ids.map(id => ({ id, advantage: `Encaja por las características de ${id}.`, limitation: 'No hay más diferencias confirmadas en la ficha.' })) });
const reply = (patch = {}) => ({ in_scope: true, message: 'Estas son las opciones que podemos revisar.', gesture: 'talk', guide: null, product_ids: ids, comparison: null, ...patch });
const final = value => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
const call = (name, args) => ({ status: 'completed', output: [{ type: 'function_call', name, call_id: 'c', arguments: JSON.stringify(args) }] });

function harness(responses, get = async id => products.find(p => p.id === id)) {
  const requests = [];
  const assistant = createAssistant({ semanticSearch: false, getKey: async () => 'test-only',
    catalog: { search: async () => ({ products, partial: false }), get, status: () => ({}) },
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return new Response(JSON.stringify(responses.shift()));
    } });
  return { assistant, requests };
}
const start = [call('search_catalog', { query: 'opciones', min_price: null, max_price: 100 }), final(reply())];
const compareCall = patch => call('compare_products', { ids, max_price: 80, clear_budget: false, ...patch });

test('comparison calculates price gaps, totals, ties and budget margins in cents', () => {
  const facts = comparisonFacts(products, 80);
  assert.equal(facts.priceGap, 34.1); assert.equal(facts.totalPrice, 223.4);
  assert.deepEqual(facts.lowestPriceIds, ['basic']);
  assert.equal(facts.rows[2].overBudgetBy, 9); assert.equal(facts.rows[2].withinBudget, false);
  assert.deepEqual(comparisonFacts([make('a', 10), make('b', 10)]).lowestPriceIds, ['a', 'b']);
  assert.equal(comparisonFacts([{ ...products[0], price: null }, products[1]], 80).totalPrice, null);
});

test('comparison refuses an unaffordable, unavailable or unpriced winner and invented rows', () => {
  const context = { ids, budget: 80 };
  assert.equal(validateComparison(comparison(), context, products).recommendedId, 'middle');
  assert.throws(() => validateComparison(comparison('premium'), context, products), /INVALID_COMPARISON_CHOICE/);
  for (const patch of [{ stock: 'out' }, { price: null }]) {
    assert.throws(() => validateComparison(comparison(), context, products.map(p => p.id === 'middle' ? { ...p, ...patch } : p)), /INVALID_COMPARISON_CHOICE/);
  }
  assert.throws(() => validateComparison({ ...comparison(), rows: comparison().rows.map((r, i) => i === 0 ? { ...r, id: 'invented' } : r) }, context, products), /INVALID_COMPARISON/);
  assert.throws(() => validateComparison(comparison(), null, products), /INVALID_COMPARISON/);
  assert.equal(validateComparison(comparison(null), context, products).recommendedId, null);
});

test('assistant compares all three previous recommendations in one tool call with fresh prices', async () => {
  const reads = [];
  const { assistant, requests } = harness([...start, compareCall(), final(reply({ comparison: comparison() }))], async id => {
    reads.push(id); return products.find(p => p.id === id);
  });
  const first = await assistant.chat({ message: 'Busco opciones hasta 100.' }, new AbortController().signal);
  const result = await assistant.chat({ message: 'Compara las tres, ahora puedo gastar 80.', sessionId: first.sessionId }, new AbortController().signal);
  assert.equal(reads.length, 9, 'initial cards plus fresh comparison and final verification');
  assert.equal(result.comparison.recommendedId, 'middle'); assert.equal(result.comparison.budget, 80);
  assert.equal(result.comparison.rows[2].overBudgetBy, 9);
  const comparisonOutput = requests.at(-1).input.find(m => m.type === 'function_call_output');
  assert.equal(JSON.parse(comparisonOutput.output).comparison.priceGap, 34.1);
});

test('comparison retains the previous budget, and clears it only through the explicit tool flag', async () => {
  const { assistant } = harness([...start, compareCall({ max_price: null }), final(reply({ comparison: comparison() })),
    compareCall({ max_price: null, clear_budget: true }), final(reply({ comparison: comparison('premium') }))]);
  const first = await assistant.chat({ message: 'Hasta 100.' }, new AbortController().signal);
  const second = await assistant.chat({ message: 'Compáralos.', sessionId: first.sessionId }, new AbortController().signal);
  assert.equal(second.comparison.budget, 100);
  const third = await assistant.chat({ message: 'Ya no tengo límite de presupuesto, compáralos de nuevo.', sessionId: first.sessionId }, new AbortController().signal);
  assert.equal(third.comparison.budget, null);
});

test('comparison rejects unknown IDs rather than comparing hallucinated recommendations', async () => {
  const { assistant } = harness([compareCall()]);
  await assert.rejects(assistant.chat({ message: 'Compáralos.' }, new AbortController().signal), error => error.code === 'invalid_tool');
});

test('price changes after comparison remove the stale conclusion and over-budget cards', async () => {
  let reads = 0;
  const { assistant } = harness([...start, compareCall(), final(reply({ comparison: comparison() }))], async id => {
    const original = products.find(p => p.id === id);
    return ++reads > 6 && id === 'middle' ? { ...original, price: 120 } : original;
  });
  const first = await assistant.chat({ message: 'Opciones hasta 100.' }, new AbortController().signal);
  const result = await assistant.chat({ message: 'Compáralos con 80 de presupuesto.', sessionId: first.sessionId }, new AbortController().signal);
  assert.equal(result.comparison, null); assert.deepEqual(result.products.map(p => p.id), ['basic']);
  assert.match(result.message, /cambió de precio/);
});

test('a deleted product cannot be resurrected by an old recommendation', async () => {
  let deleted = false;
  const { assistant } = harness([...start, compareCall(), final(reply({ product_ids: ['basic', 'middle'], comparison: null }))],
    async id => deleted && id === 'premium' ? null : products.find(p => p.id === id));
  const first = await assistant.chat({ message: 'Opciones hasta 100.' }, new AbortController().signal);
  deleted = true;
  const result = await assistant.chat({ message: 'Compáralas.', sessionId: first.sessionId }, new AbortController().signal);
  assert.equal(result.comparison, null); assert.deepEqual(result.products.map(p => p.id), ['basic', 'middle']);
});
