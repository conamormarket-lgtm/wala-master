import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getMisCupones, estadoCupon } from '../../services/cupones';
import { recordMissionAction } from '../../services/loyalty';
import { PaginaCupones } from '../../componentes/kit/paginas/CuentaRecompensas';
import usePrimeraCompra from '../../hooks/usePrimeraCompra';
import { cuponDesdeFirestore } from '../../componentes/kit/adaptadores';
import { modoStickers, estadoStickers, agregarStickers } from '../../services/stickersWhatsapp';
import { packStickers, archivoSticker, PLAY_STORE_WALA } from '../../constants/stickersWhatsapp';

const esStickers = (c) => c?.entrega === 'stickers_whatsapp';

/*
 * Mis cupones (/cuenta/cupones), paso 6 de la migración: PaginaCupones del
 * kit. Lo de antes, en pages/cuenta/MisCuponesViejo.jsx (interruptor
 * cuentaVieja).
 *
 * Los cupones (userCoupons del cliente, los más nuevos primero) con su estado
 * (estadoCupon: usado, vencido o disponible); el kit pone los disponibles
 * arriba. Se leen frescos al entrar (un canje recién hecho tiene que estar).
 * Los packs de stickers de WhatsApp van aparte, arriba: en la app de Android
 * se añaden con un toque (services/stickersWhatsapp); en la web, a Google Play.
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
  const queryClient = useQueryClient();
  const cupones = useMemo(() => (consulta.data || []).filter((c) => !esStickers(c)).map((c) => cuponDesdeFirestore(c, estadoCupon(c))), [consulta.data]);

  // Stickers: un pack por canje (si por algo hay dos del mismo, basta uno).
  const modo = modoStickers();
  const packsCanjeados = useMemo(() => {
    const vistos = new Map();
    (consulta.data || []).filter(esStickers).forEach((c) => { if (!vistos.has(c.packId)) vistos.set(c.packId, c); });
    return [...vistos.values()];
  }, [consulta.data]);
  const [enTelefono, setEnTelefono] = useState({});
  const [trabajo, setTrabajo] = useState({});
  useEffect(() => {
    if (modo !== 'app') return;
    packsCanjeados.forEach((c) => {
      estadoStickers(c.packId).then((e) => { if (e) setEnTelefono((x) => ({ ...x, [c.packId]: e.agregado })); });
    });
  }, [modo, packsCanjeados]);
  const stickers = packsCanjeados.map((c) => {
    const pack = packStickers(c.packId);
    return {
      id: c.id,
      nombre: pack?.nombre || c.titulo || c.title || 'Stickers de Walá',
      cantidad: pack?.cantidad || 0,
      muestras: (pack?.muestras || []).map((f) => archivoSticker(c.packId, f)),
      // Sin el pack en esta versión de la app, hay que actualizarla.
      modo: modo === 'app' && !pack ? 'actualizar' : modo,
      agregado: Boolean(enTelefono[c.packId]),
      procesando: trabajo[c.id] === 'procesando',
      error: trabajo[c.id] && trabajo[c.id] !== 'procesando' ? trabajo[c.id] : undefined,
    };
  });
  const agregar = async (id) => {
    const c = packsCanjeados.find((x) => x.id === id);
    if (!c) return;
    setTrabajo((t) => ({ ...t, [id]: 'procesando' }));
    try {
      const r = await agregarStickers({ packId: c.packId, couponId: c.id });
      setTrabajo((t) => ({ ...t, [id]: undefined }));
      if (r.agregado) {
        setEnTelefono((x) => ({ ...x, [c.packId]: true }));
        addToast('¡Listo! Ya están en tu WhatsApp', 'success');
        queryClient.invalidateQueries({ queryKey: ['mis-cupones', uid] });
      }
    } catch (e) {
      setTrabajo((t) => ({ ...t, [id]: e?.message || 'No pudimos abrir WhatsApp. Inténtalo otra vez.' }));
    }
  };

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

  // Semana de bienvenida: monedas y cupones en pausa.
  const { bienvenida } = usePrimeraCompra();
  return (
    <PaginaCupones
      enPausa={Boolean(bienvenida?.enPausa)}
      cupones={cupones}
      stickers={stickers}
      onAgregarStickers={agregar}
      urlPlayStore={PLAY_STORE_WALA}
      cargando={consulta.isPending}
      error={consulta.isError}
      onReintentar={() => consulta.refetch()}
      onCopiar={copiar}
    />
  );
}
