import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './AnnouncementBar.module.css';

const AnnouncementBar = ({ 
  messages = [], 
  speed = 3000, 
  bgColor = '#000000', 
  textColor = '#ffffff',
  animationType = 'fade'
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!messages || messages.length <= 1 || animationType === 'scroll') return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, speed || 3000);

    return () => clearInterval(interval);
  }, [messages, speed, animationType]);

  if (!messages || messages.length === 0) return null;

  const renderMessageContent = (msg) => {
    const textStyle = {
      fontFamily: msg.fontFamily || 'inherit',
      fontSize: msg.fontSize || 'inherit',
      fontWeight: msg.bold ? 'bold' : 'normal',
      fontStyle: msg.italic ? 'italic' : 'normal',
    };

    const content = (
      <div className={styles.messageContent} style={textStyle}>
        {msg.imageUrl && (
          <img src={msg.imageUrl} alt="" className={styles.messageIcon} />
        )}
        <span>{msg.text}</span>
      </div>
    );

    if (msg.link) {
      if (msg.link.startsWith('http')) {
        return <a href={msg.link} className={styles.announcementLink} target="_blank" rel="noopener noreferrer">{content}</a>;
      }
      return <Link to={msg.link} className={styles.announcementLink}>{content}</Link>;
    }
    return content;
  };

  if (animationType === 'scroll') {
    // Para scroll continuo
    const displayMessages = messages.length < 5 ? [...messages, ...messages, ...messages, ...messages] : [...messages, ...messages];
    const animationDuration = `${speed / 1000}s`;

    return (
      <div className={styles.announcementBar} style={{ backgroundColor: bgColor, color: textColor }}>
        <div className={styles.scrollTrack} style={{ animationDuration }}>
          {displayMessages.map((msg, index) => (
            <div key={index} className={styles.scrollItem}>
              {renderMessageContent(msg)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Comportamiento Fade por defecto
  const currentMessage = messages[currentIndex];
  if (!currentMessage || !currentMessage.text) return null;

  return (
    <div 
      className={styles.announcementBar} 
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <div key={currentIndex} className={styles.announcementText}>
        {renderMessageContent(currentMessage)}
      </div>
    </div>
  );
};

export default AnnouncementBar;
