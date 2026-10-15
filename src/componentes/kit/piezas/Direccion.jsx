import React from 'react';
import { Campo, CampoTelefono } from '../Formulario';
import s from './Direccion.module.css';

/*
 * Los campos de una dirección de envío: quién recibe (nombre, documento y
 * teléfono, o resumido con "Cambiar"), el lugar (Lima, Callao o provincias
 * con su departamento, provincia y distrito; fuera del Perú, región y ciudad)
 * y la dirección exacta. Los usan Mis direcciones y el checkout. Solo los
 * campos: el <form> y los botones son de quien los usa.
 */

export const CIUDADES = [
  { valor: 'Lima', texto: 'Lima Metropolitana' },
  { valor: 'Callao', texto: 'Callao' },
  { valor: 'Provincias', texto: 'Otras provincias' },
];

export const DOCS_DIRECCION = [
  { valor: 'DNI', texto: 'DNI' },
  { valor: 'CE', texto: 'Carnet de extranjería' },
  { valor: 'Pasaporte', texto: 'Pasaporte' },
];

/** Reglas de una dirección (las de MisDireccionesPage y el checkout). Devuelve { campo: mensaje }. */
export function validarDireccion(d) {
  const e = {};
  const fuera = d.pais && d.pais !== 'PE';
  if (String(d.nombre || '').trim().length < 3) e.nombre = 'Escribe el nombre de quien recibe.';
  if (String(d.documento || '').trim().length < 6) e.documento = 'Escribe un número de documento válido.';
  if (String(d.telefono || '').replace(/\D/g, '').length < 6) e.telefono = 'Escribe un teléfono válido.';
  if (fuera) {
    if (!String(d.provincia || '').trim()) e.provincia = 'Escribe la región o estado.';
    if (!String(d.distrito || '').trim()) e.distrito = 'Escribe la ciudad.';
  } else {
    if (d.ciudad === 'Provincias' && (!d.departamento || !d.provincia)) e.provincia = 'Elige el departamento y la provincia.';
    if (!d.distrito) e.distrito = 'Elige el distrito.';
  }
  if (String(d.direccion || '').trim().length < 5) e.direccion = 'Escribe la dirección exacta.';
  return e;
}

/**
 * Cambia un campo y limpia lo que ya no corresponde: al cambiar de país, de
 * ciudad, de departamento o de provincia, el distrito (y lo que cuelga) se borra.
 */
export function cambiarDireccion(d, campo, valor) {
  const n = { ...d, [campo]: valor };
  if (campo === 'pais' && (d.pais === 'PE') !== (valor === 'PE')) Object.assign(n, { ciudad: valor === 'PE' ? 'Lima' : '', departamento: '', provincia: '', distrito: '' });
  if (campo === 'ciudad') Object.assign(n, { departamento: '', provincia: '', distrito: '' });
  if (campo === 'departamento') Object.assign(n, { provincia: '', distrito: '' });
  if (campo === 'provincia' && n.pais === 'PE') n.distrito = '';
  return n;
}

/** "DNI 45871236" */
export const documentoDe = (d) => `${DOCS_DIRECCION.find((x) => x.valor === d.tipoDocumento)?.valor || 'DNI'} ${d.documento}`;

const opcionesDe = (lista, primera) => [{ valor: '', texto: primera, deshabilitada: true }, ...lista.map((x) => ({ valor: x, texto: x }))];

/**
 * Los campos.
 *  - valor: { nombre, tipoDocumento, documento, telefono, pais, ciudad,
 *    departamento, provincia, distrito, direccion } · onCambiar(campo, valor)
 *    (con cambiarDireccion) · errores: { campo: mensaje }
 *  - lugares: { departamentos, provincias(dep), distritos(dir) }
 *  - paises: [{ valor, texto }] para elegir el país (sin él, se queda el de la dirección)
 *  - verDestinatario: los campos de quien recibe; si es false, resumido con
 *    "Cambiar" (onVerDestinatario) · children: lo que va al final (correo…)
 */
