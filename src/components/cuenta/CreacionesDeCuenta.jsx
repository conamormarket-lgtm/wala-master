import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getDesignsByUser } from '../../services/designs';
import { agruparCombos, recuperarVersion, diasParaBorrar, DIAS_VERSION_REEMPLAZADA } from '../../services/misCombos';
import { toThumbnailImageUrl } from '../../utils/imageUrl';
import { useProductThumbnailVariant } from '../../hooks/useProductThumbnailVariant';
import { useBorradoresCrear } from '../../pages/Crear/useBorradoresCrear';
import useTarjetasCreaciones from './useTarjetasCreaciones';
import { useVersionesReemplazadas } from '../../pages/Crear/useVersionesReemplazadas';
import ComboProductImage from '../../pages/Tienda/components/ComboProductImage/ComboProductImage';
import { DomOverlay } from '../../pages/Tienda/components/ComboProductImage/ComboProductImageWithDesign';
import OptimizedImage from '../common/OptimizedImage/OptimizedImage';
import { PaginaCreaciones } from '../../componentes/kit/paginas/CuentaPersonalizacion';
import { fechaDeDiseno } from '../../componentes/kit/adaptadores';
import s from './CreacionesDeCuenta.module.css';

/*
 * Mis creaciones (/cuenta/creaciones), paso 6 de la migración:
 * PaginaCreaciones del kit. Lo de antes, en pages/cuenta/MisCreacionesViejo.jsx
 * (interruptor cuentaVieja).
 *
 * Lo mismo de antes: las creaciones de la cuenta (cada combo, una tarjeta),
 * los borradores, las versiones anteriores de los combos (con su borrado a
 * los días), renombrar, eliminar, la comunidad (admins) y "Llevar en combo".
 * "Comprado" sale de la marca del diseño (`enPedido`, la pone el checkout):
 * ya no se piden todos los pedidos solo para eso. Las creaciones quedan en
 * caché (al volver se ven al instante y se refrescan).
 */

/** La foto de un diseño del editor de antes: el producto con sus capas, como antes. */
function FotoLegado({ design, producto, apagado }) {
  const { thumbnailImageUrl } = useProductThumbnailVariant(producto);
  const esCombo = producto?.isComboProduct || producto?.comboItems?.length > 0;
  const base = thumbnailImageUrl || producto?.mainImage || producto?.images?.[0] || '';
  const capas = (design.layersByView && Object.values(design.layersByView).find((l) => Array.isArray(l) && l.length > 0))
    || (Array.isArray(design.layers) ? design.layers : []);
  return (
    <div className={[s.legado, apagado && s.legadoApagado].filter(Boolean).join(' ')}>
      {esCombo ? (
        <ComboProductImage
          comboProduct={{
            ...producto,
            comboItemCustomization: design.isUserComboDesign && design.comboItemCustomization ? design.comboItemCustomization : producto.comboItemCustomization,
          }}
          variantSelections={{}}
          isThumbnail
          className={s.legadoImagen}
        />
      ) : capas.length > 0 ? (
        <DomOverlay baseImageUrl={base} layers={capas} />
      ) : (
        <OptimizedImage src={toThumbnailImageUrl(base)} alt="" objectFit="contain" className={s.legadoImagen} showSkeleton={false} />
      )}
    </div>
  );
}

export default function CreacionesDeCuenta() {
  const { user } = useAuth();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const uid = user?.uid;
  // El estudio y el combo vuelven aquí con su flecha.
  const estadoEditar = useMemo(() => ({ desde: pathname }), [pathname]);

  const claveCreaciones = ['mis-creaciones-cuenta', uid];
  const creacionesQ = useQuery({
    queryKey: claveCreaciones,
    enabled: Boolean(uid),
    // Al volver se ven las de la caché y se piden de nuevo (un diseño recién guardado).
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await getDesignsByUser(uid);
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
  });
  const designs = useMemo(() => creacionesQ.data || [], [creacionesQ.data]);
  const borradoresQ = useBorradoresCrear(uid);
  const borradores = useMemo(() => borradoresQ.data || [], [borradoresQ.data]);

  // Cada combo es UNA tarjeta: sus prendas no se repiten sueltas.
  const tarjetas = useMemo(() => agruparCombos(designs, borradores)
    .sort((a, b) => (fechaDeDiseno(b) || 0) - (fechaDeDiseno(a) || 0)), [designs, borradores]);
  const tarjetasBorrador = useMemo(() => agruparCombos(borradores, designs), [borradores, designs]);

  // Las tarjetas y sus acciones: las mismas de Crear (useTarjetasCreaciones).
  const { tarjetaDe, eliminar, renombrar, comunidadPara, buscar, cambiarEnAmbas: cambiarAmbas, eliminarDiseno } = useTarjetasCreaciones({
    uid, designs, borradores, claveCreaciones, estadoEditar, FotoLegado,
  });

  /* ── Versiones anteriores de los combos ── */

  // Mismo cuidado que antes: con las dos listas cargadas y al día (con una a
  // medias, una prenda en uso podría parecer reemplazada).
  const versiones = useVersionesReemplazadas({
    uid,
    creaciones: designs,
    borradores,
    listo: creacionesQ.isSuccess && !creacionesQ.isFetching && borradoresQ.isSuccess && !borradoresQ.isFetching,
    alBorrar: (ids) => cambiarAmbas((lista) => lista.filter((x) => !ids.includes(x.id))),
  });
  const recuperar = async (id) => {
    const { error } = await recuperarVersion(id);
    if (error) {
      toast.error('No pudimos recuperar el diseño. Inténtalo de nuevo.');
      return;
    }
    cambiarAmbas((lista) => lista.map((x) => (x.id === id ? { ...x, combo: null, reemplazadaEn: null } : x)));
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    toast.success('Diseño recuperado: ya está en tus creaciones.');
  };
  const eliminarVersion = async (id) => {
    const d = buscar(id);
    if (d && await eliminarDiseno(d, { enPedido: d.enPedido === true })) {
      cambiarAmbas((lista) => lista.filter((x) => x.id !== id));
    }
  };

  return (
    <PaginaCreaciones
      creaciones={tarjetas.map(tarjetaDe)}
      borradores={tarjetasBorrador.map(tarjetaDe)}
      cargando={!uid || creacionesQ.isLoading}
      error={creacionesQ.isError}
      onReintentar={() => creacionesQ.refetch()}
      onEliminar={eliminar}
      onRenombrar={renombrar}
      comunidadPara={comunidadPara}
      versiones={versiones.map((d) => ({
        id: d.id,
        nombre: d.name || 'Mi diseño',
        imagen: d.vistasPrevias?.[0]?.url || d.previewUrl || '',
        combo: d.combo?.nombre,
        dias: diasParaBorrar(d),
        enPedido: d.enPedido === true,
      }))}
      diasVersion={DIAS_VERSION_REEMPLAZADA}
      onRecuperarVersion={recuperar}
      onEliminarVersion={eliminarVersion}
    />
  );
}
