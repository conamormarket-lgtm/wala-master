import React from 'react';
import { Navigate } from 'react-router-dom';
import useLoViejo from '../hooks/useLoViejo';
import NoEncontradaDeTienda from '../components/generales/NoEncontradaDeTienda';

/**
 * Una dirección que no existe (GENERALES.md P22): PaginaNoEncontrada. Con el
 * interruptor generalesViejo vuelve lo de antes: `antes` es a dónde mandaba
 * ("/" una landing que no existe, "/cuenta" la ruta *).
 */
export default function NoEncontradaPage({ antes = '/' }) {
  const viejo = useLoViejo('generales');
  if (viejo) return <Navigate to={antes} replace />;
  return <NoEncontradaDeTienda />;
}
