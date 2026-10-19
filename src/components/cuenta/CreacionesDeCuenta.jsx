import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getDesignsByUser, getDesignById, renombrarCreacion } from '../../services/designs';
import { getComboCrear, getCombosCrear } from '../../services/combosCrear';
import { publicarEnComunidad, retirarDeComunidad } from '../../services/comunidad';
import { esMiCombo, agruparCombos, recuperarVersion, diasParaBorrar, imagenDe, DIAS_VERSION_REEMPLAZADA } from '../../services/misCombos';
import { precioBase, fondoColorGuardado } from '../../utils/prendaBase';
import { toThumbnailImageUrl } from '../../utils/imageUrl';
import { useProductThumbnailVariant } from '../../hooks/useProductThumbnailVariant';
import { useBorradoresCrear } from '../../pages/Crear/TusBorradores';
import { useEliminarCreacion } from '../../pages/Crear/useEliminarCreacion';
import { useEliminarMiCombo } from '../../pages/Crear/useEliminarMiCombo';
import { useVersionesReemplazadas } from '../../pages/Crear/useVersionesReemplazadas';
import { useLlevarEnCombo } from '../../pages/Crear/LlevarEnCombo';
import ComboProductImage from '../../pages/Tienda/components/ComboProductImage/ComboProductImage';
import { DomOverlay } from '../../pages/Tienda/components/ComboProductImage/ComboProductImageWithDesign';
import OptimizedImage from '../common/OptimizedImage/OptimizedImage';
import { consultaProducto } from '../regalar/regaloDeLista';
import { PaginaCreaciones } from '../../componentes/kit/paginas/CuentaPersonalizacion';
import { creacionDesdeDiseno, fechaDeDiseno } from '../../componentes/kit/adaptadores';
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

