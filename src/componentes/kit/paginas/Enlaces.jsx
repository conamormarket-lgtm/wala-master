import React, { useState } from 'react';
import { Share2, Link2 } from 'lucide-react';
import Boton from '../Boton';
import { EstadoVacio } from '../Feedback';
import { LogoWala } from '../Marca';
import { Enlace } from '../Enlace';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { Avatar } from '../piezas/Avatar';
import { RedesEnlaces, BotonEnlace } from '../piezas/Campanas';
import { Texto, useTexto } from '../Traduccion';
import { construirFondoStyle, estiloBotonStyle } from '../../../services/linkThemes';
import s from './Enlaces.module.css';

/* ── Una página de enlaces (/l/:slug) ───────────────────── */

const ALINEAR = { left: 'start', right: 'end' };

/**
 * Una página de enlaces (estilo Linktree): la foto, el título, las redes y
 * los botones, con el diseño que eligió el admin (fondo, estilo de botón,
 * colores, redondez, letra, alineación). Al pie, "Creado con Walá". Va sola,
 * sin la cabecera ni el pie de la tienda: es la página que se pone en la bio
 * de Instagram o TikTok. Arriba a la derecha, "Compartir" (el menú del
 * teléfono o, si no hay, copia el link).
 *  - pagina: { titulo, descripcion, avatar, redes: [{ id, tipo, nombre, url, icono }],
 *    botones: [{ id, titulo, url, imagen }], diseno } (link_pages)
 *  - onClic(item): cuenta el clic (registrarClicEnlace), de un botón o de una red
 *  - urlCompartir: el link de la página (si no, el de la barra)
 *  - estado: 'cargando' | 'noDisponible'
 * Los textos (también el título, la descripción y los botones) pasan por la
 * traducción.
 */
export function PaginaEnlaces({ pagina = {}, onClic, urlCompartir, estado }) {
  const [copiado, setCopiado] = useState(false);
  const [sinFoto, setSinFoto] = useState(false);
  const t = {
    compartir: useTexto('Compartir esta página'),
    copiado: useTexto('Link copiado'),
  };
  if (estado === 'cargando') return <EsqueletoPagina forma="enlaces" />;
  if (estado === 'noDisponible') {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <EstadoVacio imagen={CARAS_KAPI.triste} titulo={<Texto>Página no disponible</Texto>} texto={<Texto>El enlace que seguiste no existe o aún no está publicado.</Texto>}>
          <Boton to="/"><Texto>Ir al inicio</Texto></Boton>
        </EstadoVacio>
      </BloqueSeccion>
    );
  }
  const d = pagina.diseno || {};
  const estilo = estiloBotonStyle(d);
  const compartir = async () => {
    const url = urlCompartir || (typeof window !== 'undefined' ? window.location.href : '');
    try {
      if (navigator.share) { await navigator.share({ title: pagina.titulo, url }); return; }
      await navigator.clipboard?.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch { /* cerró el menú de compartir: nada */ }
  };
  return (
    <div
      className={s.enlaces}
      style={{
        ...construirFondoStyle(d.background),
        '--enl-titulo': d.titleColor || '#fff',
        '--enl-texto': d.textColor || 'rgba(255,255,255,0.86)',
        '--enl-alinear': ALINEAR[d.textAlign] || 'center',
        fontFamily: d.fontFamily || undefined,
        textAlign: d.textAlign || 'center',
      }}
      data-componente="PaginaEnlaces"
    >
      <button type="button" className={s.enlacesCompartir} onClick={compartir} aria-label={copiado ? t.copiado : t.compartir}>
        {copiado ? <Link2 aria-hidden="true" /> : <Share2 aria-hidden="true" />}
        <span><Texto>{copiado ? 'Copiado' : 'Compartir'}</Texto></span>
      </button>
      <div className={s.enlacesColumna}>
        {pagina.avatar && !sinFoto
          ? <img src={pagina.avatar} alt="" className={s.enlacesAvatar} onError={() => setSinFoto(true)} />
          : <Avatar nombre={pagina.titulo} className={s.enlacesAvatar} />}
        {pagina.titulo && <h1 className={s.enlacesTitulo}><Texto>{pagina.titulo}</Texto></h1>}
        {pagina.descripcion && <p className={s.enlacesTexto}><Texto>{pagina.descripcion}</Texto></p>}
        <RedesEnlaces redes={pagina.redes} onClic={onClic} />
        <div className={s.enlacesBotones}>
          {(pagina.botones || []).map((b) => <BotonEnlace key={b.id} titulo={b.titulo} url={b.url} imagen={b.imagen} estilo={estilo} onClic={() => onClic?.(b)} />)}
          {!(pagina.botones || []).length && <p className={s.enlacesTexto}><Texto>Pronto habrá enlaces aquí.</Texto></p>}
        </div>
        <Enlace to="/" className={s.creado}><Texto>Creado con</Texto> <LogoWala tamano={18} /></Enlace>
      </div>
    </div>
  );
}
