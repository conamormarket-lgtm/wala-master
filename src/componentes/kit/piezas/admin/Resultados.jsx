import React, { useState } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import Boton from '../../Boton';
import { Confirmar } from '../../Feedback';
import { Campo } from '../../Formulario';
import { Enlace } from '../../Enlace';
import { Etiqueta } from '../../Etiquetas';
import { BloqueMetrica, SinDatos } from './Metricas';
import s from './Resultados.module.css';

/*
 * Piezas de Resultados (D4): lo que conviene mejorar, la comparativa con el
 * periodo anterior, quién está ahora en la tienda y los enlaces rotos.
 */

const entero = (n) => new Intl.NumberFormat('es-PE').format(Math.round(Number(n) || 0));
const hora = (ms) => (ms ? new Date(ms).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—');
const fechaHora = (ms) => (ms ? new Date(ms).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const NIVELES = { alta: { texto: 'Urgente', tono: 'peligro' }, media: { texto: 'Importante', tono: 'aviso' }, baja: { texto: 'Cuando puedas', tono: 'neutro' } };

/**
 * Cosas por mejorar (cosasPorMejorar.mjs): cada una con su urgencia y, si
 * lleva a otra parte, su flecha.
 *  - avisos: [{ id, nivel: 'alta' | 'media' | 'baja', titulo, texto, to }]
 */
export function ListaAvisos({ avisos = [], vacio = 'Nada urgente en este periodo. Sigue así.' }) {
  if (!avisos.length) return <SinDatos>{vacio}</SinDatos>;
  return (
    <ul className={s.avisos} data-componente="ListaAvisos">
      {avisos.map((a) => {
        const nivel = NIVELES[a.nivel] || NIVELES.baja;
        const cuerpo = (
          <>
            <span className={s.avisoTextos}>
              <span className={s.avisoTitulo}>{a.titulo}</span>
              <span className={s.avisoTexto}>{a.texto}</span>
            </span>
            <Etiqueta tono={nivel.tono} punto>{nivel.texto}</Etiqueta>
            {a.to && <ChevronRight className={s.flecha} aria-hidden="true" />}
          </>
        );
        return (
          <li key={a.id} className={`${s.aviso} ${s[`nivel_${a.nivel}`] || ''}`}>
            {a.to ? <Enlace to={a.to} className={s.avisoEnlace}>{cuerpo}</Enlace> : <div className={s.avisoEnlace}>{cuerpo}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Este periodo contra el anterior, lado a lado.
 *  - filas: [{ nombre, actual, previo, diferencia, cambio: { texto, bueno } }] (cifrasDelResumen)
 *  - columnas: [actual, previo] ("Hoy", "Ayer")
 */
export function TablaComparativa({ filas = [], columnas = ['Este periodo', 'Periodo anterior'] }) {
  return (
    <div className={s.desliza}>
      <table className={s.tabla} data-componente="TablaComparativa">
        <thead><tr><th scope="col">Qué</th><th scope="col">{columnas[0]}</th><th scope="col">{columnas[1]}</th><th scope="col">Diferencia</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre}>
              <th scope="row">{f.nombre}</th>
              <td data-titulo={columnas[0]}><strong>{f.actual}</strong></td>
              <td data-titulo={columnas[1]}>{f.previo}</td>
              <td data-titulo="Diferencia">
                <span className={f.cambio?.bueno === false ? s.baja : s.sube}>
                  {f.diferencia == null ? f.cambio?.texto : `${f.diferencia}${f.cambio && f.cambio.texto !== '= 0%' ? ` (${f.cambio.texto})` : ''}`}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Quién está ahora en la tienda.
 *  - personas: [{ id, quien, conCuenta, pagina, vistoMs }] · max (10)
 */
export function ListaEnVivo({ personas = [], max = 10 }) {
  if (!personas.length) return <SinDatos>Nadie navegando en este momento.</SinDatos>;
  return (
    <ul className={s.vivo} data-componente="ListaEnVivo">
      {personas.slice(0, max).map((p) => (
        <li key={p.id}>
          <span className={p.conCuenta ? s.conCuenta : s.visitante}>{p.conCuenta ? (p.quien || 'Cliente') : 'Visitante'}</span>
          <span className={s.vivoPagina}>{p.pagina}</span>
          <span className={s.vivoHora}>{hora(p.vistoMs)}</span>
        </li>
      ))}
    </ul>
  );
}

/* Los atajos de un enlace roto de un solo tramo (/promo): crear la landing o llevarlo a una que existe. */
function Atajos({ enlace, landings, crearLandingDe, onRedirigir }) {
  const [destino, setDestino] = useState('');
  const [preguntando, setPreguntando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState('');
  if (enlace.resueltaA) return <span className={s.resuelta}>Ya lleva a /{enlace.resueltaA}</span>;
  if (!enlace.slug) return <span className={s.nota}>No es una landing: corrige el enlace donde se publicó.</span>;
  const landing = landings.find((l) => l.id === destino);
  const redirigir = async () => {
    setPreguntando(false);
    setGuardando(true);
    setFallo('');
    try { await onRedirigir?.(landing.id, enlace.slug); } catch (err) { setFallo(err?.message || 'No se pudo guardar.'); } finally { setGuardando(false); }
  };
  return (
    <div className={s.atajos}>
      {crearLandingDe && <Boton tamano="sm" variante="secundario" to={crearLandingDe(enlace.slug)}>Crear landing</Boton>}
      <span className={s.o}>o</span>
      <div className={s.llevar}>
        <Campo
          etiqueta={`Llevar ${enlace.direccion} a`}
          opciones={[{ valor: '', texto: 'Llevar a…' }, ...landings.map((l) => ({ valor: l.id, texto: `${l.title} (/${l.slug})` }))]}
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
        />
      </div>
      <Boton tamano="sm" variante="contorno" disabled={!landing} cargando={guardando} onClick={() => setPreguntando(true)}>Redirigir</Boton>
      {fallo && <span className={s.error}>{fallo}</span>}
      <Confirmar
        abierta={preguntando}
        titulo={landing ? `¿Llevar ${enlace.direccion} a /${landing.slug}?` : ''}
        texto="Quien entre a esa dirección irá a la landing elegida (como cuando se renombra una)."
        confirmar="Redirigir"
        onConfirmar={redirigir}
        onCancelar={() => setPreguntando(false)}
      />
    </div>
  );
}

/**
 * Enlaces rotos: direcciones que no existen y que la gente pidió (de un
 * anuncio, un QR o una landing borrada), cuántas veces y de dónde venían.
 *  - enlaces: [{ direccion, visitas, personas, ultimaMs, origenes: [{ origen, visitas }], slug, resueltaA }]
 *  - landings: [{ id, title, slug }] · visitas · truncado · cargando · error
 *  - crearLandingDe(slug) → to · onRedirigir(landingId, slug) → promesa
 */
export function TarjetaEnlacesRotos({ enlaces = [], landings = [], visitas = 0, truncado = false, cargando = false, error, crearLandingDe, onRedirigir, id }) {
  const [todos, setTodos] = useState(false);
  const visibles = todos ? enlaces : enlaces.slice(0, 10);
  return (
    <BloqueMetrica
      id={id}
      titulo="Enlaces rotos"
      ayuda="Direcciones que no existen y que la gente pidió: de un anuncio, un QR o una landing borrada."
      acciones={visitas ? <Etiqueta tono="peligro" punto>{entero(visitas)} {visitas === 1 ? 'visita' : 'visitas'}</Etiqueta> : null}
    >
      {cargando ? <SinDatos>Cargando…</SinDatos> : error ? <SinDatos>No se pudieron leer los enlaces rotos: {error}</SinDatos> : !enlaces.length ? (
        <SinDatos>Nadie llegó a una dirección que no existe en este rango.</SinDatos>
      ) : (
        <>
          {truncado && <p className={s.nota}>Solo se leyeron las 1000 visitas más recientes: los conteos se quedan cortos.</p>}
          <ul className={s.rotos} data-componente="TarjetaEnlacesRotos">
            {visibles.map((e) => (
              <li key={e.direccion} className={s.roto}>
                <div className={s.rotoCabeza}>
                  <code className={s.direccion} title={e.direccion}>{e.direccion}</code>
                  <strong>{entero(e.visitas)} {e.visitas === 1 ? 'visita' : 'visitas'}</strong>
                </div>
                <p className={s.nota}>{entero(e.personas)} {e.personas === 1 ? 'persona' : 'personas'} · la última {fechaHora(e.ultimaMs)}</p>
                <ul className={s.origenes} aria-label="De dónde venían">
                  {(e.origenes || []).slice(0, 3).map((o) => <li key={o.origen}><ExternalLink aria-hidden="true" />{o.origen} · {entero(o.visitas)}</li>)}
                  {(e.origenes || []).length > 3 && <li>+{e.origenes.length - 3} más</li>}
                </ul>
                <Atajos enlace={e} landings={landings} crearLandingDe={crearLandingDe} onRedirigir={onRedirigir} />
              </li>
            ))}
          </ul>
          {enlaces.length > 10 && <Boton tamano="sm" variante="fantasma" onClick={() => setTodos((t) => !t)}>{todos ? 'Ver menos' : `Ver los ${enlaces.length}`}</Boton>}
        </>
      )}
    </BloqueMetrica>
  );
}
