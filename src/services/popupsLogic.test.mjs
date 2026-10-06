import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIA_MS,
  POPUP_ENCUESTA_DEFAULT,
  conversionPendiente,
  elegirPopup,
  evaluarPopup,
  idDesdeNombre,
  marcarMostrado,
  normalizarPopup,
  popupsDesdeDoc,
  rutaBloqueada,
} from './popupsLogic.mjs';

const AHORA = new Date(2026, 9, 6, 12, 0, 0).getTime(); // 2026-10-06 local
const base = { pathname: '/', ahora: AHORA, esMovil: false, logueado: false, perfil: null, estadoLocal: {} };
const enlace = (extra = {}) => normalizarPopup({ id: 'promo', activo: true, objetivo: 'enlace', ...extra });

test('sin documento usa el popup de encuesta por defecto', () => {
  const popups = popupsDesdeDoc(null);
  assert.equal(popups.length, 1);
  assert.equal(popups[0].id, 'encuesta');
  assert.equal(popups[0].activo, true);
});

test('documento con lista vacía no muestra nada (el admin los borró)', () => {
  assert.deepEqual(popupsDesdeDoc({ popups: [] }), []);
});

test('normalizar tolera basura', () => {
  const p = normalizarPopup({ id: ' x ', activo: 'si', segundos: 'abc', audiencia: 'marcianos', desde: 'ayer' });
  assert.equal(p.id, 'x');
  assert.equal(p.activo, false);
  assert.equal(p.segundos, 10);
  assert.equal(p.audiencia, 'todos');
  assert.equal(p.desde, '');
});

test('rutas bloqueadas', () => {
  assert.equal(rutaBloqueada('/checkout'), true);
  assert.equal(rutaBloqueada('/admin/popups'), true);
  assert.equal(rutaBloqueada('/l/conamor'), true);
  assert.equal(rutaBloqueada('/encuesta-suscripcion'), true);
  assert.equal(rutaBloqueada('/'), false);
  assert.equal(rutaBloqueada('/producto/abc'), false);
  assert.equal(rutaBloqueada('/administrador-falso'), false);
});

test('inactivo, fechas, página y dispositivo', () => {
  assert.equal(evaluarPopup(enlace({ activo: false }), base).ok, false);
  assert.equal(evaluarPopup(enlace({ desde: '2026-10-07' }), base).ok, false);
  assert.equal(evaluarPopup(enlace({ hasta: '2026-10-05' }), base).ok, false);
  assert.equal(evaluarPopup(enlace({ desde: '2026-10-06', hasta: '2026-10-06' }), base).ok, true);
  assert.equal(evaluarPopup(enlace({ paginas: 'productos' }), base).ok, false);
  assert.equal(evaluarPopup(enlace({ paginas: 'productos' }), { ...base, pathname: '/producto/1' }).ok, true);
  assert.equal(evaluarPopup(enlace({ dispositivo: 'movil' }), base).ok, false);
  assert.equal(evaluarPopup(enlace({ dispositivo: 'escritorio' }), { ...base, esMovil: true }).ok, false);
});

test('audiencia', () => {
  assert.equal(evaluarPopup(enlace({ audiencia: 'logueados' }), base).ok, false);
  assert.equal(evaluarPopup(enlace({ audiencia: 'anonimos' }), { ...base, logueado: true, perfil: {} }).ok, false);
});

test('encuesta: espera el perfil, no sale si ya la llenó o la saltó hace poco', () => {
  const p = POPUP_ENCUESTA_DEFAULT;
  assert.equal(evaluarPopup(p, base).ok, true, 'anónimo sí (irá a login)');
  assert.equal(evaluarPopup(p, { ...base, logueado: true, perfil: null }).motivo, 'perfil cargando');
  assert.equal(evaluarPopup(p, { ...base, logueado: true, perfil: { hasCompletedSurvey: true } }).ok, false);
  assert.equal(evaluarPopup(p, { ...base, logueado: true, perfil: { lastSurveyPromptedAt: AHORA - DIA_MS } }).ok, false);
  assert.equal(evaluarPopup(p, { ...base, logueado: true, perfil: { lastSurveyPromptedAt: AHORA - 10 * DIA_MS } }).ok, true);
});

test('enfriamiento tras mostrarse', () => {
  const p = enlace({ cooldownDias: 2 });
  const estado = marcarMostrado({}, p, AHORA);
  assert.equal(evaluarPopup(p, { ...base, estadoLocal: estado }).ok, false);
  assert.equal(evaluarPopup(p, { ...base, ahora: AHORA + 3 * DIA_MS, estadoLocal: estado }).ok, true);
});

test('elige el de mayor prioridad que aplica', () => {
  const a = enlace({ id: 'a', prioridad: 1 });
  const b = enlace({ id: 'b', prioridad: 5 });
  const c = enlace({ id: 'c', prioridad: 99, activo: false });
  assert.equal(elegirPopup([a, b, c], base).id, 'b');
  assert.equal(elegirPopup([], base), null);
});

test('conversión dentro de la ventana y con el mismo objetivo', () => {
  const clic = { popupId: 'encuesta', objetivo: 'encuesta', en: AHORA };
  assert.equal(conversionPendiente(clic, 'encuesta', AHORA + DIA_MS), 'encuesta');
  assert.equal(conversionPendiente(clic, 'enlace', AHORA), null);
  assert.equal(conversionPendiente(clic, 'encuesta', AHORA + 8 * DIA_MS), null);
  assert.equal(conversionPendiente(null, 'encuesta', AHORA), null);
});

test('id desde nombre, sin repetir', () => {
  assert.equal(idDesdeNombre('Promo Día de la Madre!'), 'promo-dia-de-la-madre');
  assert.equal(idDesdeNombre('Live', ['live']), 'live-2');
});
