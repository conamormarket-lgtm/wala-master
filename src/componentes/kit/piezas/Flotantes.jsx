import React from 'react';
import { IconoWhatsApp } from '../IconoWhatsApp';
import '../../../styles/actionButtons.css';
import { X } from 'lucide-react';
import { Enlace } from '../Enlace';
import { IconoWala } from '../IconosWala';
import { useTexto } from '../Traduccion';
import s from './Flotantes.module.css';

/*
 * Lo que flota sobre la página: WhatsApp, Walito y la píldora de
 * recompensa. Todo por props: quién lo ve (sesión, rutas) y qué
 * pasa al tocar lo decide la tienda. Los textos pasan por la traducción.
 */

/**
 * Pila de flotantes: abajo a la derecha, uno sobre otro (el primer hijo queda
 * abajo), por encima de la barra inferior en el celular. `izquierda` va
 * abajo a la izquierda (las píldoras de recompensa; varias, una sobre otra,
 * la primera abajo).
 *  - contenida: dentro de un marco con su propio scroll (demo, editor) en vez
 *    de fija a la ventana.
 *  - ocultarEnCelular: en páginas que ya tienen su botón fijo abajo (la ficha
 *    de producto), en el celular la pila tapaba título, precio y opciones.
 */
export function PilaFlotante({ children, izquierda, contenida = false, ocultarEnCelular = false }) {
  const clase = [s.capa, contenida && s.capaContenida, ocultarEnCelular && s.capaSinCelular].filter(Boolean).join(' ');
  return (
    <div className={clase}>
      {izquierda && <div className={s.izquierda}>{izquierda}</div>}
      <div className={s.pila}>{children}</div>
    </div>
  );
}

/** Enlace de wa.me con el mensaje ya escrito. */
export const enlaceWhatsApp = (numero, mensaje) => {
  const n = String(numero || '').replace(/\D/g, '');
  if (!n) return '';
  return `https://wa.me/${n}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`;
};

/**
 * Botón flotante de WhatsApp. Abre el chat en otra pestaña (o la app).
 * Con ratón asoma una burbuja con `etiqueta`.
 *  - numero, mensaje: arman el enlace de wa.me
 */
export function BotonWhatsApp({ numero, mensaje, etiqueta = '¿Te ayudamos?' }) {
  const url = enlaceWhatsApp(numero, mensaje);
  const escribenos = useTexto('Escríbenos por WhatsApp');
  const burbuja = useTexto(etiqueta);
  if (!url) return null;
  return (
    <Enlace to={url} data-accion="whatsapp" className={`${s.flotante} ${s.whatsapp}`} aria-label={`${escribenos}${burbuja ? `: ${burbuja}` : ''}`}>
      <IconoWhatsApp />
      {burbuja && <span className={s.burbuja} aria-hidden="true">{burbuja}</span>}
    </Enlace>
  );
}

/**
 * Caras de Walito por estado, en 3D (public/assets/kapi/3d: 512px, con el borde
 * limpio). Es la fuente única del kit: estados vacíos, el acceso, la encuesta,
 * la ventana de Walito… CARAS_KAPI_MINI (256px) para donde va chico (el botón
 * flotante). Las de antes (/assets/kapi/kapi-*.webp) siguen en la tienda real.
 */
export const CARAS_KAPI = {
  feliz: '/assets/kapi/3d/kapi-feliz.webp',
  hambre: '/assets/kapi/3d/kapi-hambre.webp',
  triste: '/assets/kapi/3d/kapi-triste.webp',
};
export const CARAS_KAPI_MINI = {
  feliz: '/assets/kapi/3d/kapi-feliz-256.webp',
  hambre: '/assets/kapi/3d/kapi-hambre-256.webp',
  triste: '/assets/kapi/3d/kapi-triste-256.webp',
};

/**
 * Walito, la mascota, flotando. Su cara cambia con el estado; el "!" avisa que
 * hay algo pendiente (comida del día, tutorial). La ventana de Walito la abre
 * quien recibe onAbrir.
 *  - estado: 'feliz' | 'hambre' | 'triste'
 */
export function KapiFlotante({ estado = 'feliz', aviso = false, onAbrir, etiqueta = 'Tu mascota Walito' }) {
  const nombre = useTexto(etiqueta);
  const algo = useTexto('tiene algo para ti');
  return (
    <button type="button" className={`${s.flotante} ${s.kapi}`} onClick={onAbrir} aria-label={aviso ? `${nombre} (${algo})` : nombre}>
      <img src={CARAS_KAPI_MINI[estado] || CARAS_KAPI_MINI.feliz} alt="" draggable="false" />
      {aviso && <span className={s.exclamacion} aria-hidden="true">!</span>}
    </button>
  );
}

/**
 * Píldora de recompensa ("Gana 15 monedas · Completa tu perfil de regalos").
 * Va con la moneda en un sello blanco de aro dorado. En el celular se
 * recoge en ese sello con "+15".
 *  - to: adónde lleva  · onIr: además de ir (cerrar menús…)
 *  - onAbrir: sin `to`, la píldora es un botón que abre algo (la semana de
 *    bienvenida abre su aviso grande)
 *  - onCerrar: la X (la tienda decide cuánto se oculta)
 */
export function PildoraRecompensa({ titulo, texto, monedas, to, onCerrar, onIr, onAbrir, icono = 'moneda' }) {
  const t = { titulo: useTexto(titulo), texto: useTexto(texto), ocultar: useTexto('Ocultar') };
  const Contenedor = !to && onAbrir ? 'button' : Enlace;
  const props = !to && onAbrir ? { type: 'button', onClick: onAbrir } : { to, onClick: onIr };
  return (
    <div className={s.pildora}>
      <Contenedor {...props} className={[s.pildoraEnlace, !to && onAbrir && s.pildoraBoton].filter(Boolean).join(' ')} aria-label={[t.titulo, t.texto].filter(Boolean).join('. ')}>
        <span className={s.pildoraSello}>
          <IconoWala nombre={icono} tamano={36} sticker={false} />
          {monedas ? <span className={s.pildoraMonedas} aria-hidden="true">+{monedas}</span> : null}
        </span>
        <span className={s.pildoraTexto}>
          <strong>{t.titulo}</strong>
          {t.texto && <span>{t.texto}</span>}
        </span>
      </Contenedor>
      {onCerrar && (
        <button type="button" className={s.pildoraCerrar} onClick={onCerrar} aria-label={t.ocultar}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
