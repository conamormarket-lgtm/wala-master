import React from 'react';
import { Campo, CampoTelefono } from '../Formulario';
import { Texto, useTexto } from '../Traduccion';
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

/** Fuera del Perú el documento es uno solo, abierto (constants/documentTypes de la tienda). */
export const DOC_EXTRANJERO = 'Documento de identidad nacional';

/**
 * Reglas de una dirección. Devuelve { campo: mensaje }.
 *  - reglas: 'cuenta' (las de MisDireccionesPage: documento de 6 o más,
 *    teléfono de 6 dígitos o más) | 'checkout' (las del checkout de la tienda,
 *    más laxas: nombre y teléfono escritos, documento de 3 o más; el tipo
 *    exacto lo interpreta el ERP)
 *  - distritos: los del lugar elegido (lugares.distritos); con ellos, en el
 *    Perú el distrito tiene que ser uno de la lista (Mis direcciones)
 */
export function validarDireccion(d, { reglas = 'cuenta', distritos } = {}) {
  const e = {};
  const fuera = d.pais && d.pais !== 'PE';
  const checkout = reglas === 'checkout';
  if (String(d.nombre || '').trim().length < (checkout ? 1 : 3)) e.nombre = 'Escribe el nombre de quien recibe.';
  if (String(d.documento || '').trim().length < (checkout ? 3 : 6)) e.documento = 'Escribe un número de documento válido.';
  if (checkout ? !String(d.telefono || '').trim() : String(d.telefono || '').replace(/\D/g, '').length < 6) e.telefono = 'Escribe un teléfono válido.';
  if (fuera) {
    if (!String(d.provincia || '').trim()) e.provincia = 'Escribe la región o estado.';
    if (!String(d.distrito || '').trim()) e.distrito = 'Escribe la ciudad.';
  } else {
    if (d.ciudad === 'Provincias' && (!d.departamento || !d.provincia)) e.provincia = 'Elige el departamento y la provincia.';
    if (!d.distrito || (distritos?.length && !distritos.includes(d.distrito))) e.distrito = 'Elige el distrito.';
  }
  if (String(d.direccion || '').trim().length < (checkout ? 1 : 5)) e.direccion = 'Escribe la dirección exacta.';
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

/** "DNI 45871236" (fuera del Perú, solo el número). */
export const documentoDe = (d) => (d.pais && d.pais !== 'PE'
  ? String(d.documento || '')
  : `${DOCS_DIRECCION.find((x) => x.valor === d.tipoDocumento)?.valor || 'DNI'} ${d.documento}`);

const opcionesDe = (lista, primera) => [{ valor: '', texto: primera, deshabilitada: true }, ...lista.map((x) => ({ valor: x, texto: x }))];

/**
 * Los campos.
 *  - valor: { nombre, tipoDocumento, documento, telefono, pais, ciudad,
 *    departamento, provincia, distrito, direccion } · onCambiar(campo, valor)
 *    (con cambiarDireccion) · errores: { campo: mensaje }
 *  - lugares: { departamentos, provincias(dep), distritos(dir) }
 *  - paises: [{ valor, texto, prefijo? }] para elegir el país (sin él, se queda
 *    el de la dirección). Con prefijo ('+56'), el teléfono va con el del país.
 *    Fuera del Perú, el documento es un campo único (DOC_EXTRANJERO).
 *  - verDestinatario: los campos de quien recibe; si es false, resumido con
 *    "Cambiar" (onVerDestinatario) · children: lo que va al final (correo…)
 */
export function CamposDireccion({ valor: d, onCambiar, errores = {}, lugares = {}, paises, verDestinatario = true, onVerDestinatario, children }) {
  const { departamentos = [], provincias = () => [], distritos = () => [] } = lugares;
  const fuera = d.pais && d.pais !== 'PE';
  const listaDistritos = fuera ? [] : distritos(d);
  const cambiar = (campo) => (e) => onCambiar?.(campo, e.target.value);
  const paisTel = paises?.find((p) => p.valor === (d.pais || 'PE'));
  // Las etiquetas y los ejemplos van en español (Campo los traduce); las opciones, traducidas aquí.
  const t = {
    elige: useTexto('Elige…'), primeroDep: useTexto('Primero el departamento'), primeroProv: useTexto('Primero la provincia'),
  };
  // Los mensajes de validarDireccion también pasan por la traducción.
  const err = (campo) => errores[campo] && <Texto>{errores[campo]}</Texto>;
  return (
    <div className={s.campos} data-componente="CamposDireccion">
      {paises?.length > 0 && (
        <Campo etiqueta="País" opciones={paises} value={d.pais} onChange={cambiar('pais')} buscable={paises.length > 10} />
      )}
      {verDestinatario ? (
        <>
          <Campo etiqueta="Nombre de quien recibe" placeholder="Ej.: Juana Pérez" value={d.nombre} onChange={cambiar('nombre')} error={err('nombre')} autoComplete="name" />
          {fuera ? (
            <Campo etiqueta={DOC_EXTRANJERO} value={d.documento} onChange={cambiar('documento')} error={err('documento')} />
          ) : (
            <div className={s.fila}>
              <Campo etiqueta="Documento" opciones={DOCS_DIRECCION} value={d.tipoDocumento} onChange={cambiar('tipoDocumento')} />
              <Campo etiqueta="Número" value={d.documento} onChange={cambiar('documento')} error={err('documento')} inputMode={d.tipoDocumento === 'DNI' ? 'numeric' : undefined} />
            </div>
          )}
          <CampoTelefono
            valor={d.telefono}
            onCambiar={(v) => onCambiar?.('telefono', v)}
            error={err('telefono')}
            {...(paisTel?.prefijo ? { pais: paisTel.valor, paises: [{ valor: paisTel.valor, texto: paisTel.texto, prefijo: paisTel.prefijo }] } : {})}
          />
        </>
      ) : (
        <div className={s.destinatario}>
          <span className={s.destinatarioTexto}>
            <small><Texto>Recibe</Texto></small>
            <strong>{d.nombre}</strong>
            <span>{documentoDe(d)} · {d.telefono}</span>
          </span>
          <button type="button" className={s.cambiar} onClick={onVerDestinatario}><Texto>Cambiar</Texto></button>
        </div>
      )}

      {fuera ? (
        <div className={s.fila}>
          <Campo etiqueta="Región / Estado" placeholder="Ej.: Región Metropolitana" value={d.provincia} onChange={cambiar('provincia')} error={err('provincia')} />
          <Campo etiqueta="Ciudad" placeholder="Ej.: Santiago" value={d.distrito} onChange={cambiar('distrito')} error={err('distrito')} />
        </div>
      ) : (
        <>
          <Campo etiqueta="Ciudad o región" opciones={CIUDADES} value={d.ciudad} onChange={cambiar('ciudad')} />
          {d.ciudad === 'Provincias' && (
            <div className={s.fila}>
              <Campo
                etiqueta="Departamento"
                opciones={opcionesDe(departamentos.filter((x) => x !== 'Callao'), t.elige)}
                value={d.departamento}
                onChange={cambiar('departamento')}
              />
              <Campo
                etiqueta="Provincia"
                opciones={opcionesDe(d.departamento ? provincias(d.departamento).filter((p) => !(d.departamento === 'Lima' && p === 'Lima')) : [], d.departamento ? t.elige : t.primeroDep)}
                value={d.provincia}
                onChange={cambiar('provincia')}
                error={err('provincia')}
                disabled={!d.departamento}
              />
            </div>
          )}
          <Campo
            etiqueta="Distrito"
            opciones={opcionesDe(listaDistritos, listaDistritos.length ? t.elige : t.primeroProv)}
            value={d.distrito}
            onChange={cambiar('distrito')}
            error={err('distrito')}
            disabled={!listaDistritos.length}
          />
        </>
      )}
      <Campo
        etiqueta="Dirección exacta"
        value={d.direccion}
        onChange={cambiar('direccion')}
        error={err('direccion')}
        placeholder="Calle, número, dpto. y una referencia"
        autoComplete="street-address"
      />
      {children}
    </div>
  );
}
