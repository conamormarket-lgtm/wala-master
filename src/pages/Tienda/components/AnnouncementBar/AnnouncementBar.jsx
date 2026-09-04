import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Sparkles, ShieldCheck, Heart } from 'lucide-react';
import styles from './AnnouncementBar.module.css';

/**
 * Mensajes existentes (y los que un admin siga escribiendo así) llevan el
 * emoji tecleado al inicio del texto, p.ej. "🚚 Envíos a todo el Perú". Un
 * emoji dentro del texto se renderiza distinto según el sistema operativo del
 * visitante y no puede tomar el color de marca — desentona con el resto del
 * sitio, que usa íconos SVG (lucide) coloreados a mano.
 *
 * En vez de pedir reescribir el contenido, detectamos el emoji líder y lo
 * reemplazamos por su ícono lucide equivalente (mismo color que el punto de
 * acento). Un mensaje sin emoji reconocido sigue mostrando el punto de
 * siempre: retrocompatible con cualquier mensaje nuevo o no mapeado.
 */
const EMOJI_ICON_MAP = {
  '🚚': Truck,
  '✨': Sparkles,
  '🔒': ShieldCheck,
  '💜': Heart,
};

// Emoji (+ variation selector opcional) al inicio del texto, seguido de espacio(s).
const LEADING_EMOJI_RE = /^(\p{Extended_Pictographic})️?\s+/u;

const splitLeadingIcon = (text) => {
  const match = LEADING_EMOJI_RE.exec(text || '');
  const Icon = match ? EMOJI_ICON_MAP[match[1]] : null;
  if (!Icon) return { Icon: null, rest: text };
  return { Icon, rest: text.slice(match[0].length) };
};
const AnnouncementBar = ({
  config = {},
  messages = [],
  speed = 3000,
  bgColor = '#000000',
  textColor = '#ffffff',
  animationType = 'fade',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const list = Array.isArray(messages) ? messages.filter((m) => m && m.text) : [];
  const variant = config.variant || 'soft';
  const density = config.density || 'compact';
  const showAccent = config.showAccent !== false;

  useEffect(() => {
    if (list.length <= 1 || animationType === 'scroll') return undefined;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % list.length);
    }, speed || 3000);

    return () => clearInterval(interval);
  }, [list.length, speed, animationType]);

  useEffect(() => {
    setCurrentIndex((prev) => (list.length ? prev % list.length : 0));
  }, [list.length]);

  if (list.length === 0) return null;

  const renderMessageContent = (msg) => {
    const textStyle = {
      fontFamily: msg.fontFamily || 'inherit',
      fontSize: msg.fontSize || 'inherit',
      fontWeight: msg.bold ? 'bold' : 'normal',
      fontStyle: msg.italic ? 'italic' : 'normal',
      ...(msg.textAlign ? { textAlign: msg.textAlign, justifyContent: msg.textAlign } : {}),
    };

    const spanStyle = {
      ...(msg.underline ? { textDecoration: 'underline' } : {}),
      ...(msg.textBg && msg.textBg !== 'transparent'
        ? {
            backgroundColor: msg.textBg,
            padding: '0.1em 0.35em',
            borderRadius: 4,
          }
        : {}),
    };

    const { Icon, rest } = splitLeadingIcon(msg.text);

    const content = (
      <div className={styles.messageContent} style={textStyle}>
        {msg.imageUrl ? (
          <img src={msg.imageUrl} alt="" className={styles.messageIcon} decoding="async" />
        ) : Icon ? (
          <Icon className={styles.messageLucideIcon} aria-hidden="true" size={14} strokeWidth={2.25} />
        ) : showAccent ? <span className={styles.accentDot} aria-hidden="true" /> : null}
        <span style={Object.keys(spanStyle).length ? spanStyle : undefined}>{Icon ? rest : msg.text}</span>
        {msg.link ? <span className={styles.linkArrow} aria-hidden="true">→</span> : null}
      </div>
    );

    if (msg.link) {
      if (String(msg.link).startsWith('http')) {
        return (
          <a
            href={msg.link}
            className={styles.announcementLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            {content}
          </a>
        );
      }
      return (
        <Link to={msg.link} className={styles.announcementLink}>
          {content}
        </Link>
      );
    }
    return content;
  };

  if (animationType === 'scroll') {
    const displayMessages =
      list.length < 5 ? [...list, ...list, ...list, ...list] : [...list, ...list];
    const animationDuration = `${speed / 1000}s`;

    return (
      <div
        className={`${styles.announcementBar} ${styles[variant]} ${styles[density]}`}
        style={{ '--announcement-accent': bgColor, '--announcement-text': textColor }}
        translate="no"
      >
        <div className={styles.scrollTrack} style={{ animationDuration }}>
          {displayMessages.map((msg, index) => (
            <div key={`scroll-${index}`} className={styles.scrollItem}>
              {renderMessageContent(msg)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fade: todos los mensajes viven en el DOM; solo uno es visible.
  return (
    <div
      className={`${styles.announcementBar} ${styles[variant]} ${styles[density]}`}
      style={{ '--announcement-accent': bgColor, '--announcement-text': textColor }}
      translate="no"
    >
      <div className={styles.fadeStack}>
        {list.map((msg, index) => (
          <div
            key={`msg-${index}-${String(msg.text).slice(0, 24)}`}
            className={`${styles.announcementText} ${
              index === currentIndex ? styles.fadeActive : styles.fadeIdle
            }`}
            aria-hidden={index !== currentIndex}
          >
            {renderMessageContent(msg)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnnouncementBar;
