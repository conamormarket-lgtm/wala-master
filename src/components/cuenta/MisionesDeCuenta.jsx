import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { dailyCheckIn, getDailyMissions, completeMission } from '../../services/loyalty';
import { TIERS } from '../../constants/tiers';
import { MISSION_ACTIONS } from '../../constants/missionActions';
import { trackMissionComplete } from '../../services/analytics/tracker';
import { volarMonedasGanadas } from '../../utils/animations';
import { PaginaMisiones } from '../../componentes/kit/paginas/CuentaRecompensas';
import { misionDesdeServidor, nivelesDesdeTiers } from '../../componentes/kit/adaptadores';

/*
 * Misiones diarias (/cuenta/misiones), paso 6 de la migración: PaginaMisiones
 * del kit. Lo de antes, en pages/cuenta/MisionesViejo.jsx (interruptor
 * cuentaVieja).
 *
 * Al entrar: el check-in del día (dailyCheckInSecure, idempotente; si dio
 * monedas, vuelan) y las misiones de hoy van a la vez (antes, una detrás de
 * otra), y después se relee el perfil. Completar: completeMissionSecure, las
 * monedas vuelan, la analítica y se releen misiones y perfil. Los niveles
 * salen de constants/tiers.js.
 */

const NIVELES = nivelesDesdeTiers(TIERS);

// '2026-10-17' → "17 de octubre" (como antes).
const fechaLegible = (iso) => {
  if (!iso) return '';
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
  } catch {
    return iso;
  }
};

export default function MisionesDeCuenta() {
  const { user, userProfile, reloadProfile } = useAuth();
  const [misiones, setMisiones] = useState([]);
  const [fecha, setFecha] = useState(null);
  const [checkIn, setCheckIn] = useState(null); // { streak, reward }
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const releerPerfil = useCallback(async () => {
    if (typeof reloadProfile === 'function') await reloadProfile();
  }, [reloadProfile]);

  const leerMisiones = useCallback(async () => {
    const { error: err, data } = await getDailyMissions();
    if (err) {
      console.error('Error al cargar las misiones diarias:', err);
      setError(true);
      return;
    }
    setError(false);
    setMisiones(data?.items || []);
    setFecha(data?.date || null);
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      setCargando(true);
      const [{ error: errCheck, data: datosCheck }] = await Promise.all([dailyCheckIn(), leerMisiones()]);
      if (activo && !errCheck && datosCheck) {
        setCheckIn(datosCheck);
        volarMonedasGanadas(null, Number(datosCheck.reward) || 0);
      }
      if (activo) setCargando(false);
      await releerPerfil();
    })();
    return () => { activo = false; };
  }, [leerMisiones, releerPerfil]);

  const completar = async (id) => {
    const { error: err, data } = await completeMission(id);
    if (err) {
      console.error('Error al completar la misión:', err);
      throw new Error(err);
    }
    if (data?.reward) volarMonedasGanadas(null, Number(data.reward) || 0);
    const hecha = misiones.find((m) => m.missionId === id);
    trackMissionComplete(
      { missionId: id, missionName: hecha?.title, coins: data?.reward ?? hecha?.rewardPoints },
      { uid: user?.uid, email: user?.email, displayName: user?.displayName },
    ).catch(() => {});
    await Promise.all([leerMisiones(), releerPerfil()]);
    return { recompensa: data?.reward };
  };

  const tarjetas = useMemo(() => misiones.map((m) => misionDesdeServidor(m, MISSION_ACTIONS)), [misiones]);
  const reward = Number(checkIn?.reward) || 0;

  return (
    <PaginaMisiones
      monedas={Number(userProfile?.monedas) || 0}
      xp={Number(userProfile?.xp) || 0}
      niveles={NIVELES}
      racha={{
        // Si el check-in falla, la racha guardada en el perfil.
        dias: checkIn?.streak ?? userProfile?.dailyStreak?.count ?? 0,
        hoy: Boolean(checkIn),
        ganado: reward,
      }}
      misiones={tarjetas}
      fecha={fechaLegible(fecha)}
      cargando={cargando}
      error={error}
      onReintentar={leerMisiones}
      onCompletar={completar}
    />
  );
}
