import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fuente = await readFile(new URL('./adaptadoresGenerales.js', import.meta.url), 'utf8');
const { plataformaDesdeNavegador } = await import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`);

test('Android, iPhone y la computadora', () => {
  assert.equal(plataformaDesdeNavegador('Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36'), 'android');
  assert.equal(plataformaDesdeNavegador('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'), 'iphone');
  assert.equal(plataformaDesdeNavegador('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129 Safari/537.36'), 'computadora');
});

test('un iPad con iPadOS se presenta como Mac, pero es táctil', () => {
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
  assert.equal(plataformaDesdeNavegador(mac, 5), 'iphone');
  assert.equal(plataformaDesdeNavegador(mac, 0), 'computadora');
});

test('sin datos, la computadora', () => {
  assert.equal(plataformaDesdeNavegador(), 'computadora');
});
