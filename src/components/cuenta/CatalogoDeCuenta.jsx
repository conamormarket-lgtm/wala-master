import React, { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';
import { getCollection } from '../../services/firebase/firestore';
import { recordMissionAction } from '../../services/loyalty';
import { getMisCupones } from '../../services/cupones';
import { textoPremio } from '../../utils/ruletaModel';
import { PaginaCatalogo } from '../../componentes/kit/paginas/CuentaRecompensas';
import usePrimeraCompra from '../../hooks/usePrimeraCompra';
import { recompensaDesdeFirestore } from '../../componentes/kit/adaptadores';

/*
 * Catálogo de recompensas (/cuenta/catalogo), paso 6 de la migración:
 * PaginaCatalogo del kit. Lo de antes, en pages/cuenta/CatalogRewardViejo.jsx
 * (interruptor cuentaVieja).
 *
 * El catálogo (rewardsCatalog activos, por `order`) queda en caché 5 minutos:
 * antes se volvía a leer en cada visita. Canjear va al servidor
 * (redeemRewardSecure, que descuenta y crea el cupón) y luego se relee el
 * perfil (el saldo de la cabecera) y los cupones.
 */

// Lo que gana el cliente, con el mismo texto que la Ruleta (textoPremio).
const beneficioDe = (r) => {
  if (!r || !r.tipo || r.tipo === 'manual') return '';
  if (r.tipo === 'stickers_whatsapp') return 'Stickers para WhatsApp · se añaden en la app de Walá';
  return textoPremio({
    tipo: r.tipo,
    nombre: r.title,
    descuentoPct: Number(r.descuentoPct) || 0,
    descuentoMonto: Number(r.descuentoMonto) || 0,
    topeDescuento: Number(r.topeDescuento) || 0,
    productName: r.productName,
    brandId: r.brandId,
    marcaNombre: r.marcaNombre,
    monedas: 0,
  });
};

export default function CatalogoDeCuenta() {
  const { user, activeMainCoins, reloadProfile } = useAuth();
  const queryClient = useQueryClient();

  const catalogo = useQuery({
    queryKey: ['recompensas-catalogo'],
    queryFn: async () => {
      const { data, error } = await getCollection(
        'rewardsCatalog',
        [{ field: 'active', operator: '==', value: true }],
        { field: 'order', direction: 'asc' },
      );
      if (error) {
        // El mensaje crudo (p. ej. un índice que falta) es para quien despliega.
        console.error('Error al cargar el catálogo de recompensas:', error);
        throw new Error(error);
      }
      return (data || []).map((r) => recompensaDesdeFirestore(r, beneficioDe(r)));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Las de una sola vez (los packs de stickers y las que el admin marcó «Una
  // vez por persona») que ya canjeó salen como obtenidas, sin canjear. Misma
  // consulta (y caché) que Mis cupones; un canje la renueva.
  const misCupones = useQuery({
    queryKey: ['mis-cupones', user?.uid],
    queryFn: async () => {
      const { data, error } = await getMisCupones(user.uid);
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: Boolean(user?.uid),
  });
  const tuyas = useMemo(() => {
    const packs = new Set();
    const recompensas = new Set();
    (misCupones.data || []).forEach((c) => {
      if (c.entrega === 'stickers_whatsapp' && c.packId) packs.add(c.packId);
      if (c.rewardId) recompensas.add(c.rewardId);
    });
    return { packs, recompensas };
  }, [misCupones.data]);
  const recompensas = useMemo(
    () => (catalogo.data || []).map((r) => {
      const obtenida = r.packId ? tuyas.packs.has(r.packId) : r.unaVez && tuyas.recompensas.has(r.id);
      return obtenida ? { ...r, obtenida: true } : r;
    }),
    [catalogo.data, tuyas],
  );

  // Para Misiones diarias: el cliente entró aquí de verdad (si falla, no avisa).
  useEffect(() => {
    if (user?.uid) recordMissionAction('visit_catalogo_recompensas').catch(() => {});
  }, [user?.uid]);

  const canjear = async (id) => {
    let res;
    try {
      res = await httpsCallable(getFunctions(), 'redeemRewardSecure')({ rewardId: id });
    } catch (e) {
      throw new Error(e?.message || 'No se pudo canjear la recompensa.');
    }
    if (typeof reloadProfile === 'function') await reloadProfile();
    queryClient.invalidateQueries({ queryKey: ['mis-cupones'] });
    return { codigo: res?.data?.coupon?.code };
  };

  // Semana de bienvenida: monedas y cupones en pausa.
  const { bienvenida } = usePrimeraCompra();
  return (
    <PaginaCatalogo
      enPausa={Boolean(bienvenida?.enPausa)}
      recompensas={recompensas}
      saldo={Number(activeMainCoins) || 0}
      cargando={catalogo.isPending}
      error={catalogo.isError}
      onReintentar={() => catalogo.refetch()}
      onCanjear={canjear}
    />
  );
}
