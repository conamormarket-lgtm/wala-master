import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Testimonials.module.css';
import { TextoSeccion, BotonSeccion } from '../textStyleUtils.jsx';

const StarIcon = () => (
  <svg className={styles.star} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const LEGACY_TOPICS = new Set([
  'calidad de impresión',
  'personalización',
  'atención al cliente',
  'envío',
  'calidad de la prenda',
  'experiencia general'
]);

export const normalizeTestimonial = (item = {}) => {
  const authorWasTopic = !item.topic && LEGACY_TOPICS.has(String(item.author || '').trim().toLocaleLowerCase('es'));
  return {
    ...item,
    author: authorWasTopic ? 'Cliente de Walá' : (item.author || 'Cliente de Walá'),
    topic: authorWasTopic ? item.author : (item.topic || ''),
    verified: item.verified === true
  };
};

const initialsOf = (name) => {
  if (!name || name === 'Cliente de Walá') return 'W';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
};

const Testimonials = ({ config, title, testimonials = [] }) => {
  const trackRef = useRef(null);
  if (!testimonials || testimonials.length === 0) return null;

  const s = config || {};
  const items = testimonials.map(normalizeTestimonial);
  const tituloEfectivo = s.title != null && s.title !== '' ? s.title : title;
  const bg = s.backgroundColor || undefined;
  const scroll = (direction) => {
    trackRef.current?.scrollBy({ left: direction * 340, behavior: 'smooth' });
  };

  return (
    <div className={styles.container} style={bg ? { backgroundColor: bg } : undefined}>
      <div className={styles.headingRow}>
        <div>
          <TextoSeccion settings={s} prefix="title" as="h2" className={styles.title}>
            {tituloEfectivo}
          </TextoSeccion>
          {s.subtitle && <p className={styles.subtitle}>{s.subtitle}</p>}
        </div>
        {items.length > 3 && (
          <div className={styles.controls} aria-label="Navegación de testimonios">
            <button type="button" onClick={() => scroll(-1)} aria-label="Testimonios anteriores"><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => scroll(1)} aria-label="Testimonios siguientes"><ChevronRight size={18} /></button>
          </div>
        )}
      </div>

      <div className={styles.track} ref={trackRef}>
        {items.map((item, idx) => {
          const avatar = item.avatar || item.imageUrl || '';
          const city = item.city || item.location || '';
          return (
            <article key={idx} className={styles.card}>
              <div className={styles.header}>
                {avatar ? (
                  <img src={avatar} alt={item.author || 'Cliente'} className={styles.avatar} loading="lazy" width={48} height={48} />
                ) : (
                  <span className={styles.avatarFallback} aria-hidden="true">{initialsOf(item.author)}</span>
                )}
                <div className={styles.meta}>
                  <p className={styles.author}>{item.author}</p>
                  {(item.topic || city) && <p className={styles.city}>{[item.topic, city].filter(Boolean).join(' · ')}</p>}
                  <div className={styles.stars} aria-label={`${item.rating || 5} estrellas`}>
                    {[...Array(Math.min(5, Math.max(1, Number(item.rating) || 5)))].map((_, i) => (
                      <StarIcon key={i} />
                    ))}
                  </div>
                </div>
              </div>
              <p className={styles.text}>“{item.text}”</p>
              {item.verified && <span className={styles.verified}>✓ Compra verificada</span>}
            </article>
          );
        })}
      </div>
      <BotonSeccion settings={s} />
    </div>
  );
};

export default Testimonials;
