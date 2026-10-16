import React from 'react';
import { ArrowRight, ShieldCheck, Check } from 'lucide-react';
import Boton from '../Boton';
import { EstadoVacio } from '../Feedback';
import { IconoWala } from '../IconosWala';
import { Trazo, LogoWala, Garabatos } from '../Marca';
import { Enlace } from '../Enlace';
import { BloqueSeccion, TituloSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { FormaGanar } from '../piezas/Referidos';
import { Avatar } from '../piezas/Avatar';
import { RedesEnlaces, BotonEnlace } from '../piezas/Campanas';
import { construirFondoStyle, estiloBotonStyle } from '../../../services/linkThemes';
import s from './Campanas.module.css';

/*
 * Páginas de campaña: la suscripción de regalos (/suscripciones) y una
 * página de enlaces (/l/:slug). (Regalos con amor salió del kit el
 * 2026-10-16; sigue en la tienda.)
 * La invitación (/invitar/:código) no tiene página: lleva al registro con
 * <AvisoInvitacion> arriba (piezas/Campanas).
 */

/* ── Suscripciones (/suscripciones) ─────────────────────── */

const PASOS_SUSCRIPCION = [
  ['reloj', '1. Programa tus fechas', 'Cuéntanos cuándo son los cumpleaños, aniversarios y días especiales de tus seres queridos.'],
  ['corazon', '2. Lo preparamos con cariño', 'Diseñamos y preparamos regalos personalizados según la ocasión y la persona.'],
  ['escudo', '3. Pagas en cuotas', 'El valor de tus regalos del año se divide en pequeñas cuotas mensuales.'],
  ['camion', '4. Llega a tiempo', 'Recibes cada Walá Box justo antes de la fecha especial, lista para sorprender.'],
];

/**
 * La suscripción de regalos: cómo funciona y la invitación a dejar las fechas
 * (la encuesta). Todavía sin pagos: los dos botones llevan a la encuesta.
 *  - urlEncuesta · pagosPronto (true: la nota de que el pago mensual llega pronto)
 */
export function PaginaSuscripciones({ urlEncuesta = '/encuesta-suscripcion', pagosPronto = true }) {
  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.75rem', paddingBottom: '1.5rem' }}>
        <div className={s.portada} data-componente="PaginaSuscripciones">
          <div className={s.portadaTexto}>
            <p className={s.antetitulo}>Nuevo en Walá</p>
            <h1 className={s.titulo}>Regalos perfectos, todo el año<Garabatos variante="titulo" className={s.garabatos} /><Trazo className={s.trazo} /></h1>
            <p className={s.bajada}>Olvídate de buscar regalos a última hora. Programa las fechas importantes de tus seres queridos y recibe cajas personalizadas justo a tiempo, pagando en cómodas cuotas mensuales.</p>
            <Boton to={urlEncuesta} tamano="lg" iconoFin={<ArrowRight aria-hidden="true" />}>Configurar mis fechas</Boton>
            {pagosPronto && <p className={s.nota}><ShieldCheck aria-hidden="true" /> Configura tus fechas hoy. El pago mensual llega muy pronto.</p>}
          </div>
          <div className={s.caja} aria-hidden="true">
            <span className={s.cajaTapa} />
            <IconoWala nombre="regalo" tamano={104} girar={-6} />
            <strong>Walá Box</strong>
            <small>Especial para mamá</small>
          </div>
        </div>
      </BloqueSeccion>
      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
        <TituloSeccion titulo="¿Cómo funciona?" subtitulo="Un proceso simple para que siempre quedes bien." alinear="center" subrayado />
        <ul className={s.pasos}>
          {PASOS_SUSCRIPCION.map(([icono, titulo, texto]) => <li key={titulo}><FormaGanar icono={icono} titulo={titulo}>{texto}</FormaGanar></li>)}
        </ul>
      </BloqueSeccion>
      <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '2.5rem' }}>
        <div className={s.llamado}>
          <h2 className={s.llamadoTitulo}>Adelántate a las fechas especiales</h2>
          <p>Estamos terminando los pagos para darte las comisiones más bajas y las mejores cuotas. <strong>Pero no tienes que esperar.</strong></p>
          <ul className={s.lista}>
            {['Planifica todo tu año hoy mismo', 'Acceso anticipado cuando lleguen los pagos', 'Diseños exclusivos para los primeros suscriptores'].map((t) => <li key={t}><Check aria-hidden="true" />{t}</li>)}
          </ul>
          <Boton to={urlEncuesta} tamano="lg" variante="contorno" style={{ '--b-fondo': '#fff', '--b-fondo-hover': '#fff', '--b-texto': '#4c1d95', '--b-borde': 'transparent' }} iconoFin={<ArrowRight aria-hidden="true" />}>Separar mis fechas ahora</Boton>
        </div>
      </BloqueSeccion>
    </>
  );
}

/* ── Una página de enlaces (/l/:slug) ───────────────────── */

/**
 * Una página de enlaces (estilo Linktree): la foto, el título, las redes y
 * los botones, con el diseño que eligió el admin (fondo, estilo de botón,
 * colores, redondez, letra). Al pie, "Creado con Walá".
 *  - pagina: { titulo, descripcion, avatar, redes: [{ id, tipo, nombre, url, icono }],
 *    botones: [{ id, titulo, url, imagen }], diseno } (link_pages)
 *  - onClic(item): cuenta el clic (registrarClicEnlace)
 *  - estado: 'cargando' | 'noDisponible'
 */
export function PaginaEnlaces({ pagina = {}, onClic, estado }) {
  if (estado === 'cargando') return <EsqueletoPagina forma="enlaces" />;
  if (estado === 'noDisponible') {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <EstadoVacio imagen={CARAS_KAPI.triste} titulo="Página no disponible" texto="El enlace que seguiste no existe o aún no está publicado.">
          <Boton to="/">Ir al inicio</Boton>
        </EstadoVacio>
      </BloqueSeccion>
    );
  }
  const d = pagina.diseno || {};
  const estilo = estiloBotonStyle(d);
  return (
    <div
      className={s.enlaces}
      style={{ ...construirFondoStyle(d.background), '--enl-titulo': d.titleColor || '#fff', '--enl-texto': d.textColor || 'rgba(255,255,255,0.86)', fontFamily: d.fontFamily || undefined, textAlign: d.textAlign || 'center' }}
      data-componente="PaginaEnlaces"
    >
      <div className={s.enlacesColumna}>
        {pagina.avatar ? <img src={pagina.avatar} alt="" className={s.enlacesAvatar} /> : <Avatar nombre={pagina.titulo} className={s.enlacesAvatar} />}
        {pagina.titulo && <h1 className={s.enlacesTitulo}>{pagina.titulo}</h1>}
        {pagina.descripcion && <p className={s.enlacesTexto}>{pagina.descripcion}</p>}
        <RedesEnlaces redes={pagina.redes} onClic={onClic} />
        <div className={s.enlacesBotones}>
          {(pagina.botones || []).map((b) => <BotonEnlace key={b.id} titulo={b.titulo} url={b.url} imagen={b.imagen} estilo={estilo} onClic={() => onClic?.(b)} />)}
          {!(pagina.botones || []).length && <p className={s.enlacesTexto}>Pronto habrá enlaces aquí.</p>}
        </div>
        <Enlace to="/" className={s.creado}>Creado con <LogoWala tamano={18} /></Enlace>
      </div>
    </div>
  );
}
