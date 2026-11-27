import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { rutaCompra } from '../../utils/checkoutOrigin.mjs';
import { isLumiCart, LUMI_CATALOG_LANDING_ROUTE } from '../../utils/catalogLanding.mjs';
import { revisarPagoLumi } from '../../utils/lumiPayment.mjs';
import PagoLumi from './PagoLumi';
import { trackLandingFunnel } from '../../services/analytics/landingFunnel.js';
import { trackLumiFunnel } from '../../services/analytics/lumiFunnel.js';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { getBrands } from '../../services/brands';
import { getCategories, getProduct, getProductsByCategory } from '../../services/products';
import { catalogoPorId, idsDeItemsIncompletos, queLeFalta } from '../../utils/cartValidation';
import { idsParaRevisar, motivoNoDisponible, preciosCambiados } from '../../utils/carritoDisponible.mjs';
import { useGlobalToast } from '../../contexts/ToastContext';
import { tieneCuenta } from '../../utils/rutaPrivada';
import { toDirectImageUrl } from '../../utils/imageUrl';
import { ENVIO_ESTANDAR, ENVIO_GRATIS_DESDE } from '../../constants/envio';
import { fuentesDeImagen } from '../common/OptimizedImage/OptimizedImage';
import TarjetaDeProducto from '../producto/TarjetaDeProducto';
import { PaginaCarrito } from '../../componentes/kit/paginas/Carrito';
import usePrimeraCompra from '../../hooks/usePrimeraCompra';
import { itemCarritoDesde } from '../../componentes/kit/adaptadores';

/**
 * El carrito de la tienda con el kit (paso 6 de la migración): PaginaCarrito
 * con las líneas de CartContext (itemCarritoDesde). Mismas acciones que
 * Cart.jsx; CartContext sigue haciendo todo lo demás (localStorage, la nube,
 * las pestañas, el pedido aprobado por el ERP).
 * El catálogo de la caché se lee UNA vez por cambio del carrito (antes, una
 * vez por línea y por dibujo). "También te puede gustar" se pide al acercarse,
 * con la misma consulta que la ficha.
 * El interruptor carritoViejo (en CartPage) vuelve a Cart.jsx.
 */
