import React from 'react';
import { SelectorTalla, SelectorColor, Cantidad } from '../Formulario';
import { Texto } from '../Traduccion';
import s from './OpcionesProducto.module.css';

/**
 * Las opciones de un producto antes de agregarlo: el color de cada pieza (un
 * combo), el color o el modelo, la talla (o medida, número…) y la cantidad.
 * Es lo mismo en "Agregar rápido" (la hoja de una tarjeta) y en la ficha del
 * producto. Sirve para cualquier producto, no solo ropa (el modelo de la
 * tienda; los datos salen de adaptadores.opcionesDeProducto):
 *
 *  - variantes: [{ id, nombre, colorHex?, claro?, opciones?: string[] }]. Si
 *    todas tienen color van como muestras (círculos de color, nunca la foto);
 *    si no, como botones con el nombre ("Feliz", "Clásico"…). Una sola
 *    variante solo se muestra si tiene tallas y color (como la tienda).
 *    varId · onVariante(id)
 *  - opciones: string[] por defecto (mainSizes) si la variante no trae las
 *    suyas · etiquetaOpcion: 'Talla' | 'Medida'… · agotadas · opcion · onOpcion
 *    · notaOpcion: una línea bajo la talla
 *  - piezas: combos → [{ nombre, colores: [{ nombre, hex, claro, tallas }],
 *    tallas }] · colores: { [i]: nombre } · onColorPieza(i, nombre).
 *    Cada prenda lleva su color y, debajo, su talla (una pareja puede ser de
 *    tallas distintas): tallasPiezas: { [i]: talla } · onTallaPieza(i, talla).
 *    Las tallas de una prenda son las de su color elegido (tallasDePieza).
 *    tallaUnica (el admin lo elige por combo): una sola talla para todas
 *    (opcion/onOpcion), la que comparten los colores elegidos (tallasDe), con
 *    "Se aplica a las N prendas".
 *  - cantidad · onCantidad · maxCantidad · onGuia (guía de tallas)
 *  - falta: la talla que falta se marca en rojo con "Elige una talla para
 *    continuar" (en un combo, la de cada prenda sin talla). Un número que
 *    cambia la vuelve a sacudir.
 */
