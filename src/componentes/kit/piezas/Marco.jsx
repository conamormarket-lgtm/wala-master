import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BookOpen, Info, Moon, Pencil, Settings, Shield, Sun, X, XCircle } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { HojaInferior } from '../Feedback';
import { useBloquearScroll, useCerrarConAtras } from '../Efectos';
import { EtiquetaColgante } from '../Marca';
import { Texto, useTexto } from '../Traduccion';
import { atributosDeFoto } from '../../../components/common/OptimizedImage/OptimizedImage';
import s from './Marco.module.css';

/*
 * Piezas del marco de la tienda: lo que rodea a las secciones (avisos
 * arriba, barra de admin, pie legal, ventanas). Todo por props; quién lo ve
 * y cuándo lo decide la tienda. Los textos (fijos y de los datos) pasan por
 * la traducción (useTexto); sin proveedor quedan igual.
 */

const ICONOS_AVISO = { info: Info, aviso: AlertTriangle, error: XCircle };

/**
 * Franja de aviso del sistema, arriba de todo (mantenimiento, demoras…).
 *  - tipo: 'info' | 'aviso' | 'error'  · onCerrar: opcional
 */
export function AvisoSistema({ tipo = 'aviso', children, onCerrar }) {
  const Icono = ICONOS_AVISO[tipo] || Info;
  const cerrar = useTexto('Cerrar aviso');
  return (
    <div className={`${s.aviso} ${s[`aviso_${tipo}`] || ''}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <Icono aria-hidden="true" />
      <p><Texto>{children}</Texto></p>
      {onCerrar && (
        <button type="button" className={s.avisoCerrar} onClick={onCerrar} aria-label={cerrar}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * Banner para bajar la app (solo en el navegador del celular).
 *  - url: tienda de apps  · onAccion: en vez de url (la tienda intenta abrir
 *    Play Store en el celular y, si no puede, va a la web)  · onCerrar: la X
 *  - icono: el ícono de la app en el violeta de la cabecera
 *    (public/assets/marca/app-icono.webp: el de public/icons con el fondo
 *    magenta cambiado al degradado del logo). Los íconos de Android, Play
 *    Store y la PWA siguen magenta hasta que se actualicen.
 */
export function BannerApp({ titulo = 'Walá App', texto = 'Para una mejor experiencia', accion = 'Obtener', url, onAccion, onCerrar, icono = '/assets/marca/app-icono.webp' }) {
  const cerrar = useTexto('Cerrar');
  return (
    <div className={s.app}>
      {onCerrar && (
        <button type="button" className={s.appCerrar} onClick={onCerrar} aria-label={cerrar}>
          <X aria-hidden="true" />
        </button>
      )}
      <img className={s.appIcono} src={icono} alt="" width="44" height="44" decoding="async" />
      <span className={s.appTexto}>
        <strong>{titulo}</strong>
        <span><Texto>{texto}</Texto></span>
      </span>
      <Boton to={onAccion ? undefined : url} onClick={onAccion} tamano="sm"><Texto>{accion}</Texto></Boton>
    </div>
  );
}

/**
 * Barra del administrador: avisa que el modo admin está activo y da acceso
 * al panel y al editor visual de la página.
 *  - editando: el editor está abierto (el botón pasa a "Guardar y salir")
 *  - onEditor: abre o cierra el editor visual
 *  - editarEn: en vez del editor, un enlace para editar lo que se ve (la
 *    ficha de un producto → su página en el panel), con `textoEditor`
 *  - panel: ruta del panel (o null)  · extra: nodos a la derecha
 *  - fija: pegada arriba al bajar; publica su alto en --admin-bar-height
 *    (en <html>) para que la cabecera se pegue justo debajo
 */
export function BarraAdmin({ editando = false, onEditor, editarEn, panel = '/admin', textoEditor, extra, fija = false }) {
  const ref = useRef(null);
  const t = {
    region: useTexto('Herramientas de administrador'),
    modo: useTexto('Modo administrador'),
    panel: useTexto('Panel de administración'),
    corto: useTexto('Panel'),
    editor: useTexto(textoEditor || (editarEn ? 'Editar' : editando ? 'Guardar y salir' : 'Editar esta página')),
  };

  // El alto real (cambia con el idioma y el tamaño de letra), no un número fijo.
  useLayoutEffect(() => {
    const el = ref.current;
    const raiz = document.documentElement;
    if (!fija || !el) return undefined;
    const medir = () => raiz.style.setProperty('--admin-bar-height', `${el.offsetHeight}px`);
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      raiz.style.removeProperty('--admin-bar-height');
    };
  }, [fija]);

  return (
    <div ref={ref} className={[s.admin, fija && s.adminFija].filter(Boolean).join(' ')} role="region" aria-label={t.region}>
      <span className={s.adminTexto}>
        <Settings aria-hidden="true" />
        <span>{t.modo}</span>
      </span>
      <div className={s.adminAcciones}>
        {extra}
        {panel && (
          <Enlace to={panel} className={s.adminPanel} aria-label={t.panel}>
            <Shield aria-hidden="true" /><span>{t.corto}</span>
          </Enlace>
        )}
        {editarEn ? (
          <Boton tamano="sm" to={editarEn} icono={<Pencil aria-hidden="true" />}>{t.editor}</Boton>
        ) : onEditor && (
          <Boton tamano="sm" variante={editando ? 'secundario' : 'primario'} onClick={onEditor}>
            {t.editor}
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
  const legal = useTexto('Legal');
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
      <nav className={s.legalEnlaces} aria-label={legal}>
        {enlaces.map((e) => <Enlace key={e.url} to={e.url}><Texto>{e.texto}</Texto></Enlace>)}
        {reclamaciones && (
          <Enlace to={reclamaciones} className={s.libro}>
            <BookOpen aria-hidden="true" /> <Texto>Libro de Reclamaciones</Texto>
          </Enlace>
        )}
      </nav>
      <p className={s.legalCopia}>© {anio} Walá. <Texto>Todos los derechos reservados.</Texto></p>
    </div>
  );
}

/**
 * Sugerencia de idioma (una vez, si el navegador no está en español).
 *  - idioma: { codigo ('EN', 'PT'), nombre, titulo, texto, cambiar, mantener }
 *    (código en un sello, no bandera: los emojis de bandera no se ven en
 *    Windows y cada celular los dibuja distinto). Los textos llegan ya en el
 *    idioma que toca (la tienda los saca de su diccionario): no se traducen.
 *  - flotante: abajo y centrado, sobre la barra inferior (en la tienda); sin
 *    él queda en su sitio (la demo)
 */
export function AvisoIdioma({ idioma = {}, onCambiar, onMantener, flotante = false }) {
  const aviso = (
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
  return flotante ? <div className={s.idiomaFlotante}>{aviso}</div> : aviso;
}

/**
 * Anuncio de solo imagen, como el popup de la tienda: la imagen ya trae su
 * texto y TODA ella es el botón; una X arriba y tocar afuera lo cierra. Igual
 * en escritorio y en el celular (ventana centrada, no hoja).
 */
function AnuncioImagen({ abierta, onCerrar, imagen, titulo, onAccion, contenida }) {
  const ref = useRef(null);
  const cerrar = useTexto('Cerrar');
  const anuncio = useTexto('Anuncio');
  useBloquearScroll(abierta && !contenida);
  useCerrarConAtras(abierta && !contenida, onCerrar);
  useEffect(() => {
    if (!abierta) return undefined;
    ref.current?.focus({ preventScroll: true });
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierta, onCerrar]);

  const ventana = (
    <AnimatePresence>
      {abierta && (
        <motion.div
          className={[s.anuncio, contenida && s.anuncioContenido].filter(Boolean).join(' ')}
          onClick={onCerrar}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            ref={ref}
            className={s.anuncioCaja}
            role="dialog"
            aria-modal="true"
            aria-label={titulo || anuncio}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
          >
            <button type="button" className={s.anuncioCerrar} onClick={onCerrar} aria-label={cerrar}>
              <X aria-hidden="true" />
            </button>
            <button type="button" className={s.anuncioImagen} onClick={onAccion}>
              <img {...atributosDeFoto(imagen, '600px')} alt={titulo || ''} />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  if (contenida || typeof document === 'undefined') return ventana;
  return createPortal(ventana, document.body);
}

/**
 * Ventana de campaña (encuesta, promo…). Las reglas de cuándo aparece viven
 * en la tienda (storeConfig/popups); aquí solo se dibuja.
 *  - formato 'imagen' (el de la tienda): solo la imagen, que es el botón.
 *  - formato 'tarjeta': imagen opcional, antetítulo (etiqueta colgante),
 *    texto y botones; en el celular sube como hoja.
 *  - textoCerrar: el segundo botón de la tarjeta (null: sin segundo botón;
 *    la X y tocar afuera siguen cerrando)
 */
export function VentanaCampana({
  abierta, onCerrar, formato = 'imagen', imagen, antetitulo, titulo, texto, accion = 'Ver más', textoCerrar = 'Ahora no', onAccion, contenida = false,
}) {
  const tituloTraducido = useTexto(titulo);
  if (formato === 'imagen' && imagen) {
    return <AnuncioImagen {...{ abierta, onCerrar, imagen, titulo: tituloTraducido, onAccion, contenida }} />;
  }
  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} contenida={contenida} titulo={tituloTraducido}>
      <div className={s.campana}>
        {imagen && <div className={s.campanaFoto}><img {...atributosDeFoto(imagen, '600px')} alt="" /></div>}
        {antetitulo && <EtiquetaColgante tamano="sm"><Texto>{antetitulo}</Texto></EtiquetaColgante>}
        {texto && <p className={s.campanaTexto}><Texto>{texto}</Texto></p>}
        <div className={s.campanaAcciones}>
          <Boton bloque tamano="lg" onClick={onAccion}><Texto>{accion}</Texto></Boton>
          {textoCerrar && <Boton bloque variante="fantasma" onClick={onCerrar}><Texto>{textoCerrar}</Texto></Boton>}
        </div>
      </div>
    </HojaInferior>
  );
}

/** Botón de tema: luna en claro, sol en noche; el ícono gira al cambiar. */
export function BotonTema({ tema = 'claro', onCambiar }) {
  const noche = tema === 'noche' || tema === 'dark';
  const aClaro = useTexto('Cambiar a modo claro');
  const aNoche = useTexto('Cambiar a modo noche');
  return (
    <button
      type="button"
      className={s.tema}
      onClick={onCambiar}
      aria-label={noche ? aClaro : aNoche}
      aria-pressed={noche}
    >
      <span key={noche ? 'sol' : 'luna'} className={s.temaIcono}>
        {noche ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </span>
    </button>
  );
}
