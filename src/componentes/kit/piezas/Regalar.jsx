import React, { useState } from 'react';
import { Gift, Heart, PartyPopper, Smile, PackageX } from 'lucide-react';
import Boton from '../Boton';
import TarjetaProducto from '../TarjetaProducto';
import { Etiqueta } from '../Etiquetas';
import { Sello } from '../Marca';
import { Avatar } from './Avatar';
import { HojaCalendario, textoFaltan } from './Regalos';
import { CARAS_KAPI } from './Flotantes';
import { Texto } from '../Traduccion';
import s from './Regalar.module.css';

/*
 * Regalarle algo a otra persona desde su lista de deseos (/wishlist/:código y
 * /regalar/:código) y abrir el regalo (/regalo/:pedido).
 */

/**
 * Un producto de la lista de deseos de otra persona: la tarjeta de la tienda
 * (sin su botón de agregar ni el corazón) y "Regalar esto" debajo, siempre a
 * la vista. Si ya se lo regalaron, un sello lo dice (y no se puede regalar dos
 * veces); si ya no está en la tienda, la foto que guardó y el aviso.
 *  - producto: props de TarjetaProducto (con srcSet, sizes, onVisible…)
 *  - regalado · disponible · cargando: el producto todavía llega (la tarjeta
 *    se ve con lo que guardó la lista y el botón espera)
 *  - onRegalar() · bloqueado: texto de por qué no se puede todavía
 */
export function TarjetaRegalo({ producto = {}, regalado = false, disponible = true, cargando = false, onRegalar, bloqueado }) {
  const [sinFoto, setSinFoto] = useState(false);
  const yaRegalado = (
    <p className={s.yaRegalado}><Sello tamano={22} girar={-8} tono="menta"><Gift aria-hidden="true" /></Sello> <Texto>¡Ya se lo regalaron!</Texto></p>
  );
  if (!disponible) {
    return (
      <div className={s.noDisponible} data-componente="TarjetaRegalo">
        {producto.imagen && !sinFoto
          ? <img src={producto.imagen} alt="" loading="lazy" decoding="async" onError={() => setSinFoto(true)} />
          : <PackageX aria-hidden="true" />}
        <strong><Texto>{producto.nombre}</Texto></strong>
        <span><Texto>Ya no está en la tienda.</Texto></span>
        {regalado && yaRegalado}
      </div>
    );
  }
  return (
    <div className={[s.regalo, regalado && s.regalado].filter(Boolean).join(' ')} data-componente="TarjetaRegalo">
      <TarjetaProducto {...producto} sinAccion sinDeseo />
      {regalado ? yaRegalado : (
        <>
          <Boton bloque icono={<Gift aria-hidden="true" />} cargando={cargando} disabled={Boolean(bloqueado) || producto.agotado} onClick={onRegalar}>
            <Texto>Regalar esto</Texto>
          </Boton>
          {bloqueado && <p className={s.pista}><Texto>{bloqueado}</Texto></p>}
        </>
      )}
    </div>
  );
}

/**
 * Una fecha para entregar el regalo: la persona (foto o inicial), su relación,
 * la ocasión, la hoja de calendario con la próxima vez que cae y cuánto falta.
 * Se elige tocándola (un grupo de radios).
 *  - nombre · foto · relacion · ocasion ("Cumpleaños") · fecha ('AAAA-MM-DD',
 *    la próxima) · dias (cuánto falta) · festivas: ['Día de la Madre']
 *  - elegida · onElegir
 */
export function FechaEntrega({ nombre, foto, relacion, ocasion, fecha, dias, festivas = [], elegida = false, onElegir }) {
  return (
    <article className={[s.fecha, elegida && s.fechaElegida].filter(Boolean).join(' ')} data-componente="FechaEntrega">
      <button type="button" role="radio" aria-checked={elegida} className={s.fechaBoton} onClick={onElegir}>
        <Avatar className={s.fechaAvatar} nombre={nombre} imagen={foto} letras={1} />
        <span className={s.fechaTextos}>
          <strong>{nombre || <Texto>Alguien</Texto>}</strong>
          {relacion && <small><Texto>{relacion}</Texto></small>}
          <span className={s.ocasion}><Texto>{ocasion}</Texto></span>
          {dias != null && <span className={s.faltan}><Texto>{textoFaltan(dias)}</Texto></span>}
        </span>
        <HojaCalendario fecha={fecha} tono={dias != null && dias <= 7 ? 'rosa' : 'violeta'} />
      </button>
      {festivas.length > 0 && (
        <span className={s.festivas}>{festivas.map((f) => <Etiqueta key={f} tono="rosa"><Texto>{f}</Texto></Etiqueta>)}</span>
      )}
    </article>
  );
}

const STICKERS = { 'kapi-love': Heart, 'kapi-party': PartyPopper, 'kapi-happy': Smile, 'kapi-smile': Smile };

/**
 * El sobre del regalo: cerrado dice para quién y "Toca para abrir"; abierto,
 * Kapi con el sticker que eligió quien regala y su mensaje.
 *  - para · mensaje · sticker ('kapi-love' | 'kapi-party' | 'kapi-happy')
 *  - abierto · onAbrir · children: lo que va al final (descargar la app…)
 */
export function SobreRegalo({ para, mensaje, sticker = 'kapi-love', abierto = false, onAbrir, children }) {
  const Icono = STICKERS[sticker] || Heart;
  return (
    <div className={[s.sobre, abierto && s.sobreAbierto].filter(Boolean).join(' ')} data-componente="SobreRegalo">
      <div className={s.escena}>
        <img className={s.kapi} src={CARAS_KAPI.feliz} alt="" width="160" height="160" />
        <Sello tamano={52} girar={-12} tono="rosa" className={s.sticker}><Icono aria-hidden="true" /></Sello>
      </div>
      {abierto ? (
        <div className={s.carta}>
          <small><Texto>Para</Texto> {para}</small>
          <p className={s.mensaje}>{mensaje}</p>
          {children}
        </div>
      ) : (
        <button type="button" className={s.cerrado} onClick={onAbrir}>
          <span className={s.solapa} aria-hidden="true" />
          <span className={s.cerradoTexto}>
            <small><Texto>Para</Texto></small>
            <strong>{para}</strong>
            <span><Texto>Toca para abrir</Texto></span>
          </span>
        </button>
      )}
    </div>
  );
}
