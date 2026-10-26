import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { useCart } from '../../contexts/CartContext';
import { linkProducto } from '../../services/referrals';
import { getBrands } from '../../services/brands';
import { getProductsByCategory, variantesDeImagen } from '../../services/products';
import { addReview, getProductReviews, toggleHelpfulVote } from '../../services/reviews';
import { getCustomerCustomProductsByUser } from '../../services/customerCustomProducts';
import { trackProductView } from '../../services/analytics/tracker';
import { recordProductClick, recordVariantViewTime } from '../../utils/productVariantBehavior';
import { isComboProduct } from '../../utils/comboProductUtils';
import { toDirectImageUrl } from '../../utils/imageUrl';
import { tieneCuenta, urlLogin } from '../../utils/rutaPrivada';
import { withEditorFonts } from '../../services/shared/fontResources';
import { fuentesDeImagen } from '../common/OptimizedImage/OptimizedImage';
import { PaginaProducto } from '../../componentes/kit/paginas/Producto';
import { SIZES_FOTO } from '../../componentes/kit/piezas/GaleriaProducto';
import { fichaProductoDesde, opinionesDesde } from '../../componentes/kit/adaptadores';
import TarjetaDeProducto from './TarjetaDeProducto';
import usePiezasDelCombo from './usePiezasDelCombo';
import { argumentosDelCarrito, rutaDelEditor } from './eleccionCarrito';
import useLoViejo from '../../hooks/useLoViejo';
import { esYoryoPersonalizable, rutaPersonalizarYoryo } from '../../utils/yoryoPersonalizacion.mjs';

// El personalizador de Yoryo y su historial se quedan en la tienda (fuera del
// kit) y bajan solo al tocar "Personalizable".
const YoryoPersonalizadoCliente = lazy(() => withEditorFonts(import('../YoryoPersonalizadoCliente/YoryoPersonalizadoCliente')));
const HistorialPersonalizacionesModal = lazy(() => import('../YoryoPersonalizadoCliente/HistorialPersonalizacionesModal'));

const categoriaDe = (product, cats) => {
  const ids = product?.categories ?? (product?.category ? [product.category] : []);
  return (cats || []).filter((c) => ids.includes(c.id)).map((c) => c.name).find(Boolean) || product?.category || '';
};

// Cuando el navegador está libre (después de pintar la ficha).
const cuandoLibre = (fn) => (typeof window.requestIdleCallback === 'function'
  ? { idle: window.requestIdleCallback(fn, { timeout: 2500 }) }
  : { reloj: window.setTimeout(fn, 1200) });
const cancelarLibre = (t) => {
  if (t?.idle) window.cancelIdleCallback?.(t.idle);
  if (t?.reloj) window.clearTimeout(t.reloj);
};

/**
 * La ficha de un producto con el kit (paso 6 de la migración):
 * PaginaProducto con los datos de la tienda. Mismo comportamiento que
 * ProductDetail (el carrito, comprar ahora, el combo, el regalo de una lista,
 * Yoryo, el editor, compartir con el código de referido, la analítica), con
 * las diferencias a propósito de guia/PRODUCTO.md.
 * Lo de abajo (opiniones y "También te puede gustar") se pide cuando se
 * acerca a la vista, y las fotos bajan en el tamaño que hace falta.
 * El interruptor fichaVieja (useLoViejo, en ProductPage) vuelve a ProductDetail.
 *  - product: el de useProduct · cargando · error · noDisponible ·
 *    categories · onReintentar
 */
