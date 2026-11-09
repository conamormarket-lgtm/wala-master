import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, ArrowRight, Medal, Gem, CheckCircle2, Gift, MessageCircle, Download } from 'lucide-react';
import Boton from '../Boton';
import { CostoMonedas, GananciaMonedas, Moneda } from '../Etiquetas';
import { Sello } from '../Marca';
import { Texto, useTexto } from '../Traduccion';
import { TextoResaltado } from './TextoResaltado';
import { IconoWala } from '../IconosWala';
import { FotoProducto } from './FotoProducto';
import { BarraProgreso } from './BarraProgreso';
import s from './Recompensas.module.css';

/*
 * Piezas de las recompensas de la cuenta: una recompensa del catálogo, un
 * cupón, una misión del día y el nivel por experiencia. Datos por props; las
 * acciones que van al servidor (canjear, completar) son promesas: la pieza
 * muestra "cargando" mientras tanto.
 */

const miles = (n) => Number(n || 0).toLocaleString('es-PE');

/**
 * Una recompensa del catálogo (rewardsCatalog).
 *  - titulo, descripcion, imagen (con fondo blanco: va en FotoProducto)
 *  - beneficio: "15% de descuento" (en texto, bajo el título: la etiqueta
 *    colgante es solo de los productos)
 *  - costo, saldo: con saldo menor, "Te faltan N" en vez de "Canjear"
 *  - onCanjear(): promesa; antes pide confirmar en la misma tarjeta
 *  - confirmando, onConfirmar(abierta): la confirmación controlada por la
 *    página (una sola abierta a la vez); sin ellas, la tarjeta la lleva sola
 *  - obtenida: una recompensa de una sola vez (un pack de stickers, o una que
 *    el admin marcó «Una vez por persona») que la persona ya canjeó: "Ya es
 *    tuyo" (los stickers) o "Ya la canjeaste" y el enlace a urlObtenida
 */
export function TarjetaRecompensa({ titulo, descripcion, imagen, beneficio, costo = 0, saldo = 0, onCanjear, confirmando, onConfirmar, obtenida = false, stickers = false, urlObtenida = '/cuenta/cupones' }) {
  const [confirmarPropio, setConfirmarPropio] = useState(false);
  const controlada = confirmando !== undefined;
  const confirmar = controlada ? confirmando : confirmarPropio;
  const setConfirmar = (v) => (controlada ? onConfirmar?.(v) : setConfirmarPropio(v));
  const [canjeando, setCanjeando] = useState(false);
  const etiquetaCanjear = useTexto('Canjear');
  const faltan = obtenida ? 0 : Math.max(0, costo - saldo);
  const canjear = async () => {
    setCanjeando(true);
    try { await onCanjear?.(); } finally { setCanjeando(false); setConfirmar(false); }
  };
  return (
    <article className={[s.recompensa, faltan > 0 && s.lejos].filter(Boolean).join(' ')} data-componente="TarjetaRecompensa">
      <FotoProducto
        className={s.recompensaFoto}
        src={imagen}
        respaldo={<span className={s.recompensaRespaldo}><IconoWala nombre="regalo" tamano={64} girar={-6} /></span>}
      />
      <div className={s.recompensaCuerpo}>
        <h3 className={s.recompensaTitulo}><Texto>{titulo}</Texto></h3>
        {beneficio && <p className={s.beneficio}><Gift aria-hidden="true" /> <Texto>{beneficio}</Texto></p>}
        {descripcion && <p className={s.recompensaTexto}><Texto>{descripcion}</Texto></p>}
      </div>
      <div className={s.recompensaPie}>
        {obtenida ? (
          <>
            <span className={s.obtenida}><CheckCircle2 aria-hidden="true" /> <Texto>{stickers ? 'Ya es tuyo' : 'Ya la canjeaste'}</Texto></span>
            <Boton to={urlObtenida} tamano="sm" variante="contorno" iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Ver en Mis cupones</Texto></Boton>
          </>
        ) : confirmar ? (
          <div className={s.confirmar} role="group" aria-label={`${etiquetaCanjear} ${titulo}`}>
            <span className={s.confirmarTexto}><Texto>¿Canjear por</Texto> <Moneda /> <strong>{miles(costo)}</strong>?</span>
            <span className={s.confirmarBotones}>
              <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmar(false)} disabled={canjeando}><Texto>Cancelar</Texto></Boton>
              <Boton tamano="sm" cargando={canjeando} onClick={canjear}><Texto>Sí, canjear</Texto></Boton>
            </span>
          </div>
        ) : (
          <>
            <CostoMonedas monto={costo} />
            {faltan > 0 ? (
              <span className={s.faltan}><Texto>Te faltan</Texto> <Moneda /> <strong>{miles(faltan)}</strong></span>
            ) : (
              onCanjear && <Boton tamano="sm" onClick={() => setConfirmar(true)}><Texto>Canjear</Texto></Boton>
            )}
          </>
        )}
      </div>
    </article>
  );
}

