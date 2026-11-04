import React, { useId, useState } from 'react';
import { ChevronDown, ImageOff, Info } from 'lucide-react';
import { Hueso } from '../../Esqueletos';
import { CampoFecha } from '../../Fecha';
import { Interruptor } from '../../Formulario';
import s from './Metricas.module.css';

/*
 * Las cifras y bloques de las páginas del admin con números (recepción,
 * pagos, Resultados). Reemplazan KpiCard / KpiRow y las piezas de
 * resultados/piezas.jsx: la cifra en letra de marca, su nombre, su cambio
 * contra el periodo anterior y, si se toca, filtra la lista de abajo.
 */

/**
 * Una cifra.
 *  - nombre · valor (ya con formato: "S/ 1,250.00", "12") · ayuda (una línea debajo)
 *  - cambio: { texto: '▲ 12%', bueno } (contra el periodo anterior; verde o rojo, siempre con su flecha)
 *  - explicacion: qué cuenta (se abre con la "i"; no en las que se tocan)
 *  - tono: violeta | exito | aviso | peligro | cielo | neutro (la rayita de color)
 *  - onClick: si se pasa, es un botón (activo = es el filtro puesto)
 */
export function Cifra({ nombre, valor, ayuda, cambio, explicacion, tono = 'violeta', onClick, activo = false, cargando = false }) {
  const [abierta, setAbierta] = useState(false);
  const id = useId();
  const contenido = (
    <>
      <span className={s.nombre}>{nombre}</span>
      {cargando ? <Hueso ancho="60%" alto={26} /> : (
        <span className={s.linea}>
          <strong className={s.valor}>{valor}</strong>
          {cambio && <span className={cambio.bueno ? s.sube : s.baja}>{cambio.texto}</span>}
        </span>
      )}
      {ayuda && <span className={s.ayuda}>{ayuda}</span>}
    </>
  );
  const cls = [s.cifra, s[tono], onClick && s.tocable, activo && s.activa].filter(Boolean).join(' ');
  if (onClick) {
    return <button type="button" className={cls} onClick={onClick} aria-pressed={activo} data-componente="Cifra">{contenido}</button>;
  }
  return (
    <div className={cls} data-componente="Cifra">
      {contenido}
      {explicacion && (
        <>
          <button type="button" className={s.info} aria-expanded={abierta} aria-controls={id} aria-label={`Qué cuenta «${nombre}»`} onClick={() => setAbierta((a) => !a)}>
            <Info aria-hidden="true" />
          </button>
          <span id={id} className={s.explicacion} hidden={!abierta}>{explicacion}</span>
        </>
      )}
    </div>
  );
}

/** La fila de cifras: en columnas parejas; en el celular, de a dos (la última sola, a todo el ancho). */
export function FilaCifras({ children, etiqueta = 'Resumen' }) {
  return <div className={s.fila} role="group" aria-label={etiqueta} data-componente="FilaCifras">{children}</div>;
}

/**
 * Un bloque de una página de números (reemplaza Tarjeta de resultados/piezas).
 *  - titulo · ayuda · acciones (a la derecha del título: "Ver todos") · id · children
 */
export function BloqueMetrica({ titulo, ayuda, acciones, id, children }) {
  const auto = useId();
  const idTitulo = id || auto;
  return (
    <section className={s.bloque} aria-labelledby={titulo ? idTitulo : undefined} data-componente="BloqueMetrica">
      {(titulo || acciones) && (
        <div className={s.bloqueCabeza}>
          {titulo && <h2 id={idTitulo} className={s.bloqueTitulo}>{titulo}</h2>}
          {acciones}
        </div>
      )}
      {ayuda && <p className={s.bloqueAyuda}>{ayuda}</p>}
      {children}
    </section>
  );
}

/**
 * "Ver los 32" / "Ver menos" bajo una lista larga: así una tarjeta no estira
 * la página (y la de al lado no parece vacía).
 *  - total · inicial (cuántos se ven cerrada) · abierto · onCambiar(bool) · unidad: ['carrito', 'carritos']
 */
export function VerTodos({ total = 0, inicial = 0, abierto = false, onCambiar, unidad = ['más', 'más'] }) {
  if (total <= inicial) return null;
  return (
    <button type="button" className={s.verTodos} aria-expanded={abierto} onClick={() => onCambiar?.(!abierto)}>
      {abierto ? 'Ver menos' : `Ver ${total === 1 ? 'el' : 'los'} ${total} ${total === 1 ? unidad[0] : unidad[1]}`}
      <ChevronDown aria-hidden="true" className={abierto ? s.verTodosAbierto : undefined} />
    </button>
  );
}

