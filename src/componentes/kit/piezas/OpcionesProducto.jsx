import React from 'react';
import { SelectorTalla, SelectorColor, Cantidad } from '../Formulario';
import s from './OpcionesProducto.module.css';

/**
 * Las opciones de un producto antes de agregarlo: el color de cada pieza (un
 * combo), el color o el modelo, la talla (o medida, número…) y la cantidad.
 * Es lo mismo en "Agregar rápido" (la hoja de una tarjeta) y en la ficha del
 * producto. Sirve para cualquier producto, no solo ropa (el modelo de la
 * tienda; los datos salen de adaptadores.opcionesDeProducto):
 *
 *  - variantes: [{ id, nombre, colorHex?, claro?, opciones?: string[] }]. Si
 *    todas tienen colorHex van como muestras de color; si no, como botones con
 *    el nombre ("Feliz", "Clásico"…). Con una sola variante no hay selector.
 *    varId · onVariante(id)
 *  - opciones: string[] por defecto (mainSizes) si la variante no trae las
 *    suyas · etiquetaOpcion: 'Talla' | 'Medida'… · agotadas · opcion · onOpcion
 *    · notaOpcion: una línea bajo la talla ("Se aplica a las 2 prendas")
 *  - piezas: combos → [{ nombre, colores: [{ nombre, hex }] }] · colores:
 *    { [i]: nombre } · onColorPieza(i, nombre)
 *  - cantidad · onCantidad · maxCantidad · onGuia (guía de tallas)
 *  - falta: la talla se marca en rojo con "Elige una talla para continuar"
 */
export function OpcionesProducto({
  variantes = [], varId, onVariante, opciones = [], etiquetaOpcion = 'Talla', agotadas = [], opcion, onOpcion, notaOpcion,
  piezas = [], colores = {}, onColorPieza, cantidad, onCantidad, maxCantidad = 10, onGuia, falta = false,
}) {
  const variante = variantes.find((v) => v.id === varId) || variantes[0];
  const lista = opcionesDe(variante, opciones);
  const conColor = variantes.length > 1 && variantes.every((v) => v.colorHex);
  return (
    <div className={s.opciones} data-componente="OpcionesProducto">
      {piezas.map((p, i) => p.colores.length > 0 && (
        <SelectorColor
          key={`${p.nombre}-${i}`}
          etiqueta={`Color · ${p.nombre}`}
          colores={p.colores}
          valor={colores[i]}
          onChange={(c) => onColorPieza?.(i, c)}
        />
      ))}

      {variantes.length > 1 && (conColor ? (
        <SelectorColor
          colores={variantes.map((v) => ({ nombre: v.nombre, hex: v.colorHex, claro: v.claro }))}
          valor={variante?.nombre}
          onChange={(n) => onVariante?.(variantes.find((v) => v.nombre === n)?.id)}
        />
      ) : (
        <SelectorTalla
          etiqueta="Modelo"
          tallas={variantes.map((v) => v.nombre)}
          valor={variante?.nombre}
          onChange={(n) => onVariante?.(variantes.find((v) => v.nombre === n)?.id)}
        />
      ))}

      {lista.length > 0 && (
        <div className={[s.opcion, falta && s.falta].filter(Boolean).join(' ')}>
          <SelectorTalla
            etiqueta={etiquetaOpcion}
            tallas={lista}
            agotadas={agotadas}
            valor={opcion}
            onChange={onOpcion}
            guia={etiquetaOpcion === 'Talla' ? onGuia : undefined}
          />
          {falta && <p className={s.aviso} role="alert">Elige {articulo(etiquetaOpcion)} para continuar.</p>}
          {!falta && notaOpcion && <p className={s.nota}>{notaOpcion}</p>}
        </div>
      )}

      {onCantidad && (
        <div className={s.fila}>
          <span>Cantidad</span>
          <Cantidad valor={cantidad} onChange={onCantidad} max={maxCantidad} />
        </div>
      )}
    </div>
  );
}

/** Las tallas de la variante elegida (o las del producto). */
export const opcionesDe = (variante, opciones = []) => (variante?.opciones?.length ? variante.opciones : opciones);

/** "una talla", "un número", "una medida"… */
const articulo = (etiqueta = 'Talla') => {
  const e = etiqueta.toLowerCase();
  return `${e.endsWith('a') ? 'una' : 'un'} ${e}`;
};