const ORIGENES = {
  ruleta: { texto: 'La Ruleta de Kapi', icono: 'estrella', clase: 'talonRuleta' },
  recompensa: { texto: 'Catálogo de recompensas', icono: 'regalo', clase: 'talonCatalogo' },
  nivel: { texto: 'Regalo de nivel', icono: 'estrella', clase: 'talonCatalogo' },
  bolitas_reto: { texto: 'Reto de Las Bolitas', icono: 'destello', clase: 'talonBolitas' },
  bolitas_semana: { texto: 'Ranking de Las Bolitas', icono: 'estrella', clase: 'talonRanking' },
  pichanga_mes: { texto: 'Goleadores de La Pichanga', icono: 'estrella', clase: 'talonRanking' },
};
const ESTADOS_CUPON = { activo: 'Disponible', usado: 'Usado', caducado: 'Vencido' };

/**
 * Un cupón del cliente (userCoupons): un boleto con su talón troquelado. El
 * talón dice de dónde salió (ruleta o catálogo); el código se copia con un
 * toque.
 *  - texto: lo que da ("10% en tu próxima compra") · codigo
 *  - origen: 'ruleta' | 'recompensa' | 'nivel' | 'bolitas_reto' | 'bolitas_semana'
 *    (sin origen: catálogo, sin nombre)
 *  - marca: el nombre de la marca si el cupón solo vale en ella («Solo en …»)
 *  - estado: 'activo' | 'usado' | 'caducado' (estadoCupon de services/cupones)
 *  - vence: texto ya legible ("31 de octubre") · conAsesor: se canjea con un asesor
 *  - onCopiar(codigo): promesa o nada; si falla, la página avisa
 */
