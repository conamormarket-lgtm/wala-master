import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getBrands } from '../../services/brands';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { productNeedsVariantSelection } from '../../utils/comboProductUtils';
import { PLACEHOLDER_IMG } from '../../constants/placeholder';
import { PaginaRegalar } from '../../componentes/kit/paginas/Regalar';
import { fechaEntregaDesde } from '../../componentes/kit/adaptadores';
import { avisoDeRegalo, codigoDeLista, consultaRegistro, itemDeTarjeta, useProductosDeLista } from './regaloDeLista';

/*
 * Regalar para una fecha (/regalar/:referralCode), paso 6 de la migración:
 * PaginaRegalar del kit. Lo de antes, en GiftRegistryPageViejo.jsx
 * (interruptor regalarViejo).
 *
 * Se toca la fecha y luego "Regalar esto" (sin arrastrar ni juntar varios por
 * fecha: REGALAR.md, "Diferencias a propósito"). El regalo lleva la próxima
 * vez que cae la fecha, la ocasión y para quién (deliveryDate,
 * deliveryEventLabel, deliveryRecipient).
 *
 * Carga: el registro (getPublicGiftRegistry: nombre, fechas y lista) con la
 * misma caché que la lista pública (de "Elegir el día de entrega" llega al
 * tiro) y cada producto con getProduct, no el catálogo entero.
 */

// 'YYYY-MM-DD' → 'DD/MM/YYYY' (como los avisos de antes).
const formatearFecha = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
};

// La foto del regalo en el carrito: la primera que no sea el relleno.
const imagenDe = (producto, item) => [
  producto?.mainImage, producto?.images?.[0], producto?.variants?.[0]?.imageUrl, item?.productImage,
].find((url) => url && url !== PLACEHOLDER_IMG) || '';

export default function RegalarDeTienda() {
  const { referralCode } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToast } = useGlobalToast();

  // Fresco al volver (alguien pudo regalar algo): se ve el de antes mientras llega.
  const registro = useQuery({ ...consultaRegistro(referralCode), staleTime: 0, refetchOnMount: 'always' });
  const datos = registro.data;
  const items = useMemo(() => datos?.wishlistItems || [], [datos]);
  const productos = useProductosDeLista(items);
  const { data: marcas } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await getBrands()).data,
    staleTime: 1000 * 60 * 5,
    enabled: items.length > 0,
  });

  const dueno = datos?.ownerName || 'Alguien';
  const fechas = useMemo(() => (datos?.dates || []).map((d, i) => fechaEntregaDesde(d, i)), [datos]);
  // Sin precio no se regala (antes se podía pagar S/ 0.00).
  const tarjetas = items.map((it) => itemDeTarjeta(it, productos[it.productId], { marcas: marcas || [], exigirPrecio: true }));

  // Lo que hace que una línea del carrito sea un regalo de esta lista (y, con fecha, cuándo llega).
  const datosDeRegalo = (fecha) => ({
    isWishlistGift: true,
    wishlistUserCode: codigoDeLista(referralCode),
    ...(fecha ? { deliveryDate: fecha.fecha, deliveryEventLabel: fecha.etiqueta, deliveryRecipient: dueno } : {}),
  });

  const alRegalar = ({ item: tarjeta, fecha }) => {
    const item = items.find((it) => it.productId === tarjeta.id);
    const producto = productos[tarjeta.id];
    if (!producto) {
      addToast('Ese producto ya no está disponible en el catálogo.', 'warning');
      return;
    }

    // Con color, talla o piezas que elegir, la ficha (el regalo va en el state).
    if (productNeedsVariantSelection(producto)) {
      navigate(`/producto/${tarjeta.id}`, {
        state: {
          regalo: {
            productId: tarjeta.id,
            ...datosDeRegalo(fecha),
            aviso: fecha
              ? `Regalo para ${dueno} · se entregará el ${formatearFecha(fecha.fecha)} (${fecha.etiqueta}). Elige y agrégalo al carrito.`
              : avisoDeRegalo(datos?.ownerName),
          },
        },
      });
      return;
    }

    if (!((producto.salePrice || producto.price || 0) > 0)) {
      addToast('Este producto no está disponible para regalar ahora.', 'warning');
      return;
    }
    addToCart({
      // El producto completo: addToCart completa sola su única variante.
      ...producto,
      id: tarjeta.id,
      name: producto.name || item?.productName,
      mainImage: imagenDe(producto, item),
      ...datosDeRegalo(fecha),
    }, {}, null, 1, null, { silent: false });
    addToast(fecha
      ? `¡Regalo agregado! Se entregará el ${formatearFecha(fecha.fecha)} para ${dueno}.`
      : '¡Producto agregado a tu carrito! Podrás elegir dónde enviarlo en el Checkout.', 'success');
    navigate('/carrito');
  };

  let estado;
  if (registro.isPending) estado = 'cargando';
  else if (!datos) estado = 'noEncontrada';

  return (
    <PaginaRegalar
      estado={estado}
      dueno={{ nombre: datos?.ownerName }}
      fechas={fechas}
      items={tarjetas}
      onRegalar={alRegalar}
    />
  );
}
