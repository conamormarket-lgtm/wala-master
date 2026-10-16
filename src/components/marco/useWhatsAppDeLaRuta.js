import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMessage } from '../../services/messages';
import { getProduct } from '../../services/products';
import { getBrands } from '../../services/brands';
import { useLayoutContext } from '../../contexts/LayoutContext';
import { numeroWhatsApp } from '../../componentes/kit/adaptadores';

/*
 * El WhatsApp flotante de cada página: { numero, mensaje } o null si en esta
 * página no va. Son las reglas de WhatsAppButton, sin cambios:
 *
 * DÓNDE NO SALE: /admin (herramienta interna), landings (la cabecera se oculta
 * con LayoutContext para proteger el pago), /checkout (tapaba los botones de
 * pago) y las pantallas de acceso, salvo que /admin/whatsapp lo active
 * (whatsapp_mostrar_en_acceso = 'si'). Tampoco en un producto con
 * whatsappEnabled === false. Todo lo demás lo tiene por defecto.
 *
 * QUÉ NÚMERO: uno por sección (tienda / crear / cuenta) o el general, de
 * /admin/whatsapp. Manda lo más específico: el del producto, luego el de su
 * marca, luego el de la marca de la ruta (/<slug>; Con Amor es global).
 *
 * QUÉ MENSAJE: en la ficha, el del producto (o el de siempre) con {url}; en
 * el resto, el general.
 */
const RUTAS_DE_ACCESO = ['/login', '/registro', '/recuperar-contrasena'];

const slugDe = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '');

const contextoDeRuta = (ruta, hayMarca) => {
  if (ruta.startsWith('/admin')) return 'admin';
  if (ruta === '/' || ruta.startsWith('/tienda') || ruta.startsWith('/producto')) return 'tienda';
  if (ruta.startsWith('/personalizar') || ruta.startsWith('/crear/') || ruta.startsWith('/editor')) return 'crear';
  if (['/cuenta', '/pedidos', '/carrito', '/checkout'].some((r) => ruta.startsWith(r))) return 'cuenta';
  // Página de marca (/<slug>): como la tienda (luego pisa el número de la marca).
  return hayMarca ? 'tienda' : 'general';
};

export default function useWhatsAppDeLaRuta() {
  const { pathname } = useLocation();
  const layout = useLayoutContext();
  const enLanding = layout && layout.isHeaderVisible === false;

  const { data: marcas } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data } = await getBrands();
      return data || [];
    },
    staleTime: 15 * 60 * 1000,
  });

  const primerTramo = (pathname.split('/')[1] || '').trim().toLowerCase();
  const marcaDeRuta = useMemo(() => {
    if (!primerTramo || !Array.isArray(marcas) || marcas.length === 0) return null;
    const m = marcas.find((b) => primerTramo === String(b?.slug || '').trim().toLowerCase() || primerTramo === slugDe(b?.name));
    if (!m) return null;
    // Con Amor se mantiene global, igual que en la cabecera.
    if (String(m.slug || '').trim().toLowerCase() === 'conamor' || slugDe(m.name) === 'conamor') return null;
    return m;
  }, [primerTramo, marcas]);

  const contexto = contextoDeRuta(pathname, Boolean(marcaDeRuta));
  const seMuestra = contexto !== 'admin' && !enLanding && !pathname.startsWith('/checkout');
  const enAcceso = RUTAS_DE_ACCESO.includes(pathname.replace(/\/+$/, ''));

  const { data: numeros } = useQuery({
    queryKey: ['whatsapp-numbers-config'],
    queryFn: async () => {
      const [tienda, crear, cuenta, mostrarEnAcceso] = await Promise.all([
        getMessage('whatsapp_number_tienda'),
        getMessage('whatsapp_number_crear'),
        getMessage('whatsapp_number_cuenta'),
        getMessage('whatsapp_mostrar_en_acceso'),
      ]);
      const general = await getMessage('whatsapp_number');
      return {
        tienda: tienda.data?.trim() || general.data?.trim() || null,
        crear: crear.data?.trim() || general.data?.trim() || null,
        cuenta: cuenta.data?.trim() || general.data?.trim() || null,
        general: general.data?.trim() || tienda.data?.trim() || null,
        // Sin guardar nada todavía = oculto en login y registro.
        mostrarEnAcceso: mostrarEnAcceso.data === 'si',
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(seMuestra),
  });

  const enFicha = pathname.startsWith('/producto/');
  const productoId = enFicha ? pathname.split('/producto/')[1]?.split('?')[0] : null;
  const { data: producto } = useQuery({
    queryKey: ['product', productoId],
    queryFn: async () => {
      const { data, error } = await getProduct(productoId);
      if (error) throw new Error(error);
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(productoId) && seMuestra,
  });

  if (!seMuestra || !numeros) return null;
  if (enAcceso && !numeros.mostrarEnAcceso) return null;
  if (enFicha && producto && producto.whatsappEnabled === false) return null;

  let crudo = numeros[contexto];
  if (marcaDeRuta?.whatsappNumber?.trim()) crudo = marcaDeRuta.whatsappNumber.trim();
  // En la ficha la marca sale del producto (el primer tramo es "producto").
  if (enFicha && producto?.brandId && Array.isArray(marcas)) {
    const marcaDelProducto = marcas.find((b) => b.id === producto.brandId);
    if (marcaDelProducto?.whatsappNumber?.trim()) crudo = marcaDelProducto.whatsappNumber.trim();
  }
  if (enFicha && producto?.whatsappNumber) crudo = producto.whatsappNumber;

  const numero = numeroWhatsApp(crudo);
  if (!numero) return null;

  let mensaje = 'Hola, me interesa conocer más sobre sus servicios.';
  if (enFicha && producto) {
    mensaje = (producto.whatsappMessage || 'Hola CON AMOR: Me interesa este producto de tu página: {url}')
      .replace('{url}', window.location.href);
  }
  return { numero, mensaje };
}
