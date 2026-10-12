import React, { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import Boton from './Boton';
import { HojaInferior } from './Feedback';
import { SelectorTalla, SelectorColor, Cantidad } from './Formulario';
import { soles } from './TarjetaProducto';
import s from './AgregarRapido.module.css';

/**
 * Elegir talla, color y cantidad antes de agregar al carrito, sin salir de
 * la lista de productos. Hoja inferior en celular / app, modal en escritorio.
 *
 *  - producto: { nombre, imagen, precio, precioAntes }
 *  - tallas, agotadas, colores: como en SelectorTalla / SelectorColor
 *  - onConfirmar({ talla, color, cantidad })
 */
export default function AgregarRapido({ abierto, onCerrar, producto, tallas = [], agotadas = [], colores = [], onConfirmar }) {
  const [talla, setTalla] = useState(null);
  const [color, setColor] = useState(colores[0]?.nombre ?? null);
  const [cantidad, setCantidad] = useState(1);

  // Cada vez que se abre para un producto, empieza limpio.
  useEffect(() => {
    if (!abierto) return;
    setTalla(null);
    setColor(colores[0]?.nombre ?? null);
    setCantidad(1);
  }, [abierto, producto?.nombre]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!producto) return null;
  const falta = tallas.length > 0 && !talla;

  return (
    <HojaInferior
      abierta={abierto}
      onCerrar={onCerrar}
      titulo="Elige tu talla"
      pie={(
        <Boton
          bloque
          tamano="lg"
          icono={<ShoppingBag aria-hidden="true" />}
          disabled={falta}
          onClick={() => onConfirmar?.({ talla, color, cantidad })}
        >
          {falta ? 'Elige una talla' : `Agregar · ${soles(producto.precio * cantidad)}`}
        </Boton>
      )}
    >
      <div className={s.contenido}>
        <div className={s.producto}>
          <span className={s.foto}><img src={producto.imagen} alt="" /></span>
          <div>
            <strong>{producto.nombre}</strong>
            <span className={s.precio}>
              {soles(producto.precio)}
              {producto.precioAntes && <s>{soles(producto.precioAntes)}</s>}
            </span>
          </div>
        </div>
        {colores.length > 0 && <SelectorColor colores={colores} valor={color} onChange={setColor} />}
        {tallas.length > 0 && <SelectorTalla tallas={tallas} agotadas={agotadas} valor={talla} onChange={setTalla} />}
        <div className={s.fila}>
          <span>Cantidad</span>
          <Cantidad valor={cantidad} onChange={setCantidad} max={10} />
        </div>
      </div>
    </HojaInferior>
  );
}
