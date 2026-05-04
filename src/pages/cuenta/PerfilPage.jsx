import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { logout } from '../../services/firebase/auth';
import { validateDNI, validateCE, validatePhone } from '../../utils/helpers';
import { useProducts } from '../../hooks/useProducts';
import AvatarStudio from '../../components/profile/AvatarStudio';
import styles from './PerfilPage.module.css';

const Icons = {
  Gift: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>,
  Copy: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  Check: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  User: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  Shirt: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" /></svg>,
};

const KapiSolCoin = () => (
  <div className={styles.coinContainer}>
    <div className={styles.coinFlip}>
      <div className={styles.coinFace}>
        <svg viewBox="0 0 100 100" className={styles.coinSvg}>
          <path d="M20,60 Q20,30 50,30 Q80,30 80,60 Q80,80 65,90 Q50,95 35,90 Q20,80 20,60 Z" fill="#6B4423" />
          <circle cx="35" cy="55" r="4" fill="#000" />
          <circle cx="65" cy="55" r="4" fill="#000" />
          <path d="M45,70 Q50,75 55,70" stroke="#000" strokeWidth="3" fill="none" />
          <rect x="45" y="65" width="10" height="5" rx="2" fill="#3E2723" />
        </svg>
      </div>
      <div className={`${styles.coinFace} ${styles.coinBack}`}>
        <svg viewBox="0 0 100 100" className={styles.coinSvg}>
          <path d="M20,70 L30,40 L45,60 L60,30 L80,70 Z" fill="#8B6508" stroke="#4A3600" strokeWidth="2" />
          <path d="M20,70 L80,70 L80,80 L20,80 Z" fill="#6B4423" />
        </svg>
      </div>
    </div>
  </div>
);

