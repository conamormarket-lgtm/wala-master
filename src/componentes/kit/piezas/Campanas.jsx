import React, { useState } from 'react';
import { X, Music2, MessageCircle, Link2 } from 'lucide-react';
import Boton from '../Boton';
import { IconoWala } from '../IconosWala';
import { Trazo } from '../Marca';
import { Enlace } from '../Enlace';
import { Texto, useTexto } from '../Traduccion';
import { TextoResaltado } from './TextoResaltado';
import { atributosDeFoto, siFallaDeVerdad } from '../../../components/common/OptimizedImage/OptimizedImage';
import s from './Campanas.module.css';

/*
 * Piezas de las campañas: el aviso de una invitación (/invitar/:código) y
 * los botones de una página de enlaces (/l/:slug). (El antes y después y la
 * reseña con foto eran de Regalos con amor, que salió del kit el 2026-10-16.)
 * Los textos pasan por la traducción.
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
  const t = {
    largo: useTexto(texto[0]),
    corto: useTexto(texto[1]),
    titulo: useTexto(nombre ? `${nombre} te invitó a Walá` : 'Llegaste con una invitación'),
    marca: useTexto('invitación'),
    aviso: useTexto('Invitación'),
    cerrar: useTexto('Cerrar el aviso de la invitación'),
  };
  const resaltado = (parte, k) => <span key={k} className={s.resaltado}>{parte}<Trazo className={s.trazo} /></span>;
  return (
    <aside className={s.invitacion} aria-label={t.aviso} data-componente="AvisoInvitacion">
      <IconoWala nombre="regalo" tamano={36} />
      <div className={s.invitacionTexto}>
        <p className={s.invitacionTitulo}>
          <TextoResaltado resaltar={[nombre || t.marca]} envolver={resaltado}>{t.titulo}</TextoResaltado>
        </p>
        <p className={s.soloAncho}>{t.largo}</p>
        <p className={s.soloAngosto}>{t.corto}</p>
      </div>
      {estado === 'nueva' && urlRegistro && <Boton to={urlRegistro} tamano="sm"><Texto>Crear cuenta</Texto></Boton>}
      {onCerrar && (
        <button type="button" className={s.cerrar} onClick={onCerrar} aria-label={t.cerrar}>
          <X aria-hidden="true" />
        </button>
      )}
    </aside>
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
  const etiqueta = useTexto('Redes sociales');
  if (!redes.length) return null;
  return (
    <nav className={s.redes} aria-label={etiqueta} data-componente="RedesEnlaces">
      {redes.map((r) => {
        const Icono = ICONOS_RED[r.tipo] || Link2;
        return (
          <Enlace key={r.id || r.url} to={r.url} className={s.red} aria-label={r.nombre || r.tipo} title={r.nombre || r.tipo} onClick={() => onClic?.(r)}>
            {r.icono ? <img {...atributosDeFoto(r.icono, '64px')} alt="" /> : <Icono aria-hidden="true" />}
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
 * Si la miniatura no carga, queda el hueco (el texto sigue centrado).
 */
export function BotonEnlace({ titulo, url, imagen, estilo, onClic }) {
  const [rota, setRota] = useState(false);
  return (
    <Enlace to={url} className={s.botonEnlace} style={estilo} onClick={onClic} data-componente="BotonEnlace">
      {imagen && !rota ? <img {...atributosDeFoto(imagen, '96px')} alt="" className={s.botonImagen} onError={siFallaDeVerdad(() => setRota(true))} /> : <span className={s.botonHueco} aria-hidden="true" />}
      <span className={s.botonTexto}><Texto>{titulo}</Texto></span>
      <span className={s.botonHueco} aria-hidden="true" />
    </Enlace>
  );
}
