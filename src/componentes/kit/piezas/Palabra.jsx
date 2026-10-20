import React from 'react';
import { Delete, CornerDownLeft, Flame } from 'lucide-react';
import { Pestanas } from '../Navegacion';
import { Avatar } from './Avatar';
import { Texto, useTexto } from '../Traduccion';
import s from './Palabra.module.css';

/*
 * Piezas de la Palabra del día (/palabra-del-dia): las reglas (puras), el
 * tablero, el teclado y el ranking. Los textos pasan por la traducción.
 */

export const INTENTOS_PALABRA = 6;

/** Sin tildes y en mayúsculas (la Ñ se queda: es otra letra). */
export const normalizarPalabra = (t) => String(t || '')
  .toUpperCase()
  .replace(/Ñ/g, '\u0000')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  // eslint-disable-next-line no-control-regex -- \u0000 es la marca que protege la Ñ
  .replace(/\u0000/g, 'Ñ');

/**
 * Cómo le fue a un intento, letra por letra: 'correcta' (en su sitio),
 * 'presente' (en otro sitio) o 'ausente'. En dos pasadas, para que una letra
 * repetida no cuente más veces de las que está.
 */
export function evaluarIntento(intento, objetivo) {
  const a = [...normalizarPalabra(intento)];
  const b = [...normalizarPalabra(objetivo)];
  const resultado = a.map(() => 'ausente');
  const quedan = {};
  b.forEach((l, i) => { if (a[i] === l) resultado[i] = 'correcta'; else quedan[l] = (quedan[l] || 0) + 1; });
  a.forEach((l, i) => {
    if (resultado[i] === 'correcta') return;
    if (quedan[l] > 0) { resultado[i] = 'presente'; quedan[l] -= 1; }
  });
  return resultado;
}

const PESO = { correcta: 3, presente: 2, ausente: 1 };

/** El color de cada tecla según lo jugado (manda el mejor: correcta > presente > ausente). */
export function estadosDeTeclas(filas = []) {
  const estados = {};
  filas.forEach(({ letras = [], evaluacion = [] }) => letras.forEach((l, i) => {
    const e = evaluacion[i];
    if (e && (PESO[e] || 0) > (PESO[estados[l]] || 0)) estados[l] = e;
  }));
  return estados;
}

const NOMBRES = { correcta: 'en su sitio', presente: 'en otro sitio', ausente: 'no está' };

/** Una letra del tablero; al revelarse se voltea y muestra su color por detrás. */
export function FichaPalabra({ letra, estado, activa, revelar, retraso = 0, onClick, tamano }) {
  const Etiqueta = onClick ? 'button' : 'span';
  const t = { estado: useTexto(estado ? NOMBRES[estado] : undefined), vacia: useTexto('vacía') };
  return (
    <Etiqueta
      type={onClick ? 'button' : undefined}
      className={[s.ficha, letra && s.conLetra, estado && s.revelada, revelar && s.volteando, activa && s.activa, tamano === 'chica' && s.chica].filter(Boolean).join(' ')}
      style={{ '--retraso': `${retraso}ms` }}
      onClick={onClick}
      aria-label={letra ? `${letra}${estado ? `, ${t.estado}` : ''}` : t.vacia}
    >
      <span className={s.cara}>{letra}</span>
      {estado && <span className={[s.reverso, s[estado]].join(' ')} aria-hidden="true">{letra}</span>}
    </Etiqueta>
  );
}

/**
 * El tablero: una fila por intento.
 *  - largo (letras) · filas: [{ letras, evaluacion }] las ya enviadas
 *  - actual: [letra | ''] lo que se está escribiendo · indice (la casilla
 *    activa) · onIndice(i): tocar una casilla para corregirla
 *  - sacudir: cambia para sacudir la fila actual (falta algo o no existe)
 *  - revelando: índice de la fila que se acaba de enviar (se voltea)
 */
