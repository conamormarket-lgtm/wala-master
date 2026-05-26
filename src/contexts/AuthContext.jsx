// eslint-disable-next-line no-unused-vars
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthChange } from '../services/firebase/auth';
// eslint-disable-next-line no-unused-vars
import { getDocument, setDocument } from '../services/firebase/firestore';
import { getAdminRoleByEmail, setAdminRole } from '../services/adminRoles';
import { getStartOfWeek, formatIsoDate } from '../services/firebase/ruleta';
import { LEGACY_USERS_COLLECTION, PORTAL_USERS_COLLECTION } from '../constants/userCollections';
import { doc, onSnapshot } from 'firebase/firestore';
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

        // Fetch admin permissions if user exists
        if (firebaseUser.email) {
          const roleData = await getAdminRoleByEmail(firebaseUser.email);
          // Hardcode de super admins iniciales por si no están en DB
          if (!roleData && (firebaseUser.email === 'yorh001@gmail.com' || firebaseUser.email === 'heyeru24@gmail.com')) {
            const defaultSuperAdmin = { 
              permissions: ['superadmin'] 
            };
            setAdminPermissions(defaultSuperAdmin.permissions);
            // Auto-guardarlos en la db para que ya aparezcan en la configuración
            await setAdminRole(firebaseUser.email, { name: profileData.name || 'Admin', permissions: ['superadmin'] });
          } else {
            setAdminPermissions(roleData ? roleData.permissions || [] : []);
          }
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

  const earnMainCoins = React.useCallback(async (amount, reason = 'Bono') => {
    if (!userProfile) return { error: 'No profile' };
    
    const currentGlobal = userProfile.monedas || 0;
    return await updateUserProfile({
      monedas: currentGlobal + amount
    });
  }, [userProfile, updateUserProfile]);

  const claimMonedas = React.useCallback(async (pedidoId, amount = 10) => {
    if (!userProfile) return { error: 'No profile' };
    const reclamadas = userProfile.monedasReclamadas || [];
    if (reclamadas.includes(pedidoId)) return { error: 'Ya reclamado' };
    
    try {
      const { error } = await earnMainCoins(amount, "pedido_" + pedidoId);
      if (error) throw new Error(error);
      
      const nuevasReclamadas = [...reclamadas, pedidoId];
      await updateUserProfile({
        monedasReclamadas: nuevasReclamadas
      });
      
      return { error: null, data: { success: true } };
    } catch (error) {
      console.error("Error al reclamar monedas:", error);
      return { error: error.message || 'Error al procesar el reclamo' };
    }
  }, [userProfile, earnMainCoins, updateUserProfile]);

  const spendMonedas = React.useCallback(async (amount) => {
    if (!userProfile) return { error: 'No profile' };
    
    let activeCoins = calculateActiveCoins();
    if (activeCoins < amount) return { error: 'Monedas insuficientes' };

    const currentMonedas = userProfile.monedas || 0;
    return await updateUserProfile({
      monedas: Math.max(0, currentMonedas - amount)
    });
  }, [userProfile, calculateActiveCoins, updateUserProfile]);

  const freezeMonedas = React.useCallback(async (amount, pseudoOrderId) => {
    if (!userProfile) return { error: 'No profile' };
    const activeCoins = calculateActiveCoins();
    if (activeCoins < amount) return { error: 'Monedas insuficientes' };
    
    const monedasEnEspera = userProfile.monedasEnEspera || 0;
    const historyEspera = userProfile.historialMonedasEspera || [];
    
    const spendRes = await spendMonedas(amount);
    if (spendRes.error) return spendRes;
    
    return await updateUserProfile({
      monedasEnEspera: monedasEnEspera + amount,
      historialMonedasEspera: [
        ...historyEspera,
        {
          orderId: pseudoOrderId,
          amount: amount,
          status: 'pending',
          date: new Date().toISOString()
        }
      ]
    });
  }, [userProfile, calculateActiveCoins, spendMonedas, updateUserProfile]);

  const processChallengeEvent = React.useCallback(async (actionType, count = 1) => {
    if (!userProfile || !activeWeeklyChallenge) return;
    
    // Si el tipo de evento coincide
    if (activeWeeklyChallenge.actionType === actionType) {
      const challengeId = activeWeeklyChallenge.challengeId;
      const currentProgress = userProfile.weeklyChallengeProgress || {};
      
      // Si ya lo completó o es de otro challenge, reseteamos/ignoramos
      if (currentProgress.challengeId !== challengeId) {
         currentProgress.challengeId = challengeId;
         currentProgress.progress = 0;
         currentProgress.completed = false;
      }
      
      if (currentProgress.completed) return; // Ya lo completó
      
      const newProgress = Math.min((currentProgress.progress || 0) + count, activeWeeklyChallenge.goal);
      const isNowCompleted = newProgress >= activeWeeklyChallenge.goal;
      
      let updates = {
         weeklyChallengeProgress: {
            challengeId,
            progress: newProgress,
            completed: isNowCompleted
         }
      };

      // Si se acaba de completar, acreditamos
      if (isNowCompleted) {
         if (activeWeeklyChallenge.rewardType === 'kapi_double_3d') {
             updates.activeMultiplier = 'kapi_double_3d';
             updates.multiplierExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
         }
         window.dispatchEvent(new CustomEvent('weekly-challenge-completed'));
      }
      
      await updateUserProfile(updates);

      // Si es "main", acreditamos aparte para asegurar consistencia
      if (isNowCompleted && activeWeeklyChallenge.rewardType === 'main') {
          await earnMainCoins(activeWeeklyChallenge.rewardCoins, 'Reto Semanal Completado');
      }
    }
  }, [userProfile, activeWeeklyChallenge, updateUserProfile, earnMainCoins]);

  const feedKapi = React.useCallback(async () => {
    if (!userProfile) return { error: 'No profile' };
    
    const _d2 = new Date();
    const todayStr = `${_d2.getFullYear()}-${String(_d2.getMonth()+1).padStart(2, '0')}-${String(_d2.getDate()).padStart(2, '0')}`;
    if (userProfile.lastKapiClaimDate === todayStr) {
      return { error: 'Ya alimentaste a Kapi hoy' };
    }
    
    const currentKapiCoins = userProfile.kapiCoins || 0;
    if (currentKapiCoins >= 31) {
      return { error: 'Límite de Kapi Coins mensual alcanzado' };
    }

    const currentHappiness = userProfile.kapiHappiness || 0;

    // Calcular racha semanal para la ruleta
    const currentWeekStart = formatIsoDate(getStartOfWeek());
    let weeklyData = userProfile.weeklyClaimsData || { weekStart: currentWeekStart, daysClaimed: [] };
    
    if (weeklyData.weekStart !== currentWeekStart) {
      // Nueva semana
      weeklyData = { weekStart: currentWeekStart, daysClaimed: [todayStr] };
    } else {
      // Misma semana
      if (!weeklyData.daysClaimed.includes(todayStr)) {
        weeklyData.daysClaimed.push(todayStr);
      }
    }

    let coinsToAdd = 1;
    if (userProfile.activeMultiplier === 'kapi_double_3d') {
      if (userProfile.multiplierExpiresAt && new Date(userProfile.multiplierExpiresAt) > new Date()) {
         coinsToAdd = 2;
      }
    }

    return await updateUserProfile({
      kapiCoins: currentKapiCoins + coinsToAdd,
      lastKapiClaimDate: todayStr,
      kapiHappiness: Math.min(100, currentHappiness + 10),
      weeklyClaimsData: weeklyData
    });
  }, [userProfile, updateUserProfile]);

  const validateDatesStreak = React.useCallback(async (completedOrders) => {
    if (!userProfile) return { error: 'No profile' };
    
    // CompletedOrders should be an array of orders. 
    // We check how many unique special dates this user has covered.
    const coveredDates = completedOrders
      .filter(o => o.fechaEspecial || o.motivoRegalo)
      .map(o => o.fechaEspecial || o.motivoRegalo);
      
    const uniqueDates = [...new Set(coveredDates)];
    const hasReceivedBonus = userProfile.streakBonusReceived === true;
    
    // Streak: 3 fechas cubiertas = 25 bonus permanente
    if (uniqueDates.length >= 3 && !hasReceivedBonus) {
      await earnMainCoins(25, 'Streak 3 fechas cubiertas');
      return await updateUserProfile({ streakBonusReceived: true });
    }
    
    return { status: 'no_action' };
  }, [userProfile, earnMainCoins, updateUserProfile]);

  const profileIncomplete = !!user && !!userProfile && (!userProfile.dni || !userProfile.phone);

  const isLegacyAdmin = userProfile?.role === 'admin' || user?.email === 'yorh001@gmail.com' || user?.email === 'heyeru24@gmail.com' || localStorage.getItem('adminWalaPro') === 'true';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const effectiveAdminPermissions = (adminPermissions && adminPermissions.length > 0) ? adminPermissions : (isLegacyAdmin ? ['superadmin'] : []);
  
  const isAdmin = isLegacyAdmin || effectiveAdminPermissions.length > 0;

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
    earnMainCoins,
    feedKapi,
    validateDatesStreak,
    processChallengeEvent,
    activeWeeklyChallenge,
    activeMainCoins: calculateActiveCoins(),
    isAuthenticated: !!user,
    isAdmin,
    profileIncomplete,
  }), [user, userProfile, effectiveAdminPermissions, loading, updateUserProfile, linkDNI, claimMonedas, spendMonedas, freezeMonedas, earnMainCoins, feedKapi, validateDatesStreak, processChallengeEvent, activeWeeklyChallenge, calculateActiveCoins, profileIncomplete, isAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
