import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PaginaResumenCuenta } from '../../componentes/kit/paginas/Cuenta';
import { useGruposDeCuenta } from './gruposDeCuenta';

/*
 * La pantalla que abre "Mi cuenta" (/cuenta): el saludo, tus monedas (y las
 * que están en espera) y los accesos a cada sección. "Cerrar sesión" lo pone
 * MarcoDeCuenta (en el celular, al final). Lo de antes, en
 * pages/cuenta/CuentaResumenViejo.jsx (interruptor cuentaVieja).
 */
export default function ResumenDeCuenta() {
  const { user, userProfile } = useAuth();
  const grupos = useGruposDeCuenta();
  return (
    <PaginaResumenCuenta
      usuario={{ nombre: userProfile?.displayName || userProfile?.nombre || user?.displayName || '' }}
      monedas={Number(userProfile?.monedas) || 0}
      enEspera={Number(userProfile?.monedasEnEspera) || 0}
      grupos={grupos}
    />
  );
}
