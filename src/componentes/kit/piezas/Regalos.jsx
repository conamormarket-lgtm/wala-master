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
import { Texto, useTexto } from '../Traduccion';
import { TextoResaltado } from './TextoResaltado';
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
  const nombre = useTexto('Lo que se viene');
  if (!items.length) return null;
  return (
    <section className={s.agenda} data-componente="AgendaFechas" aria-label={nombre}>
      <h3 className={s.agendaTitulo}><Texto>Lo que se viene</Texto></h3>
      <Carrusel visibles={{ escritorio: 3.3, tablet: 2.4, movil: 1.3 }} espacio="0.75rem" etiqueta="Lo que se viene">
        {items.map((it) => (
          <Enlace key={it.id} to={it.url} className={[s.agendaItem, it.dias <= 7 && s.agendaPronto].filter(Boolean).join(' ')}>
            <HojaCalendario fecha={it.fecha} tono={it.dias <= 7 ? 'rosa' : 'violeta'} grande />
            <span className={s.agendaTextos}>
              <strong><Texto>{it.titulo}</Texto></strong>
              {it.persona && <small><Texto>{it.persona}</Texto></small>}
              <span className={s.agendaFalta}>{it.dias === 0 ? <Texto>¡Es hoy!</Texto> : it.dias === 1 ? <Texto>Mañana</Texto> : <TextoResaltado resaltar={[it.dias]} envolver={(x, k) => <b key={k}>{x}</b>}>{`En ${it.dias} días`}</TextoResaltado>}</span>
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
  return <Etiqueta tono={dias <= 1 ? 'aviso' : 'violeta'}><Texto>{textoFaltan(dias)}</Texto></Etiqueta>;
}

/**
 * Una idea de regalo: foto, nombre (lleva al producto), por qué le pega y
 * precio, con un botón para agregarla al carrito.
 *  - nombre, imagen, srcSet, sizes, motivo, precio, url
 *  - agregada · necesitaOpciones: pide talla o color; el botón dice "Elegir"
 *    y llama a onElegir (la hoja "Agregar rápido") o, sin él, lleva al producto
 *  - onAgregar(), onElegir()
 */
export function IdeaRegalo({ nombre, imagen, srcSet, sizes, motivo, precio, url, agregada = false, necesitaOpciones = false, onAgregar, onElegir }) {
  const etiquetaAgregar = useTexto(agregada ? 'Agregada al carrito' : `Agregar ${nombre} al carrito`);
  return (
    <li className={s.idea} data-componente="IdeaRegalo">
      <FotoProducto className={s.ideaFoto} src={imagen} srcSet={srcSet} sizes={sizes} respaldo={<Gift aria-hidden="true" />} />
      <span className={s.ideaTextos}>
        <Enlace to={url} className={s.ideaNombre}>{nombre}</Enlace>
        {motivo && <small><Texto>{motivo}</Texto></small>}
      </span>
      <span className={s.ideaPrecio}>{soles(precio)}</span>
      {necesitaOpciones ? (
        <Boton to={onElegir ? undefined : url} onClick={onElegir} variante="contorno" tamano="sm"><Texto>Elegir</Texto></Boton>
      ) : (
        <Boton
          tamano="sm"
          variante={agregada ? 'contorno' : 'primario'}
          soloIcono
          aria-label={etiquetaAgregar}
          icono={agregada ? <Check aria-hidden="true" /> : <ShoppingBag aria-hidden="true" />}
          onClick={onAgregar}
          disabled={agregada}
        />
      )}
    </li>
  );
}

/**
 * Un paquete armado por el equipo: sus productos (el que pide talla o color,
 * con "Elegir talla"), lo que se quitó y el botón para agregar el resto.
 *  - total, productos: [{ id, nombre, imagen, precio, url, necesitaOpciones }]
 *  - quitados · agregado · onAgregar() · onElegir(producto)
 */
function PaqueteEquipo({ total, productos = [], quitados = 0, agregado = false, onAgregar, onElegir }) {
  const porElegir = productos.filter((p) => p.necesitaOpciones).length;
  const directos = productos.length - porElegir;
  const textoBoton = agregado
    ? 'Agregado al carrito'
    : porElegir > 0 ? `Agregar ${directos === 1 ? 'el otro' : `los otros ${directos}`} al carrito` : 'Agregar todo al carrito';
  return (
    <section className={s.paquete}>
      <h4><Package aria-hidden="true" /> <Texto>Elegido por nuestro equipo</Texto> <strong>{soles(total)}</strong></h4>
      <ul className={s.paqueteLista}>
        {productos.map((p) => (
          <li key={p.id || p.nombre}>
            <FotoProducto className={s.paqueteFoto} src={p.imagen} srcSet={p.srcSet} sizes={p.sizes} />
            <span className={s.paqueteTextos}>
              <Enlace to={p.url} className={s.ideaNombre}>{p.nombre}</Enlace>
              {p.necesitaOpciones && (onElegir
                ? <button type="button" className={s.textoBoton} onClick={() => onElegir(p)}><Texto>Elegir talla</Texto></button>
                : <Enlace to={p.url} className={s.textoBoton}><Texto>Elegir talla</Texto></Enlace>)}
            </span>
            <span className={s.ideaPrecio}>{soles(p.precio)}</span>
          </li>
        ))}
      </ul>
      {quitados > 0 && (
        <p className={s.nota}><Texto>{quitados === 1 ? 'Un producto de esta sugerencia ya no está disponible y se quitó.' : `${quitados} productos de esta sugerencia ya no están disponibles y se quitaron.`}</Texto></p>
      )}
      {porElegir > 0 && (
        <p className={s.nota}><Texto>{porElegir === 1 ? 'Un producto pide elegir talla o color: tócalo para elegirlo.' : `${porElegir} productos piden elegir talla o color: tócalos para elegirlos.`}</Texto></p>
      )}
      {onAgregar && directos > 0 && (
        <Boton variante={agregado ? 'contorno' : 'primario'} tamano="sm" bloque disabled={agregado}
          icono={agregado ? <Check aria-hidden="true" /> : <ShoppingBag aria-hidden="true" />} onClick={onAgregar}>
          <Texto>{textoBoton}</Texto>
        </Boton>
      )}
    </section>
  );
}

/**
 * Una persona a la que le regalas.
 *  - nombre, relacion ("Hermano/a"), foto
 *  - eventos: [{ id, tipo, nombre, fecha ('AAAA-MM-DD') }] · festivas: [{ nombre, fecha }]
 *  - paquetes: [{ id, total, productos: [{ id, nombre, imagen, precio, url,
 *    necesitaOpciones }], quitados, agregado }] (los que armó el equipo; antes
 *    `paquete`, uno solo: se sigue aceptando)
 *  - ideas: props de IdeaRegalo · ideasGenerales: aún no sabemos qué le gusta
 *  - buscando: las ideas
 *    todavía se están armando ("Buscando ideas…")
 *  - id: la tarjeta queda en #persona-{id} (la agenda lleva ahí)
 *  - onEditar, onEliminar (pide confirmar en la tarjeta), onAgregarPaquete(idPaquete),
 *    onAgregarIdea(idea), onAgregarIdeas, onElegir(idea o producto del paquete):
 *    lo que pide talla o color · urlTienda · hoy (para "En N días")
 */
export function TarjetaPersonaRegalo({
  id, nombre, relacion, foto, eventos = [], festivas = [], paquetes, paquete, ideas = [], ideasGenerales = false, buscando = false,
  onEditar, onEliminar, onAgregarPaquete, onAgregarIdea, onAgregarIdeas, onElegir, urlTienda = '/tienda', hoy,
}) {
  const [confirmar, setConfirmar] = useState(false);
  const etiquetaEditar = useTexto(`Editar a ${nombre}`);
  const etiquetaEliminar = useTexto(`Eliminar a ${nombre}`);
  // "Cuéntanos qué le gusta" es un botón dentro de la frase: la frase va entera
  // y el botón se marca dentro; si la traducción no lo trae, va como antes.
  const fraseGenerales = 'Son ideas generales. Cuéntanos qué le gusta y las hacemos a su medida.';
  const generales = useTexto(fraseGenerales);
  const cuentanos = useTexto('Cuéntanos qué le gusta');
  const listaPaquetes = (paquetes || (paquete ? [paquete] : [])).filter((pq) => pq.productos?.length > 0);
  const directas = ideas.filter((i) => !i.necesitaOpciones && !i.agregada);
  const conTalla = ideas.filter((i) => i.necesitaOpciones).length;
  const totalIdeas = directas.reduce((a, i) => a + Number(i.precio || 0), 0);
  return (
    <article className={s.persona} data-componente="TarjetaPersonaRegalo" id={id ? `persona-${id}` : undefined}>
      <header className={s.cabeza}>
        <Avatar className={s.avatar} nombre={nombre} imagen={foto} letras={1} />
        <div className={s.quien}>
          <h3>{nombre || <Texto>Sin nombre</Texto>}</h3>
          {relacion && <p><Texto>{relacion}</Texto></p>}
        </div>
        <span className={s.botones}>
          {onEditar && <button type="button" className={s.icono} onClick={onEditar} aria-label={etiquetaEditar}><Pencil aria-hidden="true" /></button>}
          {onEliminar && <button type="button" className={`${s.icono} ${s.peligro}`} onClick={() => setConfirmar(true)} aria-label={etiquetaEliminar}><Trash2 aria-hidden="true" /></button>}
        </span>
      </header>
      {confirmar && (
        <div className={s.confirmar} role="alert">
          <p><Texto>{`¿Quitar a ${nombre} de tus fechas importantes?`}</Texto></p>
          <span>
            <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmar(false)}><Texto>Cancelar</Texto></Boton>
            <Boton variante="peligro" tamano="sm" onClick={() => { setConfirmar(false); onEliminar(); }}><Texto>Quitar</Texto></Boton>
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
                <span className={s.fechaNombre}>{e.tipo === 'Fecha Especial' ? (e.nombre || <Texto>Fecha especial</Texto>) : <Texto>{e.tipo}</Texto>}</span>
                <span className={s.fechaDia}><Texto>{detalle}</Texto></span>
              </span>
              <Faltan dias={dias} />
            </li>
          );
        })}
        {festivas.map((f) => (
          <li key={f.nombre} className={`${s.fecha} ${s.festivaFila}`}>
            <HojaCalendario fecha={f.fecha} tono="oro" />
            <span className={s.fechaTextos}>
              <span className={s.fechaNombre}><Globe aria-hidden="true" /> <Texto>{f.nombre}</Texto></span>
              <span className={s.fechaDia}><Texto>{`${diaYMes(f.fecha)} · del calendario`}</Texto></span>
            </span>
            <Faltan dias={faltanDias(f.fecha, hoy)} />
          </li>
        ))}
      </ul>

      {listaPaquetes.map((pq, k) => (
        <PaqueteEquipo
          key={pq.id || k}
          {...pq}
          onAgregar={onAgregarPaquete && (() => onAgregarPaquete(pq.id))}
          onElegir={onElegir}
        />
      ))}

      {(buscando || ideas.length > 0) && <section className={s.ideas}>
        <h4><Gift aria-hidden="true" /> <Texto>{`Ideas de regalo para ${nombre}`}</Texto></h4>
        {ideasGenerales && ideas.length > 0 && (
          <p className={s.nota}>
            {!onEditar ? generales : generales.includes(cuentanos) ? (
              <TextoResaltado resaltar={[cuentanos]} envolver={(x, k) => <button key={k} type="button" className={s.textoBoton} onClick={onEditar}>{x}</button>}>{fraseGenerales}</TextoResaltado>
            ) : (
              <><Texto>Son ideas generales.</Texto> <button type="button" className={s.textoBoton} onClick={onEditar}>{cuentanos}</button> <Texto>y las hacemos a su medida.</Texto></>
            )}
          </p>
        )}
        {buscando ? <p className={s.nota} role="status"><Texto>Buscando ideas…</Texto></p> : (
          <ul className={s.ideasLista}>
            {ideas.map((i) => <IdeaRegalo key={i.id || i.nombre} {...i} onAgregar={() => onAgregarIdea?.(i)} onElegir={onElegir && (() => onElegir(i))} />)}
          </ul>
        )}
        {directas.length >= 2 && onAgregarIdeas && (
          <Boton variante="contorno" tamano="sm" bloque icono={<Plus aria-hidden="true" />} onClick={onAgregarIdeas}>
            <Texto>{`Agregar las ${directas.length} al carrito`}</Texto> · {soles(totalIdeas)}
          </Boton>
        )}
        {conTalla > 0 && (
          <p className={s.nota}><Texto>{conTalla === 1 ? 'Una idea pide elegir talla o color: toca «Elegir».' : `${conTalla} ideas piden elegir talla o color: toca «Elegir».`}</Texto></p>
        )}
        <Enlace to={urlTienda} className={s.masRegalos}><Texto>Ver más regalos en la tienda</Texto> <ArrowRight aria-hidden="true" /></Enlace>
      </section>}
    </article>
  );
}