export function TableroPalabra({ largo = 5, filas = [], actual = [], indice = 0, onIndice, sacudir = 0, revelando = -1, jugando = true }) {
  const etiqueta = useTexto('Tablero');
  return (
    <div className={s.tablero} style={{ '--largo': largo }} role="grid" aria-label={etiqueta} data-componente="TableroPalabra">
      {Array.from({ length: INTENTOS_PALABRA }, (_, f) => {
        const enviada = filas[f];
        const esActual = jugando && f === filas.length;
        return (
          <div key={esActual ? `actual-${sacudir}` : f} className={[s.fila, esActual && sacudir > 0 && s.sacudir].filter(Boolean).join(' ')} role="row">
            {Array.from({ length: largo }, (__, c) => {
              if (enviada) {
                return <FichaPalabra key={c} letra={enviada.letras[c]} estado={enviada.evaluacion[c]} revelar={f === revelando} retraso={c * 140} />;
              }
              if (esActual) {
                return <FichaPalabra key={c} letra={actual[c]} activa={c === indice} onClick={onIndice ? () => onIndice(c) : undefined} />;
              }
              return <FichaPalabra key={c} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

const FILAS_TECLADO = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['ENVIAR', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BORRAR'],
];

/**
 * El teclado en pantalla (con Ñ), cada tecla con el color de lo jugado.
 *  - estados: { letra: 'correcta' | 'presente' | 'ausente' } (estadosDeTeclas)
 *  - onTecla('A' | 'ENVIAR' | 'BORRAR')
 */
export function TecladoPalabra({ estados = {}, onTecla, deshabilitado = false }) {
  const t = { teclado: useTexto('Teclado'), borrar: useTexto('Borrar'), enviar: useTexto('Enviar palabra') };
  return (
    <div className={s.teclado} aria-label={t.teclado} data-componente="TecladoPalabra">
      {FILAS_TECLADO.map((fila) => (
        <div key={fila.join('')} className={s.filaTeclas}>
          {fila.map((tecla) => {
            const especial = tecla === 'ENVIAR' || tecla === 'BORRAR';
            return (
              <button
                key={tecla}
                type="button"
                className={[s.tecla, especial && s.teclaAncha, estados[tecla] && s[`tecla_${estados[tecla]}`]].filter(Boolean).join(' ')}
                onClick={() => onTecla?.(tecla)}
                disabled={deshabilitado}
                aria-label={tecla === 'BORRAR' ? t.borrar : tecla === 'ENVIAR' ? t.enviar : tecla}
              >
                {tecla === 'BORRAR' ? <Delete aria-hidden="true" /> : tecla === 'ENVIAR' ? <><CornerDownLeft aria-hidden="true" /><span><Texto>Enviar</Texto></span></> : tecla}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** La leyenda de colores para "Cómo se juega". */
export function LeyendaPalabra() {
  return (
    <ul className={s.leyenda}>
      <li><FichaPalabra letra="M" estado="correcta" tamano="chica" /><span><Texto>La letra está en la palabra y en el sitio correcto.</Texto></span></li>
      <li><FichaPalabra letra="A" estado="presente" tamano="chica" /><span><Texto>La letra está en la palabra, pero en otro sitio.</Texto></span></li>
      <li><FichaPalabra letra="R" estado="ausente" tamano="chica" /><span><Texto>La letra no está en la palabra.</Texto></span></li>
    </ul>
  );
}

const tiempoEnTexto = (seg) => {
  const n = Number(seg);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const m = Math.floor(n / 60);
  return m ? `${m} min ${n % 60} s` : `${n} s`;
};

/**
 * El ranking: quienes adivinaron hoy (por intentos y tiempo) o el global (por
 * la racha más larga). El tuyo va marcado.
 *  - hoy: [{ id, nombre, intentos, segundos, racha, yo }]
 *  - global: [{ id, nombre, victorias, jugadas, mejorRacha, yo }]
 *  - pestana ('hoy' | 'global') · onPestana · cargando
 */
export function RankingPalabra({ hoy = [], global = [], pestana = 'hoy', onPestana, cargando = false }) {
  const lista = pestana === 'hoy' ? hoy : global;
  // Pestanas traduce sus textos y su etiqueta: van en español.
  const t = {
    ranking: useTexto('Ranking'),
    tu: useTexto('Tú'),
    intentos: useTexto('intentos'),
    victorias: useTexto('victorias'),
    racha: useTexto(pestana === 'hoy' ? 'Racha actual' : 'Mejor racha'),
  };
  return (
    <section className={s.ranking} aria-labelledby="ranking-palabra" data-componente="RankingPalabra">
      <h2 id="ranking-palabra" className={s.rankingTitulo}>{t.ranking}</h2>
      <Pestanas opciones={[{ id: 'hoy', texto: 'Hoy' }, { id: 'global', texto: 'Global' }]} valor={pestana} onChange={onPestana} etiqueta="Ranking" />
      <p className={s.rankingNota}>
        <Texto>{pestana === 'hoy' ? 'Quienes adivinaron la palabra de hoy, por intentos usados.' : 'Por la racha más larga de victorias seguidas.'}</Texto>
      </p>
      {cargando ? (
        <p className={s.rankingVacio} role="status"><Texto>Cargando el ranking…</Texto></p>
      ) : !lista.length ? (
        <p className={s.rankingVacio}>
          <Texto>{pestana === 'hoy' ? 'Nadie ha adivinado la palabra de hoy todavía. ¡Sé la primera persona!' : 'Todavía no hay datos del ranking.'}</Texto>
        </p>
      ) : (
        <ol className={s.rankingLista}>
          {lista.map((p, k) => (
            <li key={p.id || p.nombre} className={p.yo ? s.yo : undefined}>
              <span className={s.puesto}>{k + 1}</span>
              <Avatar nombre={p.nombre} className={s.avatar} />
              <span className={s.persona}>
                <strong>{p.nombre}{p.yo && <small className={s.tu}>{t.tu}</small>}</strong>
                <small>
                  {pestana === 'hoy'
                    ? `${p.intentos}/${INTENTOS_PALABRA} ${t.intentos} · ${tiempoEnTexto(p.segundos)}`
                    : `${p.victorias}/${p.jugadas} ${t.victorias}`}
                </small>
              </span>
              <span className={s.racha} title={t.racha}>
                <Flame aria-hidden="true" />{pestana === 'hoy' ? p.racha : p.mejorRacha}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
