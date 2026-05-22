import React, { createContext, useContext, useState, useEffect, startTransition } from 'react';
import { onAuthChange } from '../services/firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDocument, updateDocument, setDocument } from '../services/firebase/firestore';
import { getAdminRoleByEmail, setAdminRole } from '../services/adminRoles';
import { getStartOfWeek, formatIsoDate } from '../services/firebase/ruleta';
import { LEGACY_USERS_COLLECTION, PORTAL_USERS_COLLECTION } from '../constants/userCollections';

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
    if (!userProfile || !userProfile.monedasActivas) return userProfile?.monedas || 0;
    const now = new Date().toISOString();
    return userProfile.monedasActivas.reduce((acc, batch) => {
      if (batch.expiresAt > now) return acc + batch.amount;
      return acc;
    }, 0);
  }, [userProfile]);

  // Migración automática de monedas antiguas
  React.useEffect(() => {
    if (userProfile && userProfile.monedas > 0 && !userProfile.legacyCoinsMigrated) {
      const migrateCoins = async () => {
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + 31); // TTL de 31 días para las antiguas
        
        const legacyBatch = {
          amount: userProfile.monedas,
          expiresAt: expDate.toISOString(),
          reason: 'Migración de monedas antiguas (TTL 31 días)'
        };
        
        try {
          await updateUserProfile({
            legacyCoinsMigrated: true,
            monedasActivas: [...(userProfile.monedasActivas || []), legacyBatch]
          });
        } catch (err) {
          console.error("Error migrating legacy coins:", err);
        }
      };
      
      migrateCoins();
    }
  }, [userProfile, updateUserProfile]);

  const earnMainCoins = React.useCallback(async (amount, reason = 'Bono', ttlDays = 90) => {
    if (!userProfile) return { error: 'No profile' };
    
    const now = new Date();
    const expirationDate = new Date(now);
    expirationDate.setDate(expirationDate.getDate() + ttlDays);
    expirationDate.setHours(23, 59, 59, 999);
    const expiresAtIso = expirationDate.toISOString();

    let monedasActivas = [...(userProfile.monedasActivas || [])];
    const existingBatchIndex = monedasActivas.findIndex(b => b.expiresAt === expiresAtIso);
    
    if (existingBatchIndex >= 0) {
      monedasActivas[existingBatchIndex] = {
        ...monedasActivas[existingBatchIndex],
        amount: monedasActivas[existingBatchIndex].amount + amount
      };
    } else {
      monedasActivas.push({
        amount,
        expiresAt: expiresAtIso,
        reason,
        createdAt: now.toISOString()
      });
    }

    const currentGlobal = userProfile.monedas || 0;
    return await updateUserProfile({
      monedas: currentGlobal + amount,
      monedasActivas
    });
  }, [userProfile, updateUserProfile]);

  const claimMonedas = React.useCallback(async (pedidoId, amount = 10) => {
    if (!userProfile) return { error: 'No profile' };
    const reclamadas = userProfile.monedasReclamadas || [];
    if (reclamadas.includes(pedidoId)) return { error: 'Ya reclamado' };
    
    try {
      const { error } = await earnMainCoins(amount, "pedido_" + pedidoId, 90);
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

    let remainingToSpend = amount;
    const now = new Date().toISOString();
    
    // Clonar y filtrar solo los que no han expirado, ordenados por fecha de expiración (FIFO)
    let monedasActivas = [...(userProfile.monedasActivas || [])];
    
    // Ordenar: los que expiran antes van primero
    monedasActivas.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

    for (let i = 0; i < monedasActivas.length; i++) {
      let batch = monedasActivas[i];
      if (batch.expiresAt > now && batch.amount > 0) {
        if (batch.amount >= remainingToSpend) {
          monedasActivas[i] = { ...batch, amount: batch.amount - remainingToSpend };
          remainingToSpend = 0;
          break;
        } else {
          remainingToSpend -= batch.amount;
          monedasActivas[i] = { ...batch, amount: 0 };
        }
      }
    }

    // Filtrar los que quedaron en 0 o expiraron para limpiar la DB (opcional, pero buena práctica)
    monedasActivas = monedasActivas.filter(b => b.amount > 0 && b.expiresAt > now);

    const currentMonedas = userProfile.monedas || 0;
    return await updateUserProfile({
      monedas: Math.max(0, currentMonedas - amount),
      monedasActivas
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

  const feedKapi = React.useCallback(async () => {
    if (!userProfile) return { error: 'No profile' };
    
    const todayStr = new Date().toISOString().split('T')[0];
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

    return await updateUserProfile({
      kapiCoins: currentKapiCoins + 1,
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
    
    // Streak: 3 fechas cubiertas = 25 bonus 90 días
    if (uniqueDates.length >= 3 && !hasReceivedBonus) {
      await earnMainCoins(25, 'Streak 3 fechas cubiertas', 90);
      return await updateUserProfile({ streakBonusReceived: true });
    }
    
    return { status: 'no_action' };
  }, [userProfile, earnMainCoins, updateUserProfile]);

  const profileIncomplete = !!user && !!userProfile && (!userProfile.dni || !userProfile.phone);

  const isLegacyAdmin = userProfile?.role === 'admin' || user?.email === 'yorh001@gmail.com' || user?.email === 'heyeru24@gmail.com' || localStorage.getItem('adminWalaPro') === 'true';
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
    activeMainCoins: calculateActiveCoins(),
    isAuthenticated: !!user,
    isAdmin,
    profileIncomplete,
  }), [user, userProfile, effectiveAdminPermissions, loading, updateUserProfile, linkDNI, claimMonedas, spendMonedas, freezeMonedas, earnMainCoins, feedKapi, validateDatesStreak, calculateActiveCoins, profileIncomplete, isAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
