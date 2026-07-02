// ── Página pública LINK-IN-BIO (/l/:slug) ───────────────────────────────────
// Página tipo Linktree, MÓVIL-FIRST: renderiza los botones/redes que el dueño
// configuró desde el admin, aplicando TODO el diseño (fondo, avatar, título,
// descripción, estilo/redondez/sombra/colores de botón, fuente).
//
// LECTURAS: 1 sola query — getLinkPageBySlug(slug). Los botones/redes ya vienen
// ordenados por 'order' desde el servicio.
//
// ANALÍTICA (fire-and-forget, JAMÁS bloquea la apertura del enlace):
//  - Al montar: se asegura la sesión de analítica (para capturar país/dispositivo)
//    y luego registrarVisita(pageId, slug, ctx) → la CF incrementa 'visitas' y
//    escribe el ÚNICO evento link_page_view.
//  - Al clickear: registrarClic(pageId, botonId, ctx) → la CF incrementa el
//    contador del botón y escribe el ÚNICO evento link_click. La apertura del
//    enlace ocurre igual aunque el tracking falle o tarde.
//
// Las CFs son el único escritor de eventos (así NO hay doble conteo); el cliente
// solo aporta el contexto de sesión (sessionId/país/device/clientType).
//
// REGLAS DURAS: nada de localStorage para el estado; contadores en la nube (los
// mueven las CFs registrarVisitaEnlace / registrarClicEnlace). Comentarios en español.
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLinkPageBySlug, registrarClic, registrarVisita } from '../services/enlaces';
import {
  ensureAnalyticsSession,
  getClientType,
  getAnonymousId,
  getStoredSessionId,
} from '../services/analytics/tracker';
import { getCachedCountry } from '../services/geo';
import { parseUserAgent } from '../services/analytics/ua';
import { construirFondoStyle, sombraBotonCss, hexToRgba } from '../services/linkThemes';
import { useAuth } from '../contexts/AuthContext';
import { PLACEHOLDER_IMG } from '../constants/placeholder';
import styles from './LinkInBioPage.module.css';

// Íconos de texto por tipo de red (fallback si la red no trae iconUrl propio).
// Sin librerías nuevas: usamos emojis/letras, ligeros y universales.
const ICONO_RED = {
  instagram: '📷',
  facebook: 'f',
  tiktok: '♪',
  whatsapp: '🟢',
  custom: '🔗',
};

// ¿La URL es interna del portal (empieza con "/")? Entonces se navega con
// react-router; si es externa, se abre en pestaña nueva con rel de seguridad.
const esInterna = (url) => typeof url === 'string' && url.startsWith('/');

// El fondo (color/degradado/patrón/imagen) y la sombra se calculan en el módulo
// COMPARTIDO src/services/linkThemes.js (construirFondoStyle / sombraBotonCss),
// así la vista previa del editor y esta página pública se ven IDÉNTICAS.

// Mapa de estilo de botón -> clase CSS.
const CLASE_ESTILO = {
  solid: styles.styleSolid,
  glass: styles.styleGlass,
  outline: styles.styleOutline,
};

const LinkInBioPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  // 'ok' | 'notfound' -> controla si mostramos la página o el estado vacío.
  const [status, setStatus] = useState('ok');

  // ── Carga: 1 sola lectura por slug ──────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    setLoading(true);
    setStatus('ok');
    (async () => {
      const { data, error } = await getLinkPageBySlug(slug);
      if (!vivo) return;
      // Página inexistente o en borrador -> "no disponible".
      if (error || !data || data.estado === 'borrador') {
        setPage(null);
        setStatus('notfound');
        setLoading(false);
        return;
      }
      setPage(data);
      setLoading(false);
      // Visita fire-and-forget: nunca bloquea el render. Primero aseguramos la
      // sesión de analítica (crea la sesión con país/dispositivo) y luego la CF
      // registrarVisitaEnlace incrementa 'visitas' y escribe el único evento de
      // vista. País/device viajan en el contexto (y se completan por la sesión).
      (async () => {
        try {
          await ensureAnalyticsSession(
            { uid: user?.uid || null, email: user?.email || null, displayName: user?.displayName || null },
            (typeof window !== 'undefined' && window.location.pathname) || `/l/${slug || ''}`
          );
        } catch { /* la sesión jamás debe romper la página */ }
        try { registrarVisita(data.id, slug, buildCtx()); } catch { /* no-op */ }
      })();
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user?.uid, user?.email, user?.displayName]);

  // ── Contexto de sesión para las CFs (país/device/clientType) ────────────
  // Se lee FRESCO en cada llamada: la sesión (y el país cacheado) pueden crearse
  // DESPUÉS del montaje, así que memoizar daría un sessionId/país obsoleto. La CF
  // también recibe sessionId/anonymousId/uid para unir el evento con la sesión.
  const buildCtx = useCallback(() => {
    let countryCode = null;
    try { countryCode = getCachedCountry()?.code || null; } catch { countryCode = null; }
    let device = null;
    try {
      if (typeof navigator !== 'undefined' && navigator.userAgent) {
        device = parseUserAgent(navigator.userAgent).device || null;
      }
    } catch { device = null; }
    return {
      anonymousId: (() => { try { return getAnonymousId(); } catch { return null; } })(),
      sessionId: (() => { try { return getStoredSessionId(); } catch { return null; } })(),
      uid: user?.uid || null,
      clientType: getClientType(),
      countryCode,
      device,
    };
  }, [user?.uid]);

  // ── Handler de clic en botón/red ─────────────────────────────────────────
  // 1) Dispara analítica + contador en paralelo (FIRE-AND-FORGET).
  // 2) Abre el enlace SIEMPRE, sin esperar al tracking.
  const handleClic = (e, item) => {
    const url = (item?.url || '').trim();
    const interna = esInterna(url);

    // Analítica: registrarClic (contador nube + ÚNICO evento link_click en la CF).
    // Fire-and-forget, envuelto para no lanzar nunca ni bloquear la apertura.
    try {
      registrarClic(page.id, item.id, { url, ...buildCtx() });
    } catch { /* no-op: nunca bloquea la apertura */ }

    // Sin URL: no navegamos a ningún lado (evitamos el salto a "#" del href).
    if (!url) {
      e.preventDefault();
      return;
    }

    // Enlaces internos -> navegación SPA (evitamos recarga). Prevenimos el
    // comportamiento por defecto solo en este caso para no perder el clic.
    if (interna) {
      e.preventDefault();
      navigate(url);
    }
    // Enlaces externos: dejamos que el <a target="_blank" rel="noopener
    // noreferrer"> abra la pestaña por su cuenta (no llamamos preventDefault).
  };

  // Fallback de imágenes rotas -> placeholder (evita bucle comparando la URL
  // absoluta ya resuelta por el navegador).
  const onImgError = (e) => {
    if (!e.currentTarget.src.endsWith(PLACEHOLDER_IMG)) {
      e.currentTarget.src = PLACEHOLDER_IMG;
    }
  };

  // ── Estado de carga ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.stateWrap}>
        <div className={styles.spinner} aria-label="Cargando" />
      </div>
    );
  }

  // ── Estado: página inexistente o en borrador ─────────────────────────────
  if (status === 'notfound' || !page) {
    return (
      <div className={styles.stateWrap}>
        <h1 className={styles.stateTitle}>Página no disponible</h1>
        <p className={styles.stateText}>
          El enlace que seguiste no existe o aún no está publicado.
        </p>
        <a className={styles.stateHomeLink} href="/">Ir al inicio</a>
      </div>
    );
  }

  // ── Diseño configurado -> variables CSS inline ───────────────────────────
  const diseno = page.diseno || {};
  const estilo = diseno.buttonStyle || 'solid';
  // Fondo (color/degradado/patrón/imagen) como objeto de estilo (módulo compartido).
  const fondoStyle = construirFondoStyle(diseno.background);
  // Para "glass" derivamos un fondo translúcido a partir del color del botón.
  const glassBg = hexToRgba(diseno.buttonColor || '#111827', 0.22);
  // Colores de texto: título y texto normal son INDEPENDIENTES (con fallback al
  // color del texto del botón para páginas antiguas, ya resuelto en el servicio).
  const tituloColor = diseno.titleColor || diseno.buttonTextColor || '#111827';
  const textoColor = diseno.textColor || diseno.buttonTextColor || '#374151';
  // Alineación del contenido (título/descr./redes/footer). "justify" solo afecta
  // al texto; para colocar los elementos se traduce a align-items (cross).
  const alineacion = ['left', 'center', 'right', 'justify'].includes(diseno.textAlign) ? diseno.textAlign : 'center';
  const crossAlign = alineacion === 'left' ? 'flex-start' : alineacion === 'right' ? 'flex-end' : 'center';

  const styleVars = {
    '--lb-font': diseno.fontFamily || 'inherit',
    '--lb-radius': `${typeof diseno.cornerRoundness === 'number' ? diseno.cornerRoundness : 12}px`,
    '--lb-shadow': sombraBotonCss(diseno.buttonShadow),
    '--lb-btn-bg': diseno.buttonColor || '#111827',
    '--lb-btn-text': diseno.buttonTextColor || '#ffffff',
    '--lb-btn-color': diseno.buttonColor || '#111827',
    '--lb-btn-glass': glassBg,
    // Colores de texto de cabecera/redes/footer.
    '--lb-title': tituloColor,
    '--lb-text': textoColor,
    '--lb-text-align': alineacion,
    '--lb-cross': crossAlign,
  };

  const botones = Array.isArray(page.botones) ? page.botones : [];
  const redes = Array.isArray(page.redes) ? page.redes : [];

  return (
    <div className={styles.page} style={{ ...styleVars, ...fondoStyle }}>
      <div className={styles.column}>
        {/* Cabecera: avatar + título + descripción */}
        <header className={styles.header}>
          {page.avatarUrl ? (
            <img
              className={styles.avatar}
              src={page.avatarUrl}
              alt={page.titulo || 'Avatar'}
              onError={onImgError}
              loading="lazy"
            />
          ) : null}
          {page.titulo ? <h1 className={styles.title}>{page.titulo}</h1> : null}
          {page.descripcion ? (
            <p className={styles.description}>{page.descripcion}</p>
          ) : null}
        </header>

        {/* Fila de redes sociales (íconos pequeños) */}
        {redes.length > 0 && (
          <nav className={styles.socialRow} aria-label="Redes sociales">
            {redes.map((red) => {
              const url = (red.url || '').trim();
              const interna = esInterna(url);
              const etiqueta = red.nombre || red.tipo || 'Red social';
              return (
                <a
                  key={red.id}
                  className={styles.socialItem}
                  href={url || '#'}
                  onClick={(e) => handleClic(e, red)}
                  target={interna ? undefined : '_blank'}
                  rel={interna ? undefined : 'noopener noreferrer'}
                  title={etiqueta}
                  aria-label={etiqueta}
                >
                  {red.iconUrl ? (
                    <img
                      className={styles.socialIconImg}
                      src={red.iconUrl}
                      alt=""
                      onError={onImgError}
                      loading="lazy"
                    />
                  ) : (
                    <span aria-hidden="true">{ICONO_RED[red.tipo] || ICONO_RED.custom}</span>
                  )}
                </a>
              );
            })}
          </nav>
        )}

        {/* Botones principales, en el orden guardado */}
        <div className={styles.buttons}>
          {botones.map((boton) => {
            const url = (boton.url || '').trim();
            const interna = esInterna(url);
            const tieneThumb = !!boton.thumbnailUrl;
            return (
              <a
                key={boton.id}
                className={`${styles.linkButton} ${CLASE_ESTILO[estilo] || styles.styleSolid}`}
                href={url || '#'}
                onClick={(e) => handleClic(e, boton)}
                target={interna ? undefined : '_blank'}
                rel={interna ? undefined : 'noopener noreferrer'}
              >
                {tieneThumb ? (
                  <img
                    className={styles.thumb}
                    src={boton.thumbnailUrl}
                    alt=""
                    onError={onImgError}
                    loading="lazy"
                  />
                ) : null}
                <span
                  className={`${styles.buttonLabel} ${tieneThumb ? '' : styles.buttonLabelCentered}`}
                >
                  {boton.titulo || url || 'Enlace'}
                </span>
                {/* Espaciador espejo del thumb para centrar el texto cuando hay miniatura. */}
                {tieneThumb ? <span className={styles.thumbSpacer} aria-hidden="true" /> : null}
              </a>
            );
          })}
        </div>

        {/* Marca discreta del portal */}
        <footer className={styles.footer}>
          <a className={styles.footerLink} href="/">Creado con Wala</a>
        </footer>
      </div>
    </div>
  );
};

export default LinkInBioPage;
