import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getWishlistByUserCode } from '../../services/wishlist';
import { getBrands } from '../../services/brands';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { productNeedsVariantSelection } from '../../utils/comboProductUtils';
import { PaginaListaPublica } from '../../componentes/kit/paginas/Regalar';
import { avisoDeRegalo, codigoDeLista, consultaRegistro, itemDeTarjeta, useProductosDeLista } from './regaloDeLista';

/*
 * La lista de deseos de otra persona (/wishlist/:userCode), paso 6 de la
 * migración: PaginaListaPublica del kit. Lo de antes, en WishlistPublicViejo.jsx
 * (interruptor regalarViejo).
 *
 * Carga: antes bajaba TODO el catálogo (ocultos y borrados incluidos) para
 * cruzar unos pocos productos, y esperaba a pantalla completa. Ahora:
 *  - la lista y el nombre del dueño (getPublicGiftRegistry) a la vez;
 *  - las tarjetas se ven al tiro con lo que guardó la lista (nombre, foto,
 *    precio) y cada producto llega solo (getProduct, la misma caché
 *    ['product', id] que la ficha: abrirla después es inmediato).
 */

export default function ListaPublicaDeTienda() {
  const { userCode } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToast } = useGlobalToast();

  // La lista y el registro salen a la vez (antes, uno detrás del otro).
  const lista = useQuery({
    queryKey: ['wishlist-publica', userCode],
    queryFn: async () => {
      const { data, error } = await getWishlistByUserCode(userCode);
      if (error || !data) return null;
      return data;
    },
    // Fresca al volver (alguien pudo regalar algo): se ve la de antes mientras llega.
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: Boolean(userCode),
  });
  const registro = useQuery(consultaRegistro(userCode));
  const wishlist = lista.data;
  const items = useMemo(() => wishlist?.items || [], [wishlist]);
  const productos = useProductosDeLista(items);

  const { data: marcas } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await getBrands()).data,
    staleTime: 1000 * 60 * 5,
    enabled: items.length > 0,
  });

  // Avisa al dueño que alguien visitó su lista (una vez por visita; si falla, nada).
  const avisado = useRef(null);
  useEffect(() => {
    const userId = wishlist?.userId;
    if (!userId || avisado.current === userId) return;
    avisado.current = userId;
    httpsCallable(getFunctions(), 'notifyWishlistVisitSecure')({ userId })
      .catch((e) => console.error('Error notifying owner:', e));
  }, [wishlist?.userId]);

  const nombre = wishlist?.userId ? registro.data?.ownerName || '' : '';
  const tarjetas = items.map((it) => itemDeTarjeta(it, productos[it.productId], { marcas: marcas || [] }));

  const alRegalar = (tarjeta) => {
    const item = items.find((it) => it.productId === tarjeta.id);
    const producto = productos[tarjeta.id];
    if (!item || !producto) return;
    const wishlistUserCode = codigoDeLista(userCode);

    // Con color, talla o piezas que elegir, la ficha (el regalo va en el state).
    if (productNeedsVariantSelection(producto)) {
      navigate(`/producto/${tarjeta.id}`, {
        state: { regalo: { productId: tarjeta.id, wishlistUserCode, aviso: avisoDeRegalo(nombre) } },
      });
      return;
    }

    addToCart({
      // El producto completo: addToCart completa sola su única variante.
      ...producto,
      id: tarjeta.id,
      name: item.productName || producto.name,
      // En productos con variantes mainImage es '': sin esto el pedido salía sin foto.
      mainImage: producto.mainImage || producto.images?.[0] || item.productImage || '',
      isWishlistGift: true,
      wishlistUserCode,
    }, {}, null, 1);
    addToast('¡Producto agregado a tu carrito! Podrás elegir dónde enviarlo en el Checkout.', 'success');
    navigate('/carrito');
  };

  let estado;
  if (lista.isPending || (wishlist?.userId && registro.isPending)) estado = 'cargando';
  else if (!wishlist) estado = 'noEncontrada';

  return (
    <PaginaListaPublica
      estado={estado}
      dueno={{ nombre }}
      items={tarjetas}
      onRegalar={alRegalar}
      // Solo si tiene fechas especiales: "Elegir el día de entrega".
      urlFechas={registro.data?.dates?.length ? `/regalar/${userCode}` : undefined}
    />
  );
}
