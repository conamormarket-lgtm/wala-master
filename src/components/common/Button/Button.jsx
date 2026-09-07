import React from 'react';
import styles from './Button.module.css';
import { T } from '../../../i18n/useTranslatedText';

const Button = ({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className,
  ...props
}) => {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <span key="loading"><T>Cargando...</T></span> : <span key="content">{children}</span>}
    </button>
  );
};

export default Button;
