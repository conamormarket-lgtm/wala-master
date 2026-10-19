import React, { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { usePedidos } from '../../hooks/usePedidos';
import { enviarVerificacionCorreo, refrescarVerificacionCorreo } from '../../services/firebase/auth';
import { vincularPedido } from '../../services/misPedidos';
import { getAuthErrorMessage } from '../../utils/authErrorMessages';
import { consultaProducto } from '../regalar/regaloDeLista';
import { PaginaPedidos } from '../../componentes/kit/paginas/CuentaPedidos';
import { seguimientoDesdePedido, productosSinFoto, fechaCorta, ETIQUETA_FASE } from './resumenPedido';

/*
 * Mis pedidos (/cuenta/pedidos), paso 7 de la migración: PaginaPedidos del
 * kit. Lo de antes, en pages/cuenta/CuentaRastreoViejo.jsx (interruptores
 * cuentaVieja o pagosViejo).
 *
 * Los pedidos los trae el servidor (usePedidos → misPedidosSecure, con su
 * copia en memoria: al volver se ven al instante y se refrescan). Los que
 * solo coinciden por documento llegan aparte, "por verificar". Pagar una
 * deuda es en el detalle: aquí el botón lleva ahí.
 *
 * Ya no se baja el catálogo entero: la foto de cada pedido sale de sus
 * líneas; solo las que no traen foto piden su producto (uno por uno).
 */
export default function PedidosDeCuenta() {
  const { user, userProfile, loading: cargandoSesion } = useAuth();
  const dni = userProfile?.dni ? String(userProfile.dni).trim() : '';
  const uid = user?.uid || undefined;
  const { loading, error, data, buscar, recargar } = usePedidos(dni, uid);
  const [pedido, setPedido] = useState(false);

  useEffect(() => {
    if (!user || (!dni && !cargandoSesion) || pedido) return;
    setPedido(true);
    buscar(dni, uid);
  }, [user, dni, uid, pedido, buscar, cargandoSesion]);

  const crudos = useMemo(() => data?.pedidos ?? [], [data]);
  const ids = useMemo(() => productosSinFoto(crudos), [crudos]);
  const productosQ = useQueries({ queries: ids.map(consultaProducto) });
  const productoDe = (id) => productosQ[ids.indexOf(id)]?.data || undefined;
  const pedidos = crudos.map((p) => seguimientoDesdePedido(p, productoDe));

  const pendientes = (data?.pendientes ?? []).map((p) => ({
    ref: p.ref,
    fecha: fechaCorta(p.fecha),
    fase: ETIQUETA_FASE[p.fase] || 'Recibido',
    mismoCorreo: p.mismoCorreo,
    pistaCorreo: p.pistaCorreo,
  }));

  // El kit espera promesas que fallan con su mensaje; los servicios devuelven { error }.
  const porVerificar = {
    pendientes,
    correoVerificado: data?.emailVerificado === true,
    onEnviarVerificacion: async () => {
      const { error: err, errorCode, yaVerificado } = await enviarVerificacionCorreo();
      if (yaVerificado) return { yaVerificado: true };
      if (err) throw new Error(getAuthErrorMessage(errorCode, err));
      return {};
    },
    onYaVerifique: async () => {
      const ok = await refrescarVerificacionCorreo();
      if (ok) recargar();
      return ok;
    },
    onVincular: async (datos) => {
      const { error: err } = await vincularPedido(datos);
      if (err) throw new Error(err);
      recargar();
    },
  };

  return (
    <PaginaPedidos
      pedidos={pedidos}
      porVerificar={porVerificar}
      cargando={cargandoSesion || (loading && !data) || (Boolean(dni) && !pedido)}
      error={error}
      onReintentar={() => recargar()}
      // El marco ya manda a completar el perfil; esto queda por si acaso.
      sinDocumento={Boolean(user && userProfile) && !dni}
      urlTienda="/tienda"
    />
  );
}
