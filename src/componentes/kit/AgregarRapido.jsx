import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, Wand2 } from 'lucide-react';
import Boton from './Boton';
import { HojaInferior } from './Feedback';
import { SelectorTalla, SelectorColor, Cantidad } from './Formulario';
import { soles } from './TarjetaProducto';
import s from './AgregarRapido.module.css';

/**
 * Elegir opciones antes de agregar al carrito, sin salir de la lista.
 * Sirve para cualquier producto, no solo ropa (mismo modelo que la tienda):
 *
 *  - variantes: [{ id, nombre, colorHex?, imagen?, opciones?: string[] }]
 *      Cada variante es un color o un estilo. Si todas tienen colorHex se
 *      muestran como muestras de color; si no, como botones con el nombre
 *      ("Feliz", "Clásico"…). Con una sola variante no se muestra selector.
 *  - opciones: string[] por defecto (mainSizes) si la variante no trae las suyas.
 *  - etiquetaOpcion: 'Talla' | 'Medida' | 'Número' | 'Tamaño'… (sizeLabel).
 *  - piezas: combos → [{ nombre, colores: [{ nombre, hex }] }], un color por pieza
 *      y la opción (talla) compartida.
 *  - personalizable + onPersonalizar(eleccion): botón secundario "Personalizar".
 *  - onConfirmar({ variante, opcion, piezas, cantidad }).
 */
export default function AgregarRapido({
  abierto,
  onCerrar,
  producto,
  variantes = [],
  opciones = [],
  etiquetaOpcion = 'Talla',
  agotadas = [],
  piezas = [],
  personalizable = false,
  onPersonalizar,
  onConfirmar,
  onGuia,
}) {
  const [varId, setVarId] = useState(null);
  const [opcion, setOpcion] = useState(null);
  const [colores, setColores] = useState({});
  const [cantidad, setCantidad] = useState(1);

  // Cada vez que se abre para un producto, empieza limpio.
  useEffect(() => {
    if (!abierto) return;
    setVarId(variantes[0]?.id ?? null);
    setOpcion(null);
    setColores(Object.fromEntries(piezas.map((p, i) => [i, p.colores[0]?.nombre])));
    setCantidad(1);
  }, [abierto, producto?.nombre]); // eslint-disable-line react-hooks/exhaustive-deps

  const variante = variantes.find((v) => v.id === varId) || variantes[0];
  const lista = variante?.opciones?.length ? variante.opciones : opciones;
  const conColor = variantes.length > 1 && variantes.every((v) => v.colorHex);

  // Si la variante elegida no tiene la opción marcada, se limpia.
  useEffect(() => {
    if (opcion && !lista.includes(opcion)) setOpcion(null);
  }, [varId]); // eslint-disable-line react-hooks/exhaustive-deps

  const titulo = useMemo(() => {
    if (piezas.length) return 'Arma tu combo';
    if (variantes.length > 1 && lista.length) return 'Elige tus opciones';
    if (lista.length) return `Elige tu ${etiquetaOpcion.toLowerCase()}`;
    return conColor ? 'Elige el color' : 'Elige el modelo';
  }, [piezas.length, variantes.length, lista.length, etiquetaOpcion, conColor]);

  if (!producto) return null;
  const falta = lista.length > 0 && !opcion;
  const eleccion = { variante, opcion, piezas: colores, cantidad };

  return (
    <HojaInferior
      abierta={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      pie={(
        <div className={s.pie}>
          {personalizable && (
            <Boton variante="contorno" icono={<Wand2 aria-hidden="true" />} onClick={() => onPersonalizar?.(eleccion)}>
              Personalizar
            </Boton>
          )}
          <Boton
            bloque
            tamano="lg"
            icono={<ShoppingBag aria-hidden="true" />}
            disabled={falta}
            onClick={() => onConfirmar?.(eleccion)}
          >
            {falta ? `Elige ${etiquetaOpcion.toLowerCase()}` : `Agregar · ${soles(producto.precio * cantidad)}`}
          </Boton>
        </div>
      )}
    >
      <div className={s.contenido}>
        <div className={s.producto}>
          <span className={s.foto}><img src={variante?.imagen || producto.imagen} alt="" /></span>
          <div>
            <strong>{producto.nombre}</strong>
            <span className={s.precio}>
              {soles(producto.precio)}
              {producto.precioAntes && <s>{soles(producto.precioAntes)}</s>}
            </span>
          </div>
        </div>

        {piezas.map((p, i) => (
          <SelectorColor
            key={p.nombre}
            etiqueta={`Color · ${p.nombre}`}
            colores={p.colores}
            valor={colores[i]}
            onChange={(c) => setColores((x) => ({ ...x, [i]: c }))}
          />
        ))}

        {variantes.length > 1 && (conColor ? (
          <SelectorColor
            colores={variantes.map((v) => ({ nombre: v.nombre, hex: v.colorHex, claro: v.claro }))}
            valor={variante?.nombre}
            onChange={(n) => setVarId(variantes.find((v) => v.nombre === n)?.id)}
          />
        ) : (
          <SelectorTalla
            etiqueta="Modelo"
            tallas={variantes.map((v) => v.nombre)}
            valor={variante?.nombre}
            onChange={(n) => setVarId(variantes.find((v) => v.nombre === n)?.id)}
          />
        ))}

        {lista.length > 0 && (
          <SelectorTalla
            etiqueta={etiquetaOpcion}
            tallas={lista}
            agotadas={agotadas}
            valor={opcion}
            onChange={setOpcion}
            guia={etiquetaOpcion === 'Talla' ? onGuia : undefined}
          />
        )}

        <div className={s.fila}>
          <span>Cantidad</span>
          <Cantidad valor={cantidad} onChange={setCantidad} max={10} />
        </div>
      </div>
    </HojaInferior>
  );
}
