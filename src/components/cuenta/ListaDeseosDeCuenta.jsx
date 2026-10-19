import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useWishlist } from '../../contexts/WishlistContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getCategories } from '../../services/products';
import { origenPublico } from '../../services/referrals';
import { productNeedsVariantSelection } from '../../utils/comboProductUtils';
import { toThumbnailImageUrl } from '../../utils/imageUrl';
import { consultaProducto, useProductosDeLista } from '../regalar/regaloDeLista';
import TarjetaDeProducto from '../producto/TarjetaDeProducto';
import { PaginaListaDeseos } from '../../componentes/kit/paginas/CuentaPersonalizacion';

/*
 * Lista de deseos (/cuenta/wishlist), paso 6 de la migración:
 * PaginaListaDeseos del kit. Lo de antes, en pages/cuenta/WishlistViejo.jsx
 * (interruptor cuentaVieja).
 *
 * Los productos de la lista se piden uno por uno (la caché de la ficha), no
 * el catálogo entero; cada tarjeta es la de la tienda (TarjetaDeProducto:
 * Agregar rápido, el corazón, sus fotos). Un producto borrado u oculto se ve
 * apagado, con lo que guardó la lista, y se puede quitar.
 */

/**
 * ¿El producto sigue disponible para comprarse? Un producto oculto o borrado
 * (visible:false / deleted:true) sirve para pintar nombre y foto, pero no
 * se agrega al carrito.
 */
const estaDisponible = (p) => !!p && p.visible !== false && p.deleted !== true;

/** "hace 3 días", "ayer", "hoy", "hace 2 meses" (la tarjeta dice "Guardado …"). */
const guardadoHace = (iso) => {
  if (!iso) return null;
  const entonces = new Date(iso);
  if (Number.isNaN(entonces.getTime())) return null;
  const dias = Math.round((Date.now() - entonces.getTime()) / 86400000);
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (dias < 30) return rtf.format(-dias, 'day');
  const meses = Math.round(dias / 30);
  if (meses < 12) return rtf.format(-meses, 'month');
  return rtf.format(-Math.round(meses / 12), 'year');
};

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export default function ListaDeseosDeCuenta() {
  const { userProfile } = useAuth();
  const { wishlistItems, loading, toggleFavorite } = useWishlist();
  const { addToCart, items: enCarrito } = useCart();
  const { addToast } = useGlobalToast();
  const queryClient = useQueryClient();
  const productos = useProductosDeLista(wishlistItems);

  // La tarjeta de la tienda pone el nombre de la categoría propia del producto.
  const { data: categorias = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await getCategories();
      if (error) throw new Error(error);
      return data;
    },
  });

  const codigo = userProfile?.referralCode;
  // En la app, con https://wala.pe (origenPublico): un link de localhost no abre en otro teléfono.
  const link = (ruta) => `${origenPublico()}/${ruta}/${codigo}`;

  const items = (wishlistItems || []).map((item) => {
    const p = productos[item.productId];
    const cargando = p === undefined;
    const disponible = !cargando && estaDisponible(p);
    return {
      id: item.productId,
      cargando,
      disponible: cargando ? undefined : disponible,
      // Para la tarjeta apagada: lo del producto (más fresco) o lo que guardó la lista.
      producto: disponible || cargando ? undefined : {
        nombre: p?.name || item.productName,
        imagen: toThumbnailImageUrl(p?.mainImage || item.productImage || '') || undefined,
      },
      tienda: disponible ? p : undefined,
      guardado: guardadoHace(item.addedAt),
      regalado: Boolean(item.isGifted),
    };
  });

  // Sin "NUEVO" ni "X disponibles": acá el producto ya fue elegido. "OFERTA",
  // "Agotado" y la marca se quedan (como antes).
  const Tarjeta = useMemo(() => function TarjetaDeDeseo({ item }) {
    return <TarjetaDeProducto product={item.tienda} categories={categorias} showNewBadge={false} showStockBadge={false} />;
  }, [categorias]);

  const quitar = async (id) => {
    const res = await toggleFavorite({ id });
    if (res?.error) addToast(res.error, 'error');
    else addToast('Producto eliminado', 'success');
  };

  // Todos los disponibles al carrito propio, con un solo resultado. Espera a
  // que lleguen todos los productos de la lista (los que ya llegaron salen
  // de la caché) y omite, como antes: los regalados, los borrados u ocultos,
  // los agotados, los que ya están en el carrito y los que piden elegir
  // color o talla (eso se hace en su ficha).
  const agregarTodo = async () => {
    const pendientes = wishlistItems.filter((i) => !i.isGifted);
    const lista = await Promise.all(pendientes.map((i) => queryClient.fetchQuery(consultaProducto(i.productId)).catch(() => null)));
    let agregados = 0;
    let omitidos = 0;
    for (const p of lista) {
      const omitir = !estaDisponible(p)
        || !(Number(p.inStock) > 0)
        || enCarrito.some((ci) => ci.productId === p.id)
        || productNeedsVariantSelection(p);
      if (omitir) { omitidos++; continue; }
      addToCart(p, {}, null, 1, null, { silent: true });
      agregados++;
    }
    if (agregados === 0) {
      return {
        tipo: 'info',
        texto: omitidos ? 'Esos productos ya están en tu carrito o no están disponibles.' : 'No hay productos para agregar.',
      };
    }
    const texto = `${plural(agregados, 'producto agregado', 'productos agregados')} al carrito`;
    return { tipo: 'exito', texto: omitidos ? `${texto} · ${plural(omitidos, 'omitido', 'omitidos')}.` : `${texto}.` };
  };

  const copiar = async (link, aviso) => {
    try {
      await navigator.clipboard.writeText(link);
      addToast(aviso, 'success');
    } catch {
      addToast('No pudimos copiar el enlace', 'error');
      throw new Error('sin portapapeles');
    }
  };

  // El registro de regalos (/regalar/:código): se copia y se abre aparte
  // para verlo como lo verá quien lo reciba.
  const fechasEspeciales = async () => {
    const url = link('regalar');
    try { await copiar(url, 'Enlace de tu registro de regalos copiado'); } catch { /* ya avisó */ }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <PaginaListaDeseos
      items={items}
      cargando={loading}
      sinCumpleanos={Boolean(userProfile) && !userProfile.birthDate}
      tarjeta={Tarjeta}
      onQuitar={quitar}
      onAgregarTodo={agregarTodo}
      onCompartir={codigo ? () => copiar(link('wishlist'), 'Enlace copiado al portapapeles') : undefined}
      onFechasEspeciales={codigo ? fechasEspeciales : undefined}
    />
  );
}
