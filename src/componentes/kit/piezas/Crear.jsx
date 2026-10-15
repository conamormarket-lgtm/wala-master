import React from 'react';
import { Shirt, Upload, ShoppingBag, Paintbrush, Pencil, Copy, X, Images, CheckCircle2 } from 'lucide-react';
import Boton from '../Boton';
import { SelectorTalla } from '../Formulario';
import { Sello, Trazo, Garabatos } from '../Marca';
import { FotoProducto } from './FotoProducto';
import { TituloEditable } from './Ficha';
import s from './Crear.module.css';

/*
 * Piezas de Crear (/personalizar): la portada con los tres pasos y el texto
 * de "¿Para cuántos?". Las prendas y los combos son TarjetaProducto (accion
 * "crear") y el selector, Chip: ya estaban en el kit.
 */

/* ── Portada ─────────────────────────────────────────────── */

export const PASOS_CREAR = [
  { Icono: Shirt, titulo: 'Elige tu prenda', texto: 'Color y talla' },
  { Icono: Upload, titulo: 'Diseña', texto: 'Sube tu imagen o escribe un texto' },
  { Icono: ShoppingBag, titulo: 'Recíbela', texto: 'La imprimimos y te la enviamos' },
];

/**
 * La portada de Crear: el arte de Kapi diseñando (ancho en escritorio,
 * vertical en el celular) y, en el lado libre, el título con su trazo y los
 * tres pasos en sellos unidos por una costura punteada (como una prenda).
 *  - titulo, texto · pasos: [{ Icono, titulo, texto }] (PASOS_CREAR)
 *  - arte: { ancho, ancho1200, movil } las imágenes de /crear
 */
