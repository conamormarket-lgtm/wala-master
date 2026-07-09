import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import OptimizedImage from '../../../../components/common/OptimizedImage/OptimizedImage';
import { toDirectImageUrl } from '../../../../utils/imageUrl';
import { empresa } from '../../../../config/empresa';
import styles from './ConversionFold.module.css';

const DEFAULT_MOOD = {
  accent: '#e10600',
  glow: 'rgba(225, 6, 0, 0.35)',
  soft: '#1a0a0c',
  deep: '#070708',
  mist: 'rgba(225, 6, 0, 0.22)',
};

const OFFER_DEADLINE_KEY = 'landing_offer_deadline';
// Duración de la oferta evergreen (horas) si el config no la especifica.
const OFFER_HOURS_DEFAULT = 1;

/**
 * Devuelve un deadline SIEMPRE futuro (ms).
 * - Si el `endTime` del config aún no vence, se respeta (oferta programada real).
 * - Si ya venció (o no hay), usa un deadline "evergreen" por visitante guardado
 *   en localStorage; cuando ese vence, se genera uno nuevo. Así el contador
 *   nunca se queda clavado en 00:00:00 para quien ya visitó la página antes.
 */
function resolveDeadline(configEndTime, hours) {
  const now = Date.now();
  const cfg = configEndTime ? new Date(configEndTime).getTime() : 0;
  if (cfg > now) return cfg;
  const windowMs = (Number(hours) > 0 ? Number(hours) : OFFER_HOURS_DEFAULT) * 3600 * 1000;
  try {
    const saved = Number(localStorage.getItem(OFFER_DEADLINE_KEY) || 0);
    if (saved > now) return saved;
    const next = now + windowMs;
    localStorage.setItem(OFFER_DEADLINE_KEY, String(next));
    return next;
  } catch {
    return now + windowMs;
  }
}