const PerfilPage = () => {
  const navigate = useNavigate();
  const { user, userProfile, updateUserProfile } = useAuth();
  const toast = useGlobalToast();
  const { data: allProducts } = useProducts([]);

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [tipoDoc, setTipoDoc] = useState('DNI');
  const [documento, setDocumento] = useState('');
  const [phone, setPhone] = useState('');

  // Avatar config state
  const [avatarConfig, setAvatarConfig] = useState({
    skinTone: '#FFCD94',
    hairStyle: 'short',
    hairColor: '#090806',
    eyeStyle: 'normal',
    mouthStyle: 'smile',
    accessory: 'none',
    weight: 50,
    height: 170,
    activeItemId: 'none'
  });

  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const referralCode = `KS-${(user?.uid || 'USER').substring(0, 6).toUpperCase()}`;
  const kapiSolBalance = userProfile?.monedas || 0;
  const kapiSolEspera = userProfile?.monedasEnEspera || 0;

  const clothingItems = useMemo(() => {
    const baseItems = [{ id: 'none', name: 'Sin Ropa' }];
    if (!allProducts) return baseItems;
    const clothes = allProducts.filter(p => {
      const pName = p.name?.toLowerCase() || '';
      const pCat = p.category?.toLowerCase() || '';
      return pName.includes('polo') || pName.includes('camiseta') || pName.includes('ropa') ||
        pCat.includes('polo') || pCat.includes('ropa');
    });
    return [...baseItems, ...clothes];
  }, [allProducts]);

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.displayName || user?.displayName || '');
      setTipoDoc(userProfile.tipoDocumento || 'DNI');
      setDocumento(userProfile.dni ? String(userProfile.dni).trim() : '');
      setPhone(userProfile.phone ? String(userProfile.phone).replace(/\D/g, '') : '');

      if (userProfile.avatarConfig) {
        setAvatarConfig(prev => ({ ...prev, ...userProfile.avatarConfig }));
      }
    }
  }, [userProfile, user]);

  if (!user || !userProfile) return null;

  const docValid = tipoDoc === 'DNI' ? validateDNI(documento) : validateCE(documento);
  const formValid = docValid && fullName.trim() && validatePhone(phone);

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setError(null);
    if (!formValid) return;
    setLoading(true);
    const updates = {
      displayName: fullName.trim(),
      dni: documento,
      tipoDocumento: tipoDoc,
      phone: phone.replace(/\D/g, '')
    };
    const { error: err } = await updateUserProfile(updates);
    setLoading(false);
    if (err) {
      setError(err);
      toast.error('Error al guardar datos personales');
    } else {
      setEditing(false);
      toast.success('Datos actualizados correctamente');
    }
  };

  const handleSaveAvatar = async () => {
    setIsAvatarSaving(true);
    const { error } = await updateUserProfile({ avatarConfig });
    setIsAvatarSaving(false);
    if (error) {
      toast.error('Ocurrió un error al guardar tu avatar');
    } else {
      toast.success('¡Avatar actualizado increíblemente bien! 😎');
    }
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const email = user.email || userProfile?.email || '';
  const hasCompleteProfile = !!(userProfile?.dni && userProfile?.phone);

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <h1>Mi Perfil</h1>
        <p>Personaliza tus datos, tu avatar y revisa tus recompensas KapiSol.</p>
      </header>

      <div className={styles.grid}>
        {/* Left Column: Wallet + Info */}
        <div className={styles.leftColumn}>

          <div className={styles.walletBanner}>
            <div className={styles.walletTitle}><Icons.Gift /> Recompensas</div>
            <h4 className={styles.walletAmount}>
              <KapiSolCoin /> {kapiSolBalance.toLocaleString()} <span style={{ fontSize: '1.5rem', alignSelf: 'flex-end', paddingBottom: '8px' }}>KS</span>
            </h4>
            {kapiSolEspera > 0 && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#fbbf24', fontWeight: 600 }}>
                + {kapiSolEspera.toLocaleString()} KS en espera ⏳
              </div>
            )}
            <div className={styles.referralBox}>
              <span className={styles.referralCode}>{referralCode}</span>
              <button className={styles.copyBtn} onClick={handleCopyReferral}>
                {copied ? <Icons.Check /> : <Icons.Copy />} {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className={styles.glassCard}>
            <div className={styles.cardHeader}>
              <div className={styles.headerIcon}><Icons.User /></div>
              <h3>Datos Personales</h3>
            </div>

            {editing ? (
              <form onSubmit={handleSaveInfo} className={styles.form}>
                <div className={styles.formGroup}>
                  <label>Nombre completo</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} />
                </div>
                <div className={styles.toggleRow}>
                  <button type="button" className={`${styles.toggle} ${tipoDoc === 'DNI' ? styles.active : ''}`} onClick={() => setTipoDoc('DNI')}>DNI</button>
                  <button type="button" className={`${styles.toggle} ${tipoDoc === 'CE' ? styles.active : ''}`} onClick={() => setTipoDoc('CE')}>CE</button>
                </div>
                <div className={styles.formGroup}>
                  <label>{tipoDoc === 'DNI' ? 'Número de DNI' : 'Número de CE'}</label>
                  <input type="text" value={documento} onChange={(e) => setDocumento(e.target.value.replace(/\s/g, ''))} disabled={loading} maxLength={tipoDoc === 'CE' ? 12 : 8} />
                </div>
                <div className={styles.formGroup}>
                  <label>Teléfono</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))} disabled={loading} />
                </div>
                {error && <div className={styles.errorMessage}>{error}</div>}

                <div className={styles.actionsGroup}>
                  <button type="button" className={styles.btnCancel} onClick={() => setEditing(false)} disabled={loading}>Cancelar</button>
                  <button type="submit" className={styles.btnSave} disabled={!formValid || loading}>{loading ? 'Guardando...' : 'Guardar'}</button>
                </div>
              </form>
            ) : (
              <div>
                <div className={styles.infoRow}><span className={styles.infoLabel}>Nombre</span><span className={styles.infoValue}>{userProfile.displayName || user.displayName || '—'}</span></div>
                <div className={styles.infoRow}><span className={styles.infoLabel}>Email</span><span className={styles.infoValue}>{email || '—'}</span></div>
                <div className={styles.infoRow}><span className={styles.infoLabel}>DNI</span><span className={styles.infoValue}>{userProfile.dni || '—'}</span></div>
                <div className={styles.infoRow}><span className={styles.infoLabel}>Teléfono</span><span className={styles.infoValue}>{userProfile.phone || '—'}</span></div>

                {!hasCompleteProfile && (
                  <div className={styles.errorMessage}>Para ver tus pedidos necesitamos tu DNI y número de teléfono.</div>
                )}
                <div className={styles.actionsGroup}>
                  <button className={styles.btnSave} onClick={() => setEditing(true)}>Editar</button>
                  <button className={styles.btnSecondary} onClick={async () => { await logout(); navigate('/'); }}>Cerrar sesión</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Avatar Configurator */}
        <div className={styles.glassCard}>
          <div className={styles.cardHeader}>
            <div className={styles.headerIcon}><Icons.Shirt /></div>
            <h3>Avatar Studio</h3>
          </div>
          <AvatarStudio
            config={avatarConfig}
            setConfig={setAvatarConfig}
            clothingItems={clothingItems}
            onSave={handleSaveAvatar}
            isSaving={isAvatarSaving}
          />
        </div>
      </div>
    </div>
  );
};

export default PerfilPage;
