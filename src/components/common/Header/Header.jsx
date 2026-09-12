import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '../../../contexts/CartContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useWishlist } from '../../../contexts/WishlistContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { getCategories, getProducts, getProductsByBrand, categoriasConProductos } from '../../../services/products';
import { getCollections } from '../../../services/collections';
import { getBrands } from '../../../services/brands';
import { getDocument } from '../../../services/firebase/firestore';
import { useVisualEditor } from '../../../pages/Tienda/contexts/VisualEditorContext';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import EditableSection from '../../admin/EditableSection';
import HeaderSearch from '../HeaderSearch/HeaderSearch';
import { Heart, User, ShoppingBag, Gamepad2, ArrowLeft, Home, Search, ChevronDown, Check, Package, Ticket, Gift, LogOut, Settings } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { logout } from '../../../services/firebase/auth';
import styles from './Header.module.css';
import NotificationTray from './NotificationTray';
import OptimizedImage from '../OptimizedImage/OptimizedImage';
import FlagIcon from '../../i18n/FlagIcon';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import { T } from '../../../i18n/useTranslatedText';
import { registrarTextosSinTraducir } from '../../../services/translate';

const navLinkClass = ({ isActive }) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;

// Mapa de etiquetas estándar del menú (texto en español tal cual lo guarda el
// admin) -> clave de diccionario i18n. Sólo se usa para traducir los rótulos de
// navegación bien conocidos; cualquier texto personalizado del admin se respeta
// y se muestra sin tocar (vía el fallback de la función translateNav).
const NAV_LABEL_KEYS = {
  'tienda': 'nav.tienda',
  'crear': 'nav.crear',
  'categorias': 'nav.categorias',
  'categorías': 'nav.categorias',
  'marcas': 'nav.marcas',
  'minijuegos': 'nav.minijuegos',
  'cuenta': 'nav.cuenta',
  'mi cuenta': 'nav.cuenta',
};

// Nombre legible del idioma para accesibilidad (aria-label / title).
// Las banderas las dibuja <FlagIcon> (SVG real; los emoji no se ven en Windows).
const LANG_NAMES = { es: 'Español', en: 'English', pt: 'Português (Brasil)' };

/**
 * true solo donde hay un puntero real (mouse/trackpad). Se usa para no
 * aplicar comportamiento de hover en pantallas tactiles, donde el menu se
 * abre/cierra unicamente con tap.
 */
const hasRealHover = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover)').matches;

// Iniciales (1-2 letras) para el círculo de avatar cuando no hay foto —
// mismo criterio que ya usan Testimonials/reseñas/registro de regalos en el
// resto de la app, para que el "avatar de iniciales" se vea igual en todos
// lados. "?" si no hay ni nombre ni correo (no debería pasar con user logueado).
const initialsOf = (name) => {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  return clean.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
};

