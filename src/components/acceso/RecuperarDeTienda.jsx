import React from 'react';
import { sendPasswordResetEmail } from '../../services/firebase/auth';
import { PaginaRecuperar } from '../../componentes/kit/paginas/Acceso';
import { errorDeAuth } from './comun';

/*
 * Recuperar la contraseña (/recuperar-contrasena) con el kit: el mismo
 * sendPasswordResetEmail (el correo en minúsculas y sin espacios, como
 * antes); el error, con el mensaje de siempre. Enviado, la página no dice si
 * la cuenta existe. Lo de antes: pages/ResetPasswordViejo.jsx (accesoViejo).
 */
export default function RecuperarDeTienda() {
  const enviar = async (correo) => {
    const { error, errorCode } = await sendPasswordResetEmail(correo);
    if (error) throw errorDeAuth(error, errorCode);
  };
  return <PaginaRecuperar onEnviar={enviar} urlLogin="/login" />;
}
