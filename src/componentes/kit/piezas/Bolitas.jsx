import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Star, Trophy, LogIn, Ticket, Store, Megaphone, PawPrint } from 'lucide-react';
import { Estallido } from '../Efectos';
import { Destello } from '../Marca';
import { Pestanas } from '../Navegacion';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { TextoResaltado } from './TextoResaltado';
import { Texto, useTexto } from '../Traduccion';
import { COLORES, CAPACIDAD, tramo, tuboListo } from './bolitasMotor.mjs';
import s from './Bolitas.module.css';

/*
 * Piezas de Las Bolitas de Kapi (/ball-sort): un tubo con sus bolitas. Las
 * reglas, los niveles y el solucionador están en bolitasMotor.mjs (puro, con
 * sus pruebas). Las bolitas viajan de un tubo a otro con `layoutId`
 * (framer-motion): la página envuelve los tubos en un <LayoutGroup>.
 */

export { COLORES, CAPACIDAD, tuboListo };
// Los nombres de antes (la demo y la guía los usan).
export const COLORES_BOLITAS = COLORES.map((c) => c.hex);
export const CAPACIDAD_TUBO = CAPACIDAD;

/** El color de una bolita: el del motor (`c`) o uno puesto a mano (`color`). */
export const colorDe = (b) => b.color || COLORES[b.c]?.hex;

/* Los aros de los tubos, en el orden de la ilustración del juego. */
const AROS = ['#a78bfa', '#f472b6', '#60a5fa', '#fbbf24'];

const RESORTE = { type: 'spring', stiffness: 320, damping: 26, mass: 0.8 };

/**
 * Las estrellas de un nivel (de 0 a 3).
 *  - valor · tamano: 'sm' (el mapa) | 'md' (el nivel) | 'lg' (el resultado)
 *  - animar: entran una por una (el resultado)
 */
export function EstrellasNivel({ valor = 0, tamano = 'sm', animar = false }) {
  const etiqueta = useTexto(valor === 1 ? '1 de 3 estrellas' : `${valor} de 3 estrellas`);
  return (
    <span className={[s.estrellas, s[`estrellas_${tamano}`]].join(' ')} role="img" aria-label={etiqueta}>
      {[0, 1, 2].map((k) => (
        <motion.span
          key={k}
          className={k < valor ? s.estrellaLlena : s.estrellaVacia}
          initial={animar ? { scale: 0, rotate: -40 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: animar ? 0.25 + k * 0.2 : 0, type: 'spring', stiffness: 420, damping: 14 }}
        >
          <Star aria-hidden="true" />
        </motion.span>
      ))}
    </span>
  );
}

/* ── Fase 3: marcas ── */

/**
 * Una marca en el juego: su logo (o la inicial) y su nombre. Con `url`, es un
 * enlace a su tienda (onClick avisa, para las métricas).
 *  - marca: { nombre, logo, url } · tamano: 'sm' | 'md'
 */
export function MarcaBolitas({ marca, tamano = 'sm', onClick }) {
  if (!marca) return null;
  const cuerpo = (
    <>
      {marca.logo
        ? <img src={marca.logo} alt="" className={s.marcaLogo} loading="lazy" />
        : <span className={s.marcaInicial} aria-hidden="true">{marca.nombre?.charAt(0)}</span>}
      <span className={s.marcaNombre}>{marca.nombre}</span>
    </>
  );
  const clase = [s.marca, s[`marca_${tamano}`]].join(' ');
  return marca.url
    ? <Enlace to={marca.url} className={[clase, s.marcaEnlace].join(' ')} onClick={onClick}>{cuerpo}</Enlace>
    : <span className={clase}>{cuerpo}</span>;
}

/**
 * El reto patrocinado: la marca, lo que se gana y cuántos cupones quedan.
 *  - patrocinio: { marca, texto, quedan } · sesion · hecho (ya lo ganó hoy) ·
 *    urlLogin · onClicMarca
 */
