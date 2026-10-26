import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Campo, Casilla } from './Formulario';
import { PanelFlotante } from './PanelFlotante';
import { useTexto } from './Traduccion';
import { cambiarDiaMesEvento } from '../../utils/fechaEvento.mjs';
import s from './Fecha.module.css';

/*
 * Fechas sin el calendario del navegador (cada teléfono trae el suyo y se ve
 * ajeno a la tienda): un calendario de Walá, en un panel pegado al campo o en
 * una hoja inferior en el celular.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// Los nombres cortos salen del nombre entero traducido: "Ene" / "Jan", y la inicial del día: "L" / "M".
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const ANIO_SIN = 2000; // año bisiesto: con "No sé el año" el 29 de febrero existe

const dos = (n) => String(n).padStart(2, '0');
const aIso = (a, m, d) => `${a ? String(a).padStart(4, '0') : '0000'}-${dos(m + 1)}-${dos(d)}`;
/** "AAAA-MM-DD" → { a, m (0-11), d } (a = 0 si no se sabe el año). */
const partir = (iso) => {
  const [a, m, d] = String(iso || '').split('-').map(Number);
  return m && d ? { a: a || 0, m: m - 1, d } : null;
};
const diasDelMes = (a, m) => new Date(a || ANIO_SIN, m + 1, 0).getDate();
const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** "Ene" (el mes entero traducido, en tres letras). */
function MesCorto({ m }) {
  return capital(useTexto(capital(MESES[m]))).slice(0, 3);
}

/** "L" (la inicial del día traducido). */
function InicialDia({ dia }) {
  return capital(useTexto(capital(dia))).charAt(0);
}

/** Un día del calendario; aparte para traducir entero su nombre ("12 de julio de 2001"). */
function Dia({ d, mes, anio, ...boton }) {
  const nombre = useTexto(`${d} de ${MESES[mes]}${anio ? ` de ${anio}` : ''}`);
  return <button type="button" data-dia={d} aria-label={nombre} {...boton}>{d}</button>;
}

/** "2001-07-12" → "12 de julio de 2001"; "0000-07-12" → "12 de julio". */
export const fechaEnTexto = (iso) => {
  const f = partir(iso);
  return f ? `${f.d} de ${MESES[f.m]}${f.a ? ` de ${f.a}` : ''}` : '';
};

/**
 * Calendario de Walá (también se puede usar suelto).
 *  - valor ('AAAA-MM-DD'; año 0000 = sin año) · onElegir(iso)
 *  - min, max ('AAAA-MM-DD') · sinAnio: solo día y mes
 *  - vistaInicial: 'dias' | 'anios' (cumpleaños: empezar por el año)
 *  - hoy: Date (para marcar el día de hoy)
 */
