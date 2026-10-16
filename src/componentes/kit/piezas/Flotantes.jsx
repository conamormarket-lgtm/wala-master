import React from 'react';
import { X } from 'lucide-react';
import { Enlace } from '../Enlace';
import { IconoWala } from '../IconosWala';
import { useTexto } from '../Traduccion';
import s from './Flotantes.module.css';

/*
 * Lo que flota sobre la página: WhatsApp, Kapi y la píldora de
 * recompensa. Todo por props: quién lo ve (sesión, rutas) y qué
 * pasa al tocar lo decide la tienda. Los textos pasan por la traducción.
 */

/**
 * Pila de flotantes: abajo a la derecha, uno sobre otro (el primer hijo queda
 * abajo), por encima de la barra inferior en el celular. `izquierda` va
 * abajo a la izquierda (la píldora de recompensa).
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

/** Logo de WhatsApp (el globo con el teléfono), del color del texto. */
function LogoWhatsApp() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.04 3C9.38 3 3.96 8.4 3.96 15.05c0 2.13.56 4.2 1.62 6.03L3.86 27.4l6.48-1.7a12.1 12.1 0 0 0 5.7 1.45h.01c6.66 0 12.08-5.4 12.08-12.05C28.13 8.4 22.7 3 16.04 3Zm0 22.1h-.01a10.06 10.06 0 0 1-5.12-1.4l-.37-.22-3.85 1 1.03-3.74-.24-.38a9.97 9.97 0 0 1-1.54-5.31c0-5.53 4.52-10.03 10.1-10.03a10.04 10.04 0 0 1 10.08 10.04c0 5.53-4.52 10.04-10.08 10.04Zm5.53-7.52c-.3-.15-1.79-.88-2.07-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.18.2-.35.22-.65.07-.3-.15-1.28-.47-2.43-1.5a9.1 9.1 0 0 1-1.68-2.08c-.18-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.68-1.63-.93-2.23-.25-.59-.5-.5-.68-.51h-.58c-.2 0-.53.07-.8.37-.28.3-1.06 1.03-1.06 2.5 0 1.48 1.08 2.9 1.23 3.1.15.2 2.13 3.24 5.16 4.54.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.79-.73 2.04-1.44.25-.7.25-1.31.18-1.44-.08-.12-.28-.2-.58-.35Z"
      />
    </svg>
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
    <Enlace to={url} className={`${s.flotante} ${s.whatsapp}`} aria-label={`${escribenos}${burbuja ? `: ${burbuja}` : ''}`}>
      <LogoWhatsApp />
      {burbuja && <span className={s.burbuja} aria-hidden="true">{burbuja}</span>}
    </Enlace>
  );
}

/**
 * Caras de Kapi por estado, en 3D (public/assets/kapi/3d: 512px, con el borde
 * limpio). Es la fuente única del kit: estados vacíos, el acceso, la encuesta,
 * la ventana de Kapi… CARAS_KAPI_MINI (256px) para donde va chico (el botón
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
 * Kapi, la mascota, flotando. Su cara cambia con el estado; el "!" avisa que
 * hay algo pendiente (comida del día, tutorial). La ventana de Kapi la abre
 * quien recibe onAbrir.
 *  - estado: 'feliz' | 'hambre' | 'triste'
 */
export function KapiFlotante({ estado = 'feliz', aviso = false, onAbrir, etiqueta = 'Tu mascota Kapi' }) {
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
 *  - onCerrar: la X (la tienda decide cuánto se oculta)
 */
export function PildoraRecompensa({ titulo, texto, monedas, to, onCerrar, onIr, icono = 'moneda' }) {
  const t = { titulo: useTexto(titulo), texto: useTexto(texto), ocultar: useTexto('Ocultar') };
  return (
    <div className={s.pildora}>
      <Enlace to={to} onClick={onIr} className={s.pildoraEnlace} aria-label={[t.titulo, t.texto].filter(Boolean).join('. ')}>
        <span className={s.pildoraSello}>
          <IconoWala nombre={icono} tamano={36} sticker={false} />
          {monedas ? <span className={s.pildoraMonedas} aria-hidden="true">+{monedas}</span> : null}
        </span>
        <span className={s.pildoraTexto}>
          <strong>{t.titulo}</strong>
          {t.texto && <span>{t.texto}</span>}
        </span>
      </Enlace>
      {onCerrar && (
        <button type="button" className={s.pildoraCerrar} onClick={onCerrar} aria-label={t.ocultar}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
