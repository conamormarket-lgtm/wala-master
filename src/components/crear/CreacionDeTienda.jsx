import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getDesignById, guardarTallaCreacion } from '../../services/designs';
import { getPrendaBase } from '../../services/prendasBase';
import { getCombosCrear } from '../../services/combosCrear';
import { precioBase } from '../../utils/prendaBase';
import { itemDeCreacion, creacionLista } from '../../pages/Crear/creacionCarrito';
import { ponerPieza, leerArmado } from '../../pages/Crear/comboCrear';
import { useLlevarEnCombo } from '../../pages/Crear/LlevarEnCombo';
import { useEliminarCreacion } from '../../pages/Crear/useEliminarCreacion';
import useTarjetasCreaciones from '../cuenta/useTarjetasCreaciones';
import { PaginaCreacion } from '../../componentes/kit/paginas/Creacion';
import { fechaDeDiseno } from '../../componentes/kit/adaptadores';
import { fichaCreacionDesde } from '../../componentes/kit/adaptadoresCrear';

/*
 * Una creación (/creacion/:id) con el kit (paso 6, CREAR.md P9):
 * PaginaCreacion. La misma lógica que CreacionPage:
 *  - solo la ve su dueño (la ruta pide cuenta); la prenda se vuelve a leer al
 *    entrar; las tallas son las de su color y la elegida queda guardada en la
 *    creación (guardarTallaCreacion)
 *  - agregar al carrito (la misma línea: itemDeCreacion, con la cantidad) o
 *    comprarla sola (selectOnly) e ir al pago; una prenda en borrador (la ve
 *    el admin) no se compra
 *  - "Ir al combo" deja esta creación en su prenda del combo si estaba
 *    vacía; si no es de un combo, "Llévala en combo" (una copia)
 *  - renombrar, eliminar (y volver a Mis creaciones) y la comunidad (admins)
 *  - "Editar diseño" abre el estudio, que vuelve aquí con su flecha
 * Diferente: una talla guardada que ya no existe para su color no cuenta
 * como elegida (antes pasaba el control); la publicación también se puede
 * actualizar desde aquí.
 * Lo de antes: pages/Crear/CreacionViejo.jsx (interruptor crearViejo).
 */

const SIN_NADA = [];

export default function CreacionDeTienda() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const { addToCart } = useCart();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const uid = user?.uid;
  const [talla, setTalla] = useState(null);
  const estadoEditar = useMemo(() => ({ desde: pathname }), [pathname]);

  const { data: creacion, isLoading: cargandoCreacion } = useQuery({
    queryKey: ['creacion', id, uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const { data, error } = await getDesignById(id);
      if (error || !data) return null;
      return { id, ...data };
    },
  });
  const esMia = Boolean(creacion && creacion.userId === uid && creacion.tipo === 'crear');

  const { data: prenda, isLoading: cargandoPrenda } = useQuery({
    queryKey: ['prenda-base', creacion?.productId],
    refetchOnMount: 'always',
    enabled: Boolean(esMia && creacion.productId),
    queryFn: async () => {
      const { data, error } = await getPrendaBase(creacion.productId);
      if (error) throw new Error(error);
      return data;
    },
  });
  const { data: combos = SIN_NADA } = useQuery({
    queryKey: ['combos-crear', false],
    enabled: esMia,
    queryFn: async () => (await getCombosCrear()).data,
  });

  // Renombrar y la comunidad: lo mismo que las tarjetas de Mis creaciones.
  const disenos = useMemo(() => (creacion ? [creacion] : SIN_NADA), [creacion]);
  const { renombrar, comunidadPara } = useTarjetasCreaciones({
    uid, designs: disenos, borradores: SIN_NADA, claveCreaciones: ['mis-creaciones-crear', uid], estadoEditar,
  });
  const { eliminar: eliminarDiseno, notasDe } = useEliminarCreacion();
  const { llevar } = useLlevarEnCombo();

  if (loading || (uid && cargandoCreacion) || (esMia && cargandoPrenda)) return <PaginaCreacion estado="cargando" />;
  if (!esMia) return <PaginaCreacion estado="noEncontrada" urlCreaciones="/cuenta/creaciones" />;

  const ficha = fichaCreacionDesde(creacion, prenda, { fecha: fechaDeDiseno(creacion), esAdmin: isAdmin });
  // La talla guardada solo cuenta si su color todavía la tiene.
  const tallaGuardada = ficha.tallas.includes(creacion.variant?.size) ? creacion.variant.size : undefined;
  const tallaActual = talla ?? tallaGuardada;

  const elegirTalla = async (t) => {
    setTalla(t);
    if (t === creacion.variant?.size) return;
    const { error } = await guardarTallaCreacion(id, t);
    if (error) {
      toast.error('No pudimos guardar la talla. Inténtalo de nuevo.');
      return;
    }
    queryClient.setQueryData(['creacion', id, uid], (prev) => (prev ? { ...prev, variant: { ...prev.variant, size: t } } : prev));
  };

  const linea = (cantidad) => {
    const [producto, variante, personalizacion] = itemDeCreacion({ prenda, creacion, talla: tallaActual });
    return [producto, variante, personalizacion, cantidad];
  };
  const enBorrador = () => {
    if (prenda.visible !== false) return false;
    toast.info('Esta prenda está en borrador: publícala para poder comprarla.');
    return true;
  };
  const agregar = ({ cantidad }) => {
    if (enBorrador()) return;
    addToCart(...linea(cantidad), null, { silent: true });
    toast.success('¡Agregado al carrito!');
  };
  // "Comprar": deja SOLO esta creación elegida en el carrito y va al pago.
  const comprar = ({ cantidad }) => {
    if (enBorrador()) return;
    addToCart(...linea(cantidad), null, { selectOnly: true, silent: true });
    navigate('/checkout');
  };

  const comboSuyo = creacion.combo?.id ? {
    nombre: creacion.combo.nombre,
    url: `/combo/${creacion.combo.id}`,
    onIr: () => {
      const pieza = creacion.combo.pieza || 0;
      if (!leerArmado(creacion.combo.id, pieza + 1)[pieza]?.designId) ponerPieza(creacion.combo.id, pieza, { designId: id });
    },
  } : undefined;
  const combosSugeridos = comboSuyo ? [] : combos
    .filter((c) => c.piezas.some((p) => p.prendaId === creacion.productId))
    .map((c) => ({ id: c.id, nombre: c.name, piezas: c.piezas.length, precio: precioBase(c), onUsar: () => llevar(c, creacion) }));

  const notas = notasDe(creacion);

  return (
    <PaginaCreacion
      {...ficha}
      creacion={{ ...ficha.creacion, publicada: creacion.comunidad === 'publicada' }}
      lista={creacionLista(creacion)}
      talla={tallaActual}
      onTalla={elegirTalla}
      combo={comboSuyo}
      combosSugeridos={combosSugeridos}
      onAgregar={agregar}
      onComprar={comprar}
      estadoEditar={estadoEditar}
      onRenombrar={(nombre) => renombrar(id, nombre).catch(() => {})}
      onEliminar={async () => {
        // Lo que está en un pedido conserva sus archivos (el pedido los imprime).
        if (await eliminarDiseno(creacion, { enPedido: creacion.enPedido === true })) navigate('/cuenta/creaciones', { replace: true });
      }}
      eliminar={notas.length ? { notas } : undefined}
      comunidad={comunidadPara({ id, disponible: ficha.disponible })}
      urlCreaciones="/cuenta/creaciones"
    />
  );
}
