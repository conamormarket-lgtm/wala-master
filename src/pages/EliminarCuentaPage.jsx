import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import LegalDeTienda from '../components/legales/LegalDeTienda';
import { ELIMINAR_CUENTA } from '../config/legales/eliminarCuenta';
import { tieneCuenta, urlLogin } from '../utils/rutaPrivada';

/*
 * /eliminar-cuenta (pública, sin sesión): cómo borrar la cuenta desde la app
 * o la web, qué se borra, qué se conserva y por cuánto, y el contacto de
 * soporte. Es el enlace que se da a Google Play. El botón del final lleva a
 * Mi cuenta › Ajustes › Borrar mi cuenta (con el login antes, si hace falta).
 */
const DESTINO = '/cuenta/ajustes#borrar-cuenta';

export default function EliminarCuentaPage() {
  const { user } = useAuth();
  const otro = {
    pregunta: tieneCuenta(user) ? '¿Ya decidiste borrarla?' : '¿Quieres borrarla desde la web?',
    texto: tieneCuenta(user) ? 'Ir a Borrar mi cuenta' : 'Iniciar sesión y borrar mi cuenta',
    url: tieneCuenta(user) ? DESTINO : urlLogin(DESTINO),
  };
  return (
    <LegalDeTienda
      tipo="privacidad"
      documento={ELIMINAR_CUENTA}
      otro={otro}
      mensaje="¡Hola Walá! Quiero borrar mi cuenta."
    />
  );
}
