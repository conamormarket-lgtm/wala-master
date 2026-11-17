import test from 'node:test';
import assert from 'node:assert/strict';
import { createScrollGate, sameViewport, scrollMovesTarget } from '../../src/components/kapi-local/scrollLayout.mjs';
import { navigationGuide } from '../../src/componentes/kit/navigationGuide.mjs';

function clock() {
  let id = 0;
  const timers = new Map();
  return { setTimer: fn => { timers.set(++id, fn); return id; }, clearTimer: key => timers.delete(key),
    flush: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    get size() { return timers.size; } };
}

test('a burst of scroll events hides a guide once and measures only once after settling', () => {
  const timer = clock(); let starts = 0, measures = 0;
  const gate = createScrollGate({ ...timer, onStart: () => starts++, onEnd: () => measures++ });
  for (let i = 0; i < 120; i++) gate.scroll();
  assert.equal(starts, 1); assert.equal(measures, 0); assert.equal(timer.size, 1); assert.equal(gate.active, true);
  timer.flush(); assert.equal(measures, 1); assert.equal(gate.active, false);
  gate.scroll(); gate.dispose(); timer.flush(); assert.equal(measures, 1);
});

test('only scrolling ancestors of a guide can relocate it; conversation and carousels cannot', () => {
  const target = {}, document = {}, window = {};
  const root = { contains: el => el === target }, unrelated = { contains: () => false };
  for (const source of [document, window, root]) assert.equal(scrollMovesTarget(source, target, document, window), true);
  for (const source of [unrelated, null]) assert.equal(scrollMovesTarget(source, target, document, window), false);
  assert.equal(scrollMovesTarget(document, null, document, window), false);
});

test('visual viewport scroll without changed geometry does not restart the mascot', () => {
  const before = { width: 390, height: 844, top: 0, left: 0 };
  assert.equal(sameViewport(before, { ...before }), true);
  assert.equal(sameViewport(before, { ...before, height: 843.8 }), true);
  assert.equal(sameViewport(before, { ...before, height: 400 }), false);
  assert.equal(sameViewport(before, { ...before, top: 80 }), false);
});

test('admin-generated menu IDs still identify store and create navigation targets', () => {
  assert.equal(navigationGuide({ id: 'item-17367720', menu: 'tienda', url: '' }), 'store');
  assert.equal(navigationGuide({ id: 'item-17367721', url: '/personalizar' }), 'create');
  assert.equal(navigationGuide({ id: 'tienda', url: '/tienda' }), 'store');
  assert.equal(navigationGuide({ id: 'tienda', menu: 'marcas', url: '/marcas' }), undefined);
});