export function Calendario({ valor, onElegir, min, max, sinAnio = false, vistaInicial = 'dias', hoy = new Date() }) {
  const elegido = partir(valor);
  const inicio = elegido && (elegido.a || sinAnio) ? elegido : partir(max && new Date(max) < hoy ? max : null) || { a: hoy.getFullYear(), m: hoy.getMonth(), d: hoy.getDate() };
  const [visible, setVisible] = useState({ a: sinAnio ? ANIO_SIN : (inicio.a || hoy.getFullYear()), m: inicio.m });
  const [vista, setVista] = useState(sinAnio && vistaInicial === 'anios' ? 'meses' : vistaInicial);
  const [foco, setFoco] = useState(elegido?.d || 1);
  const [paginaAnios, setPaginaAnios] = useState(Math.floor((inicio.a || hoy.getFullYear()) / 20) * 20);
  const rejilla = useRef(null);
  const pasarFoco = useRef(false);
  const lim = useMemo(() => ({ min: min ? partir(min) : null, max: max ? partir(max) : null }), [min, max]);

  useEffect(() => { if (sinAnio) setVisible((v) => ({ ...v, a: ANIO_SIN })); }, [sinAnio]);
  useEffect(() => {
    if (!pasarFoco.current) return;
    pasarFoco.current = false;
    rejilla.current?.querySelector(`[data-dia="${foco}"]`)?.focus();
  });

  const fuera = (a, m, d) => {
    if (sinAnio) return false;
    const t = a * 10000 + m * 100 + d;
    if (lim.min && t < lim.min.a * 10000 + lim.min.m * 100 + lim.min.d) return true;
    if (lim.max && t > lim.max.a * 10000 + lim.max.m * 100 + lim.max.d) return true;
    return false;
  };
  const moverMes = (paso) => setVisible(({ a, m }) => {
    const n = new Date(a, m + paso, 1);
    return { a: sinAnio ? ANIO_SIN : n.getFullYear(), m: n.getMonth() };
  });

  const total = diasDelMes(visible.a, visible.m);
  const primero = (new Date(visible.a, visible.m, 1).getDay() + 6) % 7; // lunes primero
  const celdas = [...Array(primero).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];

  const teclaDia = (e) => {
    const pasos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (pasos[e.key] != null) {
      e.preventDefault();
      const f = new Date(visible.a, visible.m, foco + pasos[e.key]);
      if (f.getMonth() !== visible.m) setVisible({ a: sinAnio ? ANIO_SIN : f.getFullYear(), m: f.getMonth() });
      setFoco(f.getDate());
      pasarFoco.current = true;
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      moverMes(e.key === 'PageUp' ? -1 : 1);
      setFoco((d) => Math.min(d, diasDelMes(visible.a, visible.m + (e.key === 'PageUp' ? -1 : 1))));
      pasarFoco.current = true;
    }
  };

  const titulo = useTexto(sinAnio ? capital(MESES[visible.m]) : `${capital(MESES[visible.m])} ${visible.a}`);
  const t = {
    antes: useTexto(vista === 'anios' ? 'Años anteriores' : 'Mes anterior'),
    elegir: useTexto(sinAnio ? 'Elegir el mes' : 'Elegir el año y el mes'),
    despues: useTexto(vista === 'anios' ? 'Años siguientes' : 'Mes siguiente'),
  };
  let cuerpo;
  if (vista === 'anios') {
    const anios = Array.from({ length: 20 }, (_, i) => paginaAnios + i);
    cuerpo = (
      <div className={s.rejillaGrande}>
        {anios.map((a) => (
          <button
            key={a}
            type="button"
            className={[s.celdaGrande, a === visible.a && s.elegida, a === hoy.getFullYear() && s.hoy].filter(Boolean).join(' ')}
            disabled={(lim.min && a < lim.min.a) || (lim.max && a > lim.max.a)}
            onClick={() => { setVisible((v) => ({ ...v, a })); setVista('meses'); }}
          >
            {a}
          </button>
        ))}
      </div>
    );
  } else if (vista === 'meses') {
    cuerpo = (
      <div className={s.rejillaGrande}>
        {MESES.map((nombre, m) => (
          <button
            key={nombre}
            type="button"
            className={[s.celdaGrande, m === visible.m && s.elegida].filter(Boolean).join(' ')}
            onClick={() => { setVisible((v) => ({ ...v, m })); setVista('dias'); }}
          >
            <MesCorto m={m} />
          </button>
        ))}
      </div>
    );
  } else {
    cuerpo = (
      <>
        <div className={s.semana} aria-hidden="true">{DIAS.map((d) => <span key={d}><InicialDia dia={d} /></span>)}</div>
        <div className={s.dias} ref={rejilla} role="grid" aria-label={titulo}>
          {celdas.map((d, i) => {
            if (!d) return <span key={`v${i}`} />;
            const sel = elegido && elegido.d === d && elegido.m === visible.m && (sinAnio || elegido.a === visible.a);
            const esHoy = !sinAnio && hoy.getDate() === d && hoy.getMonth() === visible.m && hoy.getFullYear() === visible.a;
            return (
              <Dia
                key={d}
                d={d}
                mes={visible.m}
                anio={sinAnio ? 0 : visible.a}
                tabIndex={d === Math.min(foco, total) ? 0 : -1}
                className={[s.dia, sel && s.elegida, esHoy && s.hoy].filter(Boolean).join(' ')}
                aria-pressed={sel}
                disabled={fuera(visible.a, visible.m, d)}
                onKeyDown={teclaDia}
                onFocus={() => setFoco(d)}
                onClick={() => onElegir?.(aIso(sinAnio ? 0 : visible.a, visible.m, d))}
              />
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className={s.calendario}>
      <div className={s.cabeza}>
        <button
          type="button"
          className={s.flecha}
          aria-label={t.antes}
          onClick={() => (vista === 'anios' ? setPaginaAnios((p) => p - 20) : moverMes(-1))}
          disabled={vista === 'meses'}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className={s.titulo}
          aria-label={t.elegir}
          onClick={() => setVista((v) => (v === 'dias' ? (sinAnio ? 'meses' : 'anios') : 'dias'))}
        >
          {vista === 'anios' ? `${paginaAnios} – ${paginaAnios + 19}` : titulo}
          <ChevronDown aria-hidden="true" className={vista !== 'dias' ? s.girada : undefined} />
        </button>
        <button
          type="button"
          className={s.flecha}
          aria-label={t.despues}
          onClick={() => (vista === 'anios' ? setPaginaAnios((p) => p + 20) : moverMes(1))}
          disabled={vista === 'meses'}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
      {cuerpo}
    </div>
  );
}

/**
 * Campo de fecha: muestra la fecha en palabras ("12 de julio de 2001") y abre
 * el Calendario.
 *  - etiqueta, ayuda, error, placeholder
 *  - valor ('AAAA-MM-DD'; año 0000 = sin año) · onCambiar(iso)
 *  - min, max · vistaInicial ('anios' para cumpleaños)
 *  - anioOpcional: casilla "No sé el año" (fechas de otras personas)
 *  - soloDiaMes: no muestra ni pide año; conserva el que ya estuviera guardado
 *  - disabled: mientras se guarda
 */
export function CampoFecha({
  etiqueta, ayuda, error, placeholder = 'Elige una fecha', valor = '', onCambiar, min, max, vistaInicial = 'dias', anioOpcional = false, soloDiaMes = false, id, disabled = false,
}) {
  const disparador = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState(0);
  // "No sé el año": sale de la fecha (año 0000) o, sin fecha todavía, de la casilla.
  const [sinAnioSuelto, setSinAnioSuelto] = useState(false);
  const sinAnio = soloDiaMes || (anioOpcional && (valor ? String(valor).startsWith('0000') : sinAnioSuelto));
  const texto = useTexto(fechaEnTexto(soloDiaMes && valor ? `0000${valor.slice(4)}` : valor) || undefined);
  const marcador = useTexto(placeholder);
  const elegir = (iso) => { onCambiar?.(soloDiaMes ? cambiarDiaMesEvento(iso, valor) : iso); setAbierto(false); window.setTimeout(() => disparador.current?.focus({ preventScroll: true }), 0); };
  const alternarAnio = (sin) => {
    const f = partir(valor);
    setSinAnioSuelto(sin);
    if (f && sin) onCambiar?.(aIso(0, f.m, f.d));
    else if (f) onCambiar?.(aIso(new Date().getFullYear(), f.m, f.d));
    setClave((k) => k + 1);
  };
  const casilla = anioOpcional && !soloDiaMes && <Casilla etiqueta="No sé el año" activo={sinAnio} onChange={alternarAnio} />;
  return (
    <>
      <Campo
        etiqueta={etiqueta}
        ayuda={ayuda}
        error={error}
        icono={<CalendarDays />}
        id={id}
        disabled={disabled}
        control={(aria) => (
          <button
            ref={disparador}
            type="button"
            disabled={disabled}
            className={s.disparador}
            aria-haspopup="dialog"
            aria-expanded={abierto}
            onClick={() => { setClave((k) => k + 1); setAbierto((v) => !v); }}
            {...aria}
          >
            <span className={texto ? s.valor : s.vacio}>{texto || marcador}</span>
            <ChevronDown aria-hidden="true" className={[s.flechaCampo, abierto && s.girada].filter(Boolean).join(' ')} />
          </button>
        )}
      />
      <PanelFlotante abierto={abierto} onCerrar={() => setAbierto(false)} ancla={disparador} titulo={etiqueta || 'Elige una fecha'} ancho={320} alto={460} pie={casilla}>
        <Calendario key={clave} valor={valor} onElegir={elegir} min={min} max={max} sinAnio={sinAnio} vistaInicial={valor ? 'dias' : vistaInicial} />
      </PanelFlotante>
    </>
  );
}
