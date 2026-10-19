import { volarMonedasGanadas } from '../../utils/animations';

// Tope de seguridad, el mismo de useEntregaMonedas: si el aviso de fin no
// llegara, la hoja se desbloquea sola un poco tarde.
const TOPE_MS = 8000;

/**
 * Hace volar las monedas ya acreditadas al contador y avisa (promesa) cuando
 * terminan: 'coins-animation-end', que dispara utils/animations. Los juegos
 * del kit la esperan para no dejar cerrar la hoja del premio a media entrega.
 * Con 0 monedas (o algo raro) no hay vuelo y no se espera nada.
 */
export default function entregarMonedas(cantidad) {
  const n = Number(cantidad);
  if (!Number.isFinite(n) || n <= 0) return Promise.resolve();
  return new Promise((resolver) => {
    let tope = null;
    const fin = () => {
      clearTimeout(tope);
      window.removeEventListener('coins-animation-end', fin);
      resolver();
    };
    tope = setTimeout(fin, TOPE_MS);
    window.addEventListener('coins-animation-end', fin);
    volarMonedasGanadas(null, n);
  });
}
