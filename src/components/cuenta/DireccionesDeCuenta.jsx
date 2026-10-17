import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { obtenerDirecciones, guardarDirecciones, MAX_DIRECCIONES } from '../../services/direcciones';
import { COUNTRIES } from '../../constants/countries';
import { DEPARTAMENTOS, getProvincias } from '../../constants/peruUbigeo';
import { lugarLegible, distritosSugeridos, distritoDeLista, esExtranjero } from '../../utils/ubicacionErp';
import { PaginaDirecciones } from '../../componentes/kit/paginas/Cuenta';
import { direccionDesdeFirestore, direccionAFirestore } from '../../componentes/kit/adaptadores';
import { tipoDocumentoPara } from '../../componentes/kit/piezas/DatosPersonales';

/*
 * Mis direcciones (/cuenta/direcciones), paso 6 de la migración:
 * PaginaDirecciones del kit. Lo de antes, en pages/cuenta/MisDireccionesViejo.jsx
 * (interruptor cuentaVieja).
 *
 * La libreta es wala_direcciones/{uid} (services/direcciones: una sola
 * principal, hasta 10). Se guarda la lista entera, así que si la lectura falla
 * no se deja agregar (antes quedaba vacía y guardar borraba las demás).
 */

const PAISES = COUNTRIES.map((c) => ({ valor: c.code, texto: c.name, prefijo: c.dialCode }));

// Los lugares de la tienda (ubigeo) con los nombres de campo del kit.
const LUGARES = {
  departamentos: DEPARTAMENTOS,
  provincias: getProvincias,
  distritos: (d) => distritosSugeridos(direccionAFirestore(d)),
  legible: (d) => lugarLegible(direccionAFirestore(d)),
};

/** Una dirección guardada para el kit, con el distrito como está en la lista ("Rimac" → "Rímac"). */
const paraElKit = (d) => {
  const k = direccionDesdeFirestore(d);
  if (esExtranjero(d.country)) return k;
  return { ...k, distrito: distritoDeLista(d, d.district) || k.distrito };
};

export default function DireccionesDeCuenta() {
  const { user, userProfile } = useAuth();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const uid = user?.uid;
  const [ocupada, setOcupada] = useState(false);

  const consulta = useQuery({
    queryKey: ['direcciones', uid],
    queryFn: () => obtenerDirecciones(uid),
    enabled: Boolean(uid),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  });
  const lista = consulta.data;
  const direcciones = useMemo(() => (lista || []).map(paraElKit), [lista]);

  // Guarda la libreta entera (el servicio deja una sola principal).
  const persistir = async (nueva, mensaje) => {
    setOcupada(true);
    try {
      queryClient.setQueryData(['direcciones', uid], await guardarDirecciones(uid, nueva));
      if (mensaje) toast.success(mensaje);
    } finally {
      setOcupada(false);
    }
  };

  const guardar = async (form) => {
    if (!lista) throw new Error('No pudimos leer tus direcciones. Recarga la página.');
    const datos = direccionAFirestore(form);
    const nueva = form.id
      ? lista.map((d) => (d.id === form.id ? { ...d, ...datos, id: d.id, principal: d.principal } : d))
      : [...lista, { ...datos, id: undefined, principal: lista.length === 0 }];
    try {
      await persistir(nueva, 'Dirección guardada.');
    } catch {
      throw new Error('No se pudo guardar. Inténtalo de nuevo.');
    }
  };

  const accion = (nueva, mensaje) => persistir(nueva, mensaje).catch(() => toast.error('No se pudo guardar. Inténtalo de nuevo.'));

  const pais = userProfile?.country || 'PE';
  const perfil = {
    nombre: userProfile?.displayName || user?.displayName || '',
    tipoDocumento: tipoDocumentoPara(pais, userProfile?.docType || userProfile?.tipoDocumento),
    documento: userProfile?.dni || '',
    telefono: pais === 'PE' ? String(userProfile?.phone || '').replace(/\D/g, '') : String(userProfile?.phoneIntl?.localNumber ?? userProfile?.phone ?? ''),
    pais,
  };

  return (
    <PaginaDirecciones
      direcciones={direcciones}
      cargando={consulta.isPending}
      error={consulta.isError}
      onReintentar={() => consulta.refetch()}
      maximo={MAX_DIRECCIONES}
      lugares={LUGARES}
      paises={PAISES}
      perfil={perfil}
      ocupada={ocupada}
      onGuardar={guardar}
      onPrincipal={(id) => accion(lista.map((d) => ({ ...d, principal: d.id === id })), 'Dirección principal actualizada.')}
      // Si se borra la principal, la primera que quede pasa a serlo (lo hace el servicio).
      onEliminar={(id) => accion(lista.filter((d) => d.id !== id), 'Dirección eliminada.')}
    />
  );
}
