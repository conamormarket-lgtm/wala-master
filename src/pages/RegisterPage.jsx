import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUpWithEmail, signInWithGoogle } from '../services/firebase/auth';
import { setDocument, getCollection } from '../services/firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getAuthErrorMessage } from '../utils/authErrorMessages';
import { LOGO_URL } from '../utils/constants';
import { validateDNI, validateCE, validatePhone, getPasswordRequirements, isPasswordValid } from '../utils/helpers';
import Button from '../components/common/Button';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal/Modal';
import { PORTAL_USERS_COLLECTION } from '../constants/userCollections';
import styles from './RegisterPage.module.css';

const PASSWORD_SPECIAL = '!#%&@*';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { user, userProfile, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [tipoDoc, setTipoDoc] = useState('DNI');
  const [documento, setDocumento] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const passwordReqs = getPasswordRequirements(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const step1Valid = email && isPasswordValid(password) && passwordsMatch;

  const docValid = tipoDoc === 'DNI' ? validateDNI(documento) : validateCE(documento);
  const step2Valid = docValid && fullName.trim() && validatePhone(phone);

  React.useEffect(() => {
    if (authLoading || !user) return;
    if (userProfile?.dni && userProfile?.phone) {
      navigate('/', { replace: true });
    } else if (step === 1) {
      setStep(2);
    }
  }, [user, userProfile, authLoading, step, navigate]);

  const handleStep1 = async (e) => {
    e.preventDefault();
    setError(null);
    if (!step1Valid) return;
    setLoading(true);
    const { error: err, errorCode } = await signUpWithEmail(email, password);
    setLoading(false);
    if (err) {
      setError(getAuthErrorMessage(errorCode, err));
      return;
    }
    setStep(2);
  };

  const handleStep2 = async (e) => {
    e.preventDefault();
    setError(null);
    if (!user || !step2Valid) return;
    setConfirmModalOpen(true);
  };

  const handleConfirmRegister = async () => {
    setConfirmModalOpen(false);
    setError(null);
    if (!user || !step2Valid) return;
    const documentoNorm = documento.trim().replace(/\s/g, '');
    const { data: usersWithDni, error: queryErr } = await getCollection(PORTAL_USERS_COLLECTION, [
      { field: 'dni', operator: '==', value: documentoNorm }
    ]);
    if (queryErr) {
      setError(queryErr);
      return;
    }
    const otherUserWithDni = usersWithDni.some((doc) => doc.id !== user.uid);
    if (otherUserWithDni) {
      setError('Este DNI ya está registrado en otra cuenta. Si es su DNI, use "Iniciar sesión" o recupere su acceso.');
      return;
    }
    setLoading(true);
    const { error: err } = await setDocument(PORTAL_USERS_COLLECTION, user.uid, {
      email: user.email,
      displayName: fullName.trim(),
      dni: documentoNorm,
      tipoDocumento: tipoDoc,
      phone: phone.replace(/\D/g, ''),
      accessSystem: 'portal_clientes',
      accountOrigin: 'register_form',
    });
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    navigate('/');
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    const { error: err, errorCode } = await signInWithGoogle();
    setLoading(false);
    if (err) {
      setError(getAuthErrorMessage(errorCode, err));
      return;
    }
    navigate('/completar-perfil');
  };

  if (loading && step === 1 && !user) {
    return <Loading message="Creando cuenta..." />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.branding}>
          <img src={LOGO_URL} alt="Logo" />
          <h2>Crear cuenta</h2>
          <p>Regístrate para hacer pedidos y rastrear tus compras.</p>
        </div>
        <div className={styles.formContainer}>
          <img src={LOGO_URL} alt="Logo" className={styles.logoMovil} />
          <div className={styles.steps}>
            <div className={styles.stepCircle + (step === 1 ? ' ' + styles.stepActive : '')}>1</div>
            <div className={styles.stepLine} />
            <div className={styles.stepCircle + (step === 2 ? ' ' + styles.stepActive : '')}>2</div>
          </div>
          <h1>{step === 1 ? 'Crear cuenta' : 'Tus datos para el pedido'}</h1>
          <p>{step === 1 ? 'Correo y contraseña' : 'DNI o CE, nombre y teléfono.'}</p>

          {step === 1 && (
            <form onSubmit={handleStep1} className={styles.form}>
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
              <div className={styles.formGroup}>
                <label htmlFor="password">Contraseña</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="confirmPassword">Confirmar contraseña</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                />
                {confirmPassword && !passwordsMatch && (
                  <span className={styles.fieldError}>Las contraseñas no coinciden</span>
                )}
              </div>
              <div className={styles.passwordReqs}>
                <span className={styles.passwordReqsTitle}>Requisitos de contraseña</span>
                <ul>
                  <li className={passwordReqs.length ? styles.met : ''}>Al menos 8 caracteres</li>
                  <li className={passwordReqs.uppercase ? styles.met : ''}>Al menos 1 mayúscula</li>
                  <li className={passwordReqs.lowercase ? styles.met : ''}>Al menos 1 minúscula</li>
                  <li className={passwordReqs.number ? styles.met : ''}>Al menos 1 número</li>
                  <li className={passwordReqs.special ? styles.met : ''}>Al menos 1 carácter especial ({PASSWORD_SPECIAL})</li>
                </ul>
              </div>
              {error && (
                <div className={styles.errorMessage}>
                  <span className={styles.errorIcon}>⚠</span>
                  {error}
                </div>
              )}
              <Button type="submit" variant="primary" fullWidth disabled={!step1Valid || loading}>
                Siguiente
              </Button>
            </form>
          )}

          {step === 2 && (
            <div className={styles.step2Layout}>
              <form
                onSubmit={handleStep2}
                className={styles.form}
              >
                <div className={styles.toggleRow}>
                <button
                  type="button"
                  className={tipoDoc === 'DNI' ? styles.toggleActive : styles.toggle}
                  onClick={() => setTipoDoc('DNI')}
                >
                  DNI
                </button>
                <button
                  type="button"
                  className={tipoDoc === 'CE' ? styles.toggleActive : styles.toggle}
                  onClick={() => setTipoDoc('CE')}
                >
                  CE
                </button>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="documento">
                  {tipoDoc === 'DNI' ? 'Número de DNI' : 'Número de CE'}
                </label>
                <input
                  type="text"
                  id="documento"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value.replace(/\s/g, ''))}
                  required
                  disabled={loading}
                  placeholder={tipoDoc === 'DNI' ? '8 dígitos' : '9 a 12 caracteres'}
                  maxLength={tipoDoc === 'CE' ? 12 : 8}
                />
                {documento && !docValid && (
                  <span className={styles.fieldError}>
                    {tipoDoc === 'DNI' ? 'DNI debe tener 8 dígitos' : 'CE: 9 a 12 caracteres alfanuméricos'}
                  </span>
                )}
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="fullName">Nombre completo</label>
                <input
                  type="text"
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="phone">Teléfono</label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  required
                  disabled={loading}
                  placeholder="9 dígitos (ej. 987654321)"
                />
                {phone && !validatePhone(phone) && (
                  <span className={styles.fieldError}>Teléfono debe ser 9 dígitos y empezar por 9</span>
                )}
              </div>
              {error && (
                <div className={styles.errorMessage}>
                  <span className={styles.errorIcon}>⚠</span>
                  {error}
                </div>
              )}
              <div className={styles.step2Actions}>
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  Atrás
                </Button>
                <Button type="submit" variant="primary" disabled={!step2Valid || loading}>
                  Registrarse
                </Button>
              </div>
            </form>
          </div>
          )}

          {step === 1 && (
            <>
              <div className={styles.divider}>
                <span>o continúa con</span>
              </div>
              <Button
                onClick={handleGoogle}
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
                Continuar con Google
              </Button>
            </>
          )}

          <div className={styles.footer}>
            <p>
              ¿Ya tienes cuenta? <Link to="/login" className={styles.link}>Iniciar sesión</Link>
            </p>
          </div>
        </div>
      </div>
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="¿Confirma que sus datos son correctos?"
      >
        <p className={styles.modalText}>
          El DNI y el teléfono se usarán para rastrear su pedido. Verifique que todo sea correcto antes de continuar.
        </p>
        <div className={styles.modalActions}>
          <Button type="button" variant="secondary" onClick={() => setConfirmModalOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" onClick={handleConfirmRegister}>
            Sí, registrar
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default RegisterPage;
