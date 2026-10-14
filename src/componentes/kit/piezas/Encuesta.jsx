import React from 'react';
import { Check, CheckCircle2, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { Sello } from '../Marca';
import { Avatar } from './Avatar';
import { BarraProgreso } from './BarraProgreso';
import s from './Encuesta.module.css';

/*
 * Piezas de la encuesta (/encuesta-suscripcion): el avance, elegir varias
 * opciones en tarjetas con sello y la ficha de cada persona del paso de los
 * grupos. Datos por props.
 */

/**
 * Avance de la encuesta: "Paso 2 de 3" (o "¡Listo!") y la barra con el
 * degradado del logo.
 *  - texto · avance: de 0 a 1
 */
export function ProgresoEncuesta({ texto, avance = 0 }) {
  return (
    <div className={s.progreso} data-componente="ProgresoEncuesta">
      <span className={s.progresoTexto}>{texto}</span>
      <BarraProgreso valor={Math.round(avance * 100)} max={100} minimo={4} />
    </div>
  );
}

/**
 * Elegir varias opciones en tarjetas (a quiénes regalas): cada una con su
 * sello; la elegida se pinta de violeta y lleva un visto en la esquina.
 *  - opciones: [{ valor, texto, Icono, tono }] · valores: [valor]
 *  - onCambiar(valores) · etiqueta: nombre del grupo para lectores
 */
export function ElegirVarios({ opciones = [], valores = [], onCambiar, etiqueta }) {
  const alternar = (v) => onCambiar?.(valores.includes(v) ? valores.filter((x) => x !== v) : [...valores, v]);
  return (
    <div className={s.varios} role="group" aria-label={etiqueta} data-componente="ElegirVarios">
      {opciones.map(({ valor, texto, Icono, tono }, k) => {
        const activo = valores.includes(valor);
        return (
          <button
            key={valor}
            type="button"
            className={[s.opcion, activo && s.opcionActiva].filter(Boolean).join(' ')}
            aria-pressed={activo}
            onClick={() => alternar(valor)}
            style={{ '--giro': `${k % 2 ? 6 : -8}deg` }}
          >
            <span className={s.opcionSello}>
              <Sello tamano={44} tono={activo ? (tono || 'degradado') : 'suave'} girar={0}>{Icono && <Icono aria-hidden="true" />}</Sello>
            </span>
            <span className={s.opcionTexto}>{texto}</span>
            <span className={s.visto} aria-hidden="true"><Check /></span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Una persona en el paso de los grupos de la encuesta: su inicial o foto,
 * nombre, si ya está completa y sus botones.
 *  - nombre (vacío: se ve la relación, "Pareja", y "Faltan datos") · relacion · foto · completa
 *  - onEditar · onQuitar (sin ella no hay tacho; la pareja no se quita)
 */
export function FichaPersonaEncuesta({ nombre, relacion, foto, completa = false, onEditar, onQuitar }) {
  return (
    <li className={[s.ficha, completa ? s.fichaLista : s.fichaFalta].filter(Boolean).join(' ')} data-componente="FichaPersonaEncuesta">
      <button type="button" className={s.fichaPrincipal} onClick={onEditar}>
        <Avatar className={s.fichaAvatar} nombre={nombre} imagen={foto} letras={1}>?</Avatar>
        <span className={s.fichaTextos}>
          <strong>{nombre || relacion}</strong>
          <span className={completa ? s.estadoOk : s.estadoFalta}>
            {completa ? <CheckCircle2 aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
            {completa ? 'Lista' : 'Faltan datos'}
          </span>
        </span>
        <span className={s.fichaAccion}><Pencil aria-hidden="true" /> <span className={s.fichaAccionTexto}>{completa ? 'Editar' : 'Completar'}</span></span>
      </button>
      {onQuitar && (
        <button type="button" className={s.quitar} onClick={onQuitar} aria-label={`Quitar a ${nombre || relacion}`}>
          <Trash2 aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
