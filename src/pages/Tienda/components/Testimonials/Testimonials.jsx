import React from 'react';
import styles from './Testimonials.module.css';
import { TextoSeccion, BotonSeccion } from '../textStyleUtils.jsx';

const StarIcon = () => (
  <svg className={styles.star} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop&crop=face&auto=format&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop&crop=face&auto=format&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=160&h=160&fit=crop&crop=face&auto=format&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=face&auto=format&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&h=160&fit=crop&crop=face&auto=format&q=80',
];

const Testimonials = ({ config, title, testimonials = [] }) => {
  if (!testimonials || testimonials.length === 0) return null;

  const s = config || {};
  const tituloEfectivo = s.title != null && s.title !== '' ? s.title : title;
  const bg = s.backgroundColor || undefined;

  return (
    <div className={styles.container} style={bg ? { backgroundColor: bg } : undefined}>
      <TextoSeccion settings={s} prefix="title" as="h2" className={styles.title}>
        {tituloEfectivo}
      </TextoSeccion>
      {s.subtitle && <p className={styles.subtitle}>{s.subtitle}</p>}

      <div className={styles.track}>
        {testimonials.map((item, idx) => {
          const avatar = item.avatar || item.imageUrl || DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length];
          const city = item.city || item.location || '';
          return (
            <article key={idx} className={styles.card}>
              <div className={styles.header}>
                <img
                  src={avatar}
                  alt={item.author || 'Cliente'}
                  className={styles.avatar}
                  loading="lazy"
                  width={48}
                  height={48}
                />
                <div className={styles.meta}>
                  <p className={styles.author}>{item.author}</p>
                  {city && <p className={styles.city}>{city}</p>}
                  <div className={styles.stars} aria-label={`${item.rating || 5} estrellas`}>
                    {[...Array(Number(item.rating) || 5)].map((_, i) => (
                      <StarIcon key={i} />
                    ))}
                  </div>
                </div>
              </div>
              <p className={styles.text}>“{item.text}”</p>
              <span className={styles.verified}>✓ Compra verificada</span>
            </article>
          );
        })}
      </div>
      <BotonSeccion settings={s} />
    </div>
  );
};

export default Testimonials;