export function PortadaCrear({
  titulo = 'Crea tu prenda',
  texto = 'Elige una prenda, ponle tu imagen o tu frase y la imprimimos para ti.',
  pasos = PASOS_CREAR,
  arte = { ancho: '/crear/banner-crear.webp', ancho1200: '/crear/banner-crear-1200.webp', movil: '/crear/banner-crear-movil.webp' },
}) {
  return (
    <section className={s.portada} data-componente="PortadaCrear">
      <picture>
        <source media="(max-width: 768px)" srcSet={arte.movil} width="800" height="1067" />
        <img
          className={s.portadaArte}
          src={arte.ancho}
          srcSet={`${arte.ancho1200} 1200w, ${arte.ancho} 2172w`}
          sizes="(max-width: 1280px) 100vw, 1248px"
          alt=""
          aria-hidden="true"
          draggable={false}
          width="2172"
          height="724"
        />
      </picture>
      <div className={s.portadaTexto}>
        <Garabatos variante="titulo" className={s.portadaGarabatos} />
        <h1 className={s.portadaTitulo}>
          {titulo}
          <Trazo className={s.portadaTrazo} />
        </h1>
        <p className={s.portadaBajada}>{texto}</p>
        <ol className={s.pasos}>
          {pasos.map(({ Icono, titulo: t, texto: x }, i) => (
            <li key={t} className={s.paso} style={{ '--i': i }}>
              <span className={s.pasoSello}>
                <Sello tamano={42} girar={i % 2 ? 6 : -8}><Icono aria-hidden="true" /></Sello>
                <span className={s.pasoNumero} aria-hidden="true">{i + 1}</span>
              </span>
              <span className={s.pasoTextos}>
                <strong><span className={s.oculto}>{i + 1}. </span>{t}</strong>
                <span>{x}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Nombre de cada opción de "¿Para cuántos?" (etiquetaPara de la tienda): si
 * los combos de ese tamaño mezclan prendas distintas son un conjunto para una
 * persona, no prendas iguales para varias.
 */
export const textoPara = (n, conjunto) => {
  if (n === 1) return 'Para ti';
  if (conjunto) return 'Conjunto';
  return n === 2 ? 'En pareja' : `Para ${n}`;
};

/* ── Una prenda de un combo ─────────────────────────────── */

/**
 * Una prenda de un combo (/combo/:id), en su fila: la foto con su número
 * (y un visto si está lista), la prenda, su diseño y lo que se puede hacer
 * según cómo está:
 *  - vacia: "Ponle tu imagen o tu frase" · Diseñar · Copiar de la prenda N ·
 *    Mis creaciones
 *  - plantilla: el diseño de la comunidad del que se parte · Personalizar
 *  - disenada: su nombre (se renombra ahí), color y lados con diseño, su
 *    talla (si cada prenda lleva la suya) · Editar · Usar en las demás · Quitar
 *  - borrador / vieja: lo mismo, con el aviso de que falta guardarla
 * Props: i, prenda, foto, estado, nombre, color: { nombre, fondo }, lados,
 * lista, agotada, tallas, talla, onTalla(t), urlDisenar, urlEditar,
 * copiarDe: { numero, url }, onMisCreaciones, onUsarEnLasDemas (texto: 'la
 * otra' | 'las demás'), onQuitar, onRenombrar, onVer (mostrar en la galería)
 */
export function FilaPiezaCombo({
  i, prenda, foto, estado = 'vacia', nombre, color, lados = [], lista = false, agotada = false,
  tallas = [], talla, onTalla, urlDisenar, urlEditar, copiarDe, onMisCreaciones, usarEnLasDemas, onUsarEnLasDemas,
  onQuitar, onRenombrar, onVer,
}) {
  const disenada = estado === 'disenada' || estado === 'borrador' || estado === 'vieja';
  return (
    <li className={[s.pieza, lista && s.piezaLista].filter(Boolean).join(' ')} data-componente="FilaPiezaCombo">
      <button type="button" className={s.piezaFoto} onClick={onVer} aria-label={`Ver la prenda ${i + 1}`}>
        <FotoProducto className={[s.piezaImagen, estado === 'vacia' && s.atenuada].filter(Boolean).join(' ')} src={foto} relleno={estado === 'vacia' ? '10%' : '4%'} />
        <span className={s.piezaNumero}>{i + 1}</span>
        {lista && <span className={s.piezaVisto} aria-label="Lista"><CheckCircle2 aria-hidden="true" /></span>}
      </button>
      <div className={s.piezaInfo}>
        <span className={s.piezaPrenda}>Prenda {i + 1} · {prenda}</span>
        {disenada ? (
          <>
            <TituloEditable nombre={nombre || 'Mi creación'} onRenombrar={onRenombrar} como="strong" />
            {(color?.nombre || lados.length > 0) && (
              <span className={s.piezaDatos}>
                {color?.nombre && <><span className={s.piezaColor} style={{ background: color.fondo }} aria-hidden="true" /> {color.nombre}</>}
                {color?.nombre && lados.length > 0 && <span aria-hidden="true">·</span>}
                {lados.length > 0 && lados.join(' + ')}
              </span>
            )}
            {estado !== 'disenada' && (
              <p className={s.piezaAviso}>{estado === 'borrador' ? 'Sin terminar: continúa y guárdala para tenerla lista.' : 'Ábrela y guárdala otra vez para prepararla para imprimir.'}</p>
            )}
            {tallas.length > 0 && onTalla && (
              <SelectorTalla tallas={tallas} valor={talla} onChange={onTalla} etiqueta={`Talla de la prenda ${i + 1}`} />
            )}
            <div className={s.piezaAcciones}>
              <Boton to={urlEditar} tamano="sm" variante="contorno" icono={<Pencil aria-hidden="true" />}>{estado === 'borrador' ? 'Continuar' : 'Editar'}</Boton>
              {onUsarEnLasDemas && lista && <Boton tamano="sm" variante="fantasma" icono={<Copy aria-hidden="true" />} onClick={onUsarEnLasDemas}>Usar en {usarEnLasDemas || 'las demás'}</Boton>}
              {onQuitar && <Boton tamano="sm" variante="fantasma" icono={<X aria-hidden="true" />} onClick={onQuitar}>Quitar</Boton>}
            </div>
          </>
        ) : estado === 'plantilla' ? (
          <>
            <strong className={s.piezaNombre}>{nombre || 'Diseño de la comunidad'}</strong>
            {color?.nombre && <span className={s.piezaDatos}><span className={s.piezaColor} style={{ background: color.fondo }} aria-hidden="true" /> {color.nombre}</span>}
            <p className={s.piezaAyuda}>Llévala tal cual o cámbiale el nombre, la foto o lo que quieras.</p>
            <div className={s.piezaAcciones}>
              <Boton to={urlDisenar} tamano="sm" icono={<Paintbrush aria-hidden="true" />}>Personalizar</Boton>
            </div>
          </>
        ) : (
          <>
            <p className={s.piezaAyuda}>Ponle tu imagen o tu frase.</p>
            <div className={s.piezaAcciones}>
              <Boton to={urlDisenar} tamano="sm" icono={<Paintbrush aria-hidden="true" />}>Diseñar</Boton>
              {copiarDe && <Boton to={copiarDe.url} tamano="sm" variante="contorno" icono={<Copy aria-hidden="true" />}>Copiar de la prenda {copiarDe.numero}</Boton>}
              {onMisCreaciones && <Boton tamano="sm" variante="fantasma" icono={<Images aria-hidden="true" />} onClick={onMisCreaciones}>Mis creaciones</Boton>}
            </div>
          </>
        )}
        {agotada && <p className={s.piezaAviso}>Agotada por ahora.</p>}
      </div>
    </li>
  );
}
