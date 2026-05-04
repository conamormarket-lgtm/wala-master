import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from '../services/firebase/auth';
import { getAuthErrorMessage } from '../utils/authErrorMessages';
import { LOGO_URL } from '../utils/constants';
import Button from '../components/common/Button';
import Loading from '../components/common/Loading';
import styles from './ResetPasswordPage.module.css';

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
    const { error: err, errorCode } = await sendPasswordResetEmail(email.trim());
    setLoading(false);
    if (err) {
      setError(getAuthErrorMessage(errorCode, err));
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className={styles.container}>
        <div className={styles.wrapper}>
          <div className={styles.formContainer}>
            <img src={LOGO_URL} alt="Logo" className={styles.logo} />
            <h1 className={styles.title}>Correo enviado</h1>
            <p className={styles.message}>
              Si existe una cuenta con ese correo, recibirá un enlace para restablecer la contraseña. Revise su bandeja de entrada y la carpeta de spam.
            </p>
            <Link to="/login" className={styles.backLink}>
              Volver a Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <Loading message="Enviando enlace..." />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.formContainer}>
          <img src={LOGO_URL} alt="Logo" className={styles.logo} />
          <h1 className={styles.title}>Recuperar contraseña</h1>
          <p className={styles.subtitle}>
            Ingrese su correo y le enviaremos un enlace para restablecer su contraseña.
          </p>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="email">Correo electrónico</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="tu@email.com"
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
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
