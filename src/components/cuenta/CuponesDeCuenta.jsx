import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getMisCupones, estadoCupon } from '../../services/cupones';
import { recordMissionAction } from '../../services/loyalty';
import { PaginaCupones } from '../../componentes/kit/paginas/CuentaRecompensas';
import { cuponDesdeFirestore } from '../../componentes/kit/adaptadores';

/*
 * Mis cupones (/cuenta/cupones), paso 6 de la migración: PaginaCupones del
 * kit. Lo de antes, en pages/cuenta/MisCuponesViejo.jsx (interruptor
 * cuentaVieja).
 *
 * Los cupones (userCoupons del cliente, los más nuevos primero) con su estado
 * (estadoCupon: usado, vencido o disponible); el kit pone los disponibles
 * arriba. Se leen frescos al entrar (un canje recién hecho tiene que estar).
 */
export default function CuponesDeCuenta() {
  const { user } = useAuth();
  const { addToast } = useGlobalToast();
  const uid = user?.uid;

  const consulta = useQuery({
    queryKey: ['mis-cupones', uid],
    queryFn: async () => {
      const { data, error } = await getMisCupones(uid);
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: Boolean(uid),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const cupones = useMemo(() => (consulta.data || []).map((c) => cuponDesdeFirestore(c, estadoCupon(c))), [consulta.data]);

  // Para Misiones diarias: el cliente entró aquí de verdad (si falla, no avisa).
  useEffect(() => {
    if (uid) recordMissionAction('visit_mis_cupones').catch(() => {});
  }, [uid]);

  const copiar = async (codigo) => {
    try {
      await navigator.clipboard.writeText(codigo);
    } catch (e) {
      addToast('No pudimos copiar el código', 'error');
      throw e;
    }
  };

  return (
    <PaginaCupones
      cupones={cupones}
      cargando={consulta.isPending}
      error={consulta.isError}
      onReintentar={() => consulta.refetch()}
      onCopiar={copiar}
    />
  );
}
