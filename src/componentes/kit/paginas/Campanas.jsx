import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ShieldCheck, Check, Download } from 'lucide-react';
import Boton from '../Boton';
import { EstadoVacio } from '../Feedback';
import { GananciaMonedas } from '../Etiquetas';
import { IconoWala } from '../IconosWala';
import { Trazo, LogoWala, Garabatos } from '../Marca';
import { Enlace } from '../Enlace';
import { BloqueSeccion, TituloSeccion } from '../Seccion';
import { BloqueVideo } from '../SeccionesContenido';
import { MarcasMarquesina } from '../Secciones';
import { Ubicacion } from '../SeccionesExtra';
import { EsqueletoPagina } from '../Esqueletos';
import Carrusel from '../Carrusel';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { FormaGanar } from '../piezas/Referidos';
import { Avatar } from '../piezas/Avatar';
import { AntesDespues, TarjetaResena, RedesEnlaces, BotonEnlace } from '../piezas/Campanas';
import { construirFondoStyle, estiloBotonStyle } from '../../../services/linkThemes';
import s from './Campanas.module.css';

/*
 * Páginas de campaña: la suscripción de regalos (/suscripciones), la landing
 * de Regalos con amor (/regalos-con-amor) y una página de enlaces (/l/:slug).
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

/* ── Regalos con amor (/regalos-con-amor) ───────────────── */

/**
 * La landing de Regalos con amor (para gente nueva, sin menú ni pie): el
 * video, por qué regalar algo personalizado, el antes y después, las marcas,
 * el premio de bienvenida, las reseñas con foto, la tienda física y los
 * términos. El botón de descargar la app se queda abajo al pasar su lugar.
 *  - contenido: { video, antesDespues, marcas: [{ name, imageUrl }], resenas:
 *    [TarjetaResena], mapa (embed de Google Maps), horario, fotosTienda, urlApp,
 *    imagenAbrazos, imagenFondo, bono (15) }
 */
export function PaginaRegalosConAmor({ contenido = {} }) {
  const lugar = useRef(null);
  const [flotante, setFlotante] = useState(false);
  useEffect(() => {
    const el = lugar.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setFlotante(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const c = contenido;
  const descargar = (clase) => (
    <Boton to={c.urlApp} tamano="lg" icono={<Download aria-hidden="true" />} className={clase}>Descargar la app</Boton>
  );
  return (
    <div className={s.regalos} data-componente="PaginaRegalosConAmor">
      <section className={s.regalosPortada} style={c.imagenFondo ? { '--fondo': `url("${c.imagenFondo}")` } : undefined}>
        <LogoWala tamano={42} />
        <h1 className={s.regalosTitulo}>
          Convierte tus mejores recuerdos en
          {c.imagenAbrazos ? <img src={c.imagenAbrazos} alt="abrazos" className={s.abrazos} /> : ' abrazos '}
          que duran para siempre
        </h1>
        <p className={s.pastilla}><IconoWala nombre="corazon" tamano={26} /> Ten a tu familia feliz con nuestra app</p>
      </section>

      {c.video && (
        <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '1.5rem' }}>
          <BloqueVideo ajustes={{ url: c.video, aspectRatio: '16:9', controls: true }} />
        </BloqueSeccion>
      )}

      <section className={s.franja}>
        <h2>¿Por qué regalar algo personalizado?</h2>
        <p>Porque hay fechas que merecen más que un <strong>regalo</strong> de último minuto. Un detalle <strong>personalizado</strong> se usa, se abraza y <strong>se guarda para siempre.</strong></p>
      </section>

      {c.antesDespues?.length > 0 && (
        <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '1.5rem' }}>
          <AntesDespues pares={c.antesDespues} />
        </BloqueSeccion>
      )}

      {c.marcas?.length > 0 && (
        <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '1.5rem' }}>
          <MarcasMarquesina ajustes={{ items: c.marcas, speed: 20000 }} />
        </BloqueSeccion>
      )}

      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
        <div className={s.bienvenida}>
          <img src={CARAS_KAPI.feliz} alt="" width="160" height="160" className={s.bienvenidaKapi} />
          <div className={s.bienvenidaTexto}>
            <h2>Toma la decisión de regalar diferente<Trazo className={s.trazo} /></h2>
            <p className={s.bienvenidaPremio}><GananciaMonedas monto={c.bono || 15} /> de bienvenida al completar tus fechas importantes</p>
            <p>Descarga la app de Walá y empieza a crear regalos con verdadero significado.</p>
            <div ref={lugar} className={s.lugarBoton}>{descargar()}</div>
          </div>
        </div>
      </BloqueSeccion>

      <section className={s.franja}>
        <h2>Ya están regalando momentos inolvidables</h2>
      </section>

      {c.resenas?.length > 0 && (
        <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
          <Carrusel visibles={{ escritorio: 3, tablet: 2, movil: 1.15 }} espacio="1rem" flechas autoplay={3500} etiqueta="Reseñas">
            {c.resenas.map((r) => <TarjetaResena key={r.titulo + r.fecha} {...r} />)}
          </Carrusel>
        </BloqueSeccion>
      )}

      {c.mapa && (
        <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
          <Ubicacion ajustes={{ title: '¡Encuéntranos!', description: `Visita nuestra tienda física\n${c.horario || ''}`, embedUrl: c.mapa, mapHeight: '360px' }} />
          {c.fotosTienda?.length > 0 && (
            <div className={s.tienda}>
              <Carrusel visibles={{ escritorio: 3, tablet: 3, movil: 1.2 }} espacio="0.75rem" etiqueta="La tienda">
                {c.fotosTienda.map((f) => <img key={f} src={f} alt="" loading="lazy" className={s.tiendaFoto} />)}
              </Carrusel>
            </div>
          )}
        </BloqueSeccion>
      )}

      <footer className={s.terminos}>
        <h2>Términos, condiciones y privacidad</h2>
        <p>
          La descarga y el uso de la app de Walá están sujetos a nuestros <Enlace to="/terminos-y-condiciones">Términos y Condiciones</Enlace> y
          a la <Enlace to="/politicas-privacidad">Política de Privacidad</Enlace>. La bonificación de {c.bono || 15} monedas es una promoción para
          gente nueva que descarga la app y completa su perfil de fechas importantes, sujeta a disponibilidad y a cambios sin previo aviso.
          Google Play y su logotipo son marcas de Google LLC. Las imágenes son referenciales.
        </p>
        <p>© {new Date().getFullYear()} Walá. Todos los derechos reservados.</p>
      </footer>

      {c.urlApp && <div className={[s.flotante, flotante && s.flotanteVisible].filter(Boolean).join(' ')} aria-hidden={!flotante}>{descargar(s.flotanteBoton)}</div>}
    </div>
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
