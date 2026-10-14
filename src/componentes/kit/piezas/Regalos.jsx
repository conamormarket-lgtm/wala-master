import React, { useState } from 'react';
import { Globe, Pencil, Trash2, Plus, Check, Package, ArrowRight, Gift, ShoppingBag } from 'lucide-react';
import Boton from '../Boton';
import Carrusel from '../Carrusel';
import { Enlace } from '../Enlace';
import { Etiqueta } from '../Etiquetas';
import { IconoWala } from '../IconosWala';
import { soles } from '../TarjetaProducto';
import { Avatar } from './Avatar';
import { FotoProducto } from './FotoProducto';
import { BarraProgreso } from './BarraProgreso';
import s from './Regalos.module.css';

/*
 * Piezas de "Fechas importantes": una idea de regalo, la tarjeta de cada
 * persona (sus fechas, el paquete del equipo y las ideas) y el aviso de una
 * fecha festiva que se acerca. Datos por props.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "AAAA-MM-DD" (año 0000 si no se sabe) → "27 de julio". */
export const diaYMes = (iso) => {
  const [, m, d] = String(iso || '').split('-').map(Number);
  return m && d ? `${d} de ${MESES[m - 1]}` : '';
};

/** Días que faltan para la próxima vez que llega esa fecha (0 = hoy). */
export const faltanDias = (iso, hoy = new Date()) => {
  const [, m, d] = String(iso || '').split('-').map(Number);
  if (!m || !d) return null;
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let f = new Date(base.getFullYear(), m - 1, d);
  if (f < base) f = new Date(base.getFullYear() + 1, m - 1, d);
  return Math.round((f - base) / 86400000);
};

/** 0 → "¡Es hoy!", 1 → "Mañana", n → "En n días". */
export const textoFaltan = (n) => (n === 0 ? '¡Es hoy!' : n === 1 ? 'Mañana' : `En ${n} días`);

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Años que se cumplen la próxima vez (cumpleaños o aniversario con año). */
const aniosQueCumple = (iso, hoy = new Date()) => {
  const [a, m, d] = String(iso || '').split('-').map(Number);
  if (!a || !m || !d) return null;
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const anio = new Date(base.getFullYear(), m - 1, d) < base ? base.getFullYear() + 1 : base.getFullYear();
  return anio - a;
};

/**
 * Hoja de calendario (como las de taco): el mes en la franja de arriba y el
 * día grande con la letra del logo, un poco girada. Al pasar el ratón por su
 * fila se endereza.
 *  - fecha: 'AAAA-MM-DD' · tono: 'violeta' | 'rosa' | 'oro' · grande
 */
export function HojaCalendario({ fecha, tono = 'violeta', grande = false }) {
  const [, m, d] = String(fecha || '').split('-').map(Number);
  return (
    <span className={[s.hoja, s[`hoja_${tono}`], grande && s.hojaGrande].filter(Boolean).join(' ')} aria-hidden="true">
      <span className={s.hojaMes}>{m ? MESES_CORTOS[m - 1] : '—'}</span>
      <span className={s.hojaDia}>{d || '?'}</span>
    </span>
  );
}

/**
 * Lo que se viene: las próximas fechas de todas las personas (y las
 * festivas), de la más cercana a la más lejana, en el Carrusel del kit: se
 * desliza con el dedo y tiene flechas a los costados (sin barra de scroll).
 * Cada una lleva a la tarjeta de su persona.
 *  - items: [{ id, fecha, titulo, persona, dias, url ('#persona-…') }]
 */
export function AgendaFechas({ items = [] }) {
  if (!items.length) return null;
  return (
    <section className={s.agenda} data-componente="AgendaFechas" aria-label="Lo que se viene">
      <h3 className={s.agendaTitulo}>Lo que se viene</h3>
      <Carrusel visibles={{ escritorio: 3.3, tablet: 2.4, movil: 1.3 }} espacio="0.75rem" etiqueta="Lo que se viene">
        {items.map((it) => (
          <Enlace key={it.id} to={it.url} className={[s.agendaItem, it.dias <= 7 && s.agendaPronto].filter(Boolean).join(' ')}>
            <HojaCalendario fecha={it.fecha} tono={it.dias <= 7 ? 'rosa' : 'violeta'} grande />
            <span className={s.agendaTextos}>
              <strong>{it.titulo}</strong>
              {it.persona && <small>{it.persona}</small>}
              <span className={s.agendaFalta}>{it.dias === 0 ? '¡Es hoy!' : it.dias === 1 ? 'Mañana' : <>En <b>{it.dias}</b> días</>}</span>
            </span>
          </Enlace>
        ))}
      </Carrusel>
    </section>
  );
}

