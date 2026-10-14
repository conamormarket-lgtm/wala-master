import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, ArrowRight, Medal, Gem, CheckCircle2 } from 'lucide-react';
import Boton from '../Boton';
import { CostoMonedas, GananciaMonedas, Moneda } from '../Etiquetas';
import { EtiquetaColgante, Sello } from '../Marca';
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
 *  - beneficio: "15% de descuento" (etiqueta colgante sobre la foto)
 *  - costo, saldo: con saldo menor, "Te faltan N" en vez de "Canjear"
 *  - onCanjear(): promesa; antes pide confirmar en la misma tarjeta
 */
export function TarjetaRecompensa({ titulo, descripcion, imagen, beneficio, costo = 0, saldo = 0, onCanjear }) {
  const [confirmar, setConfirmar] = useState(false);
  const [canjeando, setCanjeando] = useState(false);
  const faltan = Math.max(0, costo - saldo);
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
      >
        {beneficio && <span className={s.beneficio}><EtiquetaColgante tono="oro" tamano="sm">{beneficio}</EtiquetaColgante></span>}
      </FotoProducto>
      <div className={s.recompensaCuerpo}>
        <h3 className={s.recompensaTitulo}>{titulo}</h3>
        {descripcion && <p className={s.recompensaTexto}>{descripcion}</p>}
      </div>
      <div className={s.recompensaPie}>
        {confirmar ? (
          <div className={s.confirmar} role="group" aria-label={`Canjear ${titulo}`}>
            <span className={s.confirmarTexto}>¿Canjear por <Moneda /> <strong>{miles(costo)}</strong>?</span>
            <span className={s.confirmarBotones}>
              <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmar(false)} disabled={canjeando}>Cancelar</Boton>
              <Boton tamano="sm" cargando={canjeando} onClick={canjear}>Sí, canjear</Boton>
            </span>
          </div>
        ) : (
          <>
            <CostoMonedas monto={costo} />
            {faltan > 0 ? (
              <span className={s.faltan}>Te faltan <Moneda /> <strong>{miles(faltan)}</strong></span>
            ) : (
              onCanjear && <Boton tamano="sm" onClick={() => setConfirmar(true)}>Canjear</Boton>
            )}
          </>
        )}
      </div>
    </article>
  );
}

const ORIGENES = {
  ruleta: { texto: 'Ruleta semanal', icono: 'estrella', clase: 'talonRuleta' },
  recompensa: { texto: 'Catálogo de recompensas', icono: 'regalo', clase: 'talonCatalogo' },
};
const ESTADOS_CUPON = { activo: 'Disponible', usado: 'Usado', caducado: 'Vencido' };

/**
 * Un cupón del cliente (userCoupons): un boleto con su talón troquelado. El
 * talón dice de dónde salió (ruleta o catálogo); el código se copia con un
 * toque.
 *  - texto: lo que da ("10% en tu próxima compra") · codigo
 *  - origen: 'ruleta' | 'recompensa' (sin origen: catálogo, sin nombre)
 *  - estado: 'activo' | 'usado' | 'caducado' (estadoCupon de services/cupones)
 *  - vence: texto ya legible ("31 de octubre") · conAsesor: se canjea con un asesor
 *  - onCopiar(codigo): promesa o nada; si falla, la página avisa
 */
export function TarjetaCupon({ texto, codigo, origen, estado = 'activo', vence, conAsesor = false, onCopiar }) {
  const [copiado, setCopiado] = useState(false);
  const reloj = useRef(null);
  useEffect(() => () => window.clearTimeout(reloj.current), []);
  const o = ORIGENES[origen] || ORIGENES.recompensa;
  const usable = estado === 'activo';
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
          <span className={`${s.cuponEstado} ${s[`estado_${estado}`]}`}>{ESTADOS_CUPON[estado] || estado}</span>
          {origen && <span className={s.cuponOrigen}>{o.texto}</span>}
        </p>
        <h3 className={s.cuponTexto}>{texto}</h3>
        <div className={s.codigo}>
          <code>{codigo}</code>
          {usable && onCopiar && (
            <button type="button" className={s.copiar} onClick={copiar} aria-label={copiado ? 'Código copiado' : `Copiar el código ${codigo}`}>
              {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              <span>{copiado ? 'Copiado' : 'Copiar'}</span>
            </button>
          )}
        </div>
        {vence && estado !== 'usado' && (
          <p className={s.vence}>{estado === 'caducado' ? `Venció el ${vence}` : `Válido hasta el ${vence}`}</p>
        )}
        {usable && conAsesor && <p className={s.vence}>Este cupón se canjea con un asesor.</p>}
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
        <h3 className={s.misionTitulo}>{titulo}</h3>
        {descripcion && <p className={s.misionTexto}>{descripcion}</p>}
      </div>
      <div className={s.misionLado}>
        <GananciaMonedas monto={recompensa} />
        {completada ? (
          <span className={s.hecha}><CheckCircle2 aria-hidden="true" /> Completada</span>
        ) : accion ? (
          <Boton to={accion.url} variante="fantasma" tamano="sm" iconoFin={<ArrowRight aria-hidden="true" />}>{accion.texto}</Boton>
        ) : (
          onCompletar && <Boton tamano="sm" cargando={completando} onClick={completar}>Completar</Boton>
        )}
      </div>
    </article>
  );
}

/** Los niveles de constants/tiers.js (sin emojis: cada uno con su sello). */
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
          <h2 className={s.nivelNombre}>Nivel {actual.nombre}</h2>
          <p className={s.nivelXp}><strong>{miles(xp)}</strong> XP acumulada</p>
        </div>
        <p className={s.nivelFalta}>
          {siguiente ? <>Faltan <strong>{miles(siguiente.min - xp)} XP</strong> para {siguiente.nombre}</> : '¡Nivel máximo alcanzado!'}
        </p>
      </div>
      <BarraProgreso
        valor={siguiente ? xp - actual.min : 1}
        max={siguiente ? siguiente.min - actual.min : 1}
        minimo={4}
      />
      <ol className={s.escala}>
        {orden.map((n, i) => (
          <li key={n.clave} className={[s.escalon, i <= k && s.alcanzado, i === k && s.actual].filter(Boolean).join(' ')}>
            <Sello tamano={30} girar={0} tono={i <= k ? (TONO_NIVEL[n.clave] || 'degradado') : 'suave'}>{iconoNivel(n.clave)}</Sello>
            <span className={s.escalonTextos}>
              <span>{n.nombre}</span>
              <small>{miles(n.min)} XP</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
