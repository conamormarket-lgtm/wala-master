import React from 'react';
import { createPortal } from 'react-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import Boton from '../../componentes/kit/Boton';
import { LUMI_CART_ROUTE } from '../../utils/catalogLanding.mjs';
import s from './AccesoCarritoLumi.module.css';

export default function AccesoCarritoLumi() {
  const { items } = useCart();
  const cantidad = items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  return createPortal(
    <div className={s.flotante}>
      <Boton
        to={LUMI_CART_ROUTE}
        className={s.boton}
        soloIcono
        icono={<ShoppingCart aria-hidden="true" />}
        aria-label={`Ir al carrito (${cantidad} ${cantidad === 1 ? 'producto' : 'productos'})`}
        title="Ver mi carrito"
      />
      {cantidad > 0 && <span className={s.cantidad} aria-hidden="true">{cantidad > 99 ? '99+' : cantidad}</span>}
    </div>,
    document.body,
  );
}