export function PatrocinioBolitas({ patrocinio, sesion = true, hecho = false, urlLogin = '/login', onClicMarca }) {
  if (!patrocinio?.marca) return null;
  const { marca, texto, quedan } = patrocinio;
  let nota;
  if (!sesion) nota = 'Inicia sesión para ganar el cupón.';
  else if (hecho) nota = 'Ya ganaste el cupón de hoy: está en Mis cupones.';
  else if (quedan <= 0) nota = 'Ya se entregaron todos los cupones de hoy. El reto sigue en juego para el ranking.';
  else nota = quedan === 1 ? 'Queda 1 cupón.' : `Quedan ${quedan} cupones.`;
  return (
    <div className={s.patrocinio} data-componente="PatrocinioBolitas">
      <p className={s.patrocinioCabeza}><Megaphone aria-hidden="true" /><Texto>Reto patrocinado por</Texto></p>
      <MarcaBolitas marca={marca} tamano="md" onClick={() => onClicMarca?.({ marcaId: marca.id, destino: 'marca' })} />
      {texto && (
        <p className={s.patrocinioPremio}>
          <Ticket aria-hidden="true" />
          <span><Texto>Complétalo y gana:</Texto> <strong><Texto>{texto}</Texto></strong></span>
        </p>
      )}
      <p className={s.patrocinioNota}>
        {sesion || hecho ? <TextoResaltado resaltar={[quedan]}>{nota}</TextoResaltado> : <Texto>{nota}</Texto>}
      </p>
      {!sesion && <Boton to={urlLogin} variante="secundario" tamano="sm" icono={<LogIn aria-hidden="true" />}><Texto>Iniciar sesión</Texto></Boton>}
    </div>
  );
}

/**
 * El cupón que se acaba de ganar (reto patrocinado), en la hoja del resultado.
 *  - cupon: { code, titulo, texto, expiraEn, marcaNombre } · urlCupones
 */
export function CuponGanado({ cupon, urlCupones = '/cuenta/cupones' }) {
  if (!cupon) return null;
  const vence = cupon.expiraEn ? cupon.expiraEn.split('-').reverse().join('/') : null;
  return (
    <div className={s.cupon} data-componente="CuponGanado">
      <Ticket aria-hidden="true" className={s.cuponIcono} />
      <div className={s.cuponCuerpo}>
        <p className={s.cuponTitulo}><Texto>{cupon.marcaNombre ? `¡Ganaste un cupón de ${cupon.marcaNombre}!` : '¡Ganaste un cupón!'}</Texto></p>
        <p className={s.cuponTexto}><Texto>{cupon.texto}</Texto></p>
        <p className={s.cuponCodigo}><code>{cupon.code}</code>{vence && <small><Texto>{`Vence el ${vence}`}</Texto></small>}</p>
      </div>
      <Boton to={urlCupones} variante="secundario" tamano="sm"><Texto>Ver mis cupones</Texto></Boton>
    </div>
  );
}

/**
 * Productos de una marca (al vencer un mundo o el reto patrocinado): hasta 3,
 * con su foto, nombre y precio, y el enlace a la tienda de la marca.
 *  - marca: { id, nombre, url } · productos: [{ url, imagen, nombre, precio }]
 *  - cargando · onClic({ marcaId, destino: 'producto' | 'marca' })
 */
export function ProductosMarca({ marca, productos = [], cargando = false, onClic }) {
  const t = useTexto(marca ? `Conoce ${marca.nombre}` : undefined);
  if (!marca) return null;
  return (
    <section className={s.productos} aria-label={t} data-componente="ProductosMarca">
      <p className={s.productosTitulo}><Store aria-hidden="true" />{t}</p>
      {cargando && !productos.length ? (
        <p className={s.rankingVacio} role="status"><Texto>Cargando productos…</Texto></p>
      ) : (
        <ul className={s.productosLista}>
          {productos.slice(0, 3).map((p) => (
            <li key={p.url}>
              <Enlace to={p.url} className={s.producto} onClick={() => onClic?.({ marcaId: marca.id, destino: 'producto' })}>
                {p.imagen && <img src={p.imagen} alt="" loading="lazy" />}
                <span className={s.productoNombre}>{p.nombre}</span>
                {p.precio != null && <span className={s.productoPrecio}>S/ {Number(p.precio).toFixed(2)}</span>}
              </Enlace>
            </li>
          ))}
        </ul>
      )}
      {marca.url && (
        <Boton to={marca.url} variante="secundario" tamano="sm" icono={<Store aria-hidden="true" />} onClick={() => onClic?.({ marcaId: marca.id, destino: 'marca' })}>
          <Texto>{`Ver la tienda de ${marca.nombre}`}</Texto>
        </Boton>
      )}
    </section>
  );
}