export default function FichaDeProducto({ product, cargando, error, noDisponible, categories = [], onReintentar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { addToCart, items: cartItems = [], selectAllItems } = useCart();
  const { user, userProfile } = useAuth();
  const toast = useGlobalToast();
  const conCuenta = tieneCuenta(user);
  const id = product?.id;
  const esCombo = isComboProduct(product);
  // Lo de abajo se pide recién cuando se acerca (onVerAbajo).
  const [abajo, setAbajo] = useState(false);
  const verAbajo = useCallback(() => setAbajo(true), []);

  const { data: marcas } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await getBrands()).data,
    staleTime: 300_000,
  });

  const { porIndice: comboProd, porId: subproductos, listas: comboListo, terminado: comboPedido } = usePiezasDelCombo(product);

  const ficha = useMemo(
    () => (product ? fichaProductoDesde(product, { catalogo: { marcas: marcas || [], categorias: categories }, subproductos }) : null),
    [product, marcas, categories, subproductos],
  );

  // Las copias de cada foto (imagesVariantes del producto o de sus prendas; o
  // las de Cloudinary), como OptimizedImage. Se calculan una vez por foto.
  const fuentes = useMemo(() => {
    const duenos = [product, ...Object.values(comboProd)].filter(Boolean);
    const hechas = new Map();
    return (url) => {
      if (!url) return {};
      if (!hechas.has(url)) {
        const dueno = duenos.find((d) => variantesDeImagen(d, url));
        const { src, srcSet } = fuentesDeImagen(toDirectImageUrl(url), { variantes: dueno ? variantesDeImagen(dueno, url) : undefined, sizes: SIZES_FOTO });
        hechas.set(url, { src, srcSet });
      }
      return hechas.get(url);
    };
  }, [product, comboProd]);

  // Precarga, cuando el navegador queda libre, la primera foto de cada color
  // (y de cada color de las prendas del combo), en el tamaño de la galería:
  // cambiar de color se ve al instante sin bajar todas las fotos del producto.
  useEffect(() => {
    if (!ficha) return undefined;
    const { base, combo, ...porVariante } = ficha.fotos;
    const primeras = combo
      ? combo.piezas.flatMap((pz) => Object.values(pz.porColor).map((l) => l[0]))
      : Object.values(porVariante).map((l) => l[0]?.url);
    const urls = [...new Set(primeras.filter(Boolean))].filter((u) => u !== base[0]?.url).slice(0, 8);
    if (!urls.length) return undefined;
    const t = cuandoLibre(() => urls.forEach((u) => {
      const { src, srcSet } = fuentes(u);
      const img = new Image();
      if (srcSet) { img.sizes = SIZES_FOTO; img.srcset = srcSet; }
      img.src = src || u;
    }));
    return () => cancelarLibre(t);
  }, [ficha, fuentes]);

  // ── Analítica (igual que ProductDetail) ──
  useEffect(() => {
    if (!id) return;
    recordProductClick(id);
    trackProductView({
      productId: id,
      name: product.name,
      category: categoriaDe(product, categories),
      isCombo: esCombo,
      ...(product.categoryId && { categoryId: product.categoryId }),
      ...(product.collectionId && { collectionId: product.collectionId }),
      ...(product.lineaProducto && { lineaProducto: product.lineaProducto }),
      ...(product.brandId && { brandId: product.brandId }),
    }, user).catch(console.error);
  }, [id, categories, esCombo, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cuántos segundos se mira cada variante (recordVariantViewTime): se cuenta
  // desde que se elige hasta que se cambia o se sale de la ficha.
  const vista = useRef({ id: null, desde: 0 });
  const guardarVista = useCallback(() => {
    const { id: vid, desde } = vista.current;
    const segundos = vid != null ? Math.round((Date.now() - desde) / 1000) : 0;
    if (id && segundos > 0) recordVariantViewTime(id, vid, segundos);
  }, [id]);
  const alVariante = useCallback((v) => {
    if (!v?.id || vista.current.id === v.id) return;
    guardarVista();
    vista.current = { id: v.id, desde: Date.now() };
  }, [guardarVista]);
  const guardarRef = useRef(guardarVista);
  guardarRef.current = guardarVista;
  useEffect(() => () => guardarRef.current(), []);

  // ── Opiniones (al acercarse) ──
  const { data: resenas } = useQuery({
    queryKey: ['product-reviews', id],
    queryFn: () => getProductReviews(id),
    enabled: abajo && Boolean(id),
    staleTime: 60_000,
  });
  const opiniones = useMemo(
    () => ({ ...opinionesDesde(resenas || [], { uid: user?.uid }), cargando: !resenas }),
    [resenas, user?.uid],
  );
  const alOpinar = async ({ puntuacion, texto, fotos }) => {
    const { success, error: err, id: rid, data } = await addReview(id, user, puntuacion, texto, fotos);
    if (!success || !data) throw new Error(err || 'No pudimos publicar tu opinión. Inténtalo de nuevo.');
    // addReview devuelve el id aparte: sin él, la opinión nueva no se podía marcar útil.
    queryClient.setQueryData(['product-reviews', id], (antes) => [{ id: rid, ...data }, ...(antes || [])]);
    toast.success('¡Gracias por tu reseña!');
  };
  const alUtil = async (rid) => {
    if (!conCuenta) { toast.error('Inicia sesión para votar'); return; }
    const { success, voted, error: err } = await toggleHelpfulVote(rid, user.uid);
    if (!success) { toast.error(err || 'Error al registrar el voto'); return; }
    queryClient.setQueryData(['product-reviews', id], (antes) => (antes || []).map((r) => {
      if (r.id !== rid) return r;
      const votos = r.helpfulVotes || [];
      return { ...r, helpfulVotes: voted ? [...votos, user.uid] : votos.filter((x) => x !== user.uid) };
    }));
  };

  // ── También te puede gustar (al acercarse): misma categoría y marca ──
  const categoriaRelacionada = product?.categories?.[0] || '';
  const { data: relacionados } = useQuery({
    queryKey: ['related-products', categoriaRelacionada, product?.brandId || null, id],
    queryFn: async () => {
      const { data } = await getProductsByCategory(categoriaRelacionada, product?.brandId || null);
      return (data || []).filter((p) => p.id !== id).slice(0, 12);
    },
    enabled: abajo && Boolean(categoriaRelacionada) && Boolean(id),
    staleTime: 300_000,
  });
  // La tarjeta de la tienda (corazón, "Agregar rápido", la impresión, las copias de la foto).
  const marcaDelProducto = product?.brandId || null;
  const Tarjeta = useMemo(() => function TarjetaRelacionada({ producto }) {
    return <TarjetaDeProducto product={producto} categories={categories} currentBrandId={marcaDelProducto} />;
  }, [categories, marcaDelProducto]);

  // ── Regalo de una lista (/regalar/:código y /wishlist/:código) ──
  // Llega en location.state; solo vale para ESTE producto (al recargar se pierde).
  const regalo = location.state?.regalo;
  const regaloActivo = regalo?.wishlistUserCode && regalo.productId === id ? regalo : null;
  const productoParaCarrito = useMemo(() => {
    if (!regaloActivo) return product;
    const { productId, aviso, ...datosRegalo } = regaloActivo;
    return { ...product, ...datosRegalo, isWishlistGift: true };
  }, [product, regaloActivo]);

  // Combos: no se agrega mientras cargan las prendas.
  const avisarComboCargando = () => {
    if (comboListo) return false;
    if (comboPedido) toast.error('No pudimos cargar las prendas del combo. Recarga la página e inténtalo de nuevo.');
    else toast.info('Un momento: estamos cargando las prendas del combo.');
    return true;
  };

  // ── Comprar ──
  // El toast de "agregado" lo muestra CartContext (antes salían dos) y el
  // botón dice "¡Agregado!".
  const alAgregar = async (eleccion) => {
    if (avisarComboCargando()) return false;
    const { variant, cantidad, combo } = argumentosDelCarrito(product, eleccion, comboProd);
    addToCart(productoParaCarrito, variant, null, cantidad, combo, regaloActivo ? { silent: true } : {});
    if (regaloActivo) {
      // Igual que "Regalar este" en la lista: el regalo va directo al carrito.
      toast.success('¡Regalo agregado! Podrás elegir dónde enviarlo en el Checkout.');
      navigate('/carrito');
    }
    return true;
  };

  // Agrega ESTE producto como el único elegido y va directo a pagar.
  const alComprar = async (eleccion) => {
    if (!product.inStock) return false;
    if (avisarComboCargando()) return false;
    const { variant, cantidad, combo } = argumentosDelCarrito(product, eleccion, comboProd);
    addToCart(productoParaCarrito, variant, null, cantidad, combo, { selectOnly: true, silent: true });
    navigate('/checkout');
    return true;
  };

  // "Ir a pagar mi carrito": elige todo el carrito y va al checkout.
  const alPagarCarrito = () => {
    if (!cartItems.length) { toast.error('Tu carrito está vacío. Agrega productos primero.'); return; }
    selectAllItems();
    navigate('/checkout');
  };

  // ── Personalizar: el editor, o Yoryo ("Personalizable") ──
  const [yoryo, setYoryo] = useState(null); // { diseno } abierto
  const [historial, setHistorial] = useState(null); // diseños anteriores
  const eleccionYoryo = useRef(null);
  const abrirYoryo = async (eleccion) => {
    eleccionYoryo.current = eleccion;
    if (!conCuenta) {
      toast.error('Debes iniciar sesión para poder personalizar este producto.');
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }
    try {
      const { data, error: err } = await getCustomerCustomProductsByUser(user.uid);
      const anteriores = err ? [] : (data || []).filter((d) => d.originalProductId === id);
      if (anteriores.length) setHistorial(anteriores);
      else setYoryo({ diseno: null });
    } catch (e) {
      console.error(e);
      setYoryo({ diseno: null });
    }
  };
  // Los productos de la tienda ya no se personalizan (2026-10-20): eso es
  // Crear. Con el interruptor personalizableViejo vuelven el editor viejo y
  // Yoryo (para las esclavas, la descripción invita a pedirla por WhatsApp).
  const personalizableViejo = useLoViejo('personalizable');
  const alPersonalizar = (eleccion) => {
    if (esYoryoPersonalizable(product)) { navigate(rutaPersonalizarYoryo(product)); return; }
    if (product.YoryoPersonalizado) { abrirYoryo(eleccion); return; }
    navigate(rutaDelEditor(product, eleccion, comboProd));
  };

  // Compartir: un link fijo por producto con el código real de la cuenta.
  const referido = userProfile?.referralCode || '';
  const alCompartir = () => {
    if (!conCuenta) { toast.error('Inicia sesión para compartir y ganar monedas'); return; }
    if (!referido) { toast.error('Tu cuenta todavía está cargando. Inténtalo en un momento.'); return; }
    navigator.clipboard.writeText(linkProducto(id, referido))
      .then(() => toast.success('¡Enlace copiado! Compártelo y gana monedas.'))
      .catch(() => toast.error('Error al copiar'));
  };

  // ── Estados ──
  // Si falla la red pero ya está el de la lista (initialData), se muestra ese.
  let estado;
  if (error?.message === 'Documento no encontrado' || noDisponible) estado = 'noDisponible';
  else if (error && !product) estado = 'error';
  else if (!product) estado = cargando ? 'cargando' : 'error';

  if (estado || !ficha) {
    return <PaginaProducto estado={estado || 'cargando'} onReintentar={onReintentar} />;
  }

  const textoPersonalizar = product.personalizacionYoryo?.pack ? 'Personalizar pack' : product.YoryoPersonalizado ? 'Personalizable' : 'Personalizar';
  return (
    <>
      <PaginaProducto
        key={id}
        {...ficha}
        producto={{ ...ficha.producto, personalizable: esYoryoPersonalizable(product) || personalizableViejo && Boolean(product.customizable || product.YoryoPersonalizado) }}
        fuentes={fuentes}
        piezasCargando={esCombo && !comboPedido}
        opiniones={opiniones}
        onOpinar={alOpinar}
        onUtil={alUtil}
        onVerAbajo={verAbajo}
        relacionados={relacionados || []}
        tarjeta={Tarjeta}
        onAgregar={alAgregar}
        onComprar={alComprar}
        onPersonalizar={alPersonalizar}
        textoPersonalizar={textoPersonalizar}
        onCompartir={alCompartir}
        onVariante={alVariante}
        carrito={cartItems.length}
        onPagarCarrito={alPagarCarrito}
        sesion={conCuenta}
        urlLogin={urlLogin(location.pathname)}
        regalo={regaloActivo ? (regaloActivo.aviso || 'Estás comprando un regalo de una lista de deseos.') : undefined}
      />

      {yoryo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999, backgroundColor: '#fff', overflowY: 'auto' }}>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setYoryo(null)}
              style={{ position: 'absolute', top: '15px', right: '15px', padding: '8px 12px', background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', zIndex: 10000 }}
            >
              Cerrar (X)
            </button>
            <Suspense fallback={<p role="status" style={{ padding: '4rem 2rem' }}>Cargando personalizador…</p>}>
              <YoryoPersonalizadoCliente
                productData={product}
                existingDesignData={yoryo.diseno}
                userId={user?.uid}
                onSaved={(personalizado) => {
                  setYoryo(null);
                  const { variant, cantidad, combo } = argumentosDelCarrito(product, eleccionYoryo.current || {}, comboProd);
                  addToCart(personalizado, variant, null, cantidad, combo);
                  toast.success('¡Diseño guardado y agregado al carrito!');
                  navigate('/carrito');
                }}
              />
            </Suspense>
          </div>
        </div>
      )}

      {historial && (
        <Suspense fallback={null}>
          <HistorialPersonalizacionesModal
            pastDesigns={historial}
            onClose={() => setHistorial(null)}
            onCreateNew={() => { setHistorial(null); setYoryo({ diseno: null }); }}
            onSelectDesign={(diseno) => { setHistorial(null); setYoryo({ diseno }); }}
          />
        </Suspense>
      )}
    </>
  );
}
