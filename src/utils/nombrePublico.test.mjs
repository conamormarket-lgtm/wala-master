import test from 'node:test';
import assert from 'node:assert/strict';
import { nombrePublico, nombreParaRanking, acortarNombre } from './nombrePublico.mjs';

test('primer nombre e inicial del apellido', () => {
  assert.equal(nombrePublico({ displayName: 'jorge ramírez soto' }), 'Jorge R.');
  assert.equal(nombrePublico({ nombres: 'Lucía', apellidos: 'Rojas' }), 'Lucía R.');
  assert.equal(nombrePublico({ displayName: 'Yoryo' }), 'Yoryo');
});

test('nunca el correo ni los rellenos', () => {
  assert.equal(nombrePublico({ displayName: 'ana@correo.com' }), null);
  assert.equal(nombrePublico({ displayName: 'Anónimo' }), null);
  assert.equal(nombrePublico({ displayName: 'Jugador' }), null);
  assert.equal(nombrePublico({}), null);
  assert.equal(nombrePublico(null), null);
});

test('la ficha primero; sin nombre en la ficha, el de la cuenta de Google', () => {
  assert.equal(nombreParaRanking({ nombres: 'Lucía', apellidos: 'Rojas' }, { displayName: 'Lu R' }), 'Lucía R.');
  assert.equal(nombreParaRanking({ email: 'x@y.com' }, { displayName: 'Jorge Ramírez' }), 'Jorge R.');
  assert.equal(nombreParaRanking({}, null), null);
});

test('un nombre completo ya publicado sale corto', () => {
  assert.equal(acortarNombre('Isaac Ulloa Pérez'), 'Isaac U.');
  assert.equal(acortarNombre(undefined), null);
});