export function OpcionesProducto({
  variantes = [], varId, onVariante, opciones = [], etiquetaOpcion = 'Talla', agotadas = [], opcion, onOpcion, notaOpcion,
  piezas = [], colores = {}, onColorPieza, tallasPiezas = {}, onTallaPieza, tallaUnica = false, cantidad, onCantidad, maxCantidad = 10, onGuia, falta = false,
}) {
  const variante = variantes.find((v) => v.id === varId) || variantes[0];
  const lista = tallasDe({ variante, opciones, piezas, colores });
  const conColor = conMuestras(variantes);
  const talla = ({ etiqueta, tallas, valor, onChange, nota }) => {
    const sinElegir = Boolean(falta) && !valor;
    return (
      // La clave cambia con cada aviso: la sacudida se repite en cada intento.
      <div key={sinElegir ? `falta-${falta}` : 'ok'} className={[s.opcion, sinElegir && s.falta].filter(Boolean).join(' ')}>
        <SelectorTalla
          etiqueta={etiqueta}
          tallas={tallas}
          agotadas={agotadas}
          valor={valor}
          onChange={onChange}
          guia={etiquetaOpcion === 'Talla' ? onGuia : undefined}
        />
        {sinElegir && <p className={s.aviso} role="alert"><Texto>{`Elige ${articulo(etiquetaOpcion)} para continuar.`}</Texto></p>}
        {!sinElegir && nota && <p className={s.nota}><Texto>{nota}</Texto></p>}
      </div>
    );
  };
  return (
    <div className={s.opciones} data-componente="OpcionesProducto">
      {piezas.map((p, i) => {
        const tallas = tallasDePieza(p, colores[i]);
        return (
          <React.Fragment key={`${p.nombre}-${i}`}>
            {p.colores.length > 0 && (
              <SelectorColor
                etiqueta={`Color · ${p.nombre}`}
                colores={p.colores}
                valor={colores[i]}
                onChange={(c) => onColorPieza?.(i, c)}
              />
            )}
            {!tallaUnica && tallas.length > 0 && talla({
              etiqueta: `${etiquetaOpcion} · ${p.nombre}`,
              tallas,
              valor: tallasPiezas[i],
              onChange: (t) => onTallaPieza?.(i, t),
            })}
          </React.Fragment>
        );
      })}

      {verVariantes(variantes) && (conColor ? (
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

      {(!piezas.length || tallaUnica) && lista.length > 0 && talla({
        etiqueta: etiquetaOpcion,
        tallas: lista,
        valor: opcion,
        onChange: onOpcion,
        nota: notaOpcion || (tallaUnica && piezas.length > 1 ? `Se aplica a las ${piezas.length} prendas.` : undefined),
      })}

      {onCantidad && (
        <div className={s.fila}>
          <span><Texto>Cantidad</Texto></span>
          <Cantidad valor={cantidad} onChange={onCantidad} max={maxCantidad} />
        </div>
      )}
    </div>
  );
}

/** Las tallas de la variante elegida (o las del producto). */
export const opcionesDe = (variante, opciones = []) => (variante?.opciones?.length ? variante.opciones : opciones);

/** Las tallas de una prenda de un combo con su color elegido (sin colores, las de la prenda). */
export const tallasDePieza = (p, color) => (p?.colores?.length
  ? (p.colores.find((c) => c.nombre === color) || p.colores[0]).tallas || []
  : p?.tallas || []);

/** Las prendas de un combo con tallas y todavía sin una elegida (sus índices). */
export const piezasSinTalla = (piezas = [], colores = {}, tallas = {}) => piezas
  .map((p, i) => (tallasDePieza(p, colores[i]).length && !tallas[i] ? i : -1))
  .filter((i) => i >= 0);

/**
 * ¿Falta elegir talla? Producto suelto o combo de talla única: la `opcion`; si
 * no, la de cada prenda (`tallas`).
 */
export const faltaTalla = ({ variante, opciones = [], piezas = [], colores = {}, opcion, tallas = {}, tallaUnica = false }) => (
  piezas.length && !tallaUnica
    ? piezasSinTalla(piezas, colores, tallas).length > 0
    : tallasDe({ variante, opciones, piezas, colores }).length > 0 && !opcion
);

/**
 * Las tallas que se pueden elegir. En un combo, las que comparten las prendas
 * con el color elegido de cada una (o todas, si no comparten ninguna; las de
 * siempre, si las prendas no llegaron): la misma regla que comboSizeOptions de
 * la tienda. Si no, las de la variante (opcionesDe).
 */
export const tallasDe = ({ variante, opciones = [], piezas = [], colores = {} }) => {
  if (!piezas.length) return opcionesDe(variante, opciones);
  const listas = piezas
    .map((p, i) => tallasDePieza(p, colores[i]))
    .filter((l) => l.length);
  if (!listas.length) return opciones;
  const [primera, ...resto] = listas;
  const comunes = primera.filter((t) => resto.every((l) => l.includes(t)));
  return comunes.length ? comunes : [...new Set(listas.flat())];
};

/** Las variantes van como muestras de color si todas tienen color (el guardado o el del nombre). */
export const conMuestras = (variantes = []) => variantes.length > 0 && variantes.every((v) => v.colorHex);

/** Hay qué elegir (o qué mostrar): varias variantes, o una sola con tallas y color. */
export const verVariantes = (variantes = []) => variantes.length > 1
  || (variantes.length === 1 && variantes[0].opciones?.length > 0 && conMuestras(variantes));

/** "una talla", "un número", "una medida"… */
const articulo = (etiqueta = 'Talla') => {
  const e = etiqueta.toLowerCase();
  return `${e.endsWith('a') ? 'una' : 'un'} ${e}`;
};
