import test from 'node:test';
import assert from 'node:assert/strict';
import { configConHistorial } from './encuestaHistorial.mjs';

const base = {
  personPanel: { budget: true },
  basicDataPanel: { fields: [{ id: 'familia', label: '¿Tienes familia?' }] },
  brandsPanel: { categories: [{ id: 'cat_dep', name: 'Deportes', fields: [{ id: 'q1', label: '¿Equipo?' }] }] },
};

test('anota el texto anterior y el día en que se retira una pregunta', () => {
  const editado = {
    personPanel: { budget: false },
    basicDataPanel: { fields: [{ id: 'familia', label: '¿Tienes familia?', enEncuesta: false }] },
    brandsPanel: { categories: [{ id: 'cat_dep', name: 'Fútbol', fields: [{ id: 'q1', label: '¿De qué equipo es hincha?' }] }] },
  };
  const r = configConHistorial(editado, base, '2026-10-23');
  assert.equal(r.basicDataPanel.fields[0].retiradaEl, '2026-10-23');
  assert.deepEqual(r.brandsPanel.categories[0].antes, [{ label: 'Deportes', hasta: '2026-10-23' }]);
  assert.deepEqual(r.brandsPanel.categories[0].fields[0].antes, [{ label: '¿Equipo?', hasta: '2026-10-23' }]);
  assert.equal(r.personPanel.budgetRetiradoEl, '2026-10-23');
});

test('volver a preguntarla borra la fecha; sin cambios no anota nada', () => {
  const retirada = { ...base, basicDataPanel: { fields: [{ id: 'familia', label: '¿Tienes familia?', enEncuesta: false, retiradaEl: '2026-10-01' }] } };
  const vuelta = { ...base, basicDataPanel: { fields: [{ id: 'familia', label: '¿Tienes familia?', enEncuesta: true, retiradaEl: '2026-10-01' }] } };
  assert.equal(configConHistorial(vuelta, retirada, '2026-10-23').basicDataPanel.fields[0].retiradaEl, undefined);
  const igual = configConHistorial(base, base, '2026-10-23');
  assert.equal(igual.basicDataPanel.fields[0].antes, undefined);
  assert.equal(igual.brandsPanel.categories[0].antes, undefined);
});
