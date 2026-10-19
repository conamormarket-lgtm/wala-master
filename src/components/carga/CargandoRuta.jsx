import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useLoViejo from '../../hooks/useLoViejo';
import { tieneCuenta } from '../../utils/rutaPrivada';
import PageLoading from '../common/PageLoading/PageLoading';
import { EsqueletoPagina } from '../../componentes/kit/Esqueletos';
import { formaDeRuta } from './formaDeRuta';

/*
 * Mientras llega el código de una página (el fallback de Suspense en App.jsx)
 * o se sabe quién entra (RutaPrivada): el esqueleto con la forma de esa página
 * (paso 7 de la migración, CARGA.md). Antes, una grilla de 8 productos para
 * todo, también para la cuenta o el carrito.
 *
 * El esqueleto sigue a quien mira (con o sin sesión); mientras la sesión aún
 * carga se asume que la hay (lo común, y lo que hace el marco de la cuenta):
 * sin eso, quien sí entró veía un instante la invitación a entrar. El admin no es del kit:
 * ahí sigue el de antes. El interruptor cargaVieja (useLoViejo('carga')) vuelve
 * a PageLoading en todas.
 */
export default function CargandoRuta({ ruta }) {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const cargaVieja = useLoViejo('carga');
  const forma = formaDeRuta(ruta || pathname);
  if (cargaVieja || !forma) return <PageLoading />;
  return <EsqueletoPagina forma={forma.forma} modulo={forma.modulo} sesion={loading || tieneCuenta(user)} />;
}