const PERMISOS = ['superadmin', 'manage_design'];

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
  const { user, isAdmin, adminPermissions } = useAuth();
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

  // Cambios locales sin volver a leer todo (como antes, con setDesigns).
  const cambiarCreaciones = (fn) => queryClient.setQueryData(claveCreaciones, (prev) => (prev ? fn(prev) : prev));
  const cambiarBorradores = (fn) => queryClient.setQueryData(['mis-borradores-crear', uid], (prev) => (prev ? fn(prev) : prev));
  const cambiarEnAmbas = (fn) => { cambiarCreaciones(fn); cambiarBorradores(fn); };

  // Cada combo es UNA tarjeta: sus prendas no se repiten sueltas.
  const tarjetas = useMemo(() => agruparCombos(designs, borradores)
    .sort((a, b) => (fechaDeDiseno(b) || 0) - (fechaDeDiseno(a) || 0)), [designs, borradores]);
  const tarjetasBorrador = useMemo(() => agruparCombos(borradores), [borradores]);

  // Lo vivo del catálogo: el producto de cada creación y borrador (la caché
  // de la ficha) y el combo de cada "Mi combo".
  const todos = [...tarjetas, ...tarjetasBorrador];
  const idsProducto = [...new Set(todos.filter((d) => !esMiCombo(d) && d.productId).map((d) => d.productId))];
  const productosQ = useQueries({ queries: idsProducto.map(consultaProducto) });
  const productoDe = (id) => productosQ[idsProducto.indexOf(id)];
  const idsCombo = [...new Set(todos.filter(esMiCombo).map((d) => d.comboId).filter(Boolean))];
  const combosQ = useQueries({
    queries: idsCombo.map((id) => ({ queryKey: ['combo-crear', id], queryFn: async () => (await getComboCrear(id)).data })),
  });
  const comboDe = (id) => combosQ[idsCombo.indexOf(id)];
  // Los combos guardados antes no traen la foto de cada prenda: se leen sus prendas.
  const piezasViejas = [...new Set(todos.filter((d) => esMiCombo(d) && !(d.piezas || []).some((p) => p.frente))
    .flatMap((d) => (d.piezas || []).map((p) => p.designId)).filter(Boolean))];
  const piezasQ = useQueries({
    queries: piezasViejas.map((id) => ({
      queryKey: ['pieza-combo', id],
      staleTime: 5 * 60 * 1000,
      queryFn: async () => (await getDesignById(id)).data || null,
    })),
  });
  const piezaDe = (id) => piezasQ[piezasViejas.indexOf(id)]?.data;

  // Los combos publicados (pareja, trío…), para "Llevar en combo".
  const { data: combosPublicados = [] } = useQuery({
    queryKey: ['combos-crear', false],
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(uid),
    queryFn: async () => (await getCombosCrear()).data,
  });
  const { llevar } = useLlevarEnCombo();
  const combosPara = (d) => (d.combo?.id ? [] : (combosPublicados || [])
    .filter((c) => c.piezas.some((p) => p.prendaId === d.productId))
    .map((c) => ({ id: c.id, nombre: c.name, piezas: c.piezas.length, precio: precioBase(c), onLlevar: () => llevar(c, d) })));

  /* ── Las tarjetas ── */

  const tarjetaDe = (d) => {
    if (esMiCombo(d)) {
      const q = comboDe(d.comboId);
      const combo = q?.data;
      const piezas = d.piezas || [];
      const guardadas = piezas.some((p) => p.frente);
      const leidas = !guardadas && piezas.some((p) => piezaDe(p.designId));
      const extra = {
        precio: combo ? precioBase(combo) : undefined,
        // Mientras llega el combo se puede abrir igual; si ya no se vende, se dice.
        disponible: q?.isSuccess ? Boolean(combo) && combo.publicado && combo.deleted !== true : true,
        colores: piezas.map((p) => (guardadas ? p.color : piezaDe(p.designId)?.color)).filter((c) => c?.hex).map((c) => fondoColorGuardado(c)),
        estadoEditar,
      };
      if (leidas) extra.imagenes = piezas.map((p) => imagenDe(piezaDe(p.designId)));
      if (q?.isSuccess && !extra.disponible) extra.aviso = 'Este combo ya no se vende.';
      return creacionDesdeDiseno(d, extra);
    }
    const deCrear = d.tipo === 'crear';
    const q = d.productId ? productoDe(d.productId) : null;
    const producto = q?.data;
    const cargando = Boolean(d.productId) && (!q || q.isLoading);
    const sinProducto = !cargando && (!producto || producto.deleted === true);
    const precio = producto ? precioBase(producto) : undefined;
    const lista = Number(producto?.price);
    const borrador = d.estado === 'borrador';
    const notas = notasDe(d);
    return creacionDesdeDiseno(d, {
      producto: (deCrear || borrador) ? (producto?.name || d.productName) : (sinProducto ? undefined : (producto?.name || d.productName)),
      color: d.color?.hex ? { nombre: borrador ? undefined : d.color.nombre, hex: d.color.hex, fondo: fondoColorGuardado(d.color, producto) } : undefined,
      precio,
      precioAntes: precio > 0 && Number.isFinite(lista) && precio < lista ? lista : undefined,
      disponible: !sinProducto,
      foto: !deCrear && !borrador ? (cargando ? null : <FotoLegado design={d} producto={producto} apagado={sinProducto} />) : undefined,
      // Un diseño de antes cuyo producto ya no existe no lleva a ningún lado (como antes).
      ...(!deCrear && !borrador && sinProducto ? { url: undefined } : {}),
      combos: sinProducto ? [] : combosPara(d),
      estadoEditar,
      eliminar: notas.length ? { notas } : undefined,
    });
  };

  /* ── Acciones ── */

  const { eliminar: eliminarDiseno, notasDe } = useEliminarCreacion();
  const eliminarCombo = useEliminarMiCombo();
  const buscar = (id) => designs.find((x) => x.id === id) || borradores.find((x) => x.id === id);

  const eliminar = async (id) => {
    const d = buscar(id);
    if (!d) return;
    if (esMiCombo(d)) {
      const hecho = await eliminarCombo(d, { confirmado: true });
      if (!hecho) return;
      cambiarEnAmbas((lista) => lista
        .filter((x) => !hecho.quitadas.includes(x.id))
        .map((x) => (hecho.sueltas.includes(x.id) ? { ...x, combo: null, reemplazadaEn: null } : x)));
      return;
    }
    // Lo que está en un pedido conserva sus archivos (el pedido los imprime).
    if (await eliminarDiseno(d, { enPedido: d.enPedido === true })) {
      cambiarEnAmbas((lista) => lista.filter((x) => x.id !== id));
    }
  };

  const renombrar = async (id, nombre) => {
    const limpio = nombre.trim().slice(0, 60);
    const { error } = await renombrarCreacion(id, limpio);
    if (error) {
      toast.error('No pudimos cambiar el nombre. Inténtalo de nuevo.');
      throw new Error(error);
    }
    queryClient.setQueryData(['creacion', id, uid], (prev) => (prev ? { ...prev, name: limpio } : prev));
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    cambiarEnAmbas((lista) => lista.map((x) => (x.id === id ? { ...x, name: limpio } : x)));
    toast.success('Nombre actualizado.');
  };

  // La comunidad: solo admins con permiso, sobre sus creaciones de Crear
  // terminadas (el servidor lo vuelve a comprobar).
  const puedePublicar = Boolean(user && isAdmin && (adminPermissions || []).some((p) => PERMISOS.includes(p)));
  const comunidad = async (id, accion) => {
    const { error } = accion === 'retirar' ? await retirarDeComunidad(id) : await publicarEnComunidad(id);
    if (error) {
      toast.error(error);
      throw new Error(error);
    }
    toast.success({ publicar: 'Publicada en la comunidad.', actualizar: 'Publicación actualizada.', retirar: 'Retirada de la comunidad.' }[accion]);
    const estado = accion === 'retirar' ? 'retirada' : 'publicada';
    cambiarCreaciones((lista) => lista.map((x) => (x.id === id ? { ...x, comunidad: estado } : x)));
    queryClient.invalidateQueries({ queryKey: ['comunidad'] });
    queryClient.invalidateQueries({ queryKey: ['comunidad-diseno'] });
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['creacion', id] });
  };
  const comunidadPara = (c) => {
    const d = buscar(c.id);
    if (!puedePublicar || !d || !['crear', 'comboCrear'].includes(d.tipo) || d.userId !== uid || d.estado === 'borrador') return undefined;
    // Una creación que ya no está en la tienda no se publica (un combo, sí: como antes).
    if (d.tipo === 'crear' && c.disponible === false) return undefined;
    return {
      estado: d.comunidad || null,
      onPublicar: () => comunidad(d.id, 'publicar'),
      onActualizar: () => comunidad(d.id, 'actualizar'),
      onRetirar: () => comunidad(d.id, 'retirar'),
    };
  };

  /* ── Versiones anteriores de los combos ── */

  // Mismo cuidado que antes: con las dos listas cargadas y al día (con una a
  // medias, una prenda en uso podría parecer reemplazada).
  const versiones = useVersionesReemplazadas({
    uid,
    creaciones: designs,
    borradores,
    listo: creacionesQ.isSuccess && !creacionesQ.isFetching && borradoresQ.isSuccess && !borradoresQ.isFetching,
    alBorrar: (ids) => cambiarEnAmbas((lista) => lista.filter((x) => !ids.includes(x.id))),
  });
  const recuperar = async (id) => {
    const { error } = await recuperarVersion(id);
    if (error) {
      toast.error('No pudimos recuperar el diseño. Inténtalo de nuevo.');
      return;
    }
    cambiarEnAmbas((lista) => lista.map((x) => (x.id === id ? { ...x, combo: null, reemplazadaEn: null } : x)));
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    toast.success('Diseño recuperado: ya está en tus creaciones.');
  };
  const eliminarVersion = async (id) => {
    const d = buscar(id);
    if (d && await eliminarDiseno(d, { enPedido: d.enPedido === true })) {
      cambiarEnAmbas((lista) => lista.filter((x) => x.id !== id));
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
