import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fuente = await readFile(new URL('./estadoEstudio.js', import.meta.url), 'utf8');
const { firmaDiseno, firmaBorrador, capasParaGuardar, archivosVigentes } = await import(`data:text/javascript;base64,${Buffer.from(fuente).toString('base64')}`);

test('inicialización y autoguardado firman igual después de normalizar talla y color', () => {
  const capas = { pecho: [{ id: 'a', type: 'text', text: 'Walá' }] };
  assert.equal(firmaBorrador(capas, 'blanco', undefined), firmaBorrador(capas, 'blanco', ''));
  assert.equal(firmaBorrador(capas, 'blanco', ''), firmaBorrador({ pecho: [{ text: 'Walá', type: 'text', id: 'a' }] }, 'blanco', ''));
  assert.notEqual(firmaBorrador(capas, 'blanco', 'S'), firmaBorrador(capas, 'blanco', 'M'));
});

test('el diseño conserva orden de capas y no cambia por completar una subida', () => {
  const a = { id: 'a', type: 'image', src: 'blob:local', subiendo: true };
  const b = { id: 'b', type: 'text', text: 'Walá' };
  assert.equal(firmaDiseno({ pecho: [a, b] }, 'blanco'), firmaDiseno({ pecho: [{ ...a, src: 'storage', subiendo: false }, b] }, 'blanco'));
  assert.notEqual(firmaDiseno({ pecho: [a, b] }, 'blanco'), firmaDiseno({ pecho: [b, a] }, 'blanco'));
});

test('una imagen local pendiente no sustituye al original persistido', () => {
  const capas = { pecho: [{ id: 'a', type: 'image', src: 'blob:local', subiendo: true }], espalda: [{ type: 'text', text: 'Atrás', escalaX: 2 }] };
  assert.deepEqual(capasParaGuardar(capas), { espalda: [{ type: 'text', text: 'Atrás', escalaX: 2 }] });
  assert.equal(capas.pecho[0].subiendo, true);
});

test('reutilizar exige impresión de cada zona y vista previa de cada lado diseñado', () => {
  const capas = { pecho: [{ id: 'a' }], espalda: [{ id: 'b' }] };
  const vistas = [{ id: 'frente', zonas: [{ id: 'pecho' }] }, { id: 'atras', zonas: [{ id: 'espalda' }] }];
  const creacion = { imagenConjunta: 'conjunto', archivosImpresion: [{ vista: 'pecho', url: 'uno' }, { vista: 'espalda', url: 'dos' }], vistasPrevias: [{ vista: 'frente', url: 'frente' }, { vista: 'atras', url: 'atras' }] };
  assert.equal(archivosVigentes(creacion, capas, vistas), true);
  assert.equal(archivosVigentes({ ...creacion, archivosImpresion: creacion.archivosImpresion.slice(0, 1) }, capas, vistas), false);
  assert.equal(archivosVigentes({ ...creacion, vistasPrevias: [] }, capas, vistas), false);
  assert.equal(archivosVigentes({ ...creacion, vistasPrevias: {} }, capas, vistas), false);
  assert.equal(archivosVigentes(null, capas, vistas), false);
});
