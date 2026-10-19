import { useCallback, useState } from 'react';

const CLAVE_RECIENTES = 'wala_busquedas_recientes';
const MAX_RECIENTES = 6;

/**
 * Lo que buscaste antes, en ESTE navegador (misma clave que el buscador de la
 * tienda: no se pierde al migrar). Si no hay almacenamiento, lista vacía.
 */
export function useBusquedasRecientes(clave = CLAVE_RECIENTES) {
  const leer = useCallback(() => {
    try {
      const lista = JSON.parse(localStorage.getItem(clave) || '[]');
      return Array.isArray(lista) ? lista.filter((t) => typeof t === 'string') : [];
    } catch (e) {
      return [];
    }
  }, [clave]);
  const [recientes, setRecientes] = useState(leer);
  const guardar = useCallback((termino) => {
    const limpio = String(termino || '').trim();
    if (!limpio) return;
    const nuevas = [limpio, ...leer().filter((t) => t.toLowerCase() !== limpio.toLowerCase())].slice(0, MAX_RECIENTES);
    try { localStorage.setItem(clave, JSON.stringify(nuevas)); } catch (e) { /* sin almacenamiento */ }
    setRecientes(nuevas);
  }, [clave, leer]);
  const limpiar = useCallback(() => {
    try { localStorage.removeItem(clave); } catch (e) { /* sin almacenamiento */ }
    setRecientes([]);
  }, [clave]);
  return { recientes, guardar, limpiar, releer: () => setRecientes(leer()) };
}
