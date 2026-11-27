import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import Boton from '../../componentes/kit/Boton';
import { LUMI_CART_ROUTE } from '../../utils/catalogLanding.mjs';

export default function AccesoCarritoLumi() {
  const { items } = useCart();
  const cantidad = items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  return <Boton to={LUMI_CART_ROUTE} icono={<ShoppingCart aria-hidden="true" />} aria-label={`Ir al carrito (${cantidad} ${cantidad === 1 ? 'producto' : 'productos'})`}>
    Carrito{cantidad ? ` (${cantidad})` : ''}
  </Boton>;
}
