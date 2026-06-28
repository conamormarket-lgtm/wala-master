import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getCollection } from '../services/firebase/firestore';
import { shouldPromptSurvey } from '../utils/surveyHelper';
import { LOGO_URL } from '../utils/constants';
import { validateDNI, validateCE, validatePhone, validateDocInternacional } from '../utils/helpers';
import Button from '../components/common/Button';
import CountrySelect from '../components/intl/CountrySelect';
import PhoneIntlInput from '../components/intl/PhoneIntlInput';
import { dialCodeByCountry } from '../constants/countries';
import { detectCountry } from '../services/geo';
import { PORTAL_USERS_COLLECTION } from '../constants/userCollections';
import { getDocTypesForCountry, FOREIGN_DOC_LABEL, isPeru } from '../constants/documentTypes';
import styles from './CompleteProfilePage.module.css';

const CompleteProfilePage = () => {
  const navigate = useNavigate();
  const { user, userProfile, loading: authLoading, updateUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [country, setCountry] = useState('PE');
  const [tipoDoc, setTipoDoc] = useState('DNI');
  const [documento, setDocumento] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  // Cumpleaños PROPIO del usuario (opcional). Se precarga si el perfil ya lo tiene.
  const [birthDate, setBirthDate] = useState('');
  // true si el cumpleaños se precargó desde la cuenta de Google (para confirmar).
  const [birthFromGoogle, setBirthFromGoogle] = useState(false);

  const isPE = isPeru(country);
  // Lista de tipos de documento según país (Perú: DNI/CE/Pasaporte; extranjero: null).
  const docTypes = getDocTypesForCountry(country);

  // Detección de país por IP. Default 'PE' si falla (PRINCIPIO DE SEGURIDAD).
  useEffect(() => {
    let active = true;
    detectCountry()
      .then((res) => { if (active && res?.code) setCountry(res.code); })
      .catch(() => { if (active) setCountry('PE'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
    if (!authLoading && user && userProfile) {
      if (userProfile.dni && userProfile.phone) {
        if (shouldPromptSurvey(userProfile)) {
          navigate('/encuesta-suscripcion');
        } else {
          navigate('/');
        }
        return;
      }
      setFullName(userProfile.displayName || user.displayName || '');
      // Si el perfil ya trae país (p. ej. registro previo), respétalo.
      if (userProfile.country) setCountry(userProfile.country);
      // Precarga el cumpleaños: prioridad al del perfil; si no, al importado de
      // Google (lo guardó el login en localStorage) para confirmarlo aquí.
      if (userProfile.birthDate) {
        setBirthDate(userProfile.birthDate);
      } else {
        try {
          const g = typeof localStorage !== 'undefined'
            ? localStorage.getItem('wala_google_birthday') : null;
          if (g) {
            setBirthDate(g);
            setBirthFromGoogle(true);
            localStorage.removeItem('wala_google_birthday');
          }
        } catch (_) { /* el cumpleaños es opcional */ }
      }
    }
  }, [user, userProfile, authLoading, navigate]);

  // Validación ESTRICTA peruana solo si country === 'PE'.
  const docValid = isPE
    ? (tipoDoc === 'DNI' ? validateDNI(documento) : validateCE(documento))
    : validateDocInternacional(documento);
  const phoneValid = isPE ? validatePhone(phone) : String(phone || '').trim().length >= 4;
  const formValid = docValid && fullName.trim() && phoneValid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!formValid || !user) return;
    const documentoNorm = isPE ? documento.trim().replace(/\s/g, '') : documento.trim();
    const { data: usersWithDni, error: queryErr } = await getCollection(PORTAL_USERS_COLLECTION, [
      { field: 'dni', operator: '==', value: documentoNorm }
    ]);
    if (queryErr) {
      setError(queryErr);
      return;
    }
    const otherUserWithDni = usersWithDni.some((doc) => doc.id !== user.uid);
    if (otherUserWithDni) {
      setError('Este documento ya está registrado en otra cuenta. Si es suyo, inicie sesión en esa cuenta o contacte soporte.');
      return;
    }
    setLoading(true);
    // ERP: el documento SIEMPRE en dni / clienteNumeroDocumento / envioNumeroDocumento.
    // El tipo elegido (DNI/CE/Pasaporte u 'OTRO' si extranjero) va en tipoDocumento
    // y, de forma aditiva, en docType.
    const tipoDocFinal = isPE ? tipoDoc : 'OTRO';
    const updates = {
      displayName: fullName.trim(),
      country,
      dni: documentoNorm,
      clienteNumeroDocumento: documentoNorm,
      envioNumeroDocumento: documentoNorm,
      tipoDocumento: tipoDocFinal,
      clienteTipoDocumento: tipoDocFinal,
      docType: tipoDocFinal,
      email: user.email,
      accessSystem: 'portal_clientes',
      accountOrigin: userProfile?.accountOrigin || 'google_auth',
    };
    // Cumpleaños propio: campo OPCIONAL. Solo se escribe si hay valor,
    // para no sobrescribir uno existente con vacío. NO bloquea el registro.
    if (birthDate) {
      updates.birthDate = birthDate;
    }
    if (isPE) {
      updates.phone = phone.replace(/\D/g, '');
    } else {
      const dialCode = dialCodeByCountry(country) || '';
      const localNumber = String(phone || '').trim();
      const full = `${dialCode}${localNumber}`;
      updates.phone = full;
      updates.phoneIntl = { dialCode, localNumber, full };
    }
    const { error: err } = await updateUserProfile(updates);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    if (shouldPromptSurvey(userProfile)) {
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
            <div className={styles.formGroup}>
              <label htmlFor="country">País</label>
              <CountrySelect value={country} onChange={(code) => setCountry(code || 'PE')} />
            </div>
            {isPE ? (
              <>
                {/* Perú: tipo de documento (DNI/CE/Pasaporte) + número. */}
                <div className={styles.formGroup}>
                  <label htmlFor="tipoDoc">Tipo de documento</label>
                  <select
                    id="tipoDoc"
                    className={styles.select}
                    value={tipoDoc}
                    onChange={(e) => setTipoDoc(e.target.value)}
                    disabled={loading}
                  >
                    {docTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="documento">
                    {tipoDoc === 'DNI' ? 'Número de DNI' : `Número de ${tipoDoc}`}
                  </label>
                  <input
                    type="text"
                    id="documento"
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value.replace(/\s/g, ''))}
                    required
                    disabled={loading}
                    placeholder={tipoDoc === 'DNI' ? '8 dígitos' : '9 a 12 caracteres'}
                    maxLength={tipoDoc === 'DNI' ? 8 : 12}
                  />
                  {documento && !docValid && (
                    <span className={styles.fieldError}>
                      {tipoDoc === 'DNI' ? 'DNI debe tener 8 dígitos' : 'Debe tener 9 a 12 caracteres alfanuméricos'}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.formGroup}>
                <label htmlFor="documento">{FOREIGN_DOC_LABEL}</label>
                <input
                  type="text"
                  id="documento"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Pasaporte, ID o documento"
                />
                {documento && !docValid && (
                  <span className={styles.fieldError}>Ingresa un documento válido (mín. 3 caracteres)</span>
                )}
              </div>
            )}
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
            {isPE ? (
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
            ) : (
              <div className={styles.formGroup}>
                <label htmlFor="phone">Teléfono</label>
                <PhoneIntlInput
                  countryCode={country}
                  value={phone}
                  onChange={({ localNumber }) => setPhone(localNumber)}
                />
                {phone && !phoneValid && (
                  <span className={styles.fieldError}>Ingresa un número de teléfono válido</span>
                )}
              </div>
            )}
            {/* Cumpleaños propio: OPCIONAL, no bloquea el registro. */}
            <div className={styles.formGroup}>
              <label htmlFor="birthDate">Tu cumpleaños 🎂 (para sorprenderte con regalos)</label>
              <input
                type="date"
                id="birthDate"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                disabled={loading}
              />
              {/* Si venía precargado (del perfil o de Google), invitamos a confirmar. */}
              {(userProfile?.birthDate || birthFromGoogle) && (
                <span className={styles.fieldHint}>
                  {birthFromGoogle
                    ? 'La tomamos de tu cuenta de Google — ¿es correcta?'
                    : '¿Es correcta esta fecha?'}
                </span>
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
