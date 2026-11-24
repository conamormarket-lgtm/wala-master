import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import s from './Grafico.module.css';

/*
 * Un gráfico de tendencia del admin (Pagos en D3b; Resultados en D4).
 * Reemplaza TrendChart (recharts): un SVG liviano, una sola escala, líneas
 * de 2 px, la leyenda con el total de cada serie y, al pasar o con las
 * flechas, la guía vertical y el recuadro con los valores de ese punto.
 * Los colores son de dos en dos y están validados para la vista clara y la
 * de noche (guía: ADMIN.md, D3b).
 */

const ALTO_EJE_X = 22;
const ANCHO_EJE_Y = 34;
const ARRIBA = 10;

/* El paso del eje (1, 2 o 5 × 10ⁿ) para que 4 pasos cubran el máximo: las marcas son siempre redondas. */
function pasoRedondo(max) {
  if (max <= 4) return 1;
  const crudo = max / 4;
  const p = 10 ** Math.floor(Math.log10(crudo));
  return [1, 2, 5, 10].find((k) => k * p >= crudo) * p;
}

/* Una barra con las dos esquinas de arriba redondeadas (4 px) y la base recta en el eje. */
function barra(x, y, w, h) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Tendencia en el tiempo.
 *  - datos: [{ etiqueta: '03/10', valores: { generados: 2, pagados: 1 } }] (en orden y sin huecos)
 *  - series: [{ id: 'generados', nombre: 'Generados', tono: 'violeta' | 'menta' }]
 *  - forma: 'lineas' (una tendencia) | 'barras' (cantidades sueltas por día, lado a lado)
 *  - titulo · subtitulo · alto (px del área) · formato(n) → texto · vacio (texto)
 */
