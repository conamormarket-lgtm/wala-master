import { useEffect, useState } from 'react';
import { toDirectImageUrl } from '../../../utils/imageUrl';
import { fotoChicaPorFetch } from '../../../components/common/OptimizedImage/OptimizedImage';

/*
 * El color del fondo de una foto, para que el aro de la categoría lo repita
 * (la billetera sobre beige → aro beige). Se mira el borde del círculo, que
 * es lo que queda junto al aro: si ahí el color es parejo, es el fondo; si
 * varía mucho (una foto sin fondo liso) o es casi blanco (el aro se perdería
 * sobre la página), no hay color y se usa el acento de siempre.
 *
 * Se lee una copia de 64 px (Cloudinary, o Storage si no) en un canvas de
 * 40 × 40 una sola vez por foto: el resultado queda en localStorage (las
 * últimas 300), así que en las visitas siguientes el aro sale ya con su color.
 */
const CLAVE = 'wala_color_fondo_fotos';
const MAXIMO = 300;
const LADO = 40;
const DISPERSION_MAXIMA = 34;
const LUZ_MAXIMA = 0.93;

let guardados = null;
const leerGuardados = () => {
  if (guardados) return guardados;
  try { guardados = JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { guardados = {}; }
  return guardados;
};
const guardar = (url, color) => {
  const todos = leerGuardados();
  delete todos[url];
  todos[url] = color;
  const claves = Object.keys(todos);
  if (claves.length > MAXIMO) claves.slice(0, claves.length - MAXIMO).forEach((k) => delete todos[k]);
  try { localStorage.setItem(CLAVE, JSON.stringify(todos)); } catch { /* sin storage: solo en memoria */ }
};

const cargar = (src) => new Promise((resolver, rechazar) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.onload = () => resolver(img);
  img.onerror = rechazar;
  img.src = src;
});

const mediana = (valores) => {
  const v = [...valores].sort((a, b) => a - b);
  return v[v.length >> 1];
};

/** '' si no hay un fondo parejo; si no, 'rgb(r g b)'. */
function colorDelBorde(img) {
  const canvas = document.createElement('canvas');
  canvas.width = LADO;
  canvas.height = LADO;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // Como object-fit: cover en un cuadro: el centro de la foto.
  const lado = Math.min(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, LADO, LADO);
  const { data } = ctx.getImageData(0, 0, LADO, LADO);
  const muestras = [];
  for (let grados = 0; grados < 360; grados += 8) {
    for (const r of [0.84, 0.92]) {
      const x = Math.round(LADO / 2 + Math.cos((grados * Math.PI) / 180) * r * (LADO / 2 - 0.5));
      const y = Math.round(LADO / 2 + Math.sin((grados * Math.PI) / 180) * r * (LADO / 2 - 0.5));
      const i = (y * LADO + x) * 4;
      if (data[i + 3] >= 200) muestras.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  if (muestras.length < 24) return '';
  const centro = [0, 1, 2].map((c) => mediana(muestras.map((m) => m[c])));
  // Parejo si la mayoría queda cerca de la mediana (un objeto que toca el
  // borde en un lado no lo arruina; una foto entera, sí).
  const cerca = muestras.filter((m) => Math.hypot(m[0] - centro[0], m[1] - centro[1], m[2] - centro[2]) <= DISPERSION_MAXIMA).length;
  if (cerca / muestras.length < 0.7) return '';
  const luz = (0.2126 * centro[0] + 0.7152 * centro[1] + 0.0722 * centro[2]) / 255;
  if (luz > LUZ_MAXIMA) return '';
  return `rgb(${centro[0]} ${centro[1]} ${centro[2]})`;
}

const enCurso = new Map();
function medir(url) {
  if (enCurso.has(url)) return enCurso.get(url);
  const directa = toDirectImageUrl(url);
  const chica = fotoChicaPorFetch(directa, 64);
  const promesa = (chica ? cargar(chica).catch(() => cargar(directa)) : cargar(directa))
    .then(colorDelBorde)
    // Sin CORS o sin foto: sin color (y no se vuelve a intentar).
    .catch(() => '')
    .then((color) => { guardar(url, color); enCurso.delete(url); return color; });
  enCurso.set(url, promesa);
  return promesa;
}

/** El color de fondo de la foto `url` ('' mientras se mide o si no tiene). */
export function useColorDeFondo(url) {
  const [color, setColor] = useState(() => (url && typeof window !== 'undefined' ? leerGuardados()[url] || '' : ''));
  useEffect(() => {
    if (!url) { setColor(''); return undefined; }
    const ya = leerGuardados()[url];
    if (ya !== undefined) { setColor(ya); return undefined; }
    let vivo = true;
    medir(url).then((c) => { if (vivo) setColor(c); });
    return () => { vivo = false; };
  }, [url]);
  return color;
}
