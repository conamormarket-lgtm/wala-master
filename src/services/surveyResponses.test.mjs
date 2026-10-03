import test from 'node:test';
import assert from 'node:assert/strict';
import { resumenEncuesta, fichaCliente, csvRespuestas } from './surveyResponses.mjs';

const config = {
  basicDataPanel: {
    fields: [
      { id: 'nombres', label: '¿Cómo te llamas?', type: 'text' },
      { id: 'familia', label: '¿Tienes familia?', type: 'select', options: ['Vivo solo/a', 'Vivo en pareja', 'Tengo hijos'] },
    ],
  },
  brandsPanel: {
    categories: [
      { id: 'cat_dep', name: 'Deportes', fields: [{ id: 'q2', label: '¿De qué equipo es hincha?', type: 'text' }] },
      { id: 'cat_bel', name: 'Belleza', fields: [{ id: 'b1', label: '¿Tipo de piel?', type: 'select', options: ['Seca', 'Mixta'] }] },
    ],
  },
};
const usuarios = [
  {
    id: 'u1', displayName: 'Ana', email: 'ana@x.com', hasCompletedSurvey: true, birthDate: '1990-01-02',
    surveyBasicData: { nombres: 'Ana', familia: 'Vivo en pareja' },
    giftRoles: { pareja: true, hijos: true },
    giftRecipients: [
      { name: 'Luis', roleKey: 'pareja', roleDisplay: 'Pareja', gender: 'Masculino', budget: '50a100',
        events: [{ type: 'Cumpleaños', date: '1989-05-05' }],
        selectedCategories: ['cat_dep'], categoryAnswers: { cat_dep: { q2: 'Alianza Lima' } } },
      { name: 'Sofía', roleKey: 'hijos', roleDisplay: 'Hijo/a', gender: 'Femenino',
        events: [{ type: 'Cumpleaños', date: '2015-08-08' }],
        selectedCategories: ['cat_bel'], categoryAnswers: { cat_bel: { b1: 'Mixta' } } },
    ],
  },
  {
    id: 'u2', displayName: 'Beto', email: 'beto@x.com', hasCompletedSurvey: true,
    surveyBasicData: { familia: 'Vivo solo/a' }, giftRoles: { pareja: true },
    giftRecipients: [
      { name: 'Carla', roleKey: 'pareja', gender: 'Femenino', events: [],
        selectedCategories: ['cat_dep'], categoryAnswers: { cat_dep: { q2: 'La alianza lima ' } } },
    ],
  },
  { id: 'u3', displayName: 'Sin encuesta', hasCompletedSurvey: false },
];

test('resumen: totales, opciones, a quién regalan y gustos agrupados', () => {
  const r = resumenEncuesta(usuarios, config);
  assert.equal(r.clientes, 2);
  assert.equal(r.personas, 3);
  assert.equal(r.conCumpleanos, 1);
  const familia = r.basicos.find((b) => b.id === 'familia');
  assert.equal(familia.respondieron, 2);
  assert.deepEqual(familia.opciones.find((o) => o.valor === 'Tengo hijos'), { valor: 'Tengo hijos', total: 0 });
  assert.equal(r.aQuien[0].valor, 'Pareja');
  assert.equal(r.aQuien[0].total, 2);
  const equipo = r.gustos.find((g) => g.id === 'cat_dep').preguntas[0];
  assert.deepEqual(equipo.top, [{ valor: 'Alianza Lima', total: 2 }], 'agrupa "Alianza Lima" y "alianza lima "');
  assert.equal(r.gustos.find((g) => g.id === 'cat_bel').preguntas[0].top[0].valor, 'Mixta');
  assert.equal(r.presupuesto.find((p) => p.valor === 'S/ 50 – 100').total, 1);
});

test('ficha legible de un cliente', () => {
  const f = fichaCliente(usuarios[0], config);
  assert.equal(f.nombre, 'Ana');
  assert.deepEqual(f.aQuien, ['Pareja', 'Hijos']);
  assert.equal(f.personas[0].presupuesto, 'S/ 50 – 100');
  assert.deepEqual(f.personas[0].gustos, [{ conjunto: 'Deportes', respuestas: [{ label: '¿De qué equipo es hincha?', valor: 'Alianza Lima' }] }]);
  assert.deepEqual(f.personas[0].fechas, ['Cumpleaños: 1989-05-05']);
});

test('CSV: una fila por persona, separador ; y comillas cuando hace falta', () => {
  const csv = csvRespuestas(usuarios.slice(0, 2), config);
  assert.ok(csv.startsWith('﻿'));
  const lineas = csv.slice(1).split('\r\n');
  assert.equal(lineas.length, 1 + 3);
  assert.ok(lineas[0].includes('Deportes: ¿De qué equipo es hincha?'));
  assert.ok(lineas[1].includes('Luis') && lineas[1].includes('Alianza Lima'));
  const conPuntoYComa = csvRespuestas([{ ...usuarios[1], displayName: 'Beto; el grande' }], config);
  assert.ok(conPuntoYComa.includes('"Beto; el grande"'));
});