const Header = () => {
  const { items: cartItems, getTotalItems, getTotalPrice } = useCart();
  const { user, userProfile, updateUserProfile, activeMainCoins } = useAuth();
  const navigate = useNavigate();
  const { wishlistItems } = useWishlist();
  const { lang, setLang, available, t } = useLanguage();
  const { storeConfigDraft } = useVisualEditor();
  const { isHeaderVisible } = useLayoutContext();
  // Avatar del ícono de cuenta: foto propia (subida en "Mi Perfil") primero,
  // luego la de Google si inició sesión así; sin ninguna, iniciales. Antes
  // el ícono de "Mi cuenta" era el mismo muñequito genérico estés logueado
  // o no -no había forma de saberlo de un vistazo, como sí lo resuelve
  // cualquier ecommerce con el avatar del usuario-.
  const accountAvatarUrl = userProfile?.avatarConfig?.avatarUrl || user?.photoURL || null;
  const accountDisplayName = userProfile?.displayName || userProfile?.nombre || user?.displayName || user?.email?.split('@')[0] || '';
  const location = useLocation();
  const isArcadeZone = location.pathname.startsWith('/minijuegos') || location.pathname.startsWith('/ruleta') || location.pathname.startsWith('/ball-sort');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileWalletOpen, setMobileWalletOpen] = useState(false);
  const [forceHideDropdowns, setForceHideDropdowns] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);

  const headerRef = useRef(null);
  const mobileWalletRef = useRef(null);
  const cartItemsCount = getTotalItems();
  const realCoins = activeMainCoins || 0;
  
  const [displayCoins, setDisplayCoins] = useState(realCoins);
  const pendingCoinsRef = useRef(0);
  const [isCoinBouncing, setIsCoinBouncing] = useState(false);

  // Ya no hay segunda billetera: alimentar a Kapi acredita `monedas` como todo
  // lo demás. `kapiCoins` era un contador que no descontaba nada en el checkout.

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await getCategories();
      return data || [];
    },
    staleTime: 15 * 60 * 1000,
  });

  const { data: collectionsData } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const { data } = await getCollections();
      return data || [];
    },
    staleTime: 15 * 60 * 1000,
  });

  // ── HEADER CONSCIENTE DE MARCA (multimarca) ───────────────────────
  // El Header se monta UNA sola vez (global). Para NO cruzar mercados, detecta si
  // la ruta actual es una PÁGINA DE MARCA: el primer segmento del path (p. ej.
  // "MUSSA" en /MUSSA) se compara case-insensitive con el slug de cada marca de
  // tienda_brands. Si coincide, `brandActual` es esa marca; si no, null = global
  // (Con Amor / páginas globales) y TODO queda EXACTO como hoy.
  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data } = await getBrands();
      return data || [];
    },
    staleTime: 15 * 60 * 1000,
  });

  // Los nombres de marca NO se traducen en ningun sitio. El Header es quien ya
  // tiene la lista cargada, asi que se registra aqui y el traductor la respeta
  // venga por donde venga el texto — incluido el titulo del hero de la pagina
  // de marca, que ES el nombre de la marca escrito como texto del builder.
  useEffect(() => {
    registrarTextosSinTraducir((brandsData || []).map((b) => b?.name));
  }, [brandsData]);

  // Primer segmento del pathname (sin la barra inicial). Ej: "/MUSSA?x=1" → "mussa".
  const firstSegment = (location.pathname.split('/')[1] || '').trim().toLowerCase();

  // Normaliza un texto a un "slug canónico": minúsculas, sin acentos, sin espacios
  // ni símbolos (solo a-z0-9). Así 'Con Amor' → 'conamor', 'MUEBLERÍA' → 'muebleria'.
  // Se usa para deducir el slug desde el NOMBRE cuando la marca no tiene `slug` guardado.
  const slugify = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quita diacríticos (acentos, tildes, diéresis)
      .replace(/[^a-z0-9]+/g, '');     // quita espacios, guiones y cualquier símbolo

  // Marca de la ruta actual (o null fuera de páginas de marca). El match NO depende
  // solo de `slug`: una ruta /<seg> corresponde a la marca b si el segmento coincide
  // con (b.slug en minúsculas) O con slugify(b.name). Así marcas nuevas SIN slug
  // (que el admin aún no persistía) también se detectan por su nombre. La marca base
  // "Con Amor" (slug ConAmor) se considera GLOBAL a propósito: su página es el catálogo
  // completo, así que NO se trata como marca aislada y el dropdown sigue siendo el
  // global de siempre (retrocompat).
  const brandActual = useMemo(() => {
    if (!firstSegment || !Array.isArray(brandsData) || brandsData.length === 0) return null;
    const m = brandsData.find((b) => {
      const slugGuardado = String(b?.slug || '').trim().toLowerCase();
      const slugDeNombre = slugify(b?.name);
      return firstSegment === slugGuardado || firstSegment === slugDeNombre;
    });
    if (!m) return null;
    // Con Amor se mantiene como GLOBAL: se reconoce tanto por su slug 'conamor' como
    // por su nombre ('Con Amor' → slugify → 'conamor'), aunque le falte el slug.
    if (String(m.slug || '').trim().toLowerCase() === 'conamor' || slugify(m.name) === 'conamor') return null;
    return m;
  }, [firstSegment, brandsData]);

  // Slug real de la marca (tal cual guardado) para construir los enlaces /<slug>.
  const brandSlug = brandActual ? (brandActual.slug || '').trim() : '';

  // Categoria abierta ahora mismo (?categoria=ID). Sirve para marcarla en el
  // desplegable: sin esto no habia forma de saber donde estabas parado.
  const categoriaActual = new URLSearchParams(location.search).get('categoria') || '';


  // NOTA (corregida): antes se decia aqui que `?categoria=` disparaba la query
  // GLOBAL y cruzaba marcas, y por eso el menu no listaba categorias en pagina de
  // marca. Eso ya no es cierto: TiendaPage llama a getProductsByCategory(id,
  // pageBrandId) y el resultado SI queda acotado a la marca de la pagina. Por eso
  // ahora el desplegable si enlaza /<slug>?categoria=ID.
  // Lo que si se mantiene: "Ver Todo" va a /<slug> y no a /tienda, para no sacar
  // al usuario de la marca hacia el catalogo de Con Amor.

  const { data: storeConfig, isFetching: storeConfigFetching } = useQuery({
    queryKey: ['store-config-custom'],
    queryFn: async () => {
      const { data, error } = await getDocument('storeConfig', 'homePage');
      if (error) return null;
      // Cache local: en la próxima carga el menú real aparece de inmediato (sin parpadeo).
      try { if (data) localStorage.setItem('wala_store_config', JSON.stringify(data)); } catch (_) { /* storage no disponible */ }
      return data ?? null;
    },
    // placeholderData desde el cache local: el primer render ya muestra el menú real
    // mientras se revalida en segundo plano. Elimina el flash "Suscripciones" → menú real.
    placeholderData: () => {
      try {
        const cached = localStorage.getItem('wala_store_config');
        return cached ? JSON.parse(cached) : undefined;
      } catch (_) { return undefined; }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Traduce un rótulo de navegación si es uno de los estándar; si es un texto
  // personalizado del admin, lo devuelve tal cual (el navegador lo traducirá gratis).
  const translateNav = (texto) => {
    const key = NAV_LABEL_KEYS[String(texto || '').trim().toLowerCase()];
    return key ? t(key, texto) : texto;
  };

  const activeConfig = storeConfigDraft || storeConfig || {};
  let navLinks = activeConfig?.header?.navLinks;

  if (!navLinks || navLinks.length === 0) {
    // Anti-parpadeo: en la PRIMERA carga sin cache (storeConfig aún undefined y todavía
    // revalidando) NO mostramos el menú por defecto (el del "Suscripciones") que causaba
    // el flash; dejamos el menú vacío un instante hasta que llega la config real. Solo
    // usamos el default cuando ya se resolvió y de verdad no hay configuración guardada.
    const configAunCargandoSinCache = storeConfig === undefined && storeConfigFetching;
    navLinks = configAunCargandoSinCache
      ? []
      : [
          { id: '1', text: 'Tienda', type: 'dropdown', url: '/tienda', isCategoryAuto: true },
          { id: '2', text: 'Suscripciones', type: 'link', url: '/suscripciones' },
          { id: '3', text: 'Crear', type: 'link', url: '/personalizar' }
        ];
  }

  // ¿Hay algún desplegable automático de categorías en el menú? Si no lo hay,
  // pedir el catálogo entero solo para filtrarlas seria tirar la lectura.
  const hayMenuDeCategorias = navLinks.some((l) => l?.isCategoryAuto);

  // Productos para saber qué categorías tienen algo dentro. Comparte queryKey y
  // queryFn con la cuadrícula de categorías de TiendaPage, así que en una página
  // de tienda no se pide dos veces: React Query reparte el mismo resultado.
  const { data: productosParaCategorias } = useQuery({
    queryKey: ['storefront-category-grid-products', brandActual?.id || 'global'],
    queryFn: async () => {
      const result = brandActual?.id
        ? await getProductsByBrand(brandActual.id)
        : await getProducts([], null, null);
      if (result.error) throw new Error(result.error);
      return result.data || [];
    },
    enabled: hayMenuDeCategorias,
    staleTime: 15 * 60 * 1000,
  });

  // Ids de categorías con al menos un producto visible. `undefined` mientras no
  // se sabe todavía: eso NO es lo mismo que "ninguna", y se distingue abajo.
  const idsConProductos = useMemo(
    () => (productosParaCategorias
      ? categoriasConProductos(productosParaCategorias, brandActual?.id || null)
      : undefined),
    [productosParaCategorias, brandActual],
  );

  // Categorias que se listan en el desplegable "Tienda".
  //  - EN PAGINA DE MARCA: las de ESA marca (su categoryNav, las mismas burbujas
  //    que ya se ven en su portada), enlazando a /<slug>?categoria=ID.
  //  - FUERA DE MARCA: las globales, como siempre.
  // En ambos casos se dejan fuera las que no tienen ningun producto: una
  // categoria vacia lleva a una pagina sin nada. Segun se les vayan asignando
  // productos van apareciendo solas.
  const categoriasDelMenu = useMemo(() => {
    const conProducto = (id) => !idsConProductos || idsConProductos.has(id);
    if (brandActual) {
      const nav = Array.isArray(brandActual.categoryNav) ? brandActual.categoryNav : [];
      return nav
        .filter((it) => it && it.categoryId && conProducto(it.categoryId))
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((it) => ({
          id: it.categoryId,
          // El nombre puede venir vacio en la burbuja; se cae al de la categoria.
          name: it.name || categoriesData?.find((c) => c.id === it.categoryId)?.name || 'Categoria',
          url: `/${brandSlug}?categoria=${it.categoryId}`,
        }))
        .slice(0, 10);
    }
    return (categoriesData || [])
      .filter((c) => conProducto(c.id))
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        name: c.name,
        url: `/tienda?categoria=${c.id}`,
      }));
  }, [brandActual, brandSlug, categoriesData, idsConProductos]);

  const accountPopup = activeConfig?.accountPopup || {
    title: 'Mi cuenta',
    description: 'Inicia sesión o crea una cuenta para ver tu perfil, pedidos y creaciones.',
    loginButtonText: 'Iniciar sesión',
    loginButtonUrl: '/login',
    registerButtonText: 'Crear cuenta',
    registerButtonUrl: '/registro',
    brands: [
      { id: 'add-btn', name: 'Añadir Marca', imageUrl: 'https://cdn-icons-png.flaticon.com/512/1237/1237946.png', url: '#' }
    ]
  };

  useEffect(() => {
    // Si no hay animaciones pendientes (ej. cambio en otra pestaña o carga de perfil final), sincronizar sin demora.
    if (pendingCoinsRef.current <= 0) {
      setDisplayCoins(realCoins);
    }
  }, [realCoins]);

  useEffect(() => {
    const handleStart = (e) => {
      pendingCoinsRef.current += (e.detail?.amount || 10);
    };
    
    const handleReached = (e) => {
      const inc = e.detail?.amount || 1;
      setDisplayCoins(prev => prev + inc);
      pendingCoinsRef.current -= inc;
      
      // Animación de bounce del contenedor al recibir la moneda
      setIsCoinBouncing(true);
      setTimeout(() => setIsCoinBouncing(false), 200);
    };

    const handleEnd = () => {
      pendingCoinsRef.current = 0;
      setDisplayCoins(activeMainCoins || 0); // sync por si hubo desface
    };

    window.addEventListener('coins-animation-start', handleStart);
    window.addEventListener('coin-reached-target', handleReached);
    window.addEventListener('coins-animation-end', handleEnd);

    return () => {
      window.removeEventListener('coins-animation-start', handleStart);
      window.removeEventListener('coin-reached-target', handleReached);
      window.removeEventListener('coins-animation-end', handleEnd);
    };
  }, [activeMainCoins]);


  // Alimentar a Kapi ya no necesita su propio evento: acredita monedas normales
  // y volarMonedasGanadas() se encarga, como en el resto de la app. Mantener el
  // atajo sumaba la moneda dos veces (una al aterrizar y otra por este efecto).

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Para billetera móvil
      if (mobileWalletRef.current && !mobileWalletRef.current.contains(e.target)) {
        setMobileWalletOpen(false);
      }
      // Cerrar el dropdown activo (popups de cuenta/carrito O menus de nav
      // tipo Tienda/Marcas, que ahora tambien usan activeDropdown) si el
      // clic cae afuera de cualquiera de los dos contenedores.
      const isDropdownContainer =
        e.target.closest('.' + styles.accountDropdownContainer) ||
        e.target.closest('.' + styles.navItemWithDropdown);
      if (!isDropdownContainer) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    // Para dispositivos móviles táctiles
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    closeDropdowns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);


  const closeDropdowns = () => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    setMobileMenuOpen(false);
    setMobileWalletOpen(false);
    setActiveDropdown(null);

    // El bloqueo temporal existe únicamente para evitar que el hover de
    // escritorio reabra el menú que se acaba de cerrar. En móvil no hay hover
    // real y esperar un pointermove podía dejar los popups bloqueados después
    // de navegar o mantener presionado, porque ese evento puede no producirse.
    if (hasRealHover()) {
      setForceHideDropdowns(true);
      setTimeout(() => {
        const handlePointerMove = () => {
          setForceHideDropdowns(false);
          window.removeEventListener('pointermove', handlePointerMove);
        };
        window.addEventListener('pointermove', handlePointerMove);
      }, 100);
    } else {
      setForceHideDropdowns(false);
    }
  };

  const handleMobilePopupClick = (e, dropdownName) => {
    if (window.innerWidth <= 768 || Capacitor.isNativePlatform()) {
      e.preventDefault();
      setActiveDropdown(prev => prev === dropdownName ? null : dropdownName);
    }
  };

  // El header móvil ahora tiene dos filas. Publicar su altura REAL evita que
  // popups, menús y layouts sigan suponiendo los antiguos 60px y aparezcan
  // encima del buscador. SOLO se publica en móvil: en escritorio .container
  // usa --header-height como min-height; medir el header y volver a inyectar
  // esa medida ahí creaba una realimentación de +1px por el borde en cada
  // vuelta del ResizeObserver y el header crecía sin límite.
  useLayoutEffect(() => {
    if (!isHeaderVisible) {
      document.documentElement.style.removeProperty('--header-height');
      return undefined;
    }

    const el = headerRef.current;
    if (!el) return undefined;
    const mobileQuery = window.matchMedia('(max-width: 768px)');
    const publishHeight = () => {
      if (mobileQuery.matches) {
        document.documentElement.style.setProperty('--header-height', `${el.offsetHeight}px`);
      } else {
        document.documentElement.style.removeProperty('--header-height');
      }
    };

    publishHeight();
    const observer = new ResizeObserver(publishHeight);
    observer.observe(el);
    mobileQuery.addEventListener('change', publishHeight);
    return () => {
      observer.disconnect();
      mobileQuery.removeEventListener('change', publishHeight);
      document.documentElement.style.removeProperty('--header-height');
    };
  }, [isHeaderVisible]);

  if (!isHeaderVisible) return null;

  const isNativeApp = Capacitor.isNativePlatform();

  return (
    <>
    <header ref={headerRef} className={`${styles.header} ${forceHideDropdowns ? styles.forceHideHover : ''}`}>
      <div className={styles.container}>
        {isNativeApp ? (
          <Link to="/" className={styles.nativeBackBtn}>
            <Home size={20} />
          </Link>
        ) : (
        <Link to="/" className={styles.logo}>
          <svg viewBox="0 0 358 120" className={styles.logoImage} style={{ height: '44px', width: 'auto' }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* Degradado de marca del header: violeta -> morado profundo.
                  Tope en #7C3AED (firme, no se lava en modo claro). */}
              <linearGradient id="walaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                 <stop offset="0%" stopColor="#7C3AED" />
                 <stop offset="100%" stopColor="#5B21B6" />
              </linearGradient>
            </defs>

            {/* ISOTIPO (Left) — MISMO isotipo que la pantalla de carga
                (BrandLoader / splash de index.html): la bolsa inclinada con la
                'W' y el punto. Usa las MISMAS coordenadas del loader (espacio
                local del viewBox "12 0 94 109") para que sea exactamente la
                misma silueta.
                Colores INVERTIDOS respecto al loader porque aqui va sobre
                fondo claro: bolsa en el degradado de marca + 'W' blanca +
                punto blanco.
                Encaje: scale(1.05) (0.87 -> 0.95 -> 1.05, se pidio agrandar solo
                el isotipo, no el logotipo) y translate para que el contenido
                caiga en x 7..72 y y 15..100, o sea apoyado en la linea base
                del logotipo y pegado a el. */}
            <g transform="translate(-22.4, 2) scale(1.05)">
               <path d="M 32 42 L 28 88 C 27 92 30 94 34 93 L 85 80 C 89 79 91 76 89 72 L 76 18 C 75 13 68 11 65 14 L 36 34 C 32 37 31 40 32 42 Z" fill="url(#walaGradient)" />
               <circle cx="67" cy="23" r="6.5" fill="#FFFFFF" />
               <path d="M 38 42 L 43 78 L 54 52 L 64 72 L 72 38" fill="none" stroke="#FFFFFF" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" transform="translate(55 58) scale(0.8) translate(-55 -58)" />
            </g>

            {/* LOGOTIPO (Right) — anclado a la derecha (x=349) para que quede
                pegado al isotipo (~16u de aire). La tilde ya NO se dibuja a
                mano: antes era un trazo suelto que caia descolocado sobre la
                'A'; ahora se usa el glifo real 'Á' de la fuente, asi el acento
                tiene la forma, el peso y la posicion correctos — y sigue bien
                puesto aunque caiga la fuente de respaldo. */}
            <text x="349" y="100" textAnchor="end" fontFamily="'Montserrat', 'system-ui', 'Arial Black', sans-serif" fontWeight="900" fontSize="85" fill="url(#walaGradient)" stroke="url(#walaGradient)" strokeWidth="2.5" paintOrder="stroke fill" letterSpacing="-4"><T>WALÁ</T></text>
          </svg>
        </Link>
        )}

        <EditableSection sectionId="header" currentConfig={activeConfig} label="Menú de Navegación">
          <nav className={`${styles.nav} ${mobileMenuOpen ? styles.navOpen : ''}`} aria-label="Navegación principal">
            
            {navLinks.map((link) => {
              const linkStyle = {
                color: (link.color || 'inherit'),
                fontFamily: link.fontFamily || 'inherit',
                fontWeight: link.bold ? 'bold' : 'normal',
                fontStyle: link.italic ? 'italic' : 'normal',
              };

              // Al estar activo NO se pinta color en linea: lo pone .navLinkActive.
              // Antes el color activo venia de aqui, pero los links fijos del nav
              // (Minijuegos) no pasan por esta rama y se quedaban con el color de
              // la clase: dos "pagina activa" de colores distintos en la misma
              // barra. Dejando que mande siempre la clase, todos se ven igual.
              const getActiveStyle = (isActive) => (isActive
                ? { ...linkStyle, color: undefined }
                : linkStyle);

              if (link.type === 'link') {
                return (
                  <NavLink key={link.id} to={link.url || '#'} className={navLinkClass} end style={({ isActive }) => getActiveStyle(isActive)}>
                    {translateNav(link.text)}
                  </NavLink>
                );
              }

              if (link.type === 'dropdown') {
                // Antes el trigger era un <NavLink> real: un clic directo (no solo
                // pasar el mouse) navegaba de una al `url` de respaldo, saltandose
                // el menu. Si esto es un MENU y no una pagina, no deberia llevar a
                // ningun lado por si solo — solo "Ver Todo el Catálogo"/"Ver todas
                // las marcas" (adentro del menu) navega de verdad. Se cambia a
                // <button>: abre/cierra el menu (reutilizando activeDropdown, igual
                // que los popups de cuenta/carrito), sin navegar. Sigue abriendose
                // con hover en desktop (CSS) Y ahora TAMBIEN con click/touch/teclado
                // (antes, sin hover real —tablet, teclado—, no habia forma de
                // abrirlo: quedaba "escondido" detras de una navegacion directa).
                const navKey = `nav-${link.id}`;
                const isNavOpen = activeDropdown === navKey;
                // Con OTRO menu abierto (el otro nav, o un popup de cuenta/
                // carrito) este queda bloqueado: si no, el hover seguia
                // abriendolo y se veian dos desplegables a la vez.
                const isNavBlocked = Boolean(activeDropdown) && !isNavOpen;
                return (
                  <div
                    key={link.id}
                    className={`${styles.navItemWithDropdown} ${isNavOpen ? styles.navDropdownOpen : ''} ${isNavBlocked ? styles.hoverBlocked : ''}`}
                    // Al hacer click el menu queda FIJADO (hace falta para
                    // touch/teclado). En desktop eso lo dejaba "pegado"
                    // abierto aunque te fueras con el mouse: al salir se
                    // suelta y vuelve a mandar el hover.
                    onMouseLeave={() => {
                      if (isNavOpen && hasRealHover()) setActiveDropdown(null);
                    }}
                  >
                    <button
                      type="button"
                      className={styles.navLink}
                      style={linkStyle}
                      onClick={() => setActiveDropdown((prev) => (prev === navKey ? null : navKey))}
                      aria-expanded={isNavOpen}
                    >
                      {translateNav(link.text)}
                      <ChevronDown size={14} strokeWidth={2} className={styles.navChevron} aria-hidden="true" />
                    </button>
                    <div className={styles.megaMenu}>
                      <div className={styles.megaMenuContent}>
                        <h4>{translateNav(link.text)}</h4>
                        <ul>
                          {/* Desplegable Automático: Categorías Base.
                              · EN PÁGINA DE MARCA: NO se listan las categorías globales
                                (enlazaban a /tienda?categoria=, que es Con Amor y cruza
                                mercados). Tampoco se enlaza a /<slug>?categoria=ID porque
                                el storefront de marca filtra las categorías EN PÁGINA
                                (estado local navCategoryId), no por query param; el param
                                `categoria` dispara la query GLOBAL por categoría (sin
                                acotar por marca). Para no cruzar mercados, en marca solo
                                queda "Ver Todo el Catálogo" → /<slug> (abajo).
                              · FUERA DE MARCA: comportamiento EXACTO actual (global). */}
                          {link.isCategoryAuto && categoriasDelMenu.map(c => (
                            <li key={`cat-${c.id}`}>
                              <Link
                                to={c.url}
                                onClick={() => setMobileMenuOpen(false)}
                                className={categoriaActual === c.id ? styles.subActivo : undefined}
                                aria-current={categoriaActual === c.id ? 'page' : undefined}
                              >
                                <T>{c.name}</T>
                              </Link>
                            </li>
                          ))}

                          {/* Desplegable Automático: Colección Específica (Ej: Anime -> Muestra Categorías) */}
                          {link.autoCollectionId && categoriesData?.slice(0, 10).map(c => (
                            <li key={`colcat-${c.id}`}>
                              <Link to={`/tienda?coleccion=${link.autoCollectionId}&categoria=${c.id}`} onClick={() => setMobileMenuOpen(false)}>
                                <T>{c.name}</T>
                              </Link>
                            </li>
                          ))}

                          {/* Desplegable Automático: Marcas ("Universo Walá"). Mismo
                              patron que isCategoryAuto pero para tienda_brands — el
                              Header ya trae `brandsData` (lo usa para detectar
                              brandActual), asi que no hace falta una query nueva.
                              Sin filtro de brandActual: a diferencia de las categorias
                              (que cruzan mercados via query param), un link a /<slug>
                              es una pagina propia, navegar entre marcas es siempre valido. */}
                          {link.isBrandAuto && brandsData?.filter(b => b?.name && b.active !== false && b.visible !== false).map(b => {
                            const slug = String(b.slug || '').trim() || slugify(b.name);
                            if (!slug) return null;
                            return (
                              <li key={`brand-${b.id || slug}`}>
                                <Link
                                  to={`/${slug}`}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className={brandActual?.id === b.id ? styles.subActivo : undefined}
                                  aria-current={brandActual?.id === b.id ? 'page' : undefined}
                                >
                                  {/* SIN <T>: el nombre de una marca es un
                                      nombre propio. Al traducirlo salian
                                      "With Love Geeks", "New" por Nova o
                                      "Tastings" por Catas. */}
                                  {b.name}
                                </Link>
                              </li>
                            );
                          })}

                          {/* Enlaces Manuales */}
                          {(!link.isCategoryAuto && !link.autoCollectionId && !link.isBrandAuto) && link.dropdownLinks?.map(subLink => (
                            <li key={subLink.id}>
                              <Link to={subLink.url || '#'} onClick={() => setMobileMenuOpen(false)}>
                                <T>{subLink.text}</T>
                              </Link>
                            </li>
                          ))}

                          {link.isCategoryAuto && (
                            <li>
                              {/* "Ver Todo": en página de marca va a /<slugMarca> (la propia
                                  marca); fuera de marca, a /tienda (Con Amor) como hoy. */}
                              <Link to={brandActual ? `/${brandSlug}` : '/tienda'} onClick={() => setMobileMenuOpen(false)} style={{fontWeight: 'bold', color: 'var(--rojo-principal)'}}>
                                <T>Ver Todo el Catálogo</T> →
                              </Link>
                            </li>
                          )}

                          {link.isBrandAuto && (
                            <li>
                              <Link to="/" onClick={() => setMobileMenuOpen(false)} style={{fontWeight: 'bold', color: 'var(--rojo-principal)'}}>
                                <T>Ver todas las marcas</T> →
                              </Link>
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })}

            <NavLink to="/minijuegos" className={(props) => `${navLinkClass(props)} ${styles.desktopOnlyItem}`} end>{t('nav.minijuegos', 'Minijuegos')}</NavLink>

          </nav>
        </EditableSection>

        <div className={styles.actions}>
          <div className={styles.walletsContainer}>
            {/* Monedas: visibles en desktop Y en móvil (antes solo escritorio). */}
            {user && (
              <div className={styles.walletsDisplay}>
                {/* Monedas: la única billetera. */}
                <div
                  className={`${styles.coinsDisplayTarget} ${styles.tooltipContainer} global-coins-target`}
                >
                  <div className={`${styles.coinsDisplay} ${isCoinBouncing ? styles.bounce : ''}`}>
                    🪙 {Math.floor(displayCoins)}
                  </div>
                  {/* Antes era una sola oración corrida ("Tus monedas - 1
                      moneda = S/1 de descuento (vencen a fin de mes)") — se
                      leía como un bloque apretado de texto. Separada en 3
                      líneas con jerarquía propia (título / equivalencia /
                      vencimiento) se lee de un vistazo en vez de tener que
                      desarmar la oración. */}
                  <div className={styles.tooltipText}>
                    <strong className={styles.tooltipTitle}><T>Tus monedas</T></strong>
                    <span className={styles.tooltipBody}><T>1 moneda = S/1 de descuento</T></span>
                    <span className={styles.tooltipMeta}><T>Vencen a fin de mes</T></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modo oscuro/claro: la mayoría nunca lo toca (el tema por
              defecto sigue el del sistema operativo, ver ThemeContext) pero
              para quien SÍ quiere forzar uno distinto, un ícono suelto acá
              es un clic — antes exigía abrir el dropdown de "Mi cuenta" (o,
              logueado, entrar a Ajustes). Solo en escritorio: el header
              móvil ya se afinó varias veces para quedar minimalista, y acá
              hay más aire para sumarlo sin apretar el resto de íconos.
              Visible con y sin sesión (no es una preferencia DE LA CUENTA,
              es del navegador) — por eso vive afuera del popup de cuenta,
              no adentro. El idioma sigue solo ahí (se cambia una vez y
              listo, no amerita el mismo acceso directo). */}
          <ThemeToggle className={styles.mobileHiddenAction} />

          <span className={styles.actionsDivider} aria-hidden="true" />

          {/* En escritorio conserva exactamente su posición original. En
              móvil se oculta este botón y se muestra el buscador ancho de la
              segunda fila. */}
          <HeaderSearch
            brandId={brandActual?.id || null}
            botonClassName={`${styles.iconButton} ${styles.desktopSearchButton}`}
          />

          {user && (
            <NotificationTray
              isOpen={activeDropdown === 'notificaciones'}
              isBlocked={Boolean(activeDropdown) && activeDropdown !== 'notificaciones'}
              onToggle={(e) => handleMobilePopupClick(e, 'notificaciones')}
            />
          )}

          {/* Cuenta es el único icono que sigue sin mostrarse en el header
              móvil: ya tiene su propia pestaña en el BottomNav ("Mi
              cuenta"), así que duplicarlo acá sería el mismo destino dos
              veces. Notificaciones/favoritos/carrito sí volvieron: esos NO
              tenían otro acceso igual de directo en móvil. */}
          {!isNativeApp && (
          <div className={`${styles.accountDropdownContainer} ${styles.mobileHiddenAction} ${activeDropdown === 'cuenta' ? styles.activeDropdown : ''} ${activeDropdown && activeDropdown !== 'cuenta' ? styles.forceHideHover : ''}`}>
            <Link to="/cuenta" className={styles.iconButton} onClick={closeDropdowns} aria-label="Mi cuenta">
              {user ? (
                accountAvatarUrl ? (
                  <img src={accountAvatarUrl} alt="" className={styles.accountAvatar} referrerPolicy="no-referrer" />
                ) : (
                  <span className={styles.accountAvatarFallback} aria-hidden="true">{initialsOf(accountDisplayName)}</span>
                )
              ) : (
                <User strokeWidth={1.5} className={styles.icon} />
              )}
            </Link>

            <div className={`${styles.accountPopup} ${styles.mobileCenteredPopup}`}>
              <EditableSection sectionId="accountPopup" currentConfig={activeConfig} label="Pop-up de Cuenta">
                <div className={styles.accountPopupContent}>
                  {user ? (
                    <>
                      {/* Mismo avatar que el ícono del header, pero más grande:
                          antes el panel solo repetía el nombre en texto plano,
                          sin nada que lo conectara visualmente con el círculo
                          que abriste para llegar acá. El correo (en vez del
                          genérico "Bienvenido a tu cuenta") además confirma de
                          un vistazo CUÁL cuenta es -útil en una tienda con
                          varias cuentas de staff/admin-. */}
                      <div className={styles.accountIdentity}>
                        {accountAvatarUrl ? (
                          <img src={accountAvatarUrl} alt="" className={styles.accountIdentityAvatar} referrerPolicy="no-referrer" />
                        ) : (
                          <span className={styles.accountIdentityAvatarFallback} aria-hidden="true">{initialsOf(accountDisplayName)}</span>
                        )}
                        <div className={styles.accountIdentityText}>
                          <h3><T>Hola</T>, {accountDisplayName}</h3>
                          <p className={styles.accountIdentityEmail}>{user.email || <T>Bienvenido a tu cuenta</T>}</p>
                        </div>
                      </div>

                      {!userProfile?.hasCompletedSurvey && (
                        <div style={{ background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>
                          <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.9rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            🎁 Perfil de Regalos
                          </h4>
                          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: '#4b5563', lineHeight: '1.3' }}>
                            Gana recompensas diciéndonos qué te gusta.
                          </p>
                          <Link to="/encuesta-suscripcion" className={styles.primaryButton} onClick={closeDropdowns} style={{ background: '#8b5cf6', color: 'white', padding: '0.5rem', fontSize: '0.85rem' }}>
                            Completar Encuesta
                          </Link>
                        </div>
                      )}

                      {/* Lista limpia de accesos directos (antes: 2 botones
                          grandes tipo pill) — mismo patrón que un menú de
                          cuenta "serio", ícono + etiqueta, sin relleno de
                          color. Refleja las secciones más usadas del sidebar
                          de /cuenta (ver CuentaLayout.jsx). */}
                      <nav className={styles.accountMenuList} aria-label="Accesos de cuenta">
                        <Link to="/cuenta/perfil" className={styles.accountMenuItem} onClick={closeDropdowns}>
                          <User size={18} strokeWidth={1.75} aria-hidden="true" />
                          <span><T>Mi Perfil</T></span>
                        </Link>
                        <Link to="/cuenta/pedidos" className={styles.accountMenuItem} onClick={closeDropdowns}>
                          <Package size={18} strokeWidth={1.75} aria-hidden="true" />
                          <span><T>Mis Pedidos</T></span>
                        </Link>
                        <Link to="/cuenta/catalogo" className={styles.accountMenuItem} onClick={closeDropdowns}>
                          <Gift size={18} strokeWidth={1.75} aria-hidden="true" />
                          <span><T>Catálogo Recompensas</T></span>
                        </Link>
                        <Link to="/cuenta/cupones" className={styles.accountMenuItem} onClick={closeDropdowns}>
                          <Ticket size={18} strokeWidth={1.75} aria-hidden="true" />
                          <span><T>Mis Cupones</T></span>
                        </Link>
                        <Link to="/cuenta/wishlist" className={styles.accountMenuItem} onClick={closeDropdowns}>
                          <Heart size={18} strokeWidth={1.75} aria-hidden="true" />
                          <span><T>Lista de Deseos</T></span>
                        </Link>
                        {/* Reemplaza la sección "Preferencias" (tema/idioma)
                            que vivía suelta acá abajo: ahora ese control
                            vive en su propia página (/cuenta/ajustes, la
                            misma que ve el usuario en móvil), así que este
                            es solo el acceso directo — un link más de la
                            lista, no controles duplicados. */}
                        <Link to="/cuenta/ajustes" className={styles.accountMenuItem} onClick={closeDropdowns}>
                          <Settings size={18} strokeWidth={1.75} aria-hidden="true" />
                          <span><T>Ajustes</T></span>
                        </Link>
                      </nav>
                    </>
                  ) : (
                    <>
                      <h3><T>{accountPopup.title}</T></h3>
                      <p><T>{accountPopup.description}</T></p>
                      
                      <div className={styles.accountButtons}>
                        <Link to={accountPopup.loginButtonUrl || '/login'} className={styles.primaryButton} onClick={closeDropdowns}>
                          <T>{accountPopup.loginButtonText || 'Iniciar sesión'}</T>
                        </Link>
                        <Link to={accountPopup.registerButtonUrl || '/registro'} className={styles.secondaryButton} onClick={closeDropdowns}>
                          <T>{accountPopup.registerButtonText || 'Crear cuenta'}</T>
                        </Link>
                      </div>
                    </>
                  )}
                  
                  {/* Idioma: antes vivía acá junto con el toggle de tema
                      para TODOS (con y sin sesión). El tema ya tiene su
                      propio ícono siempre visible en la barra del header
                      (arriba, afuera de este popup) — repetirlo acá era el
                      mismo control en dos lugares. El idioma se queda: es
                      una preferencia que se fija una vez, no amerita un
                      ícono propio en la barra, y logueado ya vive también en
                      Ajustes (link arriba en la lista) — pero sin sesión
                      esta sigue siendo la ÚNICA forma de cambiarlo (Ajustes
                      exige estar logueado), así que se mantiene solo para
                      ese caso. */}
                  {!user && (
                    <div className={styles.prefsSection}>
                      <h4><T>Idioma</T></h4>
                      <div className={styles.langMenu}>
                        {available.map((code) => {
                          const name = LANG_NAMES[code] || code.toUpperCase();
                          return (
                            <button
                              key={code}
                              type="button"
                              aria-pressed={lang === code}
                              onClick={() => setLang(code)}
                              className={`${styles.langMenuOption} ${lang === code ? styles.langMenuOptionActive : ''}`}
                            >
                              <FlagIcon code={code} size={18} />
                              <span>{name}</span>
                              {lang === code && <Check size={14} strokeWidth={2.5} className={styles.langMenuCheck} aria-hidden="true" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cerrar sesión: al final de la lista (mismo patrón que
                      "Preferencias" arriba), no como botón grande — es la
                      acción menos frecuente del panel. */}
                  {user && (
                    <button
                      type="button"
                      onClick={async () => { closeDropdowns(); await logout(); navigate('/'); }}
                      className={styles.accountMenuLogout}
                    >
                      <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
                      <span><T>Cerrar sesión</T></span>
                    </button>
                  )}
                </div>
              </EditableSection>
            </div>
          </div>
          )}

          <div className={`${styles.accountDropdownContainer} ${activeDropdown === 'favoritos' ? styles.activeDropdown : ''} ${activeDropdown && activeDropdown !== 'favoritos' ? styles.forceHideHover : ''}`}>
            <Link to={user ? "/cuenta/wishlist" : "/login"} className={styles.iconButton} onClick={closeDropdowns} aria-label="Favoritos">
              <Heart strokeWidth={1.5} className={styles.icon} />
              {user && wishlistItems.length > 0 && (
                <span className={styles.cartBadge} style={{ background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)' }}>
                  {wishlistItems.length}
                </span>
              )}
            </Link>
            
            <div className={`${styles.accountPopup} ${styles.mobileCenteredPopup}`}>
              <div className={styles.accountPopupContent}>
                {(() => {
                  const favConfig = storeConfigDraft?.favoritesPopup || {
                    loggedOutTitle: 'Tus Favoritos',
                    loggedOutText: 'Aún no tienes artículos guardados. Inicia sesión para crear tu lista de deseos.',
                    loggedInTitle: 'Tus Favoritos',
                    loggedInText: 'Aún no has marcado nada como favorito.',
                    buttonText: 'Mira lo que te puede interesar',
                    buttonLink: '/tienda',
                    fontFamily: '',
                    fontSize: '14px',
                    // Texto secundario del tema: se aclara en modo noche (antes #666666 fijo).
                    color: 'var(--color-text-muted)',
                    bold: false,
                    italic: false
                  };

                  const textStyle = {
                    fontFamily: favConfig.fontFamily || 'inherit',
                    fontSize: favConfig.fontSize || '14px',
                    // Fallback al texto atenuado del tema para legibilidad en oscuro.
                    color: favConfig.color || 'var(--color-text-muted)',
                    fontWeight: favConfig.bold ? 'bold' : 'normal',
                    fontStyle: favConfig.italic ? 'italic' : 'normal',
                    marginBottom: '1.25rem'
                  };

                  if (user) {
                    if (wishlistItems.length > 0) {
                      return (
                        <>
                          <h3><T>Tu Lista de Deseos</T></h3>
                          {/* La frase se arma ENTERA y en UNA sola expresion
                              antes de traducir. <T> solo traduce cuando recibe
                              un string puro: escrita como texto + {numero} +
                              texto, los children eran varios trozos y se los
                              saltaba en silencio — el resto del popup cambiaba
                              de idioma y esta linea no. Con la frase completa,
                              ademas, el traductor acierta la concordancia del
                              plural en cada idioma. */}
                          <p style={textStyle}><T>{wishlistItems.length === 1 ? 'Tienes 1 producto guardado en tu lista.' : `Tienes ${wishlistItems.length} productos guardados en tu lista.`}</T></p>
                          <div className={styles.wishlistPreviewStrip}>
                            {wishlistItems.slice(0, 4).map((item) => (
                              <Link
                                key={item.productId}
                                to="/cuenta/wishlist"
                                onClick={closeDropdowns}
                                className={styles.wishlistThumb}
                                title={item.productName}
                              >
                                <img
                                  src={item.productImage || '/images/placeholder.svg'}
                                  alt={item.productName || 'Producto'}
                                  onError={(e) => { e.currentTarget.src = '/images/placeholder.svg'; }}
                                />
                              </Link>
                            ))}
                            {wishlistItems.length > 4 && (
                              <span className={styles.wishlistThumbMore}>+{wishlistItems.length - 4}</span>
                            )}
                          </div>
                          <div className={styles.accountButtons}>
                            <Link to="/cuenta/wishlist" className={styles.primaryButton} onClick={closeDropdowns}>
                              <T>Ver mi lista</T>
                            </Link>
                          </div>
                        </>
                      );
                    }
                    return (
                      <>
                        <h3>{favConfig.loggedInTitle || 'Tus Favoritos'}</h3>
                        <p style={textStyle}>{favConfig.loggedInText || 'Aún no has marcado nada como favorito.'}</p>
                        <div className={styles.accountButtons}>
                          <Link to={favConfig.buttonLink || '/tienda'} className={styles.primaryButton} onClick={closeDropdowns}>
                            {favConfig.buttonText || 'Mira lo que te puede interesar'}
                          </Link>
                        </div>
                      </>
                    );
                  }

                  return (
                    <>
                      <h3><T>{favConfig.loggedOutTitle || 'Tus Favoritos'}</T></h3>
                      <p style={textStyle}><T>{favConfig.loggedOutText || 'Aún no tienes artículos guardados. Inicia sesión para crear tu lista de deseos.'}</T></p>
                      <div className={styles.accountButtons}>
                        <Link to="/login" className={styles.primaryButton} onClick={closeDropdowns}>
                          <T>Iniciar sesión</T>
                        </Link>
                        <Link to="/tienda" className={styles.secondaryButton} onClick={closeDropdowns}>
                          <T>Explorar tienda</T>
                        </Link>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className={`${styles.accountDropdownContainer} ${activeDropdown === 'carrito' ? styles.activeDropdown : ''} ${activeDropdown && activeDropdown !== 'carrito' ? styles.forceHideHover : ''}`}>
            <Link to="/carrito" className={styles.iconButton} onClick={closeDropdowns} aria-label="Carrito de compras">
              <ShoppingBag strokeWidth={1.5} className={styles.icon} />
              {cartItemsCount > 0 && (
                <span className={styles.cartBadge}>{cartItemsCount}</span>
              )}
            </Link>

            <div className={`${styles.accountPopup} ${styles.cartPopupWidth} ${styles.mobileCenteredPopup}`}>
              <div className={styles.accountPopupContent}>
                <h3 style={{textAlign: 'left', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '0.75rem'}}><T>Mi Carrito</T></h3>
                {cartItems.length === 0 ? (
                  <>
                    <p><T>Tu carrito está vacío en este momento.</T></p>
                    <div className={styles.accountButtons}>
                      <Link to="/tienda" className={styles.primaryButton} onClick={closeDropdowns}><T>Explorar tienda</T></Link>
                    </div>
                  </>
                ) : (
                  <div className={styles.cartPreviewContainer}>
                    <div className={styles.previewItemList}>
                      {cartItems.filter((i) => i.selected !== false).slice(0, 3).map((item) => (
                        <div key={item.id} className={styles.previewItem}>
                          <img src={item.productImage} alt={item.productName} className={styles.previewItemImg} />
                          <div className={styles.previewItemDetails}>
                            <span className={styles.previewItemName}>{item.productName}</span>
                            <span className={styles.previewItemPrice}>{item.quantity} x S/ {(item.price || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                      {cartItems.filter((i) => i.selected !== false).length > 3 && (
                        <p className={styles.moreItemsText}><T>{`+ ${cartItems.filter((i) => i.selected !== false).length - 3} artículos más...`}</T></p>
                      )}
                    </div>
                    <div className={styles.cartPreviewFooter}>
                      <div className={styles.cartPreviewTotal}>
                        <span><T>Total:</T></span>
                        <strong>S/ {getTotalPrice().toFixed(2)}</strong>
                      </div>
                      <Link to="/carrito" className={styles.primaryButton} onClick={closeDropdowns} style={{width: '100%', boxSizing: 'border-box'}}>
                        Ir a pagar
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* En móvil la búsqueda es una segunda fila visible y familiar, como
            en un ecommerce: no obliga a descubrir qué hace una lupa entre
            cinco iconos y deja más aire a cuenta, favoritos y carrito. */}
        <div className={styles.mobileHeaderSearch}>
          <HeaderSearch
            brandId={brandActual?.id || null}
            botonClassName={`${styles.iconButton} ${styles.mobileSearchButton}`}
            mobileLabel="Buscar productos, marcas y categorías"
          />
        </div>
      </div>
    </header>

      {/* Se espera a que el perfil haya llegado. Con `!userProfile?.hasCompletedSurvey`
          la condición era TRUE mientras cargaba (`!undefined` = true), así que el
          botón aparecía a TODOS los usuarios logueados —incluidos los que ya
          hicieron la encuesta— y se iba solo un segundo después. */}
      {user && userProfile && !userProfile.hasCompletedSurvey && location.pathname !== '/encuesta-suscripcion' && (
        <Link to="/encuesta-suscripcion" className={styles.floatingSurveyBtn} onClick={closeDropdowns}>
          <span className={styles.floatingSurveyIcon}>🎁</span>
          <span className={styles.floatingSurveyLabel}>Completar Encuesta</span>
        </Link>
      )}
    </>
  );
};

export default Header;
