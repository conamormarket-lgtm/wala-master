import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { logout, metodosDeEntrada, volverAEntrar } from '../../services/firebase/auth';
import { confirmarBorrado, mensajeDeErrorBorrado, revisarBorrado } from '../../services/borrarCuenta';
import { TarjetaBorrarCuenta } from '../../componentes/kit/piezas/BorrarCuenta';
import { SE_BORRA, SE_CONSERVA } from '../../config/legales/eliminarCuenta';

/*
 * "Borrar mi cuenta" al final de Ajustes (TarjetaBorrarCuenta). Todo lo
 * decide el servidor (eliminarCuentaSecure, la misma que usa la app):
 *   1. revisar: lo pendiente (pedido sin entregar, saldo, suscripción…)
 *   2. sin pendientes, la hoja: volver a entrar (contraseña o Google: el
 *      servidor pide haber entrado hace menos de 5 minutos) y confirmar
 *   3. borrada: se cierra la sesión y se va al inicio con un aviso
 * /eliminar-cuenta (pública) trae aquí con #borrar-cuenta.
 */
export default function BorrarCuentaDeCuenta() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useGlobalToast();
  const [estado, setEstado] = useState('inicio');
  const [pendientes, setPendientes] = useState([]);
  const [error, setError] = useState('');

  // Desde /eliminar-cuenta: directo a la tarjeta.
  useEffect(() => {
    if (location.hash !== '#borrar-cuenta') return undefined;
    const t = window.setTimeout(() => document.getElementById('borrar-cuenta')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    return () => window.clearTimeout(t);
  }, [location.hash]);

  const revisar = async () => {
    setEstado('revisando');
    setError('');
    try {
      const lista = await revisarBorrado();
      setPendientes(lista);
      setEstado(lista.length ? 'pendientes' : 'listo');
    } catch (e) {
      setError(mensajeDeErrorBorrado(e));
      setEstado('inicio');
    }
  };

  // Lanza Error con el texto para la hoja; los pendientes nuevos cierran la hoja y se muestran.
  const borrar = async ({ metodo, contrasena }) => {
    const entrada = await volverAEntrar({ metodo, contrasena });
    if (entrada.cancelado) return;
    if (entrada.error) throw new Error(entrada.error);
    try {
      await confirmarBorrado();
    } catch (e) {
      if (e?.details?.motivo === 'pendientes' && Array.isArray(e.details.pendientes)) {
        setPendientes(e.details.pendientes);
        setEstado('pendientes');
        return;
      }
      throw new Error(mensajeDeErrorBorrado(e));
    }
    await logout();
    toast.success('Tu cuenta se borró. Gracias por haber sido parte de Walá.');
    navigate('/', { replace: true });
  };

  return (
    <TarjetaBorrarCuenta
      seBorra={SE_BORRA}
      seConserva={SE_CONSERVA}
      estado={estado}
      pendientes={pendientes}
      error={error}
      metodos={metodosDeEntrada(user)}
      onRevisar={revisar}
      onCancelar={() => setEstado('inicio')}
      onBorrar={borrar}
    />
  );
}
