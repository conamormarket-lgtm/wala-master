import React from 'react';
import { Campo, CampoTelefono } from '../Formulario';
import { CampoFecha } from '../Fecha';
import { Texto } from '../Traduccion';
import s from './DatosPersonales.module.css';

/*
 * Los datos con los que se ubican los pedidos: nombre, país, documento,
 * celular y (opcional) cumpleaños. Los piden Mi perfil, el paso 2 de Crear
 * cuenta y Completar perfil: los tres usan esta pieza y las mismas reglas.
 */

export const TIPOS_DOCUMENTO = [
  { valor: 'DNI', texto: 'DNI' },
  { valor: 'CE', texto: 'Carnet de extranjería' },
  { valor: 'Pasaporte', texto: 'Pasaporte' },
];
export const NOMBRE_DOCUMENTO = { DNI: 'DNI', CE: 'Carnet de extranjería', Pasaporte: 'Pasaporte' };

/**
 * Las reglas de los datos personales (las de PerfilPage, RegisterPage y
 * CompleteProfilePage: utils/helpers). En el Perú: DNI de 8 números y
 * cualquier otro documento (carnet, pasaporte o un tipo viejo) de 9 a 12
 * letras o números (validateCE), y celular de 9 números que empieza con 9.
 * Fuera: documento de 3 o más y teléfono de 4 o más. El nombre, que no esté
 * vacío. Devuelve { campo: mensaje } (vacío si todo está bien).
 */
const MENSAJE_DOCUMENTO = {
  CE: 'El carnet tiene de 9 a 12 letras o números.',
  Pasaporte: 'El pasaporte tiene de 9 a 12 letras o números.',
};
export function validarPerfil(d) {
  const e = {};
  const peru = (d.pais || 'PE') === 'PE';
  const doc = String(d.documento || '').trim();
  const tel = String(d.telefono || '').replace(/\D/g, '');
  if (!String(d.nombre || '').trim()) e.nombre = 'Escribe tu nombre completo.';
  if (peru) {
    if ((d.tipoDocumento || 'DNI') === 'DNI') {
      if (!/^\d{8}$/.test(doc)) e.documento = 'El DNI tiene 8 números.';
    } else if (!/^[A-Za-z0-9]{9,12}$/.test(doc)) {
      e.documento = MENSAJE_DOCUMENTO[d.tipoDocumento] || 'El documento tiene de 9 a 12 letras o números.';
    }
    if (!/^9\d{8}$/.test(tel)) e.telefono = 'El celular tiene 9 números y empieza con 9.';
  } else {
    if (doc.length < 3) e.documento = 'Escribe tu documento de identidad.';
    if (tel.length < 4) e.telefono = 'Escribe tu teléfono.';
  }
  return e;
}

/**
 * El tipo de documento que corresponde a un país: en el Perú, el guardado si
 * es DNI, carnet o pasaporte (un tipo viejo pasa a DNI); fuera, 'OTRO' (así
 * lo guarda la tienda).
 */
export const tipoDocumentoPara = (pais, tipo) => {
  if ((pais || 'PE') !== 'PE') return 'OTRO';
  return TIPOS_DOCUMENTO.some((t) => t.valor === tipo) ? tipo : 'DNI';
};

/**
 * Los campos de los datos personales, sin botones (cada página pone los suyos).
 *  - datos: { nombre, pais, tipoDocumento, documento, telefono, cumpleanos }
 *  - onCambiar(campo, valor) · errores: { campo: mensaje } (validarPerfil)
 *  - paises: [{ valor, texto, prefijo }] (con uno solo no se pregunta el país)
 *  - cumpleanos: { etiqueta, ayuda } o false para no pedirlo
 *  - ayudaNombre: nota bajo el nombre ("Lo tomamos de tu cuenta de Google.")
 *  - disabled: mientras se guarda
 *  - ids: { nombre, documento, telefono } para llevar el foco al primer error
 */
export function CamposDatosPersonales({
  datos = {}, onCambiar, errores = {}, paises = [{ valor: 'PE', texto: 'Perú', prefijo: '+51' }],
  cumpleanos = { etiqueta: 'Fecha de nacimiento', ayuda: 'Para saludarte en tu día.' }, ayudaNombre, disabled = false, ids = {},
}) {
  const peru = (datos.pais || 'PE') === 'PE';
  const pais = paises.find((p) => p.valor === datos.pais) || paises[0];
  const opcionesPais = paises.map((p) => ({ ...p, detalle: p.prefijo, icono: <span className={s.codigoPais}>{p.valor}</span> }));
  const cambiar = (campo) => (e) => onCambiar?.(campo, e.target.value);
  const tipo = datos.tipoDocumento || 'DNI';
  // Las etiquetas, ayudas y ejemplos van en español: Campo, CampoTelefono y CampoFecha los traducen.
  const error = (campo) => errores[campo] && <Texto>{errores[campo]}</Texto>;
  return (
    <div className={s.campos} data-componente="CamposDatosPersonales">
      <Campo id={ids.nombre} etiqueta="Nombre completo" value={datos.nombre || ''} onChange={cambiar('nombre')} error={error('nombre')} ayuda={ayudaNombre}
        autoComplete="name" placeholder="Ej. Juan Pérez" disabled={disabled} />
      {paises.length > 1 && (
        <Campo etiqueta="País" opciones={opcionesPais} value={datos.pais || 'PE'} onChange={cambiar('pais')} buscable={paises.length > 6} disabled={disabled} />
      )}
      <div className={s.fila}>
        {peru && (
          <Campo etiqueta="Tipo de documento" opciones={TIPOS_DOCUMENTO} value={tipo} onChange={cambiar('tipoDocumento')} disabled={disabled} />
        )}
        <Campo
          id={ids.documento}
          etiqueta={peru ? `Número de ${NOMBRE_DOCUMENTO[tipo] || 'documento'}` : 'Documento de identidad'}
          value={datos.documento || ''}
          onChange={(e) => onCambiar?.('documento', peru ? e.target.value.replace(/\s/g, '') : e.target.value)}
          error={error('documento')}
          inputMode={peru && tipo === 'DNI' ? 'numeric' : 'text'}
          maxLength={peru && tipo === 'DNI' ? 8 : 12}
          placeholder={peru ? (tipo === 'DNI' ? '8 números' : undefined) : 'Pasaporte, ID o documento'}
          disabled={disabled}
        />
      </div>
      <div className={s.fila}>
        <CampoTelefono
          id={ids.telefono}
          etiqueta="Celular"
          pais={pais?.valor}
          paises={[pais]}
          valor={datos.telefono || ''}
          onCambiar={(v) => onCambiar?.('telefono', v)}
          error={error('telefono')}
          maximo={peru ? 9 : undefined}
          disabled={disabled}
        />
        {cumpleanos && (
          <CampoFecha
            etiqueta={cumpleanos.etiqueta}
            valor={datos.cumpleanos || ''}
            onCambiar={(v) => onCambiar?.('cumpleanos', v)}
            max={new Date().toISOString().slice(0, 10)}
            vistaInicial="anios"
            ayuda={cumpleanos.ayuda}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