const Countdown = ({ endTime, offerHours = OFFER_HOURS_DEFAULT }) => {
  const [deadline, setDeadline] = useState(() => resolveDeadline(endTime, offerHours));
  const [parts, setParts] = useState(null);

  useEffect(() => {
    setDeadline(resolveDeadline(endTime, offerHours));
  }, [endTime, offerHours]);

  useEffect(() => {
    if (!deadline) return undefined;
    const tick = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) {
        // Venció: reiniciamos el ciclo evergreen en vez de quedarnos en 00:00:00.
        try { localStorage.removeItem(OFFER_DEADLINE_KEY); } catch { /* ignore */ }
        setDeadline(resolveDeadline(null, offerHours));
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setParts({
        h: String(h).padStart(2, '0'),
        m: String(m).padStart(2, '0'),
        s: String(s).padStart(2, '0'),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, offerHours]);

  if (!parts) return null;

  return (
    <div className={styles.timerBoxes} aria-label="Cuenta regresiva">
      {[
        { v: parts.h, l: 'Hrs' },
        { v: parts.m, l: 'Min' },
        { v: parts.s, l: 'Seg' },
      ].map((p, i) => (
        <React.Fragment key={p.l}>
          {i > 0 && <span className={styles.timerColon}>:</span>}
          <div className={styles.timerUnit}>
            <span className={styles.timerNum}>{p.v}</span>
            <span className={styles.timerLab}>{p.l}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

const renderLink = (url, className, children) => {
  if (!url) return null;
  const isHash = url.startsWith('#');
  const isInternal = url.startsWith('/') && !url.startsWith('//');
  if (isHash) {
    // Scroll por JS SIN cambiar la URL/historial: si usáramos el hash nativo se
    // agrega una entrada al historial y en móvil dispara popstate, que el
    // exit-intent confunde con "el cliente se va" y abre el popup. El cliente
    // que toca "Lo quiero comprar ya" está comprando, no saliendo.
    const targetId = url.slice(1);
    return (
      <a
        href={url}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          const el = document.getElementById(targetId);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        {children}
      </a>
    );
  }
  if (isInternal) {
    return (
      <Link to={url} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={url} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
};

function resolveMood(variant, fallbackAccent) {
  if (!variant) {
    return {
      ...DEFAULT_MOOD,
      accent: fallbackAccent || DEFAULT_MOOD.accent,
      glow: `${fallbackAccent || DEFAULT_MOOD.accent}55`,
    };
  }
  const accent = variant.accent || fallbackAccent || DEFAULT_MOOD.accent;
  return {
    accent,
    glow: variant.glow || `${accent}55`,
    soft: variant.soft || DEFAULT_MOOD.soft,
    deep: variant.deep || DEFAULT_MOOD.deep,
    mist: variant.mist || `${accent}38`,
  };
}

/**
 * Fold Matador + Coverflow de acabados con mood dinámico (flow 2026).
 */
const ConversionFold = ({ config = {} }) => {
  const variants = Array.isArray(config.variants)
    ? config.variants.filter((v) => v && v.imageUrl)
    : [];
  const [activeVariant, setActiveVariant] = useState(0);
  const touchStartX = useRef(null);
  const thumbBtnRefs = useRef([]);
  const thumbScrollReady = useRef(false);

  useEffect(() => {
    setActiveVariant(0);
    thumbScrollReady.current = false;
  }, [config.imageUrl, variants.length]);

  useEffect(() => {
    const btn = thumbBtnRefs.current[activeVariant];
    const rail = btn?.parentElement; // .coverThumbs (contenedor con overflow-x)
    if (!btn || !rail) return undefined;
    const behavior = thumbScrollReady.current ? 'smooth' : 'auto';
    thumbScrollReady.current = true;
    const id = requestAnimationFrame(() => {
      // Centrar la miniatura SOLO dentro de su propia fila (scrollTo del riel),
      // nunca con scrollIntoView: este último desplaza también a los ancestros/
      // página y corría toda la sección de abajo (timer/comentarios) a la izquierda.
      const target = btn.offsetLeft - (rail.clientWidth - btn.clientWidth) / 2;
      const max = rail.scrollWidth - rail.clientWidth;
      const left = Math.max(0, Math.min(target, max));
      rail.scrollTo({ left, behavior });
    });
    return () => cancelAnimationFrame(id);
  }, [activeVariant]);

  const current = variants[activeVariant] || null;
  const baseAccent = config.accentColor || '#e10600';
  const mood = resolveMood(current, baseAccent);

  useEffect(() => {
    if (!current) return;
    const payload = {
      id: current.id || '',
      label: current.label || '',
      imageUrl: current.imageUrl || '',
    };
    try {
      localStorage.setItem('landing_matador_acabado', JSON.stringify(payload));
    } catch { /* ignore */ }
    // Avisar al checkout (LandingPaymentBlock) para que muestre el reloj elegido
    // en "TU PEDIDO" en tiempo real, sin depender de recargar.
    try {
      window.dispatchEvent(new CustomEvent('landing-acabado-change', { detail: payload }));
    } catch { /* ignore */ }
  }, [current]);

  // Tonalidad de TODA la landing (wrapper) según el reloj activo
  useEffect(() => {
    const wrap = document.querySelector('.landing-page-wrapper');
    if (!wrap) return undefined;
    wrap.style.setProperty('--lp-mood-accent', mood.accent);
    wrap.style.setProperty('--lp-mood-glow', mood.glow);
    wrap.style.setProperty('--lp-mood-soft', mood.soft);
    wrap.style.setProperty('--lp-mood-deep', mood.deep);
    wrap.style.setProperty('--lp-mood-mist', mood.mist);
    wrap.dataset.mood = current?.id || current?.label || 'default';
    return () => {
      wrap.style.removeProperty('--lp-mood-accent');
      wrap.style.removeProperty('--lp-mood-glow');
      wrap.style.removeProperty('--lp-mood-soft');
      wrap.style.removeProperty('--lp-mood-deep');
      wrap.style.removeProperty('--lp-mood-mist');
      delete wrap.dataset.mood;
    };
  }, [mood.accent, mood.glow, mood.soft, mood.deep, mood.mist, current]);

  const montoPEN = Number(config.montoPEN) || 0;
  const precioOriginal = Number(config.precioOriginal) || 0;
  const ahorro = precioOriginal > montoPEN ? precioOriginal - montoPEN : 0;
  const pctOff = precioOriginal > montoPEN
    ? Math.round(((precioOriginal - montoPEN) / precioOriginal) * 100)
    : 0;
  const discountLabel = config.discountLabel || (pctOff > 0 ? `${pctOff}% OFF` : '');
  const rating = Number(config.rating) || 4.9;
  const reviewCount = config.reviewCount || '';
  const brand = (config.brandName || 'CHERO').trim();
  const brandMark = (config.brandMark || brand.charAt(0) || 'K').trim().charAt(0).toUpperCase();
  const badge = config.badge !== undefined && config.badge !== ''
    ? config.badge
    : 'ACTIVADO 2026';
  const features = Array.isArray(config.features) ? config.features.filter(Boolean) : [];
  const paymentLogos = Array.isArray(config.paymentLogos) ? config.paymentLogos.filter(Boolean) : [];
  const customerComments = Array.isArray(config.customerComments)
    ? config.customerComments.filter((c) => c && (c.name || c.text))
    : [];
  const COMMENTS_PER_SLIDE = 3;
  const commentSlides = useMemo(() => {
    if (!customerComments.length) return [];
    const slides = [];
    for (let i = 0; i < customerComments.length; i += COMMENTS_PER_SLIDE) {
      slides.push(customerComments.slice(i, i + COMMENTS_PER_SLIDE));
    }
    return slides;
  }, [customerComments]);
  const [commentSlide, setCommentSlide] = useState(0);

  useEffect(() => {
    if (commentSlides.length <= 1) return undefined;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      setCommentSlide((prev) => (prev + 1) % commentSlides.length);
    }, 5500);
    return () => clearInterval(id);
  }, [commentSlides.length]);

  const activeCommentSlide = commentSlides.length
    ? commentSlide % commentSlides.length
    : 0;
  const hasCopyTop = Boolean(badge || config.title || config.subtitle || features.length > 0);
  const shipBar = config.shipBarText || '';
  const waNum = (config.whatsappNumber || empresa.whatsapp || '').replace(/\D/g, '');
  const waMsg = encodeURIComponent(config.whatsappMessage || 'Hola, me interesa el Reloj Matador Pro 2026');
  // Cuando `coverflow` está activo, en vez de duplicar contenido mostramos solo las tarjetas.
  const useCoverflow = config.coverflow !== false && variants.length > 0;
  const showHeroImage = !useCoverflow && config.showHeroImage !== false;

  const heroSrc = toDirectImageUrl(
    (current && current.imageUrl) || config.imageUrl || '',
  );

  const go = (dir) => {
    if (!variants.length) return;
    setActiveVariant((prev) => (prev + dir + variants.length) % variants.length);
  };

  // Al ELEGIR un reloj (clic en tarjeta o miniatura), centrarlo y bajar al
  // formulario de compra. Las flechas ‹ › solo navegan (no bajan) para poder ojear.
  const pickTimer = useRef(null);
  const pickWatch = (i) => {
    setActiveVariant(i);
    const anchorId = config.ctaPrimaryLink?.replace('#', '') || 'pagar-ahora';
    if (pickTimer.current) clearTimeout(pickTimer.current);
    // pequeño delay para que el coverflow centre el reloj antes de desplazar
    pickTimer.current = setTimeout(() => {
      const el = document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 320);
  };
  useEffect(() => () => { if (pickTimer.current) clearTimeout(pickTimer.current); }, []);

  const onTouchStart = (e) => {
    touchStartX.current = e.changedTouches?.[0]?.clientX ?? null;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const x = e.changedTouches?.[0]?.clientX ?? touchStartX.current;
    const delta = x - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    go(delta < 0 ? 1 : -1);
  };

  const rootStyle = {
    '--fold-accent': mood.accent,
    '--fold-accent-glow': mood.glow,
    '--fold-base': mood.deep,
    '--fold-soft': mood.soft,
    '--fold-mist': mood.mist,
  };

  const starFill = Math.min(5, Math.max(0, Math.round(rating)));

  return (
    <div className={styles.root} style={rootStyle}>
      {shipBar && (
        <div className={styles.shipBar}>
          <span className={styles.shipIcon} aria-hidden="true">🛡</span>
          {shipBar}
        </div>
      )}

      <div className={styles.brandBar}>
        <span className={styles.brandMark} aria-hidden="true">{brandMark}</span>
        <span className={styles.brandName}>{brand}</span>
      </div>

      <div className={styles.inner}>
        {hasCopyTop && (
        <div className={styles.copyTop}>
          {badge && <span className={styles.badge}>{badge}</span>}
          {config.title && <h1 className={styles.title}>{config.title}</h1>}
          {config.subtitle && <p className={styles.subtitle}>{config.subtitle}</p>}

          {features.length > 0 && (
            <ul className={styles.featureList}>
              {features.map((f) => (
                <li key={typeof f === 'string' ? f : f.text} className={styles.featureItem}>
                  <span className={styles.featureIcon} aria-hidden="true">
                    {(typeof f === 'object' && f.icon) || '◆'}
                  </span>
                  <span>{typeof f === 'string' ? f : f.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        )}

        {useCoverflow && (
          <div
            className={styles.coverflow}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <button
              type="button"
              className={`${styles.coverNav} ${styles.coverNavPrev}`}
              onClick={() => go(-1)}
              aria-label="Anterior"
            >
              ‹
            </button>

            <div className={styles.coverStage} role="listbox" aria-label="Acabados disponibles">
              {variants.map((v, i) => {
                const offset = i - activeVariant;
                const abs = Math.abs(offset);
                const isFar = abs > 3;
                const tag = v.tagline || v.vibe || 'activado 2026';
                const src = toDirectImageUrl(v.imageUrl);
                return (
                  <button
                    key={`${v.imageUrl}-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === activeVariant}
                    aria-hidden={isFar}
                    tabIndex={isFar ? -1 : 0}
                    className={`${styles.coverCard} ${i === activeVariant ? styles.coverActive : ''} ${isFar ? styles.coverCardFar : ''}`}
                    style={{
                      '--o': offset,
                      '--abs': abs,
                      zIndex: 20 - abs,
                    }}
                    onClick={() => pickWatch(i)}
                  >
                    <div className={styles.coverMedia}>
                      <img src={src} alt={v.label || `Acabado ${i + 1}`} />
                      <span className={styles.coverTag}>{tag}</span>
                    </div>
                    <div className={styles.coverMeta}>
                      <strong>{v.label || `Look ${i + 1}`}</strong>
                      {v.blurb && <p>{v.blurb}</p>}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className={`${styles.coverNav} ${styles.coverNavNext}`}
              onClick={() => go(1)}
              aria-label="Siguiente"
            >
              ›
            </button>

            <div className={styles.coverThumbs} aria-label="Los 14 acabados">
              {variants.map((v, i) => {
                const src = toDirectImageUrl(v.imageUrl);
                return (
                  <button
                    key={`thumb-${i}`}
                    ref={(el) => { thumbBtnRefs.current[i] = el; }}
                    type="button"
                    className={`${styles.coverThumb} ${i === activeVariant ? styles.coverThumbOn : ''}`}
                    aria-label={v.label || `Acabado ${i + 1}`}
                    aria-current={i === activeVariant}
                    onClick={() => pickWatch(i)}
                  >
                    <img src={src} alt="" loading="lazy" />
                    <span className={styles.coverThumbNum}>{i + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showHeroImage && heroSrc && (
          <div className={styles.heroStage}>
            <div className={styles.heroGlow} aria-hidden="true" />
            <OptimizedImage
              src={heroSrc}
              alt={config.imageAlt || config.title || brand}
              className={styles.heroImage}
              loading="eager"
              fetchPriority="high"
              showSkeleton={false}
            />
          </div>
        )}

        <div className={styles.body}>
          <div className={styles.proofRow}>
            {config.socialProofBadge && (
              <span className={styles.socialBadge}>{config.socialProofBadge}</span>
            )}
            <div className={styles.ratingBlock}>
              <span className={styles.stars} aria-hidden="true">
                {'★'.repeat(starFill)}{'☆'.repeat(5 - starFill)}
              </span>
              <span className={styles.ratingNum}>{Number(rating).toFixed(1)}</span>
              {reviewCount && <span className={styles.reviewCount}>{reviewCount} reseñas</span>}
            </div>
          </div>

          {config.endTime && (
            <div className={styles.offerBox}>
              <span className={styles.offerLabel}>
                {config.countdownLabel || 'OFERTA POR TIEMPO LIMITADO'}
              </span>
              <Countdown
                endTime={config.endTime}
                offerHours={Number(config.offerHours) > 0 ? Number(config.offerHours) : OFFER_HOURS_DEFAULT}
              />
            </div>
          )}

          {montoPEN > 0 && (
            <div className={styles.priceBlock}>
              <div className={styles.priceRow}>
                <span className={styles.priceMain}>S/ {montoPEN.toFixed(2)}</span>
                {precioOriginal > montoPEN && (
                  <span className={styles.priceCompare}>S/ {precioOriginal.toFixed(2)}</span>
                )}
              </div>
              {(discountLabel || ahorro > 0) && (
                <span className={styles.discountBadge}>
                  {discountLabel}
                  {ahorro > 0 ? ` · AHORRAS S/ ${ahorro.toFixed(2)}` : ''}
                </span>
              )}
            </div>
          )}

          <div className={styles.miniTrust}>
            {(config.miniTrust || ['Pago seguro', 'Garantía 12 meses', 'Devolución fácil']).map((t) => (
              <span key={t} className={styles.miniTrustItem}>{t}</span>
            ))}
          </div>

          {commentSlides.length > 0 && (
            <section className={styles.commentsSection} aria-label="Comentarios de clientes">
              <h3 className={styles.commentsTitle}>Lo que dicen nuestros clientes</h3>
              <div
                className={styles.commentsCarousel}
                aria-live="polite"
                aria-atomic="true"
              >
                {commentSlides.map((slide, slideIdx) => (
                  <div
                    key={`comments-slide-${slideIdx}`}
                    className={`${styles.commentsList} ${
                      slideIdx === activeCommentSlide
                        ? styles.commentsListActive
                        : styles.commentsListHidden
                    }`}
                    aria-hidden={slideIdx !== activeCommentSlide}
                  >
                    {slide.map((comment, idx) => {
                      const name = (comment.name || `Cliente ${idx + 1}`).trim();
                      const city = (comment.city || '').trim();
                      const product = (comment.product || '').trim();
                      const avatar = (comment.avatar || comment.photo || '').trim();
                      const commentKey = `${name}-${city || idx}`;
                      const initials = name
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase())
                        .join('') || 'C';
                      const stars = Math.max(1, Math.min(5, Number(comment.stars) || 5));
                      return (
                        <article key={commentKey} className={styles.commentCard}>
                          <div className={styles.commentHead}>
                            {avatar ? (
                              <img
                                src={avatar}
                                alt=""
                                className={styles.commentAvatarImg}
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className={styles.commentAvatar} aria-hidden="true">{initials}</div>
                            )}
                            <div className={styles.commentMeta}>
                              <p className={styles.commentName}>
                                {name}
                                {city ? <span className={styles.commentCity}> · {city}</span> : null}
                              </p>
                              {product ? (
                                <p className={styles.commentPurchased}>Modelo: {product}</p>
                              ) : null}
                            </div>
                          </div>
                          <p className={styles.commentStars} aria-label={`${stars} estrellas`}>
                            {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
                          </p>
                          <p className={styles.commentText}>{comment.text}</p>
                        </article>
                      );
                    })}
                  </div>
                ))}
              </div>
              {commentSlides.length > 1 && (
                <div className={styles.commentsDots} role="tablist" aria-label="Grupos de comentarios">
                  {commentSlides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={i === activeCommentSlide}
                      aria-label={`Comentarios ${i + 1} de ${commentSlides.length}`}
                      className={`${styles.commentsDot} ${i === activeCommentSlide ? styles.commentsDotActive : ''}`}
                      onClick={() => setCommentSlide(i)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {config.ctaPrimaryText && renderLink(
            config.ctaPrimaryLink || '#pagar-ahora',
            styles.ctaPrimary,
            <>
              <span className={styles.ctaBag} aria-hidden="true">🛍</span>
              <span className={styles.ctaPrimaryText}>{config.ctaPrimaryText}</span>
              {config.ctaPrimarySub && (
                <span className={styles.ctaPrimarySub}>{config.ctaPrimarySub}</span>
              )}
            </>,
          )}

          {config.secureText !== false && (
            <p className={styles.secureLine}>
              ✓ {config.secureText || 'COMPRA 100% SEGURA'}
            </p>
          )}

          {paymentLogos.length > 0 && (
            <div className={styles.payLogos}>
              {paymentLogos.map((p) => (
                <span key={p} className={styles.payLogo}>{p}</span>
              ))}
            </div>
          )}

          {config.trustText && (
            <p className={styles.trustLine}>{config.trustText}</p>
          )}
        </div>
      </div>

      {config.showWhatsApp !== false && waNum && typeof document !== 'undefined' && createPortal(
        <a
          href={`https://wa.me/${waNum}?text=${waMsg}`}
          className={styles.waFloat}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
        </a>,
        document.body,
      )}
    </div>
  );
};

export default ConversionFold;
