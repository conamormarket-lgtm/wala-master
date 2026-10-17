import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, Wand2 } from 'lucide-react';
import Boton from './Boton';
import { HojaInferior } from './Feedback';
import { Texto } from './Traduccion';
import { Hueso } from './Esqueletos';
import { soles } from './TarjetaProducto';
import { FotoProducto } from './piezas/FotoProducto';
import { OpcionesProducto, tallasDe, conMuestras } from './piezas/OpcionesProducto';
import s from './AgregarRapido.module.css';

/**
 * Elegir opciones antes de agregar al carrito, sin salir de la lista. Los
 * selectores son OpcionesProducto (los mismos de la ficha del producto).
 * Sirve para cualquier producto, no solo ropa (mismo modelo que la tienda):
 *
 *  - variantes: [{ id, nombre, colorHex?, imagen?, opciones?: string[] }]
 *      Cada variante es un color o un estilo. Si todas tienen color se
 *      muestran como muestras; si no, como botones con el nombre ("Feliz",
 *      "Clásico"…). Una sola variante solo se muestra si tiene tallas y color.
 *  - opciones: string[] por defecto (mainSizes) si la variante no trae las suyas.
 *  - etiquetaOpcion: 'Talla' | 'Medida' | 'Número' | 'Tamaño'… (sizeLabel).
 *  - piezas: combos → [{ nombre, colores: [{ nombre, hex, tallas }] }], un color por pieza
 *      y la opción (talla) compartida: las que tienen los colores elegidos.
 *  - personalizable + onPersonalizar(eleccion): botón secundario "Personalizar".
 *  - onConfirmar({ variante, opcion, piezas, cantidad }).
 *  - varianteInicial: el id de la que abre (la principal del producto; si
 *    no, la primera) · cargando: las prendas del combo todavía no llegan
 *    (sus colores van en esqueleto y no se puede agregar)
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
  varianteInicial,
  cargando = false,
}) {
  const [varId, setVarId] = useState(null);
  const [opcion, setOpcion] = useState(null);
  const [colores, setColores] = useState({});
  const [cantidad, setCantidad] = useState(1);

  // Cada vez que se abre para un producto, empieza limpio.
  useEffect(() => {
    if (!abierto) return;
    setVarId((variantes.some((v) => v.id === varianteInicial) ? varianteInicial : variantes[0]?.id) ?? null);
    setOpcion(null);
    setColores(Object.fromEntries(piezas.map((p, i) => [i, p.colores.some((c) => c.nombre === p.color) ? p.color : p.colores[0]?.nombre])));
    setCantidad(1);
  }, [abierto, producto?.nombre]); // eslint-disable-line react-hooks/exhaustive-deps

  // Las prendas de un combo pueden llegar con la hoja abierta: cada una toma su color.
  const firmaPiezas = piezas.map((p) => p.colores.map((c) => c.nombre).join('|')).join('/');
  useEffect(() => {
    setColores((x) => {
      const n = { ...x };
      let cambio = false;
      piezas.forEach((p, i) => {
        if (p.colores.some((c) => c.nombre === n[i])) return;
        const v = p.colores.some((c) => c.nombre === p.color) ? p.color : p.colores[0]?.nombre;
        if (v !== n[i]) { n[i] = v; cambio = true; }
      });
      return cambio ? n : x;
    });
  }, [firmaPiezas]); // eslint-disable-line react-hooks/exhaustive-deps

  const variante = variantes.find((v) => v.id === varId) || variantes[0];
  const lista = tallasDe({ variante, opciones, piezas, colores });
  const conColor = conMuestras(variantes);

  // Si la variante (o el color de una prenda del combo) no tiene la opción marcada, se limpia.
  useEffect(() => {
    if (opcion && !lista.includes(opcion)) setOpcion(null);
  }, [varId, colores]); // eslint-disable-line react-hooks/exhaustive-deps

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
              <Texto>Personalizar</Texto>
            </Boton>
          )}
          <Boton
            bloque
            tamano="lg"
            icono={<ShoppingBag aria-hidden="true" />}
            disabled={falta || cargando}
            onClick={() => onConfirmar?.(eleccion)}
          >
            {falta ? <Texto>{`Elige ${etiquetaOpcion.toLowerCase()}`}</Texto> : <><Texto>Agregar</Texto> · {soles(producto.precio * cantidad)}</>}
          </Boton>
        </div>
      )}
    >
      <div className={s.contenido}>
        <div className={s.producto}>
          <FotoProducto className={s.foto} src={variante?.imagen || producto.imagen} relleno="4px" loading="eager" />
          <div>
            <strong><Texto>{producto.nombre}</Texto></strong>
            <span className={s.precio}>
              {soles(producto.precio)}
              {producto.precioAntes && <s>{soles(producto.precioAntes)}</s>}
            </span>
          </div>
        </div>

        {cargando && (
          <div className={s.cargando} aria-hidden="true">
            <Hueso ancho="45%" alto={12} />
            <span>{[0, 1, 2, 3, 4].map((k) => <Hueso key={k} forma="circulo" ancho={34} alto={34} />)}</span>
          </div>
        )}
        <OpcionesProducto
          variantes={variantes}
          varId={variante?.id}
          onVariante={setVarId}
          opciones={opciones}
          etiquetaOpcion={etiquetaOpcion}
          agotadas={agotadas}
          opcion={opcion}
          onOpcion={setOpcion}
          piezas={piezas}
          colores={colores}
          onColorPieza={(i, c) => setColores((x) => ({ ...x, [i]: c }))}
          cantidad={cantidad}
          onCantidad={setCantidad}
          onGuia={onGuia}
        />
      </div>
    </HojaInferior>
  );
}
