import React from 'react';
import styles from './Loading.module.css';

const Loading = ({ size = 'medium', fullScreen = false, message }) => {
  const sizeClass = styles[size] || styles.medium;
  
  if (fullScreen) {
    return (
      <div className={styles.fullScreen}>
        <div className={`${styles.spinner} ${sizeClass}`}></div>
        {message && <p className={styles.message}>{message}</p>}
      </div>
    );
  }
  
  return <div className={`${styles.spinner} ${sizeClass}`}></div>;
};

export default Loading;
