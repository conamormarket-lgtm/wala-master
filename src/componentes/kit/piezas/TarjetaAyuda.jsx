import React from 'react';
import { MessageCircle } from 'lucide-react';
import Boton from '../Boton';
import s from './TarjetaAyuda.module.css';

/**
 * "¿Te quedó otra duda?": tarjeta de contacto con Kapi asomándose por el
 * borde (suelto, sin círculo). La usa Preguntas frecuentes y sirve para
 * cualquier lugar donde se ofrezca ayuda.
 *  - titulo, texto
 *  - accion: { texto, url } botón (p. ej. el WhatsApp de la tienda); sin él
 *    la tarjeta solo informa
 *  - imagen: Kapi por defecto
 */
export function TarjetaAyuda({
  titulo = '¿Te quedó otra duda?',
  texto = 'Escríbenos y te respondemos rapidito.',
  accion,
  imagen = '/assets/kapi/kapi-happy.webp',
}) {
  return (
    <aside className={s.ayuda}>
      <img className={s.kapi} src={imagen} alt="" width="104" height="96" loading="lazy" decoding="async" />
      <h3 className={s.titulo}>{titulo}</h3>
      {texto && <p className={s.texto}>{texto}</p>}
      {accion?.url && (
        <Boton to={accion.url} tamano="sm" icono={<MessageCircle aria-hidden="true" />}>
          {accion.texto || 'Escríbenos'}
        </Boton>
      )}
    </aside>
  );
}
