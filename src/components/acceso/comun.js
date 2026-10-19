import { COUNTRIES, dialCodeByCountry } from '../../constants/countries';
import { getAuthErrorMessage } from '../../utils/authErrorMessages';

/*
 * Lo que comparten las páginas de acceso con el kit (paso 6, ACCESO.md).
 */

/** Los países como los pide el kit (CamposDatosPersonales). */
export const PAISES = COUNTRIES.map((c) => ({ valor: c.code, texto: c.name, prefijo: c.dialCode }));

/** Un fallo de Firebase Auth como el error que muestra la página (el mensaje de siempre). */
export const errorDeAuth = (error, errorCode) => new Error(getAuthErrorMessage(errorCode, error));

/** Cerrar la ventana de Google no es un error: solo se deja de cargar. */
export const cerroGoogle = (errorCode) => errorCode === 'auth/popup-closed-by-user' || errorCode === 'auth/cancelled-popup-request';

/**
 * Un enlace entre login y registro que no pierde a dónde volver: antes iba en
 * el state del router; ahora en ?redirect= (lo lee leerDestino).
 */
export const conDestino = (ruta, destino) => (destino ? `${ruta}?redirect=${encodeURIComponent(destino)}` : ruta);

/**
 * Los datos del pedido del kit → los campos del perfil, como los guardaban
 * el registro y completar perfil: el documento en dni, clienteNumeroDocumento
 * y envioNumeroDocumento; el tipo en tipoDocumento, clienteTipoDocumento y
 * docType ('OTRO' fuera del Perú); en el Perú el celular solo con números y,
 * fuera, phone con el código del país y phoneIntl.
 */
export function camposDelPedido(datos) {
  const peru = (datos.pais || 'PE') === 'PE';
  const documento = peru ? String(datos.documento || '').trim().replace(/\s/g, '') : String(datos.documento || '').trim();
  const tipo = peru ? (datos.tipoDocumento || 'DNI') : 'OTRO';
  const campos = {
    displayName: String(datos.nombre || '').trim(),
    country: datos.pais || 'PE',
    dni: documento,
    clienteNumeroDocumento: documento,
    envioNumeroDocumento: documento,
    tipoDocumento: tipo,
    clienteTipoDocumento: tipo,
    docType: tipo,
  };
  if (peru) {
    campos.phone = String(datos.telefono || '').replace(/\D/g, '');
  } else {
    const dialCode = dialCodeByCountry(datos.pais) || '';
    const localNumber = String(datos.telefono || '').trim();
    campos.phone = `${dialCode}${localNumber}`;
    campos.phoneIntl = { dialCode, localNumber, full: `${dialCode}${localNumber}` };
  }
  return campos;
}
