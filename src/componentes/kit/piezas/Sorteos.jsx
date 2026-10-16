import React from 'react';
import { Users, Check, Trophy, MapPin, ExternalLink, Clock, CalendarDays } from 'lucide-react';
import Boton from '../Boton';
import { Etiqueta } from '../Etiquetas';
import { Trazo, Destello, Puntos } from '../Marca';
import { Enlace } from '../Enlace';
import { Texto } from '../Traduccion';
import CuentaRegresiva from '../CuentaRegresiva';
import { Avatar } from './Avatar';
import { FotoProducto } from './FotoProducto';
import s from './Sorteos.module.css';

/*
 * Piezas de los sorteos: el sorteo de /sorteos (un premio, una cuenta atrás)
 * y la campaña por suscripción de /suscrito-sorteo (planes, ganadores y
 * beneficios de marcas aliadas).
 */

const miles = (n) => Number(n || 0).toLocaleString('es-PE');
const diaYMes = (iso) => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });

/**
 * La cabeza de un sorteo: el premio como un boleto (la foto arriba y el
 * talón con muescas: cuándo se sortea y cuántos ganan), el precio (o
 * "Gratis"), "Gana: …" con su trazo, la cuenta atrás en una píldora y
 * cuánta gente participa. Adornos quietos junto al título.
 *  - premio · imagen · descripcion · precio (texto: "Gratis", "S/ 5 por ticket")
 *  - ganadores (cuántos) · hasta (ISO del fin) · cerrado · participantes
 */
export function CabezaSorteo({ premio, imagen, descripcion, precio, ganadores = 1, hasta, cerrado = false, participantes }) {
  return (
    <header className={s.cabeza} data-componente="CabezaSorteo">
      <div className={s.cabezaFoto}>
        <div className={s.boleto}>
          {imagen ? <FotoProducto src={imagen} relleno="6%" className={s.foto} /> : <span className={s.fotoVacia}><Destello /></span>}
          <div className={s.talon}>
            <span className={s.talonDato}>
              <CalendarDays aria-hidden="true" />
              {cerrado ? 'Sorteo cerrado' : hasta ? <>Se sortea el <strong>{diaYMes(hasta)}</strong></> : 'Sorteo de Walá'}
            </span>
            <span className={s.talonDato}>
              <Trophy aria-hidden="true" />
              <strong>{ganadores}</strong> {ganadores === 1 ? 'ganador' : 'ganadores'}
            </span>
          </div>
        </div>
        {precio && (
          <span className={s.cabezaEtiquetas}>
            <Etiqueta tono="violeta" sobreFoto>{precio}</Etiqueta>
          </span>
        )}
      </div>
      <div className={s.cabezaTextos}>
        <span className={s.adornos} aria-hidden="true">
          <Puntos className={s.puntos} />
          <Destello className={s.destello1} />
          <Destello className={s.destello2} />
        </span>
        <h1 className={s.titulo}>Gana: <Texto>{premio}</Texto><Trazo className={s.trazo} /></h1>
        {descripcion && <p className={s.descripcion}><Texto>{descripcion}</Texto></p>}
        {cerrado ? (
          <p className={s.cerrado}>El sorteo ya cerró.</p>
        ) : hasta && (
          // Con más de dos días por delante, en palabras ("Termina en 4 d 7 h"); al final, los bloques.
          <div className={s.reloj}>
            {new Date(hasta) - Date.now() > 48 * 3600000
              ? <span className={s.relojPildora}><Clock aria-hidden="true" /><CuentaRegresiva hasta={hasta} variante="frase" etiqueta="Termina en" textoFin="Ya terminó: pronto anunciamos a quien ganó" /></span>
              : <CuentaRegresiva hasta={hasta} variante="bloques" etiqueta="Termina en" textoFin="Ya terminó: pronto anunciamos a quien ganó" />}
          </div>
        )}
        {participantes != null && (
          <p className={s.participan}><Users aria-hidden="true" /><strong>{miles(participantes)}</strong> {participantes === 1 ? 'persona ya participa' : 'personas ya participan'}</p>
        )}
      </div>
    </header>
  );
}

