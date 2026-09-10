import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from '../services/firebase/auth';
import { getAuthErrorMessage } from '../utils/authErrorMessages';
import { LOGO_URL } from '../utils/constants';
import Button from '../components/common/Button';
import Loading from '../components/common/Loading';
import styles from './ResetPasswordPage.module.css';
import { T } from '../i18n/useTranslatedText';

const ResetPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setLoading(true);
    const { error: err, errorCode } = await sendPasswordResetEmail(email.trim().toLowerCase());
    setLoading(false);
    if (err) {
      setError(getAuthErrorMessage(errorCode, err));
      return;
    }
    setSent(true);
  };

  if (loading) {
    return <Loading message="Enviando enlace..." />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.branding}>
          <img src={LOGO_URL} alt="Logo" />
          <h2><T>Recupera tu acceso</T></h2>
          <p><T>Te enviaremos un enlace seguro para restablecer tu contraseña.</T></p>
        </div>
        <div className={styles.formContainer}>
          <img src={LOGO_URL} alt="Logo" className={styles.logoMovil} />
          {sent ? (
            <>
              <h1 className={styles.title}><T>Correo enviado</T></h1>
              <p className={styles.message}>
                Si existe una cuenta con ese correo, recibirá un enlace para restablecer la contraseña. Revise su bandeja de entrada y la carpeta de spam.
              </p>
              <Link to="/login" className={styles.backLink}>
                Volver a Iniciar sesión
              </Link>
            </>
          ) : (
            <>
              <h1 className={styles.title}><T>Recuperar contraseña</T></h1>
              <p className={styles.subtitle}>
                Ingrese su correo y le enviaremos un enlace para restablecer su contraseña.
              </p>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="email"><T>Correo electrónico</T></label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Ingresa tu correo electrónico"
                  />
                </div>
                {error && (
                  <div className={styles.errorMessage}>
                    <span className={styles.errorIcon}>⚠</span>
                    {error}
                  </div>
                )}
                <Button type="submit" variant="primary" fullWidth disabled={loading}>
                  Enviar enlace
                </Button>
              </form>
              <div className={styles.footer}>
                <Link to="/login" className={styles.link}>
                  Volver a Iniciar sesión
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
