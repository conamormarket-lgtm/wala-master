export const COMPARISON_SCHEMA = {
  type: ['object', 'null'], additionalProperties: false,
  properties: {
    recommended_id: { type: ['string', 'null'] },
    rows: { type: 'array', minItems: 2, maxItems: 3, items: {
      type: 'object', additionalProperties: false,
      properties: { id: { type: 'string' }, advantage: { type: 'string', minLength: 1, maxLength: 150 },
        limitation: { type: 'string', minLength: 1, maxLength: 150 } },
      required: ['id', 'advantage', 'limitation'],
    } },
  }, required: ['recommended_id', 'rows'],
};

const cents = value => value == null ? null : Math.round(value * 100);
export function comparisonFacts(products, budget = null) {
  const priced = products.filter(p => p.price != null).sort((a, b) => a.price - b.price);
  const rows = products.map(p => ({ id: p.id, price: p.price, stock: p.stock,
    withinBudget: budget == null || (p.price != null && cents(p.price) <= cents(budget)),
    overBudgetBy: budget != null && p.price != null ? Math.max(0, cents(p.price) - cents(budget)) / 100 : null,
  }));
  return {
    budget, rows,
    lowestPriceIds: priced.filter(p => cents(p.price) === cents(priced[0]?.price)).map(p => p.id),
    priceGap: priced.length >= 2 && priced.length === products.length ? (cents(priced.at(-1).price) - cents(priced[0].price)) / 100 : null,
    totalPrice: priced.length > 0 && priced.length === products.length ? priced.reduce((sum, p) => sum + cents(p.price), 0) / 100 : null,
  };
}

export function validateComparison(value, context, products) {
  if (!value) return null;
  const ids = new Set(context?.ids || []);
  if (ids.size < 2 || !Array.isArray(value.rows) || value.rows.length !== ids.size
    || new Set(value.rows.map(row => row.id)).size !== ids.size
    || value.rows.some(row => !ids.has(row.id) || ['advantage', 'limitation'].some(k => typeof row[k] !== 'string' || !row[k].trim() || row[k].length > 150))
    || !(value.recommended_id === null || ids.has(value.recommended_id))
    || products.length !== ids.size || products.some(p => !ids.has(p.id))) throw Error('INVALID_COMPARISON');
  const facts = comparisonFacts(products, context.budget);
  const winner = facts.rows.find(row => row.id === value.recommended_id);
  if (winner && (winner.stock === 'out' || winner.price == null || !winner.withinBudget)) throw Error('INVALID_COMPARISON_CHOICE');
  return { ...facts, recommendedId: value.recommended_id,
    rows: value.rows.map(row => ({ ...row, ...facts.rows.find(fact => fact.id === row.id) })) };
}
