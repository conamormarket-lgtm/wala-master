import React, { useMemo } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getDesignById, renombrarCreacion } from '../../services/designs';
import { getComboCrear, getCombosCrear } from '../../services/combosCrear';
import { publicarEnComunidad, retirarDeComunidad } from '../../services/comunidad';
import { esMiCombo, imagenDe, espaldaDe } from '../../services/misCombos';
import { precioBase, fondoColorGuardado } from '../../utils/prendaBase';
import { useEliminarCreacion } from '../../pages/Crear/useEliminarCreacion';
import { useEliminarMiCombo, notasEliminarCombo } from '../../pages/Crear/useEliminarMiCombo';
import { useCart } from '../../contexts/CartContext';
import useLoViejo from '../../hooks/useLoViejo';
import { useLlevarEnCombo } from '../../pages/Crear/LlevarEnCombo';
import { consultaProducto } from '../regalar/regaloDeLista';
import { creacionDesdeDiseno } from '../../componentes/kit/adaptadores';

const PERMISOS = ['superadmin', 'manage_design'];

/*
 * Las tarjetas de las creaciones del cliente (TarjetaCreacion del kit) y lo
 * que se hace con ellas: eliminar, renombrar, la comunidad (admins) y
 * "Llevar en combo". Lo comparten Mis creaciones (CreacionesDeCuenta) y Crear
 * (CrearDeTienda), así una tarjeta hace lo mismo en los dos lados.
 *  - uid · designs, borradores: lo que ya leyó quien lo usa
 *  - claveCreaciones: la caché de las creaciones de esa página (para los
 *    cambios locales; los borradores son ['mis-borradores-crear', uid])
 *  - estadoEditar: el state con que el estudio y el combo vuelven (su flecha)
 *  - FotoLegado: cómo dibujar un diseño del editor de antes (solo Mis
 *    creaciones lo necesita; así Crear no baja ese código)
 * Devuelve { tarjetaDe(d), eliminar(id), renombrar(id, nombre),
 * comunidadPara(tarjeta), buscar(id), cambiarEnAmbas(fn), eliminarDiseno }.
 */
export default function useTarjetasCreaciones({ uid, designs, borradores, claveCreaciones, estadoEditar, FotoLegado }) {
  const { user, isAdmin, adminPermissions } = useAuth();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();

  // Cambios locales sin volver a leer todo.
  const cambiarCreaciones = (fn) => queryClient.setQueryData(claveCreaciones, (prev) => (prev ? fn(prev) : prev));
  const cambiarBorradores = (fn) => queryClient.setQueryData(['mis-borradores-crear', uid], (prev) => (prev ? fn(prev) : prev));
  const cambiarEnAmbas = (fn) => { cambiarCreaciones(fn); cambiarBorradores(fn); };

  // Lo vivo del catálogo: el producto de cada creación y borrador (la caché
  // de la ficha) y el combo de cada "Mi combo".
  const todos = useMemo(() => [...designs, ...borradores], [designs, borradores]);
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

  const { eliminar: eliminarDiseno, notasDe } = useEliminarCreacion();
  const eliminarCombo = useEliminarMiCombo();
  const { items } = useCart();
  // El editor de antes ya no está (2026-10-20): sus diseños se ven, pero no se
  // editan; llevan al producto. Con personalizableViejo, como antes.
  const personalizableViejo = useLoViejo('personalizable');
  const buscar = (id) => designs.find((x) => x.id === id) || borradores.find((x) => x.id === id);

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
      if (leidas) {
        extra.imagenes = piezas.map((p) => imagenDe(piezaDe(p.designId)));
        extra.imagenesEspalda = piezas.map((p) => espaldaDe(piezaDe(p.designId)));
      }
      if (q?.isSuccess && !extra.disponible) extra.aviso = 'Este combo ya no se vende.';
      const notasCombo = notasEliminarCombo(d, items);
      if (notasCombo.length) extra.eliminar = { notas: notasCombo };
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
    const legado = !deCrear && !borrador && FotoLegado;
    return creacionDesdeDiseno(d, {
      producto: (deCrear || borrador) ? (producto?.name || d.productName) : (sinProducto ? undefined : (producto?.name || d.productName)),
      color: d.color?.hex ? { nombre: borrador ? undefined : d.color.nombre, hex: d.color.hex, fondo: fondoColorGuardado(d.color, producto) } : undefined,
      precio,
      precioAntes: precio > 0 && Number.isFinite(lista) && precio < lista ? lista : undefined,
      disponible: !sinProducto,
      foto: legado ? (cargando ? null : React.createElement(FotoLegado, { design: d, producto, apagado: sinProducto })) : undefined,
      // Un diseño de antes cuyo producto ya no existe no lleva a ningún lado (como antes).
      ...(!deCrear && !borrador && sinProducto ? { url: undefined } : {}),
      ...(!deCrear && !borrador && !personalizableViejo ? {
        url: sinProducto ? undefined : `/producto/${d.productId}`,
        urlEditar: undefined,
        urlComprar: undefined,
        soloEditar: false,
        aviso: 'Hecho con el editor de antes: ya no se edita. Para uno nuevo, entra a Crear.',
      } : {}),
      combos: sinProducto ? [] : combosPara(d),
      estadoEditar,
      eliminar: notas.length ? { notas } : undefined,
    });
  };

  /* ── Acciones ── */

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

  return { tarjetaDe, eliminar, renombrar, comunidadPara, buscar, cambiarEnAmbas, eliminarDiseno };
}
