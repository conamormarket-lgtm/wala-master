import { useCallback, useRef, useState } from 'react';
import { crearHistorialYoryo } from '../../pages/Crear/historialYoryo.mjs';

export function useHistorialYoryo(inicial) {
  const historial = useRef(null);
  if (!historial.current) historial.current = crearHistorialYoryo(typeof inicial === 'function' ? inicial() : inicial);
  const [datos, publicar] = useState(historial.current.actual);
  const cambiar = useCallback((nuevo, grupo) => publicar(historial.current.cambiar(nuevo, grupo)), []);
  const deshacer = useCallback(() => { const valor = historial.current.deshacer(); publicar(valor); return valor; }, []);
  const rehacer = useCallback(() => { const valor = historial.current.rehacer(); publicar(valor); return valor; }, []);
  return [datos, cambiar, { puedeDeshacer: historial.current.puedeDeshacer, puedeRehacer: historial.current.puedeRehacer, deshacer, rehacer }];
}
