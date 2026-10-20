import React from 'react';
import { MessageCircle, Music2, Mail } from 'lucide-react';
import { Enlace } from '../Enlace';
import { Garabatos, LogoWala, Corazon } from '../Marca';
import { Texto, useTexto } from '../Traduccion';
import { atributosDeFoto } from '../../../components/common/OptimizedImage/OptimizedImage';
import { CARAS_KAPI } from './Flotantes';
import s from './Pie.module.css';

/*
 * El pie de página (M5): una tarjeta noche con el logo, lo que guarda el
 * builder (pages/footer) y la franja legal. Va en su propio archivo: así el
 * pie no le suma a cada página el código de las secciones (el catálogo, los
 * filtros). Las partes se arman por separado: MarcoPie lleva la tarjeta y
 * recibe los bloques (ColumnasPie, TextoPie, ImagenPie), así la tienda puede
 * envolver cada bloque con el editor. Todo pasa por la traducción.
 */

/* Íconos de redes dibujados a trazo (lucide ya no trae marcas). */
const trazo = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const Instagram = (p) => <svg {...trazo} {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></svg>;
const Facebook = (p) => <svg {...trazo} {...p}><path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" /></svg>;
const Youtube = (p) => <svg {...trazo} {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="m10 9.5 4.5 2.5-4.5 2.5z" fill="currentColor" /></svg>;

const REDES = [
  [/instagram\./i, Instagram, 'Instagram'],
  [/facebook\.|fb\.com/i, Facebook, 'Facebook'],
  [/tiktok\./i, Music2, 'TikTok'],
  [/youtube\.|youtu\.be/i, Youtube, 'YouTube'],
  [/wa\.me|whatsapp/i, MessageCircle, 'WhatsApp'],
  [/^mailto:/i, Mail, 'Correo'],
];
const redDe = (url) => REDES.find(([re]) => re.test(url || '')) || [null, null, null];

/**
 * La tarjeta del pie: garabatos, el logo con "Hecho con amor en Perú" (en
 * texto: la etiqueta colgante es solo para productos), los bloques y la
 * franja legal.
 *  - kapi: Kapi asomado por el borde (la tienda lo apaga cuando ya flota el
 *    de la esquina o la página termina con otro Kapi)
 *  - pieLegal: <PieLegal> · children: los bloques
 */
export function MarcoPie({ kapi = true, pieLegal, children, className }) {
  return (
    <footer className={[s.pie, className].filter(Boolean).join(' ')}>
      <Garabatos variante="pie" />
      {kapi && <img className={s.pieKapi} src={CARAS_KAPI.feliz} alt="" width="96" height="96" loading="lazy" decoding="async" />}
      <div className={s.pieMarca}>
        <LogoWala tamano={34} tono="blanco" />
        <span className={s.lema}><Corazon className={s.lemaCorazon} /> <Texto>Hecho con amor en Perú</Texto></span>
      </div>
      <div className={s.bloques}>{children}</div>
      {pieLegal && <div className={s.pieLegal}>{pieLegal}</div>}
    </footer>
  );
}

/** Una red, con su ícono (o su texto si no se reconoce). */
function RedPie({ enlace }) {
  const [, Icono, red] = redDe(enlace.url);
  const etiqueta = useTexto(enlace.text || red || enlace.url);
  return (
    <Enlace to={enlace.url} className={s.red} aria-label={etiqueta} title={etiqueta}>
      {Icono ? <Icono aria-hidden="true" /> : <Texto>{enlace.text || enlace.url}</Texto>}
    </Enlace>
  );
}

/**
 * Columnas (footer_columns): `type` 'text' (content), 'links' (links:
 * [{ text, url, color, bold }]) o 'social' (links con íconos según la red).
 */
export function ColumnasPie({ columnas = [] }) {
  const visibles = columnas.filter((c) => c?.title || c?.content || c?.links?.length);
  if (!visibles.length) return null;
  return (
    <div className={s.pieColumnas}>
      {visibles.map((c, i) => (
        <div key={c.id || i} className={s.pieColumna}>
          {c.title && <h3><Texto>{c.title}</Texto></h3>}
          {c.type === 'text' && c.content && <p><Texto>{c.content}</Texto></p>}
          {c.type === 'links' && (
            <ul>
              {(c.links || []).filter((l) => l?.text).map((l, j) => (
                <li key={j}>
                  <Enlace to={l.url} className={s.pieEnlace} style={{ color: l.color || undefined, fontWeight: l.bold ? 700 : undefined }}><Texto>{l.text}</Texto></Enlace>
                </li>
              ))}
            </ul>
          )}
          {c.type === 'social' && (
            <ul className={s.redes}>
              {(c.links || []).filter((l) => l?.url).map((l, j) => <li key={j}><RedPie enlace={l} /></li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/** Un texto suelto en el pie (el bloque 'text' del builder): heading y content. */
export function TextoPie({ titulo, texto }) {
  if (!titulo && !texto) return null;
  return (
    <div className={s.textoPie}>
      {titulo && <h3><Texto>{titulo}</Texto></h3>}
      {texto && <p><Texto>{texto}</Texto></p>}
    </div>
  );
}

/** Una imagen en el pie (el bloque 'image' del builder): url y alt. */
export function ImagenPie({ url, alt = '' }) {
  if (!url?.trim()) return null;
  return (
    <div className={s.imagenPie}>
      <img {...atributosDeFoto(url, '600px')} alt={alt} loading="lazy" decoding="async" />
    </div>
  );
}

/**
 * El pie como sección (footer_columns), con sus columnas: el de la demo y el
 * del builder. Sin columnas no sale.
 *  - ajustes: { columns } · pieLegal · kapi
 */
export function PiePagina({ ajustes = {}, pieLegal, kapi = true }) {
  const columnas = (ajustes.columns || []).filter((c) => c?.title || c?.content || c?.links?.length);
  if (!columnas.length) return null;
  return (
    <MarcoPie kapi={kapi} pieLegal={pieLegal}>
      <ColumnasPie columnas={columnas} />
    </MarcoPie>
  );
}
