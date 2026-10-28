import React from 'react';
import { calcularDelta, calcularDeltaPuntos } from './dashboard/dashShared';
import styles from './AdminRespuestasEncuesta.module.css';

/*
 * Línea "▲ 50% · ayer: 2" bajo un número de las encuestas, cuando Resultados
 * compara con el periodo anterior. enPuntos: el número ya es un promedio o un %
 * y la diferencia va en su unidad ("▲ 0,3 ★", "▼ 5 pp"), no en % de un %.
 */
export default function CambioKpi({ actual, previo, contra, enPuntos = false, unidad = 'pp', formato = (v) => v }) {
  if (previo == null) return null;
  const cambio = enPuntos ? calcularDeltaPuntos(actual, previo) : calcularDelta(actual, previo);
  if (!cambio) return null;
  const texto = enPuntos ? cambio.delta.replace(' pp', ` ${unidad}`) : cambio.delta;
  return (
    <small className={cambio.deltaPositive ? styles.kpiSube : styles.kpiBaja}>
      {texto} <em>· {contra}: {formato(previo)}</em>
    </small>
  );
}
