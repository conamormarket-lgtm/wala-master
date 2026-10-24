import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';
import { PaginaEncuestaEntrega } from '../../componentes/kit/paginas/EncuestaEntrega';
import { tieneCuenta } from '../../utils/rutaPrivada';
import { volarMonedasGanadas } from '../../utils/animations';

/*
 * /opinar/:codigo: "¿Cómo te fue con tu pedido?" (PaginaEncuestaEntrega del
 * kit). Todo pasa por el servidor (functions/encuestaEntrega.js): si el pedido
 * es suyo y está entregado, si ya respondió, las opciones y las monedas que
 * configura el admin en Resultados › Opiniones (Editar encuesta).
 */
export default function EncuestaEntregaDeTienda() {
  const { codigo = '' } = useParams();
  const { user, loading } = useAuth();
  const conCuenta = tieneCuenta(user);

  const { data: estado, isLoading, error } = useQuery({
    queryKey: ['encuesta-entrega', user?.uid, codigo],
    queryFn: async () => (await httpsCallable(getFunctions(), 'estadoEncuestaEntrega')({ codigo })).data,
    enabled: conCuenta && Boolean(codigo),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const enviar = async (respuesta) => {
    try {
      const { data } = await httpsCallable(getFunctions(), 'responderEncuestaEntrega')({ codigo, ...respuesta });
      if (data?.monedas > 0) volarMonedasGanadas(null, data.monedas);
      return data;
    } catch (e) {
      throw new Error(e?.message || 'No pudimos enviar tu respuesta. Inténtalo de nuevo.');
    }
  };

  return (
    <PaginaEncuestaEntrega
      codigo={codigo}
      // Si falla la consulta, se muestra como "no figura como entregado" (con el botón a Mis pedidos).
      estado={error ? { activo: true, entregado: false } : estado}
      sesion={loading || conCuenta}
      cargando={loading || (conCuenta && isLoading)}
      urlLogin={`/login?redirect=${encodeURIComponent(`/opinar/${codigo}`)}`}
      onEnviar={enviar}
    />
  );
}
