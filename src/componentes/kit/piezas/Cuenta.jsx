import React, { useRef } from 'react';
import { Camera, Check, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Enlace } from '../Enlace';
import { Contador } from '../Etiquetas';
import { Sello, Puntos, Trazo } from '../Marca';
import { Avatar } from './Avatar';
import s from './Cuenta.module.css';

/*
 * Piezas de la cuenta (/cuenta): la cabecera de cada página y de cada tarjeta,
 * la tarjeta, los datos en filas, las cifras (monedas, XP, racha), los accesos
 * del resumen, la identidad del perfil y una lista para elegir una opción.
 * Datos por props; la página decide qué hacer con cada acción. Cada pieza
 * lleva data-componente con su nombre ("Ver componentes" de la demo).
 */

/**
 * Cabecera de una página o tarjeta de la cuenta: sello con el ícono, título
 * con la letra del logo, una línea de ayuda y, a la derecha, una acción.
 *  - icono: ícono de lucide (nodo) · tono: del Sello ('degradado', 'oro'…)
 *  - titulo, subtitulo · accion: nodo (un Boton) · nivel: 1 (página) o 2 (tarjeta)
 *  - subrayado: trazo a mano bajo el título (la página de inicio de la cuenta)
 *  - figura: en vez del sello, otro nodo (la foto de un producto, un IconoWala)
 *  - antetitulo: línea chica sobre el título ("Link del producto"), en texto
 */
export function CabezaCuenta({ icono, tono = 'degradado', titulo, subtitulo, accion, nivel = 1, subrayado = false, figura, antetitulo }) {
  const H = `h${nivel}`;
  return (
    <header className={[s.cabeza, nivel > 1 && s.cabezaTarjeta].filter(Boolean).join(' ')}>
      {figura || (icono && <Sello tamano={nivel > 1 ? 36 : 44} tono={tono}>{icono}</Sello>)}
      <div className={s.cabezaTextos}>
        {antetitulo && <p className={s.cabezaAntetitulo}>{antetitulo}</p>}
        <H className={s.cabezaTitulo}>
          <span className={subrayado ? s.conTrazo : undefined}>
            {titulo}
            {subrayado && <Trazo className={s.trazo} />}
          </span>
        </H>
        {subtitulo && <p className={s.cabezaSub}>{subtitulo}</p>}
      </div>
      {accion && <div className={s.cabezaAccion}>{accion}</div>}
    </header>
  );
}

/**
 * Tarjeta de la cuenta (Datos personales, Apariencia, Idioma…): superficie
 * con borde y su CabezaCuenta de nivel 2 arriba.
 *  - icono, tono, titulo, subtitulo, accion, figura, antetitulo: los de CabezaCuenta
 *  - children: el contenido
 */
export function TarjetaCuenta({ icono, tono, titulo, subtitulo, accion, figura, antetitulo, children, className, ...rest }) {
  return (
    <section className={[s.tarjeta, className].filter(Boolean).join(' ')} data-componente="TarjetaCuenta" {...rest}>
      {(titulo || icono) && <CabezaCuenta nivel={2} icono={icono} tono={tono} titulo={titulo} subtitulo={subtitulo} accion={accion} figura={figura} antetitulo={antetitulo} />}
      {children}
    </section>
  );
}

/**
 * Datos en filas: la etiqueta en gris a la izquierda y el valor a la derecha.
 *  - datos: [{ etiqueta, valor }]; sin valor dice `vacio` en gris
 */
