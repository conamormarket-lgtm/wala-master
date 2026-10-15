import React from 'react';
import { X, Music2, MessageCircle, Link2 } from 'lucide-react';
import Boton from '../Boton';
import { IconoWala } from '../IconosWala';
import { Trazo } from '../Marca';
import { Enlace } from '../Enlace';
import { Texto } from '../Traduccion';
import Carrusel from '../Carrusel';
import { Estrellas } from './Opiniones';
import s from './Campanas.module.css';

/*
 * Piezas de las campañas: el aviso de una invitación (/invitar/:código), el
 * antes y después, una reseña con foto (Regalos con amor) y los botones de
 * una página de enlaces (/l/:slug).
 */

/**
 * El aviso de una invitación, arriba de todo (sobre la cabecera): quién te
 * invitó y qué ganas. Lo que hoy es AvisoInvitacion.
 *  - nombre (de quien invita; sin él, "una invitación")
 *  - estado: 'nueva' (sin cuenta: crea la tuya y recibe 10) | 'aceptada' (ya
 *    tienes las 10) | 'compra' (un link de compra: quien invita gana si compras)
 *  - plazo: "hasta el jueves 16, 9:20 p. m." · bono (10)
 *  - urlRegistro (el botón "Crear cuenta", solo en 'nueva'; null en el mismo
 *    registro) · onCerrar
 */
export function AvisoInvitacion({ nombre, estado = 'nueva', plazo, bono = 10, urlRegistro = '/registro', onCerrar }) {
  const quien = nombre || 'quien te invitó';
  const texto = {
    nueva: [`Crea tu cuenta y recibe ${bono} monedas de bienvenida para tu primera compra.`, `Crea tu cuenta y recibe ${bono} monedas.`],
    aceptada: [`Ya tienes tus ${bono} monedas de bienvenida. Tu primera compra${plazo ? ` ${plazo}` : ''} le suma monedas a ${quien}.`, `Ya tienes tus ${bono} monedas de bienvenida.`],
    compra: [`Compra${plazo ? ` ${plazo}` : ''} y ${quien} gana monedas con tu pedido. A ti no te cuesta nada.`, `Compra${plazo ? ` ${plazo}` : ''} y ${quien} gana monedas.`],
  }[estado] || [];
  return (
    <aside className={s.invitacion} aria-label="Invitación" data-componente="AvisoInvitacion">
      <IconoWala nombre="regalo" tamano={36} />
      <div className={s.invitacionTexto}>
        <p className={s.invitacionTitulo}>
          {nombre
            ? <><span className={s.resaltado}>{nombre}<Trazo className={s.trazo} /></span> te invitó a Walá</>
            : <>Llegaste con una <span className={s.resaltado}>invitación<Trazo className={s.trazo} /></span></>}
        </p>
        <p className={s.soloAncho}>{texto[0]}</p>
        <p className={s.soloAngosto}>{texto[1]}</p>
      </div>
      {estado === 'nueva' && urlRegistro && <Boton to={urlRegistro} tamano="sm">Crear cuenta</Boton>}
      {onCerrar && (
        <button type="button" className={s.cerrar} onClick={onCerrar} aria-label="Cerrar el aviso de la invitación">
          <X aria-hidden="true" />
        </button>
      )}
    </aside>
  );
}

/**
 * El antes y el después: dos fotos por lado con su rótulo y el "VS" al medio,
 * en un carrusel (un par por vista).
 *  - pares: [{ rotulo: 'Antes', fotos: [a, b] }, { rotulo: '5 años después', … }]
 */
export function AntesDespues({ pares = [] }) {
  return (
    <div className={s.antesDespues} data-componente="AntesDespues">
      <Carrusel visibles={{ escritorio: 1, tablet: 1, movil: 1 }} flechas puntos etiqueta="Antes y después">
        {pares.map((p, k) => (
          <figure key={p.rotulo} className={s.par}>
            <figcaption className={[s.rotulo, k > 0 && s.rotuloDespues].filter(Boolean).join(' ')}>{p.rotulo}</figcaption>
            <div className={s.fotos}>
              <img src={p.fotos[0]} alt="" loading="lazy" className={s.parFoto} />
              <span className={s.vs} aria-hidden="true">VS</span>
              <img src={p.fotos[1]} alt="" loading="lazy" className={s.parFoto} />
            </div>
          </figure>
        ))}
      </Carrusel>
    </div>
  );
}

/**
 * Una reseña con foto grande (las de Regalos con amor).
 *  - foto · lugar ("Lima, PE") · fecha · titulo · texto · puntuacion (5)
 */
export function TarjetaResena({ foto, lugar, fecha, titulo, texto, puntuacion = 5 }) {
  return (
    <article className={s.resena} data-componente="TarjetaResena">
      {foto && <img src={foto} alt="" loading="lazy" className={s.resenaFoto} />}
      <div className={s.resenaCuerpo}>
        <p className={s.resenaMeta}><span>{lugar}</span><span>{fecha}</span></p>
        <h3 className={s.resenaTitulo}><Texto>{titulo}</Texto></h3>
        <p className={s.resenaTexto}><Texto>{texto}</Texto></p>
        <Estrellas valor={puntuacion} tamano={16} etiqueta={`${puntuacion} de 5`} />
      </div>
    </article>
  );
}

/* Instagram y Facebook a línea, como los de lucide (su versión ya no trae marcas). */
const Instagram = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
);
const Facebook = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5.5v4H8v7h4v-7h2.6l.9-4H12V7.8c0-.5.4-.8.9-.8H15z" />
  </svg>
);

const ICONOS_RED = { instagram: Instagram, facebook: Facebook, tiktok: Music2, whatsapp: MessageCircle, custom: Link2 };

/**
 * Las redes de una página de enlaces, en círculos (íconos de línea, sin emojis).
 *  - redes: [{ id, tipo, nombre, url, icono }] · onClic(red)
 */
export function RedesEnlaces({ redes = [], onClic }) {
  if (!redes.length) return null;
  return (
    <nav className={s.redes} aria-label="Redes sociales" data-componente="RedesEnlaces">
      {redes.map((r) => {
        const Icono = ICONOS_RED[r.tipo] || Link2;
        return (
          <Enlace key={r.id || r.url} to={r.url} className={s.red} aria-label={r.nombre || r.tipo} title={r.nombre || r.tipo} onClick={() => onClic?.(r)}>
            {r.icono ? <img src={r.icono} alt="" /> : <Icono aria-hidden="true" />}
          </Enlace>
        );
      })}
    </nav>
  );
}

/**
 * Un botón de una página de enlaces, con el estilo que eligió el admin.
 *  - titulo · url · imagen (miniatura a la izquierda) · estilo (el style de
 *    estiloBotonStyle) · onClic
 */
export function BotonEnlace({ titulo, url, imagen, estilo, onClic }) {
  return (
    <Enlace to={url} className={s.botonEnlace} style={estilo} onClick={onClic} data-componente="BotonEnlace">
      {imagen ? <img src={imagen} alt="" className={s.botonImagen} /> : <span className={s.botonHueco} aria-hidden="true" />}
      <span className={s.botonTexto}><Texto>{titulo}</Texto></span>
      <span className={s.botonHueco} aria-hidden="true" />
    </Enlace>
  );
}
