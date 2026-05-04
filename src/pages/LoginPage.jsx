import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmail, signInWithGoogle } from '../services/firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { getAuthErrorMessage } from '../utils/authErrorMessages';
import { LOGO_URL } from '../utils/constants';
import Button from '../components/common/Button';
import Loading from '../components/common/Loading';
import styles from './LoginPage.module.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, userProfile, loading: authLoading } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (authLoading || !user) return;
    if (userProfile?.dni && userProfile?.phone) {
      navigate('/', { replace: true });
    } else {
      navigate('/completar-perfil', { replace: true });
    }
  }, [user, userProfile, authLoading, navigate]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (email === 'AdminWalaPro' && password === 'LaClaveDeWala2020') {
      localStorage.setItem('adminWalaPro', 'true');
      // Forzar recarga completa para que el AuthContext lea el localStorage y actualice isAdmin
      window.location.href = '/admin';
      return;
    }

    const { error: err, errorCode } = await signInWithEmail(email, password);
    if (err) {
      setError(getAuthErrorMessage(errorCode, err));
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    const { error: err, errorCode } = await signInWithGoogle();
    if (err) {
      setError(getAuthErrorMessage(errorCode, err));
    } else {
      navigate('/completar-perfil');
    }
    setLoading(false);
  };

  if (loading && !error) {
    return <Loading message="Iniciando sesión..." />;
  }

  if (user && !authLoading) {
    return <Loading message="Redirigiendo..." />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.branding}>
          <img src={LOGO_URL} alt="Logo de la Empresa" />
          <h2>Bienvenido de vuelta</h2>
          <p>Inicia sesión para acceder a tu cuenta y gestionar tus pedidos personalizados.</p>
          <div className={styles.brandingFeatures}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>✓</span>
              <span>Gestiona tus pedidos</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>✓</span>
              <span>Personaliza tus prendas</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>✓</span>
              <span>Acceso rápido y seguro</span>
            </div>
          </div>
        </div>
        <div className={styles.formContainer}>
          <img src={LOGO_URL} alt="Logo de la Empresa" className={styles.logoMovil} />
          <h1>Iniciar Sesión</h1>
          <p>Ingresa tus credenciales para acceder a tu cuenta.</p>
          
          <form onSubmit={handleEmailLogin} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="email">Correo Electrónico</label>
              <input
                type="text"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="tu@email.com o Usuario Admin"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="••••••••"
              />
              <div className={styles.forgotRow}>
                <Link to="/recuperar-contrasena" className={styles.forgotLink}>
                  ¿Olvidó su contraseña?
                </Link>
              </div>
            </div>
            
            {error && (
              <div className={styles.errorMessage}>
                <span className={styles.errorIcon}>⚠</span>
                {error}
              </div>
            )}
            
            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={loading}
              loading={loading}
            >
              Iniciar Sesión
            </Button>
          </form>
          
          <div className={styles.divider}>
            <span>o continúa con</span>
          </div>
          
          <Button
            onClick={handleGoogleLogin}
            variant="secondary"
            fullWidth
            disabled={loading}
            className={styles.googleButton}
          >
            <svg className={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Iniciar con Google
          </Button>
          
          <div className={styles.footer}>
            <p>
              ¿No tienes una cuenta?{' '}
              <Link to="/registro" className={styles.link}>
                Regístrate aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