export default function CarritoDeTienda() {
  const navigate = useNavigate();
  const location = useLocation();
  const esLumi = isLumiCart(location);
  const [pagoLumi, setPagoLumi] = useState(null);
  const [revisandoPago, setRevisandoPago] = useState(false);
  useEffect(() => { trackLandingFunnel('cart', { location }); }, [location.pathname, location.search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { trackLumiFunnel('cart', { location }); }, [location.pathname, location.search]); // eslint-disable-line react-hooks/exhaustive-deps
  const queryClient = useQueryClient();
  const {
    items, updateQuantity, removeFromCart, toggleItemSelected, setAllItemsSelected, removeSelectedItems, clearCart, actualizarPrecios,
  } = useCart();
  const itemsActuales = useRef(items);
  itemsActuales.current = items;
  const toast = useGlobalToast();
  const { user, userProfile } = useAuth();
  const [abajo, setAbajo] = useState(false);
  const verAbajo = useCallback(() => setAbajo(true), []);
  useEffect(() => { setPagoLumi(null); }, [items, esLumi]);

  // Una sola lectura del catálogo (localStorage) por cambio del carrito.
  const catalogo = useMemo(() => catalogoPorId(), [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const incompletos = useMemo(() => idsDeItemsIncompletos(items, catalogo), [items, catalogo]);

  // Lo que ya no se puede comprar (papelera, borrado, oculto, sin una prenda
  // de su combo o pack): se lee cada producto del carrito (la misma caché que
  // la ficha) y se avisa aquí, no recién al pagar. Un corte de red no marca nada.
  const idsRevisar = useMemo(() => idsParaRevisar(items), [items]);
  const revisados = useQueries({
    queries: idsRevisar.map((id) => ({
      queryKey: ['product', id],
      staleTime: 60 * 1000,
      retry: false,
      queryFn: async () => {
        const resultado = await getProduct(id);
        if (resultado.error || !resultado.data) throw new Error(resultado.error || 'Producto no encontrado');
        return resultado.data;
      },
    })),
    combine: (consultas) => consultas.map((q) => (q.data ? q.data : /no encontrado/i.test(q.error?.message || '') ? null : undefined)),
  });
  const productosRevisados = useMemo(() => {
    const m = new Map();
    idsRevisar.forEach((id, i) => { if (revisados[i] !== undefined) m.set(id, revisados[i]); });
    return m;
  }, [idsRevisar, revisados]);

  // Si el admin cambió un precio, la línea toma el nuevo y se avisa (antes el
  // pago se rechazaba con "el precio cambió" y había que quitar el producto).
  const cambiosDePrecio = useMemo(() => preciosCambiados(items, productosRevisados), [items, productosRevisados]);
  useEffect(() => {
    if (!cambiosDePrecio.length) return;
    actualizarPrecios(cambiosDePrecio);
    const c = cambiosDePrecio[0];
    toast.info(cambiosDePrecio.length === 1
      ? `El precio de ${c.nombre || 'un producto'} cambió a S/ ${c.price.toFixed(2)}. Ya está actualizado.`
      : `Cambió el precio de ${cambiosDePrecio.length} productos. Ya están actualizados.`);
  }, [cambiosDePrecio, actualizarPrecios, toast]);

  const filas = useMemo(() => items.map((item) => {
    const fila = itemCarritoDesde(item, { catalogo, falta: incompletos.has(item.id) ? queLeFalta(item, catalogo) : undefined, noDisponible: motivoNoDisponible(item, productosRevisados) });
    // La foto en su tamaño (la fila mide 84px): las copias que guardó el carrito.
    const { src, srcSet } = fuentesDeImagen(toDirectImageUrl(fila.imagen), { variantes: fila.imagen === item.productImage ? item.productImageVariantes : undefined, sizes: '96px' });
    const url = esLumi && /^\/producto\/[^/?]+$/.test(fila.url) ? `${fila.url}?catalogo=lumi` : fila.url;
    return { ...fila, url, imagen: src || fila.imagen, srcSet };
  }), [items, catalogo, incompletos, productosRevisados, esLumi]);

  // Todas las líneas esperando la confirmación del pago por WhatsApp.
  const pendiente = items.length > 0 && items.every((i) => i.status === 'pending_confirmation')
    ? { codigo: items[0].pseudoOrderId }
    : undefined;

  // ── También te puede gustar: la consulta de la ficha (categoría y marca del
  // primer producto elegido), sin lo que ya está en el carrito ──
  const base = useMemo(() => {
    const primero = items.find((i) => i.selected !== false && !i.customization) || items.find((i) => !i.customization);
    if (!primero) return null;
    const producto = catalogo.get(primero.productId) || queryClient.getQueryData(['product', primero.productId]);
    return producto?.categories?.[0] ? producto : null;
  }, [items, catalogo, queryClient]);
  const enCarrito = useMemo(() => new Set(items.map((i) => i.productId)), [items]);
  const { data: relacionados } = useQuery({
    queryKey: ['related-products', base?.categories?.[0] || '', base?.brandId || null, base?.id],
    queryFn: async () => {
      const { data } = await getProductsByCategory(base.categories[0], base.brandId || null);
      return (data || []).filter((p) => p.id !== base.id).slice(0, 12);
    },
    enabled: abajo && Boolean(base),
    staleTime: 300_000,
  });
  const recomendados = useMemo(
    () => (relacionados || []).filter((p) => !enCarrito.has(p.id) && !p.esPrendaBase).slice(0, 10),
    [relacionados, enCarrito],
  );
  const { data: categorias = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await getCategories();
      if (error) throw new Error(error);
      return data;
    },
    enabled: abajo,
  });
  const { data: marcas = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await getBrands()).data,
    staleTime: 300_000,
    enabled: abajo,
  });
  // La tarjeta de la tienda (corazón, "Agregar rápido", la impresión).
  // Semana de bienvenida: las monedas no se usan y el saldo sí (al pagar).
  const { bienvenida, cargando: cargandoBienvenida } = usePrimeraCompra();
  const Tarjeta = useMemo(() => function TarjetaRecomendada({ producto }) {
    return <TarjetaDeProducto product={producto} categories={categorias} />;
  }, [categorias]);

  const pagar = async () => {
    if (!esLumi) { navigate(rutaCompra(location)); return; }
    if (revisandoPago) return;
    setRevisandoPago(true);
    try {
      const elegidos = items.filter((it) => it.selected !== false);
      const productos = new Map(await Promise.all(idsParaRevisar(elegidos).map(async (id) => {
        const { data, error } = await getProduct(id);
        if (error || !data) throw new Error('No pudimos verificar el catálogo. Inténtalo de nuevo.');
        queryClient.setQueryData(['product', id], data);
        return [id, data];
      })));
      if (itemsActuales.current !== items) {
        trackLumiFunnel('payment_error', { reason: 'El carrito cambió durante la revisión' });
        toast.info('El carrito cambió. Revisa los productos y vuelve a pagar.');
        return;
      }
      if (idsDeItemsIncompletos(elegidos, productos).size) {
        trackLumiFunnel('payment_error', { reason: 'Faltan opciones de producto' });
        toast.error('Completa las opciones de tus productos antes de pagar.');
        return;
      }
      const resultado = revisarPagoLumi(elegidos, productos, { metaEnvio: ENVIO_GRATIS_DESDE, costoEnvio: ENVIO_ESTANDAR });
      if (resultado.cambios) actualizarPrecios(resultado.cambios);
      if (resultado.error) { trackLumiFunnel('payment_error', { reason: resultado.error }); toast.error(resultado.error); return; }
      setPagoLumi(resultado.resumen);
    } catch (error) {
      trackLumiFunnel('payment_error', { reason: 'No se pudo verificar el catálogo' });
      toast.error(error.message || 'No pudimos verificar tu carrito. Inténtalo de nuevo.');
    } finally {
      setRevisandoPago(false);
    }
  };

  return (
    <>
    <PaginaCarrito
      titulo={esLumi ? 'Tu carrito Lumi' : undefined}
      sinMascota={esLumi}
      bienvenida={!esLumi && (cargandoBienvenida ? { cargando: true } : bienvenida?.enPausa ? { enPausa: true, saldo: bienvenida.saldo } : undefined)}
      items={filas}
      onCantidad={updateQuantity}
      onQuitar={removeFromCart}
      // toggleItemSelected alterna: solo se llama si de verdad cambia.
      onSeleccionar={(id, v) => { const it = items.find((i) => i.id === id); if (it && (it.selected !== false) !== v) toggleItemSelected(id); }}
      onSeleccionarTodo={setAllItemsSelected}
      onQuitarSeleccionados={removeSelectedItems}
      onVaciar={clearCart}
      onPagar={pagar}
      textoPagar={esLumi ? 'Pagar por depósito' : undefined}
      revisandoPago={revisandoPago}
      notaPago={esLumi ? 'Yape, Plin o transferencia. Envía el comprobante al WhatsApp de Lumi.' : undefined}
      onSeguirComprando={() => navigate(esLumi ? LUMI_CATALOG_LANDING_ROUTE : '/tienda')}
      pendiente={pendiente}
      metaEnvio={ENVIO_GRATIS_DESDE}
      costoEnvio={ENVIO_ESTANDAR}
      saldoMonedas={!esLumi && tieneCuenta(user) ? userProfile?.monedas || 0 : 0}
      recomendados={esLumi ? [] : recomendados}
      tarjeta={Tarjeta}
      catalogo={{ marcas, categorias }}
      onVerAbajo={esLumi ? undefined : verAbajo}
    />
    {esLumi && <PagoLumi resumen={pagoLumi} onCerrar={() => { trackLumiFunnel('payment_close'); setPagoLumi(null); }} />}
    </>
  );
}