/** Cuánto falta, como etiqueta (solo si es en 30 días o menos). */
function Faltan({ dias, hasta = 30 }) {
  if (dias == null || dias > hasta) return null;
  return <Etiqueta tono={dias <= 1 ? 'aviso' : 'violeta'}>{textoFaltan(dias)}</Etiqueta>;
}

/**
 * Una idea de regalo: foto, nombre (lleva al producto), por qué le pega y
 * precio, con un botón para agregarla al carrito.
 *  - nombre, imagen, motivo, precio, url
 *  - agregada · necesitaOpciones: el botón lleva al producto ("Elegir")
 *  - onAgregar()
 */
export function IdeaRegalo({ nombre, imagen, motivo, precio, url, agregada = false, necesitaOpciones = false, onAgregar }) {
  return (
    <li className={s.idea} data-componente="IdeaRegalo">
      <FotoProducto className={s.ideaFoto} src={imagen} respaldo={<Gift aria-hidden="true" />} />
      <span className={s.ideaTextos}>
        <Enlace to={url} className={s.ideaNombre}>{nombre}</Enlace>
        {motivo && <small>{motivo}</small>}
      </span>
      <span className={s.ideaPrecio}>{soles(precio)}</span>
      {necesitaOpciones ? (
        <Boton to={url} variante="contorno" tamano="sm">Elegir</Boton>
      ) : (
        <Boton
          tamano="sm"
          variante={agregada ? 'contorno' : 'primario'}
          soloIcono
          aria-label={agregada ? 'Agregada al carrito' : `Agregar ${nombre} al carrito`}
          icono={agregada ? <Check aria-hidden="true" /> : <ShoppingBag aria-hidden="true" />}
          onClick={onAgregar}
          disabled={agregada}
        />
      )}
    </li>
  );
}

/**
 * Una persona a la que le regalas.
 *  - nombre, relacion ("Hermano/a"), foto
 *  - eventos: [{ id, tipo, nombre, fecha ('AAAA-MM-DD') }] · festivas: [{ nombre, fecha }]
 *  - paquete: { total, productos: [{ nombre, imagen, precio, url }], quitados, agregado }
 *  - ideas: props de IdeaRegalo · ideasGenerales: aún no sabemos qué le gusta
 *  - sinIdeas: tiene gustos pero no hay productos de eso
 *  - id: la tarjeta queda en #persona-{id} (la agenda lleva ahí)
 *  - onEditar, onEliminar (pide confirmar en la tarjeta), onAgregarPaquete,
 *    onAgregarIdea(idea), onAgregarIdeas · urlTienda · hoy (para "En N días")
 */
