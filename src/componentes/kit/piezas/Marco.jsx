import React from 'react';
import { AlertTriangle, BookOpen, Info, Moon, Settings, Sun, X, XCircle } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { HojaInferior } from '../Feedback';
import { IsoWala, EtiquetaColgante } from '../Marca';
import s from './Marco.module.css';

/*
 * Piezas del marco de la tienda: lo que rodea a las secciones (avisos
 * arriba, barra de admin, pie legal, ventanas). Todo por props; quién lo ve
 * y cuándo lo decide la tienda.
 */

const ICONOS_AVISO = { info: Info, aviso: AlertTriangle, error: XCircle };

/**
 * Franja de aviso del sistema, arriba de todo (mantenimiento, demoras…).
 *  - tipo: 'info' | 'aviso' | 'error'  · onCerrar: opcional
 */
export function AvisoSistema({ tipo = 'aviso', children, onCerrar }) {
  const Icono = ICONOS_AVISO[tipo] || Info;
  return (
    <div className={`${s.aviso} ${s[`aviso_${tipo}`] || ''}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <Icono aria-hidden="true" />
      <p>{children}</p>
      {onCerrar && (
        <button type="button" className={s.avisoCerrar} onClick={onCerrar} aria-label="Cerrar aviso">
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * Banner para bajar la app (solo en el navegador del celular).
 *  - url: tienda de apps  · onCerrar: la X
 */
export function BannerApp({ titulo = 'Walá App', texto = 'Para una mejor experiencia', accion = 'Obtener', url, onCerrar }) {
  return (
    <div className={s.app}>
      {onCerrar && (
        <button type="button" className={s.appCerrar} onClick={onCerrar} aria-label="Cerrar">
          <X aria-hidden="true" />
        </button>
      )}
      <span className={s.appIcono}><IsoWala tamano={30} tono="blanco" /></span>
      <span className={s.appTexto}>
        <strong>{titulo}</strong>
        <span>{texto}</span>
      </span>
      <Boton to={url} tamano="sm">{accion}</Boton>
    </div>
  );
}

/**
 * Barra del administrador: avisa que el modo admin está activo y da acceso
 * al panel y al editor visual de la página.
 *  - editando: el editor está abierto (el botón pasa a "Guardar y salir")
 *  - panel: ruta del panel (o null)  · extra: nodos a la derecha
 */
export function BarraAdmin({ editando = false, onEditor, panel = '/admin', textoEditor, extra }) {
  return (
    <div className={s.admin} role="region" aria-label="Herramientas de administrador">
      <span className={s.adminTexto}>
        <Settings aria-hidden="true" />
        <span>Modo administrador</span>
      </span>
      <div className={s.adminAcciones}>
        {extra}
        {panel && <Enlace to={panel} className={s.adminPanel}>Panel</Enlace>}
        {onEditor && (
          <Boton tamano="sm" variante={editando ? 'secundario' : 'primario'} onClick={onEditor}>
            {textoEditor || (editando ? 'Guardar y salir' : 'Editar esta página')}
          </Boton>
        )}
      </div>
    </div>
  );
}

/**
 * Pie legal, debajo de las columnas del pie: contacto de la empresa, enlaces
 * legales y el Libro de Reclamaciones (obligatorio en Perú).
 *  - empresa: { nombre, email, telefono, direccion }
 *  - enlaces: [{ texto, url }]  · reclamaciones: ruta del libro
 */
export function PieLegal({ empresa = {}, enlaces = [], reclamaciones = '/libro-de-reclamaciones', anio = new Date().getFullYear() }) {
  const contacto = [
    empresa.nombre,
    empresa.email && <a key="email" href={`mailto:${empresa.email}`}>{empresa.email}</a>,
    empresa.telefono && <a key="tel" href={`tel:${String(empresa.telefono).replace(/\s+/g, '')}`}>Tel. {empresa.telefono}</a>,
    empresa.direccion,
  ].filter(Boolean);
  return (
    <div className={s.legal}>
      {contacto.length > 0 && (
        <p className={s.legalContacto}>
          {contacto.map((c, i) => <React.Fragment key={i}>{i > 0 && <span aria-hidden="true"> · </span>}{c}</React.Fragment>)}
        </p>
      )}
      <nav className={s.legalEnlaces} aria-label="Legal">
        {enlaces.map((e) => <Enlace key={e.url} to={e.url}>{e.texto}</Enlace>)}
        {reclamaciones && (
          <Enlace to={reclamaciones} className={s.libro}>
            <BookOpen aria-hidden="true" /> Libro de Reclamaciones
          </Enlace>
        )}
      </nav>
      <p className={s.legalCopia}>© {anio} Walá. Todos los derechos reservados.</p>
    </div>
  );
}

/**
 * Sugerencia de idioma (una vez, si el navegador no está en español).
 *  - idioma: { codigo ('EN', 'PT'), nombre, titulo, texto, cambiar, mantener }
 *    (código en un sello, no bandera: los emojis de bandera no se ven en
 *    Windows y cada celular los dibuja distinto)
 */
export function AvisoIdioma({ idioma = {}, onCambiar, onMantener }) {
  return (
    <div className={s.idioma} role="dialog" aria-label={idioma.titulo || 'Idioma'}>
      {idioma.codigo && <span className={s.idiomaCodigo} aria-hidden="true">{idioma.codigo}</span>}
      <div className={s.idiomaTexto}>
        <strong>{idioma.titulo}</strong>
        {idioma.texto && <span>{idioma.texto}</span>}
      </div>
      <div className={s.idiomaAcciones}>
        <Boton tamano="sm" onClick={onCambiar}>{idioma.cambiar || idioma.nombre}</Boton>
        <Boton tamano="sm" variante="fantasma" onClick={onMantener}>{idioma.mantener || 'Seguir en español'}</Boton>
      </div>
    </div>
  );
}

/**
 * Ventana de campaña (encuesta, promo…): en escritorio un diálogo, en el
 * celular una hoja inferior. Las reglas de cuándo aparece viven en la tienda.
 *  - formato: 'imagen' (toda la imagen es el botón) | 'tarjeta'
 *  - titulo: en la cabecera de la ventana  · antetitulo: etiqueta colgante
 */
export function VentanaCampana({
  abierta, onCerrar, formato = 'tarjeta', imagen, antetitulo, titulo, texto, accion = 'Ver más', onAccion, contenida = false,
}) {
  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} contenida={contenida} titulo={titulo}>
      {formato === 'imagen' ? (
        <button type="button" className={s.campanaImagen} onClick={onAccion} aria-label={titulo || accion}>
          <img src={imagen} alt="" />
        </button>
      ) : (
        <div className={s.campana}>
          {imagen && <div className={s.campanaFoto}><img src={imagen} alt="" /></div>}
          {antetitulo && <EtiquetaColgante tamano="sm">{antetitulo}</EtiquetaColgante>}
          {texto && <p className={s.campanaTexto}>{texto}</p>}
          <div className={s.campanaAcciones}>
            <Boton bloque tamano="lg" onClick={onAccion}>{accion}</Boton>
            <Boton bloque variante="fantasma" onClick={onCerrar}>Ahora no</Boton>
          </div>
        </div>
      )}
    </HojaInferior>
  );
}

/** Botón de tema: luna en claro, sol en noche; el ícono gira al cambiar. */
export function BotonTema({ tema = 'claro', onCambiar }) {
  const noche = tema === 'noche' || tema === 'dark';
  return (
    <button
      type="button"
      className={s.tema}
      onClick={onCambiar}
      aria-label={noche ? 'Cambiar a modo claro' : 'Cambiar a modo noche'}
      aria-pressed={noche}
    >
      <span key={noche ? 'sol' : 'luna'} className={s.temaIcono}>
        {noche ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </span>
    </button>
  );
}
