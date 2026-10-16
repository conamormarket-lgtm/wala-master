import React, { useState } from 'react';
import { ChevronDown, Copy, Check, CalendarDays, PenLine, Hash, Mail } from 'lucide-react';
import Boton from '../Boton';
import { Sello, Trazo } from '../Marca';
import { Enlace } from '../Enlace';
import { Texto } from '../Traduccion';
import { PasosSellos } from './PasosSellos';
import s from './Legales.module.css';

/*
 * Piezas de las páginas legales: la política de privacidad, los términos y
 * condiciones y el libro de reclamaciones (obligatorio en Perú, Ley 29571).
 */

/**
 * La cabeza de una página legal: el ícono en su sello, el título con su
 * trazo y una línea debajo (la fecha de actualización, la ley…).
 *  - icono (nodo de lucide) · titulo · detalle (nodo o texto)
 */
export function CabezaLegal({ icono, titulo, detalle }) {
  return (
    <header className={s.cabeza} data-componente="CabezaLegal">
      <Sello tamano={52}>{icono}</Sello>
      <div className={s.cabezaTextos}>
        <h1 className={s.titulo}><Texto>{titulo}</Texto><Trazo className={s.trazo} /></h1>
        {detalle && <p className={s.detalle}>{detalle}</p>}
      </div>
    </header>
  );
}

/**
 * El índice de un documento: cada sección con su número, enlazada a su
 * ancla. En escritorio va fijo al costado; en el celular, plegado arriba
 * ("En esta página").
 *  - secciones: [{ id, titulo }]
 */
export function IndiceLegal({ secciones = [] }) {
  const [abierto, setAbierto] = useState(false);
  const lista = (
    <ol className={s.indiceLista}>
      {secciones.map((sec, k) => (
        <li key={sec.id}>
          <Enlace to={`#${sec.id}`} className={s.indiceEnlace} onClick={() => setAbierto(false)}>
            <span className={s.indiceNumero}>{k + 1}</span>
            <Texto>{sec.titulo}</Texto>
          </Enlace>
        </li>
      ))}
    </ol>
  );
  return (
    <nav className={s.indice} aria-label="En esta página" data-componente="IndiceLegal">
      <p className={s.indiceTitulo}>En esta página</p>
      <button type="button" className={s.indicePlegable} aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        <span>En esta página</span>
        <small>{secciones.length} secciones</small>
        <ChevronDown aria-hidden="true" className={abierto ? s.girada : undefined} />
      </button>
      <div className={[s.indiceCuerpo, abierto && s.indiceAbierto].filter(Boolean).join(' ')}>{lista}</div>
    </nav>
  );
}

/**
 * Una sección de un documento legal: su número en un sello, el título, los
 * párrafos, una lista (con o sin etiqueta en negrita) y, si hay, un párrafo
 * destacado (la excepción que el cliente necesita encontrar).
 *  - numero, id (el ancla), titulo, parrafos: [texto], lista: [{ etiqueta, texto }], destacado
 *  - children: lo que va al final (p. ej. la tarjeta de contacto)
 */
export function SeccionLegal({ numero, id, titulo, parrafos = [], lista = [], destacado, children }) {
  return (
    <section id={id} className={s.seccion} data-componente="SeccionLegal">
      <h2 className={s.seccionTitulo}>
        <Sello tamano={30} girar={numero % 2 ? -8 : 6}><b className={s.seccionNumero}>{numero}</b></Sello>
        <Texto>{titulo}</Texto>
      </h2>
      {parrafos.map((p) => <p key={p.slice(0, 40)} className={s.parrafo}><Texto>{p}</Texto></p>)}
      {lista.length > 0 && (
        <ul className={s.lista}>
          {lista.map((it) => (
            <li key={(it.etiqueta || '') + it.texto.slice(0, 30)}>
              {it.etiqueta && <strong><Texto>{it.etiqueta}</Texto>: </strong>}
              <Texto>{it.texto}</Texto>
            </li>
          ))}
        </ul>
      )}
      {destacado && <p className={s.destacado}><Texto>{destacado}</Texto></p>}
      {children}
    </section>
  );
}