export function TarjetaPersonaRegalo({
  id, nombre, relacion, foto, eventos = [], festivas = [], paquete, ideas = [], ideasGenerales = false, sinIdeas = false,
  onEditar, onEliminar, onAgregarPaquete, onAgregarIdea, onAgregarIdeas, urlTienda = '/tienda', hoy,
}) {
  const [confirmar, setConfirmar] = useState(false);
  const directas = ideas.filter((i) => !i.necesitaOpciones && !i.agregada);
  const totalIdeas = directas.reduce((a, i) => a + Number(i.precio || 0), 0);
  return (
    <article className={s.persona} data-componente="TarjetaPersonaRegalo" id={id ? `persona-${id}` : undefined}>
      <header className={s.cabeza}>
        <Avatar className={s.avatar} nombre={nombre} imagen={foto} letras={1} />
        <div className={s.quien}>
          <h3>{nombre || 'Sin nombre'}</h3>
          {relacion && <p>{relacion}</p>}
        </div>
        <span className={s.botones}>
          {onEditar && <button type="button" className={s.icono} onClick={onEditar} aria-label={`Editar a ${nombre}`}><Pencil aria-hidden="true" /></button>}
          {onEliminar && <button type="button" className={`${s.icono} ${s.peligro}`} onClick={() => setConfirmar(true)} aria-label={`Eliminar a ${nombre}`}><Trash2 aria-hidden="true" /></button>}
        </span>
      </header>
      {confirmar && (
        <div className={s.confirmar} role="alert">
          <p>¿Quitar a {nombre} de tus fechas importantes?</p>
          <span>
            <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmar(false)}>Cancelar</Boton>
            <Boton variante="peligro" tamano="sm" onClick={() => { setConfirmar(false); onEliminar(); }}>Quitar</Boton>
          </span>
        </div>
      )}

      <ul className={s.fechas}>
        {eventos.map((e) => {
          const dias = faltanDias(e.fecha, hoy);
          const anios = aniosQueCumple(e.fecha, hoy);
          let detalle = diaYMes(e.fecha) || 'Sin fecha';
          if (anios && e.tipo === 'Cumpleaños') detalle += ` · cumple ${anios}`;
          if (anios && e.tipo === 'Aniversario') detalle += ` · ${anios} ${anios === 1 ? 'año' : 'años'}`;
          return (
            <li key={e.id} className={s.fecha}>
              <HojaCalendario fecha={e.fecha} tono={dias != null && dias <= 7 ? 'rosa' : 'violeta'} />
              <span className={s.fechaTextos}>
                <span className={s.fechaNombre}>{e.tipo === 'Fecha Especial' ? (e.nombre || 'Fecha especial') : e.tipo}</span>
                <span className={s.fechaDia}>{detalle}</span>
              </span>
              <Faltan dias={dias} />
            </li>
          );
        })}
        {festivas.map((f) => (
          <li key={f.nombre} className={`${s.fecha} ${s.festivaFila}`}>
            <HojaCalendario fecha={f.fecha} tono="oro" />
            <span className={s.fechaTextos}>
              <span className={s.fechaNombre}><Globe aria-hidden="true" /> {f.nombre}</span>
              <span className={s.fechaDia}>{diaYMes(f.fecha)} · del calendario</span>
            </span>
            <Faltan dias={faltanDias(f.fecha, hoy)} />
          </li>
        ))}
      </ul>

      {paquete?.productos?.length > 0 && (
        <section className={s.paquete}>
          <h4><Package aria-hidden="true" /> Elegido por nuestro equipo <strong>{soles(paquete.total)}</strong></h4>
          <ul className={s.paqueteLista}>
            {paquete.productos.map((p) => (
              <li key={p.nombre}>
                <FotoProducto className={s.paqueteFoto} src={p.imagen} />
                <Enlace to={p.url} className={s.ideaNombre}>{p.nombre}</Enlace>
                <span className={s.ideaPrecio}>{soles(p.precio)}</span>
              </li>
            ))}
          </ul>
          {paquete.quitados > 0 && (
            <p className={s.nota}>{paquete.quitados === 1 ? 'Un producto de esta sugerencia ya no está disponible y se quitó.' : `${paquete.quitados} productos de esta sugerencia ya no están disponibles y se quitaron.`}</p>
          )}
          {onAgregarPaquete && (
            <Boton variante={paquete.agregado ? 'contorno' : 'primario'} tamano="sm" bloque disabled={paquete.agregado}
              icono={paquete.agregado ? <Check aria-hidden="true" /> : <ShoppingBag aria-hidden="true" />} onClick={onAgregarPaquete}>
              {paquete.agregado ? 'Agregado al carrito' : 'Agregar todo al carrito'}
            </Boton>
          )}
        </section>
      )}

      <section className={s.ideas}>
        <h4><Gift aria-hidden="true" /> Ideas de regalo para {nombre}</h4>
        {ideasGenerales && ideas.length > 0 && (
          <p className={s.nota}>
            Son ideas generales. {onEditar ? <button type="button" className={s.textoBoton} onClick={onEditar}>Cuéntanos qué le gusta</button> : 'Cuéntanos qué le gusta'} y las hacemos a su medida.
          </p>
        )}
        {ideas.length > 0 ? (
          <ul className={s.ideasLista}>
            {ideas.map((i) => <IdeaRegalo key={i.id || i.nombre} {...i} onAgregar={() => onAgregarIdea?.(i)} />)}
          </ul>
        ) : (
          <p className={s.nota}>
            {sinIdeas
              ? `Todavía no tenemos productos de lo que le gusta a ${nombre}. Preferimos no recomendarte algo que no le va.`
              : `Cuéntanos qué le gusta (equipo, anime, personaje…) editando a ${nombre} y te recomendamos regalos a su medida.`}
          </p>
        )}
        {directas.length >= 2 && onAgregarIdeas && (
          <Boton variante="contorno" tamano="sm" bloque icono={<Plus aria-hidden="true" />} onClick={onAgregarIdeas}>
            Agregar las {directas.length} al carrito · {soles(totalIdeas)}
          </Boton>
        )}
        <Enlace to={urlTienda} className={s.masRegalos}>Ver más regalos en la tienda <ArrowRight aria-hidden="true" /></Enlace>
      </section>
    </article>
  );
}

