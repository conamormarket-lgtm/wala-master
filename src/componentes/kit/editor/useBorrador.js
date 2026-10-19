import { useCallback, useState } from 'react';

/**
 * Borrador con deshacer/rehacer. Al escribir en un mismo campo los cambios
 * seguidos se juntan en un solo paso (clave + menos de 0,8 s).
 *  cambiar(valor | (valor) => valor, clave?)
 *  reiniciar(valor | (valor) => valor): empieza de nuevo (sin historia, "publicado")
 * El valor puede ser la lista de secciones o cualquier objeto (la tienda guarda
 * toda su configuración: secciones, menú, textos…).
 */
export function useBorrador(inicial = []) {
  const [e, setE] = useState(() => {
    const lista = typeof inicial === 'function' ? inicial() : inicial;
    return { pasado: [], actual: lista, futuro: [], guardado: lista, clave: null, t: 0 };
  });
  const cambiar = useCallback((sig, clave = null) => setE((x) => {
    const actual = typeof sig === 'function' ? sig(x.actual) : sig;
    if (actual === x.actual) return x;
    const ahora = Date.now();
    const juntar = clave && clave === x.clave && ahora - x.t < 800;
    return { ...x, pasado: juntar ? x.pasado : [...x.pasado.slice(-49), x.actual], actual, futuro: [], clave, t: ahora };
  }), []);
  const deshacer = useCallback(() => setE((x) => (x.pasado.length
    ? { ...x, pasado: x.pasado.slice(0, -1), actual: x.pasado[x.pasado.length - 1], futuro: [x.actual, ...x.futuro], clave: null }
    : x)), []);
  const rehacer = useCallback(() => setE((x) => (x.futuro.length
    ? { ...x, pasado: [...x.pasado, x.actual], actual: x.futuro[0], futuro: x.futuro.slice(1), clave: null }
    : x)), []);
  const marcarGuardado = useCallback(() => setE((x) => ({ ...x, guardado: x.actual })), []);
  const reiniciar = useCallback((sig) => setE((x) => {
    const lista = typeof sig === 'function' ? sig(x.actual) : sig;
    return { pasado: [], actual: lista, futuro: [], guardado: lista, clave: null, t: 0 };
  }), []);
  return {
    secciones: e.actual, cambiar, deshacer, rehacer, marcarGuardado, reiniciar,
    puedeDeshacer: e.pasado.length > 0, puedeRehacer: e.futuro.length > 0, sinGuardar: e.actual !== e.guardado,
  };
}