/**
 * Quienes ganaron, con la tuya marcada (y la celebración si ganaste).
 *  - ganadores: [{ id, nombre, premio, fecha, foto }] · yo: id del tuyo
 */
export function ListaGanadores({ ganadores = [], yo }) {
  return (
    <ul className={s.ganadores} data-componente="ListaGanadores">
      {ganadores.map((g) => (
        <li key={g.id || g.nombre} className={g.id && g.id === yo ? s.ganadorYo : undefined}>
          <Avatar nombre={g.nombre} imagen={g.foto} className={s.ganadorAvatar} />
          <span className={s.ganadorTexto}>
            <strong>{g.nombre}{g.id && g.id === yo && <small className={s.tu}>Tú</small>}</strong>
            {(g.premio || g.fecha) && <small>{[g.premio, g.fecha].filter(Boolean).join(' · ')}</small>}
          </span>
          <Trophy aria-hidden="true" className={s.trofeo} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Un plan de la suscripción: el precio con la letra de la marca, cuánto sale
 * al mes, las chances por ciclo y lo que incluye.
 *  - nombre · intervalo ("Mensual") · precio ("S/ 19.90") · precioUsd ("$ 5.50")
 *  - alMes ("S/ 9.95", si dura más de un mes) · chances (por ciclo)
 *  - beneficios: [texto] · destacado · onElegir · boton
 */
export function TarjetaPlan({ nombre, intervalo, precio, precioUsd, alMes, chances, beneficios = [], destacado = false, onElegir, boton = 'Suscribirme' }) {
  return (
    <article className={[s.plan, destacado && s.planDestacado].filter(Boolean).join(' ')} data-componente="TarjetaPlan">
      {destacado && <span className={s.planRecomendado}>Recomendado</span>}
      <h3 className={s.planNombre}><Texto>{nombre}</Texto></h3>
      {intervalo && <p className={s.planIntervalo}>{intervalo}</p>}
      <p className={s.planPrecio}>
        <strong>{precio}</strong>
        {precioUsd && <small> · {precioUsd}</small>}
      </p>
      {alMes && <p className={s.planAlMes}>Es como pagar <strong>{alMes}</strong> al mes</p>}
      {chances > 0 && <p className={s.planChances}><strong>{chances}</strong> {chances === 1 ? 'chance' : 'chances'} por ciclo</p>}
      {beneficios.length > 0 && (
        <ul className={s.planBeneficios}>
          {beneficios.map((b) => <li key={b}><Check aria-hidden="true" /><Texto>{b}</Texto></li>)}
        </ul>
      )}
      <Boton bloque variante={destacado ? 'primario' : 'secundario'} onClick={onElegir}>{boton}</Boton>
    </article>
  );
}

/**
 * Un descuento de una marca aliada (para suscriptores).
 *  - marca · titulo · descuento ("20% de descuento") · ubicacion · imagen · url
 */
export function TarjetaAliado({ marca, titulo, descuento, ubicacion, imagen, url }) {
  const cuerpo = (
    <>
      <span className={s.aliadoLogo}>{imagen ? <img src={imagen} alt="" loading="lazy" /> : <Avatar nombre={marca} />}</span>
      <span className={s.aliadoTexto}>
        <small className={s.aliadoMarca}>{marca}</small>
        <strong><Texto>{titulo}</Texto></strong>
        {descuento && <span className={s.aliadoDescuento}>{descuento}</span>}
        {ubicacion && <small className={s.aliadoLugar}><MapPin aria-hidden="true" />{ubicacion}</small>}
      </span>
      {url && <ExternalLink aria-hidden="true" className={s.aliadoIr} />}
    </>
  );
  return url
    ? <Enlace to={url} className={s.aliado} data-componente="TarjetaAliado">{cuerpo}</Enlace>
    : <div className={s.aliado} data-componente="TarjetaAliado">{cuerpo}</div>;
}