/**
 * Los datos del proveedor en la hoja de reclamación (como pide INDECOPI):
 * razón social, RUC, domicilio, el número de hoja y la fecha.
 *  - empresa: { razonSocial, ruc, domicilioFiscal } · fecha: "15 de octubre de 2026"
 *  - codigo: el número de hoja, si ya se generó
 */
export function DatosProveedor({ empresa = {}, fecha, codigo }) {
  return (
    <dl className={s.proveedor} data-componente="DatosProveedor">
      <div className={s.proveedorEmpresa}>
        <dt>Proveedor</dt>
        <dd><strong>{empresa.razonSocial}</strong></dd>
      </div>
      <div>
        <dt>RUC</dt>
        <dd>{empresa.ruc}</dd>
      </div>
      <div className={s.proveedorAncho}>
        <dt>Domicilio</dt>
        <dd>{empresa.domicilioFiscal}</dd>
      </div>
      <div>
        <dt>Hoja de reclamación</dt>
        <dd>{codigo || <em>Se genera al enviar</em>}</dd>
      </div>
      {fecha && (
        <div>
          <dt>Fecha</dt>
          <dd>{fecha}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * Lo que pasa con una hoja de reclamación, en tres pasos con su sello: la
 * llenas, recibes tu código y te respondemos (en cuántos días hábiles).
 * Es PasosSellos con los pasos del libro.
 *  - plazo: días hábiles (15)
 */
export function PasosAtencion({ plazo = 15 }) {
  return (
    <PasosSellos
      etiqueta="Lo que sigue"
      pasos={[
        { icono: <PenLine aria-hidden="true" />, titulo: 'Llenas tu hoja', texto: 'Tus datos, lo que compraste y qué pasó.' },
        { icono: <Hash aria-hidden="true" />, titulo: 'Recibes tu código', texto: 'Al enviarla, para hacerle seguimiento.' },
        { icono: <Mail aria-hidden="true" />, titulo: 'Te respondemos', texto: `En máximo ${plazo} días hábiles, a tu correo.` },
      ]}
    />
  );
}

/**
 * Cuánto falta para enviar una hoja: un tramo por paso que se llena al
 * completarlo (solo se mueve cuando la persona escribe) y una línea que dice
 * qué falta o que ya se puede enviar.
 *  - pasos: [{ titulo, hecho }] · listo: el texto cuando están todos
 */
export function AvanceHoja({ pasos = [], listo = 'Todo listo: revisa y envía.' }) {
  const faltan = pasos.filter((p) => !p.hecho).map((p) => p.titulo);
  const texto = faltan.length === 0
    ? listo
    : `Te falta: ${faltan.length > 1 ? `${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}` : faltan[0]}.`;
  return (
    <div className={[s.avance, faltan.length === 0 && s.avanceListo].filter(Boolean).join(' ')} data-componente="AvanceHoja">
      <span className={s.avanceTramos} aria-hidden="true">
        {pasos.map((p) => <span key={p.titulo} className={s.avanceTramo}><span className={p.hecho ? s.avanceLleno : undefined} /></span>)}
      </span>
      <p className={s.avanceTexto} aria-live="polite">
        {faltan.length === 0 && <Check aria-hidden="true" />}
        {texto}
      </p>
    </div>
  );
}

/**
 * Un código para guardar (una reclamación, un cupón): grande, con la letra
 * de la marca y un botón para copiarlo.
 *  - codigo · rotulo ("Tu código de seguimiento") · fecha (texto) · detalle
 *    (una línea más, p. ej. "Válido hasta el 14 de noviembre")
 */
export function CodigoCopiable({ codigo, rotulo = 'Tu código', fecha, detalle }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch { /* sin portapapeles: el código queda a la vista */ }
  };
  return (
    <div className={s.codigo} data-componente="CodigoCopiable">
      <span className={s.codigoRotulo}>{rotulo}</span>
      <strong className={s.codigoValor}>{codigo}</strong>
      {fecha && <span className={s.codigoFecha}><CalendarDays aria-hidden="true" /> {fecha}</span>}
      {detalle && <span className={s.codigoFecha}>{detalle}</span>}
      <Boton variante="secundario" tamano="sm" icono={copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} onClick={copiar}>
        {copiado ? 'Copiado' : 'Copiar código'}
      </Boton>
    </div>
  );
}
