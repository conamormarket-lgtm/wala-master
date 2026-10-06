// Fecha de un cumpleaños / aniversario con el AÑO OPCIONAL: día y mes en listas
// y el año aparte ("Año en que nació (opcional)"). Entrega "YYYY-MM-DD" con
// "0000" si no se sabe el año (ver utils/fechaEvento.mjs), o '' mientras falte
// el día o el mes.
import React, { useEffect, useState } from 'react';
import { MESES } from '../../../utils/fechasFestivas.mjs';
import { armarFechaEvento, partesFechaEvento, diasDelMes } from '../../../utils/fechaEvento.mjs';
import styles from './FechaEventoInput.module.css';

const ANIO_ACTUAL = new Date().getFullYear();

const FechaEventoInput = ({ value, onChange, etiquetaAnio = 'Año (opcional)', inputClassName = '', id }) => {
  const inicial = partesFechaEvento(value) || { dia: '', mes: '', anio: null };
  const [dia, setDia] = useState(inicial.dia || '');
  const [mes, setMes] = useState(inicial.mes || '');
  const [anio, setAnio] = useState(inicial.anio ? String(inicial.anio) : '');

  // Si el valor cambia desde afuera (otra persona en el mismo modal), se sincroniza.
  useEffect(() => {
    const p = partesFechaEvento(value);
    if (!p) return;
    setDia(p.dia);
    setMes(p.mes);
    setAnio(p.anio ? String(p.anio) : '');
  }, [value]);

  const emitir = (d, m, a) => {
    const anioValido = /^\d{4}$/.test(a) && Number(a) >= 1900 && Number(a) <= ANIO_ACTUAL ? a : '';
    onChange(armarFechaEvento({ dia: d, mes: m, anio: anioValido }));
  };

  const maxDia = mes ? diasDelMes(mes) : 31;
  const anioInvalido = anio !== '' && !(/^\d{4}$/.test(anio) && Number(anio) >= 1900 && Number(anio) <= ANIO_ACTUAL);
  const base = id || 'fecha';

  return (
    <div className={styles.fila}>
      <label className={styles.campo} htmlFor={`${base}-dia`}>
        <span>Día</span>
        <select
          id={`${base}-dia`}
          className={inputClassName}
          value={dia}
          onChange={(e) => {
            setDia(e.target.value);
            emitir(e.target.value, mes, anio);
          }}
        >
          <option value="">—</option>
          {Array.from({ length: maxDia }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      <label className={`${styles.campo} ${styles.mes}`} htmlFor={`${base}-mes`}>
        <span>Mes</span>
        <select
          id={`${base}-mes`}
          className={inputClassName}
          value={mes}
          onChange={(e) => {
            const m = e.target.value;
            // Si el día no existe en el mes nuevo (31 → abril), se baja al último.
            const d = dia && m && Number(dia) > diasDelMes(m) ? diasDelMes(m) : dia;
            setMes(m);
            setDia(d);
            emitir(d, m, anio);
          }}
        >
          <option value="">—</option>
          {MESES.map((nombre, i) => <option key={nombre} value={i + 1}>{nombre}</option>)}
        </select>
      </label>
      <label className={styles.campo} htmlFor={`${base}-anio`}>
        <span>{etiquetaAnio}</span>
        <input
          id={`${base}-anio`}
          className={inputClassName}
          inputMode="numeric"
          maxLength={4}
          placeholder="Ej. 1990"
          value={anio}
          aria-invalid={anioInvalido || undefined}
          onChange={(e) => {
            const a = e.target.value.replace(/\D/g, '').slice(0, 4);
            setAnio(a);
            emitir(dia, mes, a);
          }}
        />
        {anioInvalido && anio.length === 4 && <small className={styles.error}>Revisa el año</small>}
      </label>
    </div>
  );
};

export default FechaEventoInput;
