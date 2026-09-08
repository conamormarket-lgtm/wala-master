import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMessage } from '../../../services/messages';
import { getProduct } from '../../../services/products';
import { getBrands } from '../../../services/brands';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import styles from './WhatsAppButton.module.css';

/**
 * Botón flotante de WhatsApp.
 *
 * DÓNDE APARECE: en toda la web MENOS dos sitios, y a propósito:
 *   - /admin/*  : es una herramienta interna, no un sitio donde pedir soporte.
 *   - landings  : ahí el header se oculta (LayoutContext) para proteger la
 *                 conversión del checkout; no metemos más distracciones.
 *
 * Antes era al revés: una lista blanca de rutas (tienda, crear, cuenta). Eso
 * dejaba SIN soporte toda sección que naciera después y que nadie recordara
 * añadir — la Zona Arcade entera, sorteos, suscripciones, búsqueda, nichos,
 * wishlist pública... Con la regla invertida, una sección nueva tiene soporte
 * por defecto y hay que excluirla a mano si no se quiere.
 *
 * QUÉ NÚMERO USA: sigue habiendo uno por sección (tienda / crear / cuenta),
 * configurables en /admin/whatsapp. El resto de la web usa el número general
 * (whatsapp_number), que esa misma pantalla mantiene.
 *
 * WHATSAPP POR MARCA: en páginas de marca (/<slug>), si la marca tiene
 * whatsappNumber propio (tienda_brands.whatsappNumber), el botón usa ESE
 * número en vez del número global de contexto. Sin marca (Con Amor / páginas
 * globales) o sin número configurado, el comportamiento queda EXACTO como hoy.
 */
const WhatsAppButton = () => {
  const location = useLocation();
  const pathname = location.pathname;
  // Mismo criterio que KapiPet: en landings el header se oculta y ahí no
  // sacamos nada flotante encima del pago.
  const layout = useLayoutContext();
  const onLandingPage = layout && layout.isHeaderVisible === false;

  // ── MARCA DE LA RUTA ACTUAL (mismo patrón que Header.jsx) ──────────
  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data } = await getBrands();
      return data || [];
    },
    staleTime: 15 * 60 * 1000,
  });

  const firstSegment = (pathname.split('/')[1] || '').trim().toLowerCase();

  const slugify = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '');

  const brandActual = useMemo(() => {
    if (!firstSegment || !Array.isArray(brandsData) || brandsData.length === 0) return null;
    const m = brandsData.find((b) => {
      const slugGuardado = String(b?.slug || '').trim().toLowerCase();
      const slugDeNombre = slugify(b?.name);
      return firstSegment === slugGuardado || firstSegment === slugDeNombre;
    });
    if (!m) return null;
    // Con Amor se mantiene GLOBAL (retrocompat), igual que en el Header.
    if (String(m.slug || '').trim().toLowerCase() === 'conamor' || slugify(m.name) === 'conamor') return null;
    return m;
  }, [firstSegment, brandsData]);

  // 1. Determinar el contexto (Tienda, Crear, Cuenta o Admin)
  let context = null;
  if (pathname.startsWith('/admin')) {
    context = 'admin';
  } else if (
    pathname === '/' ||
    pathname.startsWith('/tienda') ||
    pathname.startsWith('/producto')
  ) {
    context = 'tienda';
  } else if (
    pathname.startsWith('/personalizar') ||
    pathname.startsWith('/editor')
  ) {
    context = 'crear';
  } else if (
    pathname.startsWith('/cuenta') ||
    pathname.startsWith('/pedidos') ||
    pathname.startsWith('/carrito') ||
    pathname.startsWith('/checkout')
  ) {
    context = 'cuenta';
  } else if (brandActual) {
    // Página de marca (/<slug>, ruta catch-all vía DynamicLandingPage): se trata
    // como contexto "tienda" para que el botón aparezca igual que en /tienda,
    // usando el número de contexto tienda como base (luego pisado por el
    // whatsappNumber propio de la marca si existe, ver más abajo).
    context = 'tienda';
  } else {
    // Todo lo demás (Zona Arcade, sorteos, suscripciones, búsqueda, nichos,
    // wishlist pública, regalos...) usa el número general.
    context = 'general';
  }

  // 2. Fuera del panel de administración y de las landings de conversión.
  const shouldShow = context !== 'admin' && !onLandingPage;

  const { data: whatsappNumbers } = useQuery({
    queryKey: ['whatsapp-numbers-config'],
    queryFn: async () => {
      const [tienda, crear, cuenta] = await Promise.all([
        getMessage('whatsapp_number_tienda'),
        getMessage('whatsapp_number_crear'),
        getMessage('whatsapp_number_cuenta')
      ]);

      // Fallback a whatsapp_number
      const fallback = await getMessage('whatsapp_number');

      return {
        tienda: tienda.data?.trim() || fallback.data?.trim() || null,
        crear: crear.data?.trim() || fallback.data?.trim() || null,
        cuenta: cuenta.data?.trim() || fallback.data?.trim() || null,
        // Resto de la web: el número general de /admin/whatsapp.
        general: fallback.data?.trim() || tienda.data?.trim() || null
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!shouldShow // Solo cargar si vamos a mostrar el botón
  });

  const isProductDetail = pathname.startsWith('/producto/');
  const productId = isProductDetail ? pathname.split('/producto/')[1]?.split('?')[0] : null;

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const { data, error } = await getProduct(productId);
      if (error) throw new Error(error);
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!productId && shouldShow
  });

  if (!shouldShow || !whatsappNumbers) return null;

  if (isProductDetail && product && product.whatsappEnabled === false) return null;

  // Obtener el número según el contexto
  let rawWhatsappNumber = whatsappNumbers[context];

  // WHATSAPP POR MARCA: en página de marca, si la marca tiene whatsappNumber
  // propio, pisa el número global de contexto (pero un número específico del
  // producto, más abajo, sigue teniendo prioridad sobre el de la marca).
  if (brandActual?.whatsappNumber?.trim()) {
    rawWhatsappNumber = brandActual.whatsappNumber.trim();
  }

  if (isProductDetail && product && product.whatsappNumber) {
    rawWhatsappNumber = product.whatsappNumber;
  }

  if (!rawWhatsappNumber) return null;

  // Limpiar número
  // eslint-disable-next-line no-useless-escape
  const cleanNumber = rawWhatsappNumber.replace(/[\s\-\(\)]/g, '');
  const formattedNumber = cleanNumber.startsWith('+') ? cleanNumber : `+51${cleanNumber}`;

  let messageText = 'Hola, me interesa conocer más sobre sus servicios.';
  
  if (isProductDetail && product) {
    const productUrl = window.location.href;
    const baseMsg = product.whatsappMessage || 'Hola CON AMOR: Me interesa este producto de tu página: {url}';
    messageText = baseMsg.replace('{url}', productUrl);
  }

  const defaultMessage = encodeURIComponent(messageText);
  const whatsappUrl = `https://wa.me/${formattedNumber.replace(/\+/g, '')}?text=${defaultMessage}`;

  const buttonClassName = `${styles.whatsappButton} ${isProductDetail ? styles.inProductDetail : ''}`.trim();

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClassName}
      aria-label="Contactar por WhatsApp"
      title="Contáctanos por WhatsApp"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.icon}
      >
        <path
          d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
          fill="currentColor"
        />
      </svg>
    </a>
  );
};

export default WhatsAppButton;
