import React from 'react';
import { ImageOff, MessageCircle } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso } from '../../Feedback';
import { Etiqueta } from '../../Etiquetas';
import { Pestanas } from '../../Navegacion';
import { EsqueletoTexto, Hueso } from '../../Esqueletos';
import { Cifra, FilaCifras, SinDatos } from './Metricas';
import { resumenDeFicha, listasDeFicha } from '../../adaptadoresAdmin';
import { urlWhatsApp, telefonoDePerfil, aceptoWhatsApp } from '../../../../utils/whatsappLink';
import s from './Clientes.module.css';

/*
 * Clientes de Resultados (D4c): la ficha de un cliente (lo que mira, su
 * lista de deseos, su carrito y sus fechas) y los próximos cumpleaños.
 */

const PESTANAS_FICHA = [
  { id: 'resumen', texto: 'Resumen' },
  { id: 'mira', texto: 'Interés' },
  { id: 'deseos', texto: 'Deseos' },
  { id: 'carrito', texto: 'Carrito' },
  { id: 'fechas', texto: 'Fechas' },
];

/* Un producto de la ficha: foto, nombre, una línea y una marca ("Ya se lo regalaron"). */
function ListaProductos({ productos = [], vacio }) {
  if (!productos.length) return <SinDatos>{vacio}</SinDatos>;
  return (
    <ul className={s.productos}>
      {productos.map((p) => (
        <li key={p.id}>
          <span className={s.foto}>{p.imagen ? <img src={p.imagen} alt="" loading="lazy" /> : <ImageOff aria-hidden="true" />}</span>
          <span className={s.productoTextos}>
            <span className={s.productoNombre} title={p.nombre}>{p.nombre}</span>
            {p.detalle && <span className={s.productoDetalle}>{p.detalle}</span>}
            {/* Debajo del detalle: al costado apretaba el nombre en el celular. */}
            {p.marca && <span className={s.marca}><Etiqueta tono="neutro">{p.marca}</Etiqueta></span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * La ficha de un cliente (va dentro de una HojaEdicion solo para mirar).
 *  - ficha (getUserFicha) · cargando · error
 *  - actividad (getUserAnalytics) · cargandoActividad · errorActividad (solo hace falta en Resumen y Lo que mira)
 *  - productoDe(id) → { nombre, imagen } · recomendados: [{ id, nombre, imagen, detalle }]
 *  - pestana · onPestana(id)
 */
export function FichaCliente({ ficha, cargando = false, error, actividad, cargandoActividad = false, errorActividad, productoDe, recomendados = [], pestana = 'resumen', onPestana }) {
  if (cargando) return <div className={s.ficha} aria-busy="true"><Hueso ancho="60%" alto={18} /><Hueso ancho="80%" alto={12} /><Hueso forma="bloque" alto={140} /></div>;
  if (error || !ficha) return <Aviso tipo="error" titulo="No se pudo cargar la ficha">{error || 'No se encontró el perfil.'}</Aviso>;

  const r = resumenDeFicha(ficha, actividad);
  const l = listasDeFicha(ficha, actividad, productoDe);
  const telefono = telefonoDePerfil({ phone: ficha.phone, phoneIntl: ficha.phoneIntl });
  const primerNombre = String(ficha.nombre || '').split(' ')[0];
  const escribir = telefono && aceptoWhatsApp(ficha) ? urlWhatsApp(telefono, `¡Hola${primerNombre ? ` ${primerNombre}` : ''}! Te escribimos de Walá.`) : null;
  const actividadPendiente = cargandoActividad ? <EsqueletoTexto lineas={4} /> : errorActividad ? <SinDatos>No se pudo cargar la actividad: {errorActividad}</SinDatos> : null;

  return (
    <div className={s.ficha} data-componente="FichaCliente">
      <div className={s.cabeza}>
        <span className={s.contacto}>{r.contacto}</span>
        <span className={s.chips}>{r.chips.map((c) => <Etiqueta key={c} tono="neutro">{c}</Etiqueta>)}</span>
        {escribir && <Boton tamano="sm" variante="primario" icono={<MessageCircle aria-hidden="true" />} to={escribir}>Escribir por WhatsApp</Boton>}
      </div>

      <div className={s.pestanas}><Pestanas etiqueta="Secciones de la ficha" opciones={PESTANAS_FICHA} valor={pestana} onChange={onPestana} /></div>

      {pestana === 'resumen' && (
        <div className={s.panel}>
          {actividadPendiente || (
            <FilaCifras etiqueta="Actividad del cliente">
              {r.cifras.map((c) => <Cifra key={c.nombre} nombre={c.nombre} valor={c.valor} ayuda={c.ayuda} tono="neutro" />)}
            </FilaCifras>
          )}
          {r.notas.map((n) => <p key={n} className={s.nota}>{n}</p>)}
        </div>
      )}
      {pestana === 'mira' && (
        <div className={s.panel}>
          {actividadPendiente || (
            <>
              <h3 className={s.subtitulo}>Donde más tiempo pasa</h3>
              <ListaProductos productos={l.mira} vacio="Todavía no miró productos." />
              <h3 className={s.subtitulo}>Para recomendarle</h3>
              <p className={s.nota}>De las mismas líneas que más mira y que todavía no vio.</p>
              <ListaProductos productos={recomendados} vacio="Sin datos suficientes para recomendar." />
            </>
          )}
        </div>
      )}
      {pestana === 'deseos' && <div className={s.panel}><ListaProductos productos={l.deseos} vacio="Todavía no tiene lista de deseos." /></div>}
      {pestana === 'carrito' && (
        <div className={s.panel}>
          {l.carritoResumen && <p className={s.nota}>{l.carritoResumen}</p>}
          <ListaProductos productos={l.carrito} vacio="Su carrito está vacío en este momento." />
        </div>
      )}
      {pestana === 'fechas' && (
        <div className={s.panel}>
          <p className={s.nota}>{l.cumpleanos}</p>
          {!l.personas.length ? <SinDatos>Todavía no agendó personas ni fechas.</SinDatos> : (
            <ul className={s.personas}>
              {l.personas.map((p) => (
                <li key={p.id}>
                  <span className={s.persona}><strong>{p.nombre}</strong>{p.rol && <Etiqueta tono="violeta">{p.rol}</Etiqueta>}</span>
                  <span className={s.productoDetalle}>{p.fechas}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Los próximos cumpleaños: cuándo (los de esta semana resaltados), de quién y la fecha.
 *  - cumpleanos: [cumpleanosDe] · max (15)
 */
export function ListaCumpleanos({ cumpleanos = [], max = 15 }) {
  if (!cumpleanos.length) return <SinDatos>No hay cumpleaños en los próximos 30 días.</SinDatos>;
  return (
    <ul className={s.cumples} data-componente="ListaCumpleanos">
      {cumpleanos.slice(0, max).map((c) => (
        <li key={c.id}>
          <span className={c.pronto ? s.pronto : s.dias}>{c.cuando}</span>
          <span className={s.cumpleTextos}><strong>{c.quien}</strong><span>{c.detalle}</span></span>
        </li>
      ))}
    </ul>
  );
}
