import { cajaSeccion, limitar } from './distribucionYoryo.mjs';

export function transformarSeccionYoryo(elemento, { dx = 0, dy = 0, factor = 1, escala = 100, centrar = false, eje = false, iman = .018 } = {}) {
  const nuevaEscala = Math.round(limitar(escala * factor, 40, 160));
  const k = Math.min(nuevaEscala / escala, .96 / elemento.w, .96 / elemento.h);
  if (eje) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
  let x = centrar ? .5 : elemento.centroX + dx;
  const alineado = Math.abs(x - .5) <= iman;
  if (alineado) x = .5;
  const caja = cajaSeccion({ x, y: elemento.centroY + dy }, elemento.w * k, elemento.h * k);
  return { ...caja, escala: nuevaEscala, iman: alineado && Math.abs(caja.centroX - .5) < .0001 };
}

export function limitarCamaraYoryo({ z = 1, x = 0, y = 0 }, ancho, alto) {
  z = limitar(z, 1, 3);
  return { z, x: limitar(x, -(z - 1) * ancho / 2, (z - 1) * ancho / 2) || 0, y: limitar(y, -(z - 1) * alto / 2, (z - 1) * alto / 2) || 0 };
}

export function zoomCamaraYoryo(camara, factor, ancho, alto, punto = { x: 0, y: 0 }) {
  const z = limitar(camara.z * factor, 1, 3), k = z / camara.z;
  return limitarCamaraYoryo({ z, x: punto.x - (punto.x - camara.x) * k, y: punto.y - (punto.y - camara.y) * k }, ancho, alto);
}
