import { createContext, createElement, useContext } from 'react';

/*
 * Cómo se nombra lo que se diseña en el estudio: una prenda (polera, casaca)
 * o un producto (cuadro, mousepad, tomatodo). MarcoEstudio lo recibe como
 * `sustantivo` y las piezas de adentro (barra, pasos, panel, atajos) arman sus
 * textos con estas palabras. Sin proveedor, "prenda".
 */
const PALABRAS = {
  prenda: { la: 'la prenda', La: 'La prenda', tu: 'Tu prenda', del: 'de la prenda', completa: 'completa', entera: 'entera' },
  producto: { la: 'el producto', La: 'El producto', tu: 'Tu producto', del: 'del producto', completa: 'completo', entera: 'entero' },
};

const SustantivoCtx = createContext('prenda');

export function ProveedorSustantivo({ sustantivo, children }) {
  return createElement(SustantivoCtx.Provider, { value: PALABRAS[sustantivo] ? sustantivo : 'prenda' }, children);
}

/** Las palabras de la prenda o del producto: { la, La, tu, del, completa, entera }. */
export const usePalabrasEstudio = () => PALABRAS[useContext(SustantivoCtx)];
export const palabrasEstudio = (sustantivo) => PALABRAS[sustantivo] || PALABRAS.prenda;