export function TarjetaCupon({ texto, codigo, origen, marca, estado = 'activo', vence, conAsesor = false, onCopiar }) {
  const [copiado, setCopiado] = useState(false);
  const reloj = useRef(null);
  useEffect(() => () => window.clearTimeout(reloj.current), []);
  const o = ORIGENES[origen] || ORIGENES.recompensa;
  const usable = estado === 'activo';
  const t = { copiado: useTexto('Código copiado'), copiar: useTexto('Copiar el código') };
  const copiar = async () => {
    try {
      await onCopiar?.(codigo);
      setCopiado(true);
      window.clearTimeout(reloj.current);
      reloj.current = window.setTimeout(() => setCopiado(false), 2000);
    } catch { /* la página avisa */ }
  };
  return (
    <article className={[s.cupon, !usable && s.cuponInactivo].filter(Boolean).join(' ')} data-componente="TarjetaCupon">
      <div className={`${s.talon} ${s[o.clase]}`}>
        <IconoWala nombre={o.icono} tamano={46} girar={-8} />
      </div>
      <div className={s.cuponCuerpo}>
        <p className={s.cuponMeta}>
          <span className={`${s.cuponEstado} ${s[`estado_${estado}`]}`}><Texto>{ESTADOS_CUPON[estado] || estado}</Texto></span>
          {origen && <span className={s.cuponOrigen}><Texto>{o.texto}</Texto></span>}
          {marca && <span className={s.cuponMarca}><Texto>Solo en</Texto> {marca}</span>}
        </p>
        <h3 className={s.cuponTexto}><Texto>{texto}</Texto></h3>
        <div className={s.codigo}>
          <code>{codigo}</code>
          {usable && onCopiar && (
            <button type="button" className={s.copiar} onClick={copiar} aria-label={copiado ? t.copiado : `${t.copiar} ${codigo}`}>
              {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              <span><Texto>{copiado ? 'Copiado' : 'Copiar'}</Texto></span>
            </button>
          )}
        </div>
        {vence && estado !== 'usado' && (
          <p className={s.vence}><Texto>{estado === 'caducado' ? 'Venció el' : 'Válido hasta el'}</Texto> {vence}</p>
        )}
        {usable && conAsesor && <p className={s.vence}><Texto>Este cupón se canjea con un asesor.</Texto></p>}
      </div>
    </article>
  );
}

/**
 * Un pack de stickers de WhatsApp canjeado. Se añade desde la app de Android;
 * en la web (o en una versión vieja de la app) lleva a Google Play.
 *  - nombre · cantidad · muestras: [url] (unos cuantos stickers)
 *  - modo: 'app' (se puede añadir aquí) | 'web' | 'actualizar' (app sin el botón)
 *  - agregado: ya está en su WhatsApp · procesando · error: texto
 *  - onAgregar() · urlPlayStore
 */
export function TarjetaStickers({ nombre, cantidad = 0, muestras = [], modo = 'web', agregado = false, procesando = false, error, onAgregar, urlPlayStore }) {
  return (
    <article className={s.stickers} data-componente="TarjetaStickers">
      <div className={s.stickersMuestras} aria-hidden="true">
        {muestras.slice(0, 4).map((src, i) => <img key={src} src={src} alt="" loading="lazy" style={{ '--i': i }} />)}
      </div>
      <div className={s.stickersCuerpo}>
        <p className={s.cuponMeta}>
          <span className={`${s.cuponEstado} ${s[agregado ? 'estado_usado' : 'estado_activo']}`}><Texto>{agregado ? 'En tu WhatsApp' : 'Tuyos'}</Texto></span>
          <span className={s.cuponOrigen}><Texto>Stickers de WhatsApp</Texto></span>
        </p>
        <h3 className={s.cuponTexto}><Texto>{nombre}</Texto></h3>
        <p className={s.vence}>
          <Texto>
            {modo === 'app'
              ? (agregado ? `Ya están en tu WhatsApp. Si cambias de teléfono, vuelve a añadirlos desde aquí.` : `${cantidad} stickers para usar en tus chats.`)
              : modo === 'actualizar'
                ? 'Actualiza la app de Walá para añadirlos a WhatsApp.'
                : 'Se añaden a WhatsApp desde la app de Walá para Android.'}
          </Texto>
        </p>
        {error && <p className={s.stickersError} role="alert"><Texto>{error}</Texto></p>}
        <div className={s.stickersAcciones}>
          {modo === 'app' ? (
            <Boton tamano="sm" variante={agregado ? 'contorno' : 'primario'} icono={<MessageCircle aria-hidden="true" />} cargando={procesando} onClick={onAgregar}>
              <Texto>{agregado ? 'Añadir otra vez' : 'Añadir a WhatsApp'}</Texto>
            </Boton>
          ) : (
            <Boton tamano="sm" icono={<Download aria-hidden="true" />} to={urlPlayStore} target="_blank" rel="noopener noreferrer">
              <Texto>{modo === 'actualizar' ? 'Actualizar en Google Play' : 'Descargar en Google Play'}</Texto>
            </Boton>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Una misión del día.
 *  - titulo, descripcion · recompensa: monedas que da
 *  - completada
 *  - accion: { texto, url } si se completa en otra página ("Ir a Mis cupones")
 *  - onCompletar(): promesa (misiones que se marcan aquí)
 */
export function TarjetaMision({ titulo, descripcion, recompensa = 0, completada = false, accion, onCompletar }) {
  const [completando, setCompletando] = useState(false);
  const completar = async () => {
    setCompletando(true);
    try { await onCompletar?.(); } finally { setCompletando(false); }
  };
  return (
    <article className={[s.mision, completada && s.misionHecha].filter(Boolean).join(' ')} data-componente="TarjetaMision">
      <span className={s.misionMarca} aria-hidden="true">
        {completada ? <Sello tamano={34}><Check /></Sello> : <span className={s.misionVacia} />}
      </span>
      <div className={s.misionTextos}>
        <h3 className={s.misionTitulo}><Texto>{titulo}</Texto></h3>
        {descripcion && <p className={s.misionTexto}><Texto>{descripcion}</Texto></p>}
      </div>
      <div className={s.misionLado}>
        <GananciaMonedas monto={recompensa} etiqueta="Ganas" />
        {completada ? (
          <span className={s.hecha}><CheckCircle2 aria-hidden="true" /> <Texto>Completada</Texto></span>
        ) : accion ? (
          <Boton to={accion.url} variante="fantasma" tamano="sm" iconoFin={<ArrowRight aria-hidden="true" />}><Texto>{accion.texto}</Texto></Boton>
        ) : (
          onCompletar && <Boton tamano="sm" cargando={completando} onClick={completar}><Texto>Completar</Texto></Boton>
        )}
      </div>
    </article>
  );
}

/**
 * Los niveles por defecto (la demo). En la tienda llegan de constants/tiers.js
 * por nivelesDesdeTiers (adaptadores), así no se desfasan.
 */
export const NIVELES = [
  { clave: 'bronce', nombre: 'Bronce', min: 0 },
  { clave: 'plata', nombre: 'Plata', min: 100 },
  { clave: 'oro', nombre: 'Oro', min: 300 },
  { clave: 'diamante', nombre: 'Diamante', min: 1000 },
];
const TONO_NIVEL = { bronce: 'bronce', plata: 'plata', oro: 'oro', diamante: 'degradado' };
const iconoNivel = (clave) => (clave === 'diamante' ? <Gem /> : <Medal />);

/**
 * Nivel por experiencia (XP): el actual con su sello, cuánto falta para el
 * siguiente, la barra y la escala de niveles. La XP no se gasta.
 *  - xp · niveles: [{ clave, nombre, min }] (NIVELES por defecto)
 */
export function NivelCuenta({ xp = 0, niveles = NIVELES }) {
  const orden = [...niveles].sort((a, b) => a.min - b.min);
  const k = Math.max(0, orden.reduce((acc, n, i) => (xp >= n.min ? i : acc), 0));
  const actual = orden[k];
  const siguiente = orden[k + 1];
  return (
    <section className={s.nivel} data-componente="NivelCuenta">
      <div className={s.nivelCabeza}>
        <Sello tamano={52} tono={TONO_NIVEL[actual.clave] || 'degradado'}>{iconoNivel(actual.clave)}</Sello>
        <div className={s.nivelTextos}>
          <h2 className={s.nivelNombre}><Texto>Nivel</Texto> <Texto>{actual.nombre}</Texto></h2>
          <p className={s.nivelXp}><TextoResaltado resaltar={[miles(xp)]}>{`${miles(xp)} XP acumulada`}</TextoResaltado></p>
        </div>
        <p className={s.nivelFalta}>
          {siguiente ? <TextoResaltado resaltar={[`${miles(siguiente.min - xp)} XP`]}>{`Faltan ${miles(siguiente.min - xp)} XP para ${siguiente.nombre}`}</TextoResaltado> : <Texto>¡Nivel máximo alcanzado!</Texto>}
          {siguiente?.regalo && <span className={s.nivelRegalo}><Gift aria-hidden="true" /> <Texto>Al llegar:</Texto> <strong><Texto>{siguiente.regalo}</Texto></strong></span>}
        </p>
      </div>
      <BarraProgreso
        valor={siguiente ? xp - actual.min : 1}
        max={siguiente ? siguiente.min - actual.min : 1}
        minimo={4}
        ariaLabel={siguiente ? `Progreso hacia el nivel ${siguiente.nombre}` : 'Nivel máximo'}
      />
      <ol className={s.escala}>
        {orden.map((n, i) => (
          <li key={n.clave} className={[s.escalon, i <= k && s.alcanzado, i === k && s.actual].filter(Boolean).join(' ')} aria-current={i === k ? 'step' : undefined}>
            <Sello tamano={30} girar={0} tono={i <= k ? (TONO_NIVEL[n.clave] || 'degradado') : 'suave'}>{iconoNivel(n.clave)}</Sello>
            <span className={s.escalonTextos}>
              <span><Texto>{n.nombre}</Texto></span>
              <small>{miles(n.min)} XP</small>
              {n.regalo && <small className={s.escalonRegalo}><Texto>{n.regalo}</Texto></small>}
            </span>
          </li>
        ))}
      </ol>
      <p className={s.nivelComo}><Texto>Cómo se gana XP: +10 al entrar a Misiones cada día, +5 por cada misión y +20 por cada pedido entregado. La XP no se gasta y el regalo de cada nivel llega una sola vez a «Mis cupones».</Texto></p>
    </section>
  );
}
