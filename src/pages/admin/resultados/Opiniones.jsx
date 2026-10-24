import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import AdminEncuestaEntregas from '../AdminEncuestaEntregas';
import AdminRespuestasEncuesta from '../AdminRespuestasEncuesta';
import { Interruptor } from './piezas';
import styles from './Opiniones.module.css';

/*
 * Opiniones: ¿qué dicen de nosotros? Las dos encuestas, con el periodo de
 * Resultados. Cada una sigue siendo su propia pantalla (descargar, ver por
 * cliente, editar la encuesta), aquí sin su título ni su selector de fechas.
 */

const pad = (n) => String(n).padStart(2, '0');
const diaLocal = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const ENCUESTAS = [
  { id: 'entregas', label: 'Cómo les fue con su pedido' },
  { id: 'suscripcion', label: 'Encuesta de regalos' },
];

export default function Opiniones() {
  const { filtros } = useOutletContext();
  const [encuesta, setEncuesta] = useState('entregas');
  const { startDateMs, endDateMs } = filtros.dateRange;

  return (
    <div className={styles.pagina}>
      <Interruptor etiqueta="Encuesta" opciones={ENCUESTAS} valor={encuesta} onChange={setEncuesta} />
      {encuesta === 'entregas' ? (
        <AdminEncuestaEntregas embebido desdeMs={startDateMs} hastaMs={endDateMs} />
      ) : (
        <AdminRespuestasEncuesta embebido desde={diaLocal(startDateMs)} hasta={diaLocal(endDateMs)} />
      )}
    </div>
  );
}
