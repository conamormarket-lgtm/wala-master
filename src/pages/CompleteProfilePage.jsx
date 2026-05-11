import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getCollection } from '../services/firebase/firestore';
import { LOGO_URL } from '../utils/constants';
import { validateDNI, validateCE, validatePhone } from '../utils/helpers';
import Button from '../components/common/Button';
import { PORTAL_USERS_COLLECTION } from '../constants/userCollections';
import styles from './CompleteProfilePage.module.css';

const CompleteProfilePage = () => {
  const navigate = useNavigate();
  const { user, userProfile, loading: authLoading, updateUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [tipoDoc, setTipoDoc] = useState('DNI');
  const [documento, setDocumento] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
    if (!authLoading && user && userProfile) {
      if (userProfile.dni && userProfile.phone) {
        if (!userProfile.hasCompletedSurvey) {
          navigate('/encuesta-suscripcion');
        } else {
          navigate('/');
        }
        return;
      }
      setFullName(userProfile.displayName || user.displayName || '');
    }
  }, [user, userProfile, authLoading, navigate]);

  const docValid = tipoDoc === 'DNI' ? validateDNI(documento) : validateCE(documento);
  const formValid = docValid && fullName.trim() && validatePhone(phone);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!formValid || !user) return;
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
      setError('Este DNI ya está registrado en otra cuenta. Si es su DNI, inicie sesión en esa cuenta o contacte soporte.');
      return;
    }
    setLoading(true);
    const updates = {
      displayName: fullName.trim(),
      dni: documentoNorm,
      tipoDocumento: tipoDoc,
      phone: phone.replace(/\D/g, ''),
      email: user.email,
      accessSystem: 'portal_clientes',
      accountOrigin: userProfile?.accountOrigin || 'google_auth',
    };
    const { error: err } = await updateUserProfile(updates);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    if (!userProfile?.hasCompletedSurvey) {
      navigate('/encuesta-suscripcion');
    } else {
      navigate('/');
    }
  };

  if (authLoading || (!user && !userProfile)) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingInline}>
          <span className={styles.loadingDot} />
          <span>Verificando...</span>
        </div>
      </div>
    );
  }

  if (user && userProfile?.dni && userProfile?.phone) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.branding}>
          <img src={LOGO_URL} alt="Logo" />
          <h2>Completa tu perfil</h2>
          <p>Necesitamos tu DNI y teléfono para tus pedidos.</p>
        </div>
        <div className={styles.formContainer}>
          <img src={LOGO_URL} alt="Logo" className={styles.logoMovil} />
          <h1>Completa tu perfil</h1>
          <p>Indica tu documento y teléfono para continuar.</p>

          <form onSubmit={handleSubmit} className={styles.form}>
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
            <Button type="submit" variant="primary" fullWidth disabled={!formValid || loading}>
              Guardar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfilePage;
