import React, { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getPrendasBase } from '../../services/prendasBase';
import { getCombosCrear } from '../../services/combosCrear';
import { getDesignsByUser } from '../../services/designs';
import { esMiCombo, agruparCombos } from '../../services/misCombos';
import { useBorradoresCrear } from '../../pages/Crear/useBorradoresCrear';
import { useComunidad } from '../../pages/Comunidad/useComunidad';
import { useVersionesReemplazadas } from '../../pages/Crear/useVersionesReemplazadas';
import useTarjetasCreaciones from '../cuenta/useTarjetasCreaciones';
import { PaginaCrear } from '../../componentes/kit/paginas/Crear';
import { fechaDeDiseno } from '../../componentes/kit/adaptadores';
import { prendaCrearDesdeProducto, comboCrearDesde, disenoComunidadDesde } from '../../componentes/kit/adaptadoresCrear';

/*
 * Crear (/personalizar) con el kit (paso 6, CREAR.md): PaginaCrear. La misma
 * lógica que PersonalizarPage:
 *  - las prendas base (el admin ve también las de borrador) y los combos
 *    cuyas prendas están a la venta; "¿Para cuántos?" en la dirección
 *    (?para=2, con replace)
 *  - tus borradores, tus creaciones (cada combo una tarjeta, las 8 más
 *    recientes, "Ver todas (N)") y la comunidad (8, "Ver todos (N)"); se
 *    vuelven a leer al volver del estudio
 *  - las versiones anteriores de los combos se marcan y se borran a los días
 *    (useVersionesReemplazadas)
 *  - "Armar" empieza un combo limpio (?nuevo=1); "Usar diseño" abre el
 *    estudio con la plantilla
 * Las tarjetas de tus creaciones son las de Mis creaciones, con lo mismo:
 * eliminar, renombrar, la comunidad (admins) y "Llevar en combo"
 * (useTarjetasCreaciones).
 * Diferente: el producto de cada creación se lee con la misma caché que la
 * ficha (antes, otra forma que dejaba tarjetas "Ya no disponible" después de
 * pasar por Mis creaciones); sin el Kapi flotante (está en la portada).
 * Lo de antes: pages/PersonalizarViejo.jsx (interruptor crearViejo).
 */

const SIN_NADA = [];

export default function CrearDeTienda() {
  const { user, isAdmin } = useAuth();
  const uid = user?.uid;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  // El estudio y el combo vuelven aquí con su flecha.
  const estadoEditar = useMemo(() => ({ desde: pathname }), [pathname]);

  const prendasQ = useQuery({
    queryKey: ['prendas-base', Boolean(isAdmin)],
    queryFn: async () => {
      const { data, error } = await getPrendasBase({ incluirBorradores: Boolean(isAdmin) });
      if (error) throw new Error(error);
      return data;
    },
  });
  const combosQ = useQuery({
    queryKey: ['combos-crear', Boolean(isAdmin)],
    queryFn: async () => (await getCombosCrear({ incluirBorradores: Boolean(isAdmin) })).data,
  });

  const claveCreaciones = ['mis-creaciones-crear', uid];
  const creacionesQ = useQuery({
    queryKey: claveCreaciones,
    enabled: Boolean(uid),
    // Al volver del estudio se ve lo recién guardado.
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data } = await getDesignsByUser(uid);
      // Creaciones de Crear y "Mis combos" (una tarjeta por combo).
      return (data || []).filter((d) => d.tipo === 'crear' || esMiCombo(d));
    },
  });
  const borradoresQ = useBorradoresCrear(uid);
  const comunidadQ = useComunidad();
  const creaciones = uid ? creacionesQ.data || SIN_NADA : SIN_NADA;
  const borradores = uid ? borradoresQ.data || SIN_NADA : SIN_NADA;

  // Versiones anteriores de las prendas de los combos: aquí no salen (las
  // oculta agruparCombos); esto solo las marca y borra las que pasaron los días.
  useVersionesReemplazadas({
    uid,
    creaciones,
    borradores,
    listo: creacionesQ.isSuccess && !creacionesQ.isFetching && borradoresQ.isSuccess && !borradoresQ.isFetching,
  });

  const { tarjetaDe, eliminar, renombrar, comunidadPara } = useTarjetasCreaciones({
    uid, designs: creaciones, borradores, claveCreaciones, estadoEditar,
  });
  // Cada tarjeta con sus acciones (PaginaCrear las pasa tal cual a TarjetaCreacion).
  const conAcciones = (d) => {
    const c = tarjetaDe(d);
    return { ...c, onEliminar: () => eliminar(d.id), onRenombrar: (nombre) => renombrar(d.id, nombre), comunidad: comunidadPara(c) };
  };

  const tarjetas = useMemo(() => agruparCombos(creaciones, borradores)
    .sort((a, b) => (fechaDeDiseno(b) || 0) - (fechaDeDiseno(a) || 0)), [creaciones, borradores]);
  const tarjetasBorrador = useMemo(() => agruparCombos(borradores, creaciones), [borradores, creaciones]);

  const prendasBase = prendasQ.data || SIN_NADA;
  const prendaPorId = useMemo(() => new Map(prendasBase.map((p) => [p.id, p])), [prendasBase]);
  // Las tarjetas de prendas y combos llevan su botón al estudio o al combo.
  const conIr = (t) => ({ ...t, onAgregar: () => navigate(t.url) });
  const prendas = prendasBase.map(prendaCrearDesdeProducto).map(conIr);
  const combos = (combosQ.data || SIN_NADA).map((c) => comboCrearDesde(c, prendaPorId)).filter(Boolean).map(conIr);

  const comunidad = (comunidadQ.data || SIN_NADA).map(disenoComunidadDesde);

  // "¿Para cuántos?": va en la dirección para que al volver siga elegido.
  const para = Number(params.get('para')) || 1;
  const elegirPara = (n) => {
    const siguiente = new URLSearchParams(params);
    if (n === 1) siguiente.delete('para'); else siguiente.set('para', String(n));
    setParams(siguiente, { replace: true });
  };

  return (
    <PaginaCrear
      prendas={prendas}
      combos={combos}
      cargando={prendasQ.isLoading}
      para={para}
      onPara={elegirPara}
      borradores={tarjetasBorrador.map(conAcciones)}
      creaciones={tarjetas.slice(0, 8).map(conAcciones)}
      totalCreaciones={tarjetas.length}
      comunidad={comunidad.slice(0, 8)}
      totalComunidad={comunidad.length}
      urlCreaciones="/cuenta/creaciones"
      urlComunidad="/comunidad"
      urlTienda="/tienda"
    />
  );
}
