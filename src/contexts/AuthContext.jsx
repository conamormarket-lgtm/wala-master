import React, { createContext, useContext, useState, useEffect, startTransition } from 'react';
import { onAuthChange } from '../services/firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDocument, updateDocument, setDocument } from '../services/firebase/firestore';
import { getAdminRoleByEmail, setAdminRole } from '../services/adminRoles';
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

  const claimMonedas = React.useCallback(async (pedidoId, amount = 10) => {
    if (!userProfile) return { error: 'No profile' };
    const reclamadas = userProfile.monedasReclamadas || [];
    if (reclamadas.includes(pedidoId)) return { error: 'Ya reclamado' };
    
    try {
      const currentMonedas = userProfile.monedas || 0;
      const nuevasMonedas = currentMonedas + amount;
      const nuevasReclamadas = [...reclamadas, pedidoId];
      
      const { error } = await updateUserProfile({
        monedas: nuevasMonedas,
        monedasReclamadas: nuevasReclamadas
      });
      
      if (error) throw new Error(error);
      
      return { error: null, data: { success: true, nuevasMonedas } };
    } catch (error) {
      console.error("Error al reclamar monedas:", error);
      return { error: error.message || 'Error al procesar el reclamo' };
    }
  }, [userProfile, updateUserProfile]);

  const spendMonedas = React.useCallback(async (amount) => {
    if (!userProfile) return { error: 'No profile' };
    const currentMonedas = userProfile.monedas || 0;
    if (currentMonedas < amount) return { error: 'Monedas insuficientes' };

    return await updateUserProfile({
      monedas: currentMonedas - amount
    });
  }, [userProfile, updateUserProfile]);

  const freezeMonedas = React.useCallback(async (amount, pseudoOrderId) => {
    if (!userProfile) return { error: 'No profile' };
    const currentMonedas = userProfile.monedas || 0;
    if (currentMonedas < amount) return { error: 'Monedas insuficientes' };
    
    const monedasEnEspera = userProfile.monedasEnEspera || 0;
    const historyEspera = userProfile.historialMonedasEspera || [];
    
    return await updateUserProfile({
      monedas: currentMonedas - amount,
      monedasEnEspera: monedasEnEspera + amount,
      historialMonedasEspera: [
        ...historyEspera,
        {
          orderId: pseudoOrderId,
          amount: amount,
          status: 'pending', // pueden ser: pending, claimed (aprobado), refunded (devuelto)
          date: new Date().toISOString()
        }
      ]
    });
  }, [userProfile, updateUserProfile]);

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
    isAuthenticated: !!user,
    isAdmin,
    profileIncomplete,
  }), [user, userProfile, effectiveAdminPermissions, loading, updateUserProfile, linkDNI, claimMonedas, spendMonedas, freezeMonedas, profileIncomplete, isAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