/**
 * Una fecha festiva que se acerca (Día de la Madre, Navidad…): cuándo es y,
 * por cada persona a la que le toca, sus ideas. Sin personas, invita a
 * agregar a alguien.
 *  - nombre, fecha ('AAAA-MM-DD'), icono (IconoWala; sin emojis)
 *  - personas: [{ id, nombre, ideas, buscando }] · onAgregarPersona
 *  - onAgregarIdea(idea) · onElegir(idea): la que pide talla o color
 *  - urlTienda · hoy
 */
export function AvisoFestiva({ nombre, fecha, icono = 'regalo', personas = [], onAgregarPersona, onAgregarIdea, onElegir, urlTienda = '/tienda', hoy }) {
  const dias = faltanDias(fecha, hoy);
  const etiquetaFaltan = useTexto(textoFaltan(dias));
  return (
    <section className={s.festiva} data-componente="AvisoFestiva">
      <header className={s.festivaCabeza}>
        <span className={s.festivaIcono}><IconoWala nombre={icono} tamano={48} girar={-6} /></span>
        <div className={s.quien}>
          <h3><Texto>{dias === 0 ? `¡Hoy es ${nombre}!` : `Se acerca el ${nombre}`}</Texto></h3>
          <p><Texto>{diaYMes(fecha)}</Texto></p>
        </div>
        <span className={s.cuentaAtras} aria-label={etiquetaFaltan}>
          {dias === 0 ? <strong><Texto>¡Hoy!</Texto></strong> : <><strong>{dias}</strong><small><Texto>{dias === 1 ? 'día' : 'días'}</Texto></small></>}
        </span>
      </header>
      {dias != null && dias <= 30 && (
        <div className={s.festivaBarra}>
          <BarraProgreso valor={30 - dias} max={30} minimo={6} />
        </div>
      )}
      {personas.length > 0 ? personas.slice(0, 3).map((p) => (
        <div key={p.id || p.nombre} className={s.festivaPersona}>
          <h4><Texto>{`Ideas para ${p.nombre}`}</Texto></h4>
          {p.buscando ? <p className={s.nota}><Texto>Buscando ideas…</Texto></p> : p.ideas?.length ? (
            <ul className={s.ideasLista}>
              {p.ideas.map((i) => <IdeaRegalo key={i.id || i.nombre} {...i} onAgregar={() => onAgregarIdea?.(i)} onElegir={onElegir && (() => onElegir(i))} />)}
            </ul>
          ) : <p className={s.nota}><Texto>{`Todavía no tenemos algo pensado para ${p.nombre}. Mira la tienda o cuéntanos qué le gusta.`}</Texto></p>}
        </div>
      )) : (
        <div className={s.festivaVacia}>
          <p className={s.nota}><Texto>{`¿Le vas a regalar a alguien por el ${nombre}? Agrégalo y te damos ideas a su medida, con aviso antes de la fecha.`}</Texto></p>
          {onAgregarPersona && <Boton tamano="sm" icono={<Plus aria-hidden="true" />} onClick={onAgregarPersona}><Texto>Añadir persona</Texto></Boton>}
        </div>
      )}
      <Enlace to={urlTienda} className={s.masRegalos}><Texto>Ver regalos en la tienda</Texto> <ArrowRight aria-hidden="true" /></Enlace>
    </section>
  );
}