/**
 * El ranking del reto del día: hoy (menos movimientos) y la semana (más retos
 * hechos; empate, menos movimientos en total). Los nombres llegan cortos
 * ("Lucía R.") desde el servidor y van tal cual; el tuyo va marcado y, si
 * quedaste fuera de los primeros, se dice tu puesto.
 *  - ranking: { hoy: [{ puesto, nombre, movimientos, yo }],
 *    semanal: [{ puesto, nombre, completados, total, yo }],
 *    yo: { hoy, semana, jugadoresHoy, jugadoresSemana } } o null
 *  - cargando · sesion · urlLogin
 */
export function RankingBolitas({ ranking, cargando = false, sesion = true, urlLogin = '/login' }) {
  const [pestana, setPestana] = useState('hoy');
  const t = { tu: useTexto('Tú'), titulo: useTexto('Ranking del reto') };
  const lista = (pestana === 'hoy' ? ranking?.hoy : ranking?.semanal) || [];
  const puesto = pestana === 'hoy' ? ranking?.yo?.hoy : ranking?.yo?.semana;
  const total = pestana === 'hoy' ? ranking?.yo?.jugadoresHoy : ranking?.yo?.jugadoresSemana;
  const fuera = puesto && !lista.some((f) => f.yo);
  let cuerpo;
  if (cargando && !ranking) cuerpo = <p className={s.rankingVacio} role="status"><Texto>Cargando el ranking…</Texto></p>;
  else if (!lista.length) {
    cuerpo = (
      <p className={s.rankingVacio}>
        <Texto>{pestana === 'hoy' ? 'Nadie hizo el reto de hoy todavía. ¡Sé la primera persona!' : 'Todavía nadie hizo un reto esta semana.'}</Texto>
      </p>
    );
  } else {
    cuerpo = (
      <ol className={s.rankingLista}>
        {lista.map((f) => (
          <li key={`${f.puesto}-${f.nombre}`} className={f.yo ? s.rankingYo : undefined}>
            <span className={[s.rankingPuesto, f.puesto <= 3 && s[`podio${f.puesto}`]].filter(Boolean).join(' ')}>{f.puesto}</span>
            <span className={s.rankingNombre}>{f.nombre}{f.yo && <small>{t.tu}</small>}</span>
            <span className={s.rankingValor}>
              {pestana === 'hoy'
                ? <Texto>{f.movimientos === 1 ? '1 movimiento' : `${f.movimientos} movimientos`}</Texto>
                : <Texto>{`${f.completados === 1 ? '1 reto' : `${f.completados} retos`} · ${f.total} mov.`}</Texto>}
            </span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <section className={s.ranking} aria-label={t.titulo} data-componente="RankingBolitas">
      <p className={s.rankingTitulo}><Trophy aria-hidden="true" />{t.titulo}</p>
      <Pestanas opciones={[{ id: 'hoy', texto: 'Hoy' }, { id: 'semana', texto: 'Esta semana' }]} valor={pestana} onChange={setPestana} etiqueta="Ranking del reto" />
      {cuerpo}
      {fuera && (
        <p className={s.rankingNota}>
          <TextoResaltado resaltar={[puesto]}>{total ? `Vas en el puesto ${puesto} de ${total}.` : `Vas en el puesto ${puesto}.`}</TextoResaltado>
        </p>
      )}
      {!sesion && (
        <div className={s.rankingNota}>
          <Texto>Inicia sesión para aparecer en el ranking.</Texto>
          <Boton to={urlLogin} variante="secundario" tamano="sm" icono={<LogIn aria-hidden="true" />}><Texto>Iniciar sesión</Texto></Boton>
        </div>
      )}
    </section>
  );
}

/**
 * Una bolita (con su brillo). `oculta` se ve como "?"; `hielo` (movimientos
 * que le faltan para derretirse) la cubre de hielo con el número.
 */
export function Bolita({ color, id, levantada = false, chica = false, oculta = false, hielo = 0 }) {
  return (
    <motion.span
      layoutId={id}
      layout="position"
      transition={RESORTE}
      className={[s.bolita, chica && s.bolitaChica, oculta && s.oculta, hielo > 0 && s.congelada].filter(Boolean).join(' ')}
      style={oculta ? undefined : { '--bola': color }}
      animate={{ y: levantada ? -28 : 0, scale: levantada ? 1.06 : 1 }}
    >
      {oculta && <span className={s.signo} aria-hidden="true">?</span>}
      {hielo > 0 && <span className={s.hielo} aria-hidden="true">{hielo}</span>}
    </motion.span>
  );
}

/**
 * Un tubo: sus bolitas de abajo hacia arriba. Al elegirlo se levantan las de
 * arriba que se moverían juntas; si se puede soltar aquí, el tubo se marca.
 *  - bolas: [{ id, c | color, oculta, hielo }] · capacidad · elegido · destino · listo
 *  - cortina: el color que lo abre (índice) o null · pista: 'origen' | 'destino'
 *  - onClick · numero (para lectores de pantalla) · chico (la ayuda)
 */
export function TuboBolitas({ bolas = [], capacidad = CAPACIDAD, elegido = false, destino = false, listo = false, cortina = null, pista, onClick, numero, chico = false }) {
  const Etiqueta = onClick ? 'button' : 'span';
  const levantadas = elegido ? tramo(bolas) : 0;
  const colorCortina = cortina != null ? COLORES[cortina] : null;
  const estadoTubo = [
    listo && ', listo',
    elegido && ', elegido',
    colorCortina && `, cerrado hasta completar el ${colorCortina.nombre}`,
    pista && (pista === 'origen' ? ', pista: mueve desde aquí' : ', pista: suelta aquí'),
  ].filter(Boolean).join('');
  const etiqueta = useTexto(onClick ? `Tubo ${numero}: ${bolas.length} de ${capacidad}${estadoTubo}` : undefined);
  return (
    <Etiqueta
      type={onClick ? 'button' : undefined}
      className={[s.tubo, elegido && s.elegido, destino && s.destino, listo && s.listo, pista && s.pista, chico && s.tuboChico].filter(Boolean).join(' ')}
      style={{ '--capacidad': capacidad, '--aro': AROS[((numero || 1) - 1) % AROS.length] }}
      onClick={onClick}
      aria-label={etiqueta}
      aria-pressed={onClick ? elegido : undefined}
      data-componente={chico ? undefined : 'TuboBolitas'}
    >
      <span className={s.aro} aria-hidden="true" />
      <span className={s.vidrio}>
        {bolas.map((b, k) => (
          <Bolita
            key={b.id}
            id={chico ? undefined : b.id}
            color={colorDe(b)}
            oculta={b.oculta}
            hielo={b.hielo}
            levantada={k >= bolas.length - levantadas}
            chica={chico}
          />
        ))}
        {colorCortina && (
          <span className={s.cortina} style={{ '--bola': colorCortina.hex }} aria-hidden="true">
            <Lock className={s.candado} />
            <span className={s.llave} />
          </span>
        )}
      </span>
      <span className={s.base} aria-hidden="true"><PawPrint className={s.huella} /></span>
      {listo && !chico && (
        <>
          <Estallido disparo={`listo-${numero}`} forma="confeti" cantidad={12} distancia={44} colores={[colorDe(bolas[0] || {}), '#8b5cf6', '#f59e0b', '#f472b6']} />
          <span className={s.destellos} aria-hidden="true"><Destello /><Destello /><Destello /></span>
        </>
      )}
    </Etiqueta>
  );
}