/** Dos bloques lado a lado cuando hay ancho; uno debajo del otro en el celular. */
export function ColumnasMetricas({ children }) {
  return <div className={s.columnas}>{children}</div>;
}

/** Un texto de "no hay datos" dentro de un bloque. */
export const SinDatos = ({ children }) => <p className={s.sinDatos}>{children}</p>;

/**
 * Un ranking: cada fila con su nombre, su valor y una barra del largo que le
 * toca frente a la primera (reemplaza Barras de resultados/piezas).
 *  - filas: [{ id, nombre, valor (número), texto (ya con formato), sub, imagen }]
 *    (con `imagen` en la fila, sale su foto, aunque esté vacía)
 *  - max (10) · tono: 'violeta' | 'menta' · vacio (texto)
 *  - conCeros: también las filas en 0 (los pasos de un embudo, las estrellas)
 *  - inicial: cuántas se ven antes de "Ver todos" (sin él, todas las de max) · unidad: ['país', 'países']
 */
export function ListaBarras({ filas = [], max = 10, tono = 'violeta', vacio = 'Sin datos en este periodo.', conCeros = false, inicial, unidad }) {
  const [abierta, setAbierta] = useState(false);
  const todas = filas.filter((f) => conCeros || Number(f.valor) > 0).slice(0, max);
  if (!todas.length || !todas.some((f) => Number(f.valor) > 0)) return <SinDatos>{vacio}</SinDatos>;
  const tope = Math.max(...todas.map((f) => Number(f.valor) || 0)) || 1;
  const visibles = inicial && !abierta ? todas.slice(0, inicial) : todas;
  return (
    <>
    <ol className={`${s.barras} ${s[`barras_${tono}`] || ''}`} data-componente="ListaBarras">
      {visibles.map((f) => (
        <li key={f.id ?? f.nombre} className={s.barraFila}>
          {f.imagen !== undefined && (
            <span className={s.miniatura}>{f.imagen ? <img src={f.imagen} alt="" loading="lazy" /> : <ImageOff aria-hidden="true" />}</span>
          )}
          <span className={s.barraCuerpo}>
            <span className={s.barraTexto}>
              <span className={s.barraNombre} title={f.nombre}>{f.nombre}</span>
              <span className={s.barraValor}>{f.texto ?? f.valor}</span>
            </span>
            <span className={s.pista} aria-hidden="true">
              <span className={s.relleno} style={{ width: `${Number(f.valor) > 0 ? Math.max(3, Math.round(((Number(f.valor) || 0) / tope) * 100)) : 0}%` }} />
            </span>
            {f.sub && <span className={s.barraSub}>{f.sub}</span>}
          </span>
        </li>
      ))}
    </ol>
    {inicial ? <VerTodos total={todas.length} inicial={inicial} abierto={abierta} onCambiar={setAbierta} unidad={unidad} /> : null}
    </>
  );
}

/**
 * Elegir el periodo: botones en fila (se desliza en el celular) y, con
 * "Fechas", los dos campos de fecha. Reemplaza el SelectorPeriodo de
 * ResultadosLayout.
 *  - opciones: [{ id, texto }] (PERIODOS_RESULTADOS) · valor (id) · onCambiar(id)
 *  - desde · hasta ('AAAA-MM-DD') · onFechas(desde, hasta) · max (hoy)
 *  - comparar · onComparar(si) · textoComparar ("Comparar con el periodo anterior")
 */
export function SelectorPeriodo({ opciones = [], valor, onCambiar, desde = '', hasta = '', onFechas, max, comparar, onComparar, textoComparar = 'Comparar con el periodo anterior' }) {
  return (
    <div className={s.periodo} data-componente="SelectorPeriodo">
      <div className={s.segmentos} role="group" aria-label="Periodo">
        {opciones.map((o) => (
          <button key={o.id} type="button" className={valor === o.id ? s.segActivo : s.seg} aria-pressed={valor === o.id} onClick={() => onCambiar?.(o.id)}>
            {o.texto}
          </button>
        ))}
      </div>
      {valor === 'fechas' && (
        <div className={s.fechas}>
          <CampoFecha etiqueta="Desde" valor={desde} max={hasta || max} onCambiar={(v) => onFechas?.(v, hasta)} />
          <CampoFecha etiqueta="Hasta" valor={hasta} min={desde || undefined} max={max} onCambiar={(v) => onFechas?.(desde, v)} />
        </div>
      )}
      {onComparar && <Interruptor etiqueta={textoComparar} activo={Boolean(comparar)} onChange={onComparar} />}
    </div>
  );
}
