import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './AnnouncementBar.module.css';

/**
 * Barra de anuncios.
 * Mantiene TODOS los mensajes montados y solo oculta/muestra con CSS.
 * Evita remount + removeChild (conflicto con Google Translate / extensiones).
 */
const AnnouncementBar = ({
  messages = [],
  speed = 3000,
  bgColor = '#000000',
  textColor = '#ffffff',
  animationType = 'fade',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const list = Array.isArray(messages) ? messages.filter((m) => m && m.text) : [];

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

    const content = (
      <div className={styles.messageContent} style={textStyle}>
        {msg.imageUrl ? (
          <img src={msg.imageUrl} alt="" className={styles.messageIcon} decoding="async" />
        ) : null}
        <span style={Object.keys(spanStyle).length ? spanStyle : undefined}>{msg.text}</span>
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
        className={styles.announcementBar}
        style={{ backgroundColor: bgColor, color: textColor }}
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
      className={styles.announcementBar}
      style={{ backgroundColor: bgColor, color: textColor }}
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