export function CamposDireccion({ valor: d, onCambiar, errores = {}, lugares = {}, paises, verDestinatario = true, onVerDestinatario, children }) {
  const { departamentos = [], provincias = () => [], distritos = () => [] } = lugares;
  const fuera = d.pais && d.pais !== 'PE';
  const listaDistritos = fuera ? [] : distritos(d);
  const cambiar = (campo) => (e) => onCambiar?.(campo, e.target.value);
  return (
    <div className={s.campos} data-componente="CamposDireccion">
      {paises?.length > 0 && (
        <Campo etiqueta="País" opciones={paises} value={d.pais} onChange={cambiar('pais')} buscable={paises.length > 10} />
      )}
      {verDestinatario ? (
        <>
          <Campo etiqueta="Nombre de quien recibe" placeholder="Ej.: Juana Pérez" value={d.nombre} onChange={cambiar('nombre')} error={errores.nombre} autoComplete="name" />
          <div className={s.fila}>
            <Campo etiqueta="Documento" opciones={DOCS_DIRECCION} value={d.tipoDocumento} onChange={cambiar('tipoDocumento')} />
            <Campo etiqueta="Número" value={d.documento} onChange={cambiar('documento')} error={errores.documento} inputMode={d.tipoDocumento === 'DNI' ? 'numeric' : undefined} />
          </div>
          <CampoTelefono valor={d.telefono} onCambiar={(v) => onCambiar?.('telefono', v)} error={errores.telefono} />
        </>
      ) : (
        <div className={s.destinatario}>
          <span className={s.destinatarioTexto}>
            <small>Recibe</small>
            <strong>{d.nombre}</strong>
            <span>{documentoDe(d)} · {d.telefono}</span>
          </span>
          <button type="button" className={s.cambiar} onClick={onVerDestinatario}>Cambiar</button>
        </div>
      )}

      {fuera ? (
        <div className={s.fila}>
          <Campo etiqueta="Región / Estado" placeholder="Ej.: Región Metropolitana" value={d.provincia} onChange={cambiar('provincia')} error={errores.provincia} />
          <Campo etiqueta="Ciudad" placeholder="Ej.: Santiago" value={d.distrito} onChange={cambiar('distrito')} error={errores.distrito} />
        </div>
      ) : (
        <>
          <Campo etiqueta="Ciudad o región" opciones={CIUDADES} value={d.ciudad} onChange={cambiar('ciudad')} />
          {d.ciudad === 'Provincias' && (
            <div className={s.fila}>
              <Campo
                etiqueta="Departamento"
                opciones={opcionesDe(departamentos.filter((x) => x !== 'Callao'), 'Elige…')}
                value={d.departamento}
                onChange={cambiar('departamento')}
              />
              <Campo
                etiqueta="Provincia"
                opciones={opcionesDe(d.departamento ? provincias(d.departamento).filter((p) => !(d.departamento === 'Lima' && p === 'Lima')) : [], d.departamento ? 'Elige…' : 'Primero el departamento')}
                value={d.provincia}
                onChange={cambiar('provincia')}
                error={errores.provincia}
                disabled={!d.departamento}
              />
            </div>
          )}
          <Campo
            etiqueta="Distrito"
            opciones={opcionesDe(listaDistritos, listaDistritos.length ? 'Elige…' : 'Primero la provincia')}
            value={d.distrito}
            onChange={cambiar('distrito')}
            error={errores.distrito}
            disabled={!listaDistritos.length}
          />
        </>
      )}
      <Campo
        etiqueta="Dirección exacta"
        value={d.direccion}
        onChange={cambiar('direccion')}
        error={errores.direccion}
        placeholder="Calle, número, dpto. y una referencia"
        autoComplete="street-address"
      />
      {children}
    </div>
  );
}
