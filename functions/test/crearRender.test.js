const test = require('node:test');
const assert = require('node:assert/strict');
const { createCanvas, loadImage } = require('canvas');
const render = require('../crearRender');

// Una "prenda" blanca de 800×1000 con fondo transparente y una foto de 400×300 para el diseño.
function png(width, height, paint) {
  const c = createCanvas(width, height);
  paint(c.getContext('2d'));
  return c.toBuffer('image/png');
}
const prendaPng = png(800, 1000, (ctx) => { ctx.fillStyle = '#F2F2F2'; ctx.fillRect(100, 100, 600, 800); });
const fotoPng = png(400, 300, (ctx) => { ctx.fillStyle = '#EC4899'; ctx.fillRect(0, 0, 400, 300); });
const archivos = { 'https://x.test/prenda.png': prendaPng, 'https://x.test/foto.png': fotoPng };
const cargar = async (src) => { if (!archivos[src]) throw new Error(`sin ${src}`); return archivos[src]; };

const producto = {
  name: 'Polera clásica', esPrendaBase: true, price: 79.9,
  variants: [{ id: 'negro', name: 'Negro', colorHex: '#111111' }, { id: 'blanco', name: 'Blanco', colorHex: '#FFFFFF' }],
  prendaBase: { vistas: [
    { id: 'frente', nombre: 'Frente', imagen: 'https://x.test/prenda.png', anchoImg: 800, altoImg: 1000,
      referencia: { x1: 0.125, y1: 0.4, x2: 0.875, y2: 0.4, cm: 50 },
      zonas: [{ id: 'pecho', nombre: 'Pecho', x: 0.3, y: 0.25, w: 0.4, proporcion: 1.2, angulo: 0 }] },
    { id: 'espalda', nombre: 'Espalda', imagen: 'https://x.test/prenda.png', zonas: [{ id: 'espalda', nombre: 'Espalda', x: 0.25, y: 0.2, w: 0.5, proporcion: 1.3 }] },
  ] },
};
const capas = { pecho: [
  { id: 'f1', type: 'image', src: 'https://x.test/foto.png', anchoNatural: 400, altoNatural: 300, left: 500, top: 400, escalaX: 2, escalaY: 2, angulo: 0 },
  { id: 't1', type: 'text', text: 'Feliz cumple', fuente: 'Montserrat', color: '#FFFFFF', tamano: 120, negrita: true, cursiva: false,
    left: 500, top: 900, escalaX: 1, escalaY: 1, angulo: 0, contorno: 8, contornoColor: '#7C3AED', curva: 30 },
] };

test('dibuja en el servidor el archivo de impresión a 300 dpi, las vistas previas y la conjunta como la web', async () => {
  const out = await render.generarArchivos({ producto, colorId: 'negro', capas, cargar });
  // Solo la zona con diseño; 26,7 × 32 cm a 300 dpi (la referencia mide 600 px = 50 cm y la zona 320 px).
  assert.equal(out.impresion.length, 1);
  assert.deepEqual(out.impresion[0].datos, { vista: 'pecho', vistaId: 'frente', nombre: 'Frente · Pecho', ancho: 3154, alto: 3780, tecnica: 'impresion', anchoCm: 26.7, altoCm: 32 });
  const impresa = await loadImage(out.impresion[0].buffer);
  assert.equal(impresa.width, 3154);
  // El centro (la foto rosada a 2× escala) está pintado y una esquina queda transparente.
  const c = createCanvas(impresa.width, impresa.height); const ctx = c.getContext('2d'); ctx.drawImage(impresa, 0, 0);
  assert.deepEqual([...ctx.getImageData(1577, 1260, 1, 1).data], [236, 72, 153, 255]);
  assert.equal(ctx.getImageData(5, 5, 1, 1).data[3], 0);
  // Vista previa del frente (900 px, lila) y la conjunta con los dos lados.
  assert.equal(out.previas.length, 1);
  assert.deepEqual(out.previas[0].datos, { vista: 'frente', nombre: 'Frente', zonas: ['pecho'] });
  const previa = await loadImage(out.previas[0].buffer);
  assert.equal(previa.width, 900);
  const conjunta = await loadImage(out.conjunta);
  assert.ok(conjunta.width > 1800);
  // La prenda blanca se tiñe de negro (el centro de la tela, fuera del diseño).
  const p = createCanvas(previa.width, previa.height); const pctx = p.getContext('2d'); pctx.drawImage(previa, 0, 0);
  const tela = pctx.getImageData(200, 900, 1, 1).data;
  assert.ok(tela[0] < 60 && tela[1] < 60 && tela[2] < 60, `tela ${[...tela]}`);
});

test('las letras de la web están registradas y las que faltan caen en Montserrat', () => {
  render.registrarFuentes();
  for (const familia of ['Montserrat', 'Bebas Neue', 'Back to Black', 'Varsity Team Bold', 'Crimson Pro', 'Cinzel']) assert.ok(render.familiasDisponibles.has(familia), familia);
  assert.equal(render.propiedadesTexto({ fuente: 'Inventada', tamano: 90 }).fontFamily, 'Montserrat');
});
