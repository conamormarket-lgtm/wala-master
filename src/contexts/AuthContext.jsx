// eslint-disable-next-line no-unused-vars
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthChange } from '../services/firebase/auth';
// eslint-disable-next-line no-unused-vars
import { getDocument, setDocument } from '../services/firebase/firestore';
import { getAdminRoleByEmail } from '../services/adminRoles';
import { LEGACY_USERS_COLLECTION, PORTAL_USERS_COLLECTION } from '../constants/userCollections';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../services/firebase/config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [adminPermissions, setAdminPermissions] = useState(null);
  const [isAdminClaim, setIsAdminClaim] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeWeeklyChallenge, setActiveWeeklyChallenge] = useState(null);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'globals', 'activeChallenge'), (snapshot) => {
      if (snapshot.exists()) {
        setActiveWeeklyChallenge(snapshot.data());
      } else {
        setActiveWeeklyChallenge(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // Rol admin desde custom claims de Firebase Auth (fuente de verdad).
        // Nunca desde localStorage ni emails hardcodeados (ver FASE-0-SEGURIDAD.md, H-01/H-09).
        try {
          const tokenResult = await firebaseUser.getIdTokenResult();
          setIsAdminClaim(tokenResult.claims?.admin === true);
        } catch (e) {
          setIsAdminClaim(false);
        }

        const { data: portalDoc } = await getDocument(PORTAL_USERS_COLLECTION, firebaseUser.uid);
        
        let profileData = null;
        if (portalDoc) {
          profileData = portalDoc;
        } else {
          // Intentar obtener de legacy users si no existe en portal
          const { data: legacyDoc } = await getDocument(LEGACY_USERS_COLLECTION, firebaseUser.uid);
          profileData = legacyDoc || {
            email: firebaseUser.email,
            role: 'client'
          };
        }

        // Generar referralCode si no tiene
        if (!profileData.referralCode) {
          const newCode = 'KS-' + Math.random().toString(36).substring(2, 8).toUpperCase();
          profileData.referralCode = newCode;
          // Guardar en Firestore asíncronamente
          setDocument(PORTAL_USERS_COLLECTION, firebaseUser.uid, { referralCode: newCode });
        }

        // Permisos admin desde adminRoles (RBAC por email). El bootstrap por email
        // hardcodeado fue eliminado (H-01); conceder admin se hace con custom claims
        // vía la Cloud Function setAdminClaim / el script scripts/set-admin-claims.js.
        if (firebaseUser.email) {
          const roleData = await getAdminRoleByEmail(firebaseUser.email);
          setAdminPermissions(roleData ? roleData.permissions || [] : []);
        }

        // Update lastAppOpen if not updated today
        const _d1 = new Date();
        const todayStr = `${_d1.getFullYear()}-${String(_d1.getMonth()+1).padStart(2, '0')}-${String(_d1.getDate()).padStart(2, '0')}`;
        if (profileData.lastAppOpen !== todayStr) {
          profileData.lastAppOpen = todayStr;
          setDocument(PORTAL_USERS_COLLECTION, firebaseUser.uid, { lastAppOpen: todayStr });
        }

        setUserProfile(profileData);
      } else {
        setUser(null);
        setUserProfile(null);
        setAdminPermissions(null);
        setIsAdminClaim(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateUserProfile = React.useCallback(async (updates) => {
    if (!user) return { error: 'Usuario no autenticado' };

    const { error } = await setDocument(PORTAL_USERS_COLLECTION, user.uid, updates);
    if (error && error.includes('Firebase no está configurado')) {
      // En modo desarrollo, actualizar solo localmente
      setUserProfile(prev => ({ ...prev, ...updates }));
      return { error: null };
    }
    if (!error) {
      setUserProfile(prev => ({ ...prev, ...updates }));
    }
    return { error };
  }, [user]);

  const linkDNI = React.useCallback(async (dni, phone) => {
    return await updateUserProfile({ dni, phone });
  }, [updateUserProfile]);

  const calculateActiveCoins = React.useCallback(() => {
    // Las monedas son permanentes ahora
    return userProfile?.monedas || 0;
  }, [userProfile]);

  // ── Economía SERVER-AUTHORITATIVE (Fase 0, H-06) ────────────────────
  // El cliente nunca escribe campos de saldo; invoca Cloud Functions callable.
  const callFn = React.useCallback(async (name, payload = {}) => {
    try {
      const res = await httpsCallable(getFunctions(), name)(payload);
      return { error: null, data: res.data };
    } catch (e) {
      return { error: e?.message || 'Error en el servidor' };
    }
  }, []);

  // Recarga el perfil tras una mutación server-side (saldos, rachas, etc.).
  const reloadProfile = React.useCallback(async () => {
    if (!user) return;
    const { data } = await getDocument(PORTAL_USERS_COLLECTION, user.uid);
    if (data) setUserProfile(data);
  }, [user]);

  const claimMonedas = React.useCallback(async (pedidoId) => {
    const res = await callFn('secureClaimMonedas', { pedidoId });
    if (!res.error) await reloadProfile();
    return res;
  }, [callFn, reloadProfile]);

  const spendMonedas = React.useCallback(async (amount) => {
    const res = await callFn('spendCoinsSecure', { amount });
    if (!res.error) await reloadProfile();
    return res;
  }, [callFn, reloadProfile]);

  const freezeMonedas = React.useCallback(async (amount, orderId) => {
    const res = await callFn('freezeCoinsSecure', { amount, orderId });
    if (!res.error) await reloadProfile();
    return res;
  }, [callFn, reloadProfile]);

  const feedKapi = React.useCallback(async () => {
    const res = await callFn('feedKapiSecure');
    if (!res.error) await reloadProfile();
    return res;
  }, [callFn, reloadProfile]);

  const processChallengeEvent = React.useCallback(async (actionType, count = 1) => {
    if (!activeWeeklyChallenge) return { error: null };
    const res = await callFn('recordChallengeEventSecure', { actionType, count });
    if (!res.error) await reloadProfile();
    return res;
  }, [callFn, reloadProfile, activeWeeklyChallenge]);

  const grantSurveyReward = React.useCallback(async (coins) => {
    const res = await callFn('grantSurveyRewardSecure', { coins });
    if (!res.error) await reloadProfile();
    return res;
  }, [callFn, reloadProfile]);

  const validateDatesStreak = React.useCallback(async (completedOrders) => {
    const covered = (completedOrders || [])
      .filter((o) => o.fechaEspecial || o.motivoRegalo)
      .map((o) => o.fechaEspecial || o.motivoRegalo);
    const uniqueDates = [...new Set(covered)].length;
    const res = await callFn('claimDatesStreakSecure', { uniqueDates });
    if (!res.error) await reloadProfile();
    return res;
  }, [callFn, reloadProfile]);

  const profileIncomplete = !!user && !!userProfile && (!userProfile.dni || !userProfile.phone);

  // Admin = custom claim (fuente de verdad) o permisos en adminRoles (RBAC).
  // Sin localStorage ni emails hardcodeados (eliminados en Fase 0, H-01/H-09).
  const effectiveAdminPermissions = (adminPermissions && adminPermissions.length > 0)
    ? adminPermissions
    : (isAdminClaim ? ['superadmin'] : []);

  const isAdmin = isAdminClaim || effectiveAdminPermissions.length > 0;

  const value = React.useMemo(() => ({
    user,
    userProfile,
    adminPermissions: effectiveAdminPermissions,
    loading,
    updateUserProfile,
    linkDNI,
    claimMonedas,
    spendMonedas,
    freezeMonedas,
    grantSurveyReward,
    feedKapi,
    validateDatesStreak,
    processChallengeEvent,
    reloadProfile,
    activeWeeklyChallenge,
    activeMainCoins: calculateActiveCoins(),
    isAuthenticated: !!user,
    isAdmin,
    profileIncomplete,
  }), [user, userProfile, effectiveAdminPermissions, loading, updateUserProfile, linkDNI, claimMonedas, spendMonedas, freezeMonedas, grantSurveyReward, feedKapi, validateDatesStreak, processChallengeEvent, reloadProfile, activeWeeklyChallenge, calculateActiveCoins, profileIncomplete, isAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