/**
 * Una fecha festiva que se acerca (Día de la Madre, Navidad…): cuándo es y,
 * por cada persona a la que le toca, sus ideas. Sin personas, invita a
 * agregar a alguien.
 *  - nombre, fecha ('AAAA-MM-DD'), icono (IconoWala; sin emojis)
 *  - personas: [{ nombre, ideas, buscando }] · onAgregarPersona · onAgregarIdea(idea)
 *  - urlTienda · hoy
 */
export function AvisoFestiva({ nombre, fecha, icono = 'regalo', personas = [], onAgregarPersona, onAgregarIdea, urlTienda = '/tienda', hoy }) {
  const dias = faltanDias(fecha, hoy);
  return (
    <section className={s.festiva} data-componente="AvisoFestiva">
      <header className={s.festivaCabeza}>
        <span className={s.festivaIcono}><IconoWala nombre={icono} tamano={48} girar={-6} /></span>
        <div className={s.quien}>
          <h3>{dias === 0 ? `¡Hoy es ${nombre}!` : `Se acerca el ${nombre}`}</h3>
          <p>{diaYMes(fecha)}</p>
        </div>
        <span className={s.cuentaAtras} aria-label={textoFaltan(dias)}>
          {dias === 0 ? <strong>¡Hoy!</strong> : <><strong>{dias}</strong><small>{dias === 1 ? 'día' : 'días'}</small></>}
        </span>
      </header>
      {dias != null && dias <= 30 && (
        <div className={s.festivaBarra}>
          <BarraProgreso valor={30 - dias} max={30} minimo={6} />
        </div>
      )}
      {personas.length > 0 ? personas.slice(0, 3).map((p) => (
        <div key={p.nombre} className={s.festivaPersona}>
          <h4>Ideas para {p.nombre}</h4>
          {p.buscando ? <p className={s.nota}>Buscando ideas…</p> : p.ideas?.length ? (
            <ul className={s.ideasLista}>
              {p.ideas.map((i) => <IdeaRegalo key={i.id || i.nombre} {...i} onAgregar={() => onAgregarIdea?.(i)} />)}
            </ul>
          ) : <p className={s.nota}>Todavía no tenemos algo pensado para {p.nombre}. Mira la tienda o cuéntanos qué le gusta.</p>}
        </div>
      )) : (
        <div className={s.festivaVacia}>
          <p className={s.nota}>¿Le vas a regalar a alguien por el {nombre}? Agrégalo y te damos ideas a su medida, con aviso antes de la fecha.</p>
          {onAgregarPersona && <Boton tamano="sm" icono={<Plus aria-hidden="true" />} onClick={onAgregarPersona}>Añadir persona</Boton>}
        </div>
      )}
      <Enlace to={urlTienda} className={s.masRegalos}>Ver regalos en la tienda <ArrowRight aria-hidden="true" /></Enlace>
    </section>
  );
}
