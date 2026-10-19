import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getLinkPageBySlug, registrarClic, registrarVisita } from '../../services/enlaces';
import { ensureAnalyticsSession, getClientType, getAnonymousId, getStoredSessionId } from '../../services/analytics/tracker';
import { getCachedCountry } from '../../services/geo';
import { parseUserAgent } from '../../services/analytics/ua';
import { PaginaEnlaces } from '../../componentes/kit/paginas/Enlaces';

/*
 * El Link en bio (/l/:slug) con el kit (paso 6, CAMPANAS.md): PaginaEnlaces
 * con la página de link_pages. La misma lógica que LinkInBioPage:
 *  - una sola lectura por slug (getLinkPageBySlug); sin página o en borrador,
 *    "no disponible"
 *  - la visita (registrarVisitaEnlace) después de asegurar la sesión de
 *    analítica; cada clic (registrarClicEnlace) con el país, el aparato y la
 *    sesión, sin esperar: el enlace se abre igual
 *  - las internas (/…) navegan sin recargar y las externas abren otra pestaña
 *    (lo hace Enlace del kit)
 * Diferente: va sola, sin la cabecera, el pie ni los flotantes de la tienda
 * (App.jsx); la visita se cuenta una vez por entrada (antes, otra vez al
 * llegar la sesión); los clics de las redes también se cuentan (la función
 * ya los acepta); un link sin "https://" (instagram.com/…) abre afuera
 * (antes se tomaba por una página de la tienda); "Compartir"; los textos se
 * traducen.
 * Lo de antes: pages/LinkInBioViejo.jsx (interruptor campanasViejo).
 */

// "instagram.com/walá" → "https://instagram.com/walá". Las de la tienda (/…),
// mailto:, tel: y las que ya traen protocolo quedan igual.
const conProtocolo = (url) => {
  const u = String(url || '').trim();
  if (!u || u.startsWith('/') || u.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  return `https://${u.replace(/^\/+/, '')}`;
};

// El diseño guardado sin los colores de texto toma los de antes (el texto de
// los botones y, si no, gris oscuro): la página de antes caía en esos.
const disenoConColores = (d = {}) => ({
  ...d,
  titleColor: d.titleColor || d.buttonTextColor || '#111827',
  textColor: d.textColor || d.buttonTextColor || '#374151',
});

const contexto = (uid) => {
  let countryCode = null;
  try { countryCode = getCachedCountry()?.code || null; } catch { countryCode = null; }
  let device = null;
  try { device = parseUserAgent(navigator.userAgent).device || null; } catch { device = null; }
  const seguro = (fn) => { try { return fn(); } catch { return null; } };
  return {
    anonymousId: seguro(getAnonymousId),
    sessionId: seguro(getStoredSessionId),
    uid: uid || null,
    clientType: getClientType(),
    countryCode,
    device,
  };
};

export default function EnlacesDeTienda() {
  const { slug = '' } = useParams();
  const { user, loading } = useAuth();
  const [pagina, setPagina] = useState(null);
  const [estado, setEstado] = useState('cargando');
  const contada = useRef(null);

  useEffect(() => {
    let vivo = true;
    setEstado('cargando');
    getLinkPageBySlug(slug).then(({ data, error }) => {
      if (!vivo) return;
      if (error || !data || data.estado === 'borrador') { setPagina(null); setEstado('noDisponible'); return; }
      setPagina(data);
      setEstado(undefined);
    });
    return () => { vivo = false; };
  }, [slug]);

  // La visita, una vez por página y entrada, cuando ya se sabe quién entra.
  useEffect(() => {
    if (!pagina || loading || contada.current === pagina.id) return;
    contada.current = pagina.id;
    (async () => {
      try {
        await ensureAnalyticsSession(
          { uid: user?.uid || null, email: user?.email || null, displayName: user?.displayName || null },
          window.location.pathname,
        );
      } catch { /* la sesión nunca rompe la página */ }
      registrarVisita(pagina.id, slug, contexto(user?.uid));
    })();
  }, [pagina, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const onClic = (item) => {
    if (!pagina?.id || !item?.id) return;
    registrarClic(pagina.id, item.id, { url: item.url || '', ...contexto(user?.uid) });
  };

  const datos = pagina ? {
    titulo: pagina.titulo,
    descripcion: pagina.descripcion,
    avatar: pagina.avatarUrl || undefined,
    redes: (pagina.redes || []).map((r) => ({ id: r.id, tipo: r.tipo, nombre: r.nombre, url: conProtocolo(r.url), icono: r.iconUrl || undefined })),
    botones: (pagina.botones || []).map((b) => ({ id: b.id, titulo: b.titulo, url: conProtocolo(b.url), imagen: b.thumbnailUrl || undefined })),
    diseno: disenoConColores(pagina.diseno),
  } : undefined;

  return <PaginaEnlaces pagina={datos} onClic={onClic} estado={estado} />;
}