export function ListaDatos({ datos = [], vacio = 'Por completar' }) {
  return (
    <dl className={s.datos}>
      {datos.map((d) => (
        <div key={d.etiqueta} className={s.dato}>
          <dt>{d.etiqueta}</dt>
          <dd className={d.valor ? undefined : s.datoVacio}>{d.valor || vacio}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Una cifra de la cuenta: monedas, XP, racha, personas que entraron…
 * El número va con la letra del logo y la palabra en gris (texto simple, no
 * etiqueta: es un dato de la página).
 *  - icono: nodo; va en un Sello salvo `sello={false}` (p. ej. la Moneda)
 *  - tono: del Sello · etiqueta: "Monedas" · valor · unidad: "monedas", "XP"
 *  - nota: línea chica debajo (texto o nodo) · children: una acción (Boton)
 *  - grande: centrada y con el número grande (el saldo del perfil)
 */
export function Estadistica({ icono, tono = 'degradado', sello = true, etiqueta, valor, unidad, nota, grande = false, children }) {
  return (
    <div className={[s.cifra, grande && s.cifraGrande].filter(Boolean).join(' ')} data-componente="Estadistica">
      <div className={[s.cifraCaja, grande && s.cifraCajaGrande].filter(Boolean).join(' ')}>
        {icono && (sello ? <Sello tamano={grande ? 48 : 38} tono={tono}>{icono}</Sello> : <span className={s.cifraIcono}>{icono}</span>)}
        <div className={s.cifraTextos}>
          {etiqueta && <p className={s.cifraEtiqueta}>{etiqueta}</p>}
          <p className={s.cifraValor}>
            <strong>{valor}</strong>
            {unidad && <span>{unidad}</span>}
          </p>
          {nota && <p className={s.cifraNota}>{nota}</p>}
        </div>
        {children && <div className={s.cifraAccion}>{children}</div>}
      </div>
    </div>
  );
}

/**
 * Accesos de la cuenta (la pantalla que abre "Mi cuenta" en el celular): una
 * cuadrícula por grupo, cada acceso con su sello y su nombre, todos del mismo
 * tamaño.
 *  - grupos: [{ titulo, tono, items: [{ to, texto, Icono, cuenta }] }]
 *    (tono del Sello por grupo; cuenta: número en la esquina, p. ej. cupones)
 *  - onNavegar
 */
export function AccesosCuenta({ grupos = [], onNavegar }) {
  return (
    <nav className={s.accesos} aria-label="Secciones de tu cuenta" data-componente="AccesosCuenta">
      {grupos.map((g) => (
        <section key={g.titulo} className={s.accesosGrupo}>
          <h2 className={s.accesosTitulo}>{g.titulo}</h2>
          <ul className={s.accesosLista}>
            {g.items.map(({ to, texto, Icono, cuenta }, k) => (
              <li key={to}>
                <Enlace to={to} className={s.acceso} onClick={onNavegar}>
                  <span className={s.accesoSello} style={{ '--giro': `${k % 2 ? 6 : -8}deg` }}>
                    <Sello tamano={46} tono={g.tono} girar={0}>{Icono && <Icono aria-hidden="true" />}</Sello>
                    <Contador valor={cuenta} />
                  </span>
                  <span className={s.accesoTexto}>{texto}</span>
                </Enlace>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

/**
 * Identidad del perfil: la foto en un aro punteado (como un sello) con el
 * botón de cámara, el nombre con la letra del logo, el correo y si el perfil
 * está completo (en texto, con su ícono).
 *  - nombre, email, avatar
 *  - completo: true → "Perfil completo"; false → "Faltan datos por completar"
 *  - onCambiarFoto(archivo): sin ella no hay botón de cámara
 *  - onQuitarFoto: con foto, una × para quitarla (la página confirma)
 *  - subiendo: la cámara gira mientras sube
 */
export function IdentidadCuenta({ nombre, email, avatar, completo, onCambiarFoto, onQuitarFoto, subiendo = false }) {
  const archivo = useRef(null);
  return (
    <section className={s.identidad} data-componente="IdentidadCuenta">
      <Puntos className={s.identidadPuntos} filas={4} columnas={6} />
      <div className={s.identidadCaja}>
        <div className={s.identidadFoto}>
          <Avatar className={s.identidadAvatar} nombre={nombre} imagen={avatar} />
          {onCambiarFoto && (
            <>
              <button
                type="button"
                className={[s.identidadCamara, subiendo && s.subiendo].filter(Boolean).join(' ')}
                onClick={() => archivo.current?.click()}
                disabled={subiendo}
                aria-label="Cambiar foto de perfil"
              >
                <Camera aria-hidden="true" />
              </button>
              <input
                ref={archivo}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onCambiarFoto(f); }}
              />
            </>
          )}
          {avatar && onQuitarFoto && (
            <button type="button" className={s.identidadQuitar} onClick={onQuitarFoto} aria-label="Quitar foto de perfil">
              <X aria-hidden="true" />
            </button>
          )}
        </div>
        <div className={s.identidadTextos}>
          <h1 className={s.identidadNombre}>{nombre || 'Mi perfil'}</h1>
          <p className={s.identidadEmail}>{email || '—'}</p>
          {completo != null && (
            <p className={[s.identidadEstado, completo ? s.estadoOk : s.estadoFalta].filter(Boolean).join(' ')}>
              {completo ? <CheckCircle2 aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
              {completo ? 'Perfil completo' : 'Faltan datos por completar'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Elegir una opción de una lista en filas (idioma, y cualquier ajuste de
 * una sola opción). La elegida se marca en violeta con un visto.
 *  - opciones: [{ valor, texto, detalle, icono }] (icono: nodo a la izquierda)
 *  - valor · onElegir(valor) · etiqueta: nombre del grupo para lectores
 */
export function ListaEleccion({ opciones = [], valor, onElegir, etiqueta }) {
  return (
    <div className={s.eleccion} role="group" aria-label={etiqueta}>
      {opciones.map((o) => {
        const activa = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            className={[s.opcion, activa && s.opcionActiva].filter(Boolean).join(' ')}
            aria-pressed={activa}
            onClick={() => onElegir?.(o.valor)}
          >
            {o.icono && <span className={s.opcionIcono}>{o.icono}</span>}
            <span className={s.opcionTextos}>
              <span>{o.texto}</span>
              {o.detalle && <small>{o.detalle}</small>}
            </span>
            <span className={s.opcionVisto} aria-hidden="true">{activa && <Check />}</span>
          </button>
        );
      })}
    </div>
  );
}