export function GraficoTendencia({ datos: dias = [], series = [], forma = 'lineas', titulo, subtitulo, alto = 200, formato = (n) => String(n), vacio = 'Todavía no hay datos en este rango.' }) {
  const caja = useRef(null);
  const [ancho, setAncho] = useState(600);
  const [punto, setPunto] = useState(null);
  const uid = useId();

  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [dias.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const barras = forma === 'barras';
  // Barras sin lugar (muchos días en un celular): se juntan de a `junta` días para que cada una mida 8 px o más.
  const junta = barras ? Math.max(1, Math.ceil((8 * dias.length) / Math.max(1, ancho - ANCHO_EJE_Y))) : 1;
  const datos = useMemo(() => {
    if (junta === 1) return dias;
    const grupos = [];
    for (let i = 0; i < dias.length; i += junta) {
      const tramo = dias.slice(i, i + junta);
      grupos.push({
        etiqueta: tramo[0].etiqueta,
        rango: tramo.length > 1 ? `${tramo[0].etiqueta}–${tramo[tramo.length - 1].etiqueta}` : tramo[0].etiqueta,
        valores: Object.fromEntries(series.map((x) => [x.id, tramo.reduce((a, d) => a + (Number(d.valores?.[x.id]) || 0), 0)])),
      });
    }
    return grupos;
  }, [dias, junta, series]);

  const paso = useMemo(() => pasoRedondo(Math.max(0, ...datos.flatMap((d) => series.map((x) => Number(d.valores?.[x.id]) || 0)))), [datos, series]);
  const tope = paso * 4;
  const totales = useMemo(() => Object.fromEntries(series.map((x) => [x.id, dias.reduce((a, d) => a + (Number(d.valores?.[x.id]) || 0), 0)])), [dias, series]);

  const anchoArea = ancho - ANCHO_EJE_Y;
  const n = datos.length;
  const hueco = anchoArea / Math.max(1, n);
  // En barras, cada día es una franja y su centro; en líneas, los puntos van de borde a borde.
  const xDe = (i) => ANCHO_EJE_Y + (barras ? hueco * (i + 0.5) : (n <= 1 ? anchoArea / 2 : (i / (n - 1)) * (anchoArea - 8) + 4));
  const grupo = Math.min(hueco * 0.72, 30);
  const anchoBarra = Math.max(1, (grupo - 2 * (series.length - 1)) / Math.max(1, series.length));
  const yDe = (v) => ARRIBA + alto - (v / tope) * alto;
  const marcas = [0, 1, 2, 3, 4].map((k) => k * paso);
  // Las etiquetas del eje X, unas 6 parejas a lo ancho (siempre la primera y la última).
  const cadaX = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(anchoArea / 70))));
  const conPuntos = !barras && n <= 20;

  const elegirDesde = (clientX) => {
    const r = caja.current?.getBoundingClientRect();
    if (!r || !n) return;
    const x = clientX - r.left;
    let mejor = 0;
    for (let i = 1; i < n; i += 1) if (Math.abs(xDe(i) - x) < Math.abs(xDe(mejor) - x)) mejor = i;
    setPunto(mejor);
  };
  const teclas = (e) => {
    if (!n) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setPunto((p) => Math.min(n - 1, Math.max(0, (p ?? (e.key === 'ArrowRight' ? -1 : n)) + (e.key === 'ArrowRight' ? 1 : -1))));
    } else if (e.key === 'Escape') setPunto(null);
  };

  const elegido = punto != null ? datos[punto] : null;
  const izquierda = punto != null && xDe(punto) > ancho / 2;

  return (
    <figure className={s.grafico} data-componente="GraficoTendencia">
      {(titulo || series.length > 1) && (
        <figcaption className={s.cabeza}>
          <span>
            {titulo && <strong className={s.titulo}>{titulo}</strong>}
            {subtitulo && <span className={s.subtitulo}>{subtitulo}</span>}
            {junta > 1 && <span className={s.subtitulo}>Cada barra junta {junta} días (no caben uno por uno).</span>}
          </span>
          {series.length > 1 && (
            <ul className={s.leyenda}>
              {series.map((x) => (
                <li key={x.id}><span className={`${s.marca} ${s[x.tono || 'violeta']}`} aria-hidden="true" />{x.nombre} <b>{formato(totales[x.id])}</b></li>
              ))}
            </ul>
          )}
        </figcaption>
      )}

      {!n ? (
        <p className={s.vacio}>{vacio}</p>
      ) : (
        <div
          ref={caja}
          className={s.area}
          tabIndex={0}
          role="img"
          aria-label={`${titulo || 'Gráfico'}: ${series.map((x) => `${x.nombre} ${formato(totales[x.id])}`).join(', ')}. Usa las flechas para recorrer los días.`}
          aria-describedby={`${uid}-tabla`}
          onPointerMove={(e) => elegirDesde(e.clientX)}
          onPointerDown={(e) => elegirDesde(e.clientX)}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setPunto(null); }}
          onKeyDown={teclas}
          onBlur={() => setPunto(null)}
        >
          <svg width={ancho} height={ARRIBA + alto + ALTO_EJE_X} aria-hidden="true">
            {marcas.map((m) => (
              <g key={m}>
                <line className={s.rejilla} x1={ANCHO_EJE_Y} x2={ancho} y1={yDe(m)} y2={yDe(m)} />
                <text className={s.ejeY} x={ANCHO_EJE_Y - 6} y={yDe(m)} dy="0.32em">{formato(m)}</text>
              </g>
            ))}
            {datos.map((d, i) => ((i % cadaX === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= cadaX / 2) ? (
              // La primera y la última, hacia adentro (centradas se cortan en el borde).
              <text key={d.etiqueta} className={s.ejeX} x={i === n - 1 ? ancho - 2 : i === 0 ? Math.max(ANCHO_EJE_Y, xDe(0) - 14) : xDe(i)} y={ARRIBA + alto + 16} textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}>{d.etiqueta}</text>
            ) : null))}
            {punto != null && (barras
              ? <rect className={s.franja} x={xDe(punto) - hueco / 2} y={ARRIBA} width={hueco} height={alto} rx="4" />
              : <line className={s.guia} x1={xDe(punto)} x2={xDe(punto)} y1={ARRIBA} y2={ARRIBA + alto} />)}
            {barras && series.map((x, k) => (
              <g key={x.id} className={s[x.tono || 'violeta']}>
                {datos.map((d, i) => {
                  const v = Number(d.valores?.[x.id]) || 0;
                  const izq = xDe(i) - grupo / 2 + k * (anchoBarra + 2);
                  return v ? <path key={i} className={s.barra} d={barra(izq, yDe(v), anchoBarra, yDe(0) - yDe(v))} /> : null;
                })}
              </g>
            ))}
            {!barras && series.map((x) => (
              <g key={x.id} className={s[x.tono || 'violeta']}>
                <polyline className={s.linea} points={datos.map((d, i) => `${xDe(i)},${yDe(Number(d.valores?.[x.id]) || 0)}`).join(' ')} />
                {datos.map((d, i) => ((conPuntos || i === punto) ? (
                  <circle key={i} className={s.punto} cx={xDe(i)} cy={yDe(Number(d.valores?.[x.id]) || 0)} r={i === punto ? 5 : 4} />
                ) : null))}
              </g>
            ))}
          </svg>
          {elegido && (
            <div className={s.recuadro} style={{ left: izquierda ? undefined : xDe(punto) + 10, right: izquierda ? ancho - xDe(punto) + 10 : undefined }} aria-hidden="true">
              <strong>{elegido.rango || elegido.etiqueta}</strong>
              {series.map((x) => (
                <span key={x.id}><span className={`${s.marca} ${s[x.tono || 'violeta']}`} />{x.nombre}<b>{formato(Number(elegido.valores?.[x.id]) || 0)}</b></span>
              ))}
            </div>
          )}
          <span className={s.vivo} aria-live="polite">{elegido ? `${elegido.rango || elegido.etiqueta}: ${series.map((x) => `${x.nombre} ${formato(Number(elegido.valores?.[x.id]) || 0)}`).join(', ')}` : ''}</span>
        </div>
      )}

      {/* La misma información en tabla, para lectores de pantalla. */}
      {dias.length > 0 && (
        <table id={`${uid}-tabla`} className={s.oculta}>
          <caption>{titulo || 'Datos del gráfico'}</caption>
          <thead><tr><th scope="col">Día</th>{series.map((x) => <th key={x.id} scope="col">{x.nombre}</th>)}</tr></thead>
          <tbody>{dias.map((d) => <tr key={d.etiqueta}><th scope="row">{d.etiqueta}</th>{series.map((x) => <td key={x.id}>{formato(Number(d.valores?.[x.id]) || 0)}</td>)}</tr>)}</tbody>
        </table>
      )}
    </figure>
  );
}
