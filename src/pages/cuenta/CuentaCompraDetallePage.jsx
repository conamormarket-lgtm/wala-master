import React, { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Check } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { usePedidos } from '../../hooks/usePedidos';
import { useProducts } from '../../hooks/useProducts';

import { GlassCard, Reveal, Stagger, StaggerItem } from '../../components/ui';
import Timeline from '../../components/Timeline';
import { PASOS_GENERALES } from '../../utils/constants';

import {
  derivarEstadoCompra,
  getProductosPedido,
  getCodigoPedido,
  getBrandIdsDePedido,
} from '../../utils/estadoCompra';
import { formatCurrency } from '../../utils/formatters';
import { toThumbnailImageUrl } from '../../utils/imageUrl';
import { normalizarPedidoParaVista } from '../../utils/pedidos';

import { getBrands } from '../../services/brands';
import { getMessage } from '../../services/messages';
import { getFeaturedProducts, getProductsByCategory } from '../../services/products';
import { getOrderByIdAnyCollection } from '../../services/erp/firebase';

import ProductGrid from '../Tienda/components/ProductGrid/ProductGrid';

import styles from './CuentaCompraDetallePage.module.css';
import { T } from '../../i18n/useTranslatedText';

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers locales (presentación / lectura defensiva)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Normaliza un número de WhatsApp como en el resto del repo:
 * quita espacios/guiones/paréntesis/+, y antepone 51 (Perú) si tiene <=9 dígitos.
 */
function normalizarWhatsapp(num) {
  if (!num) return '';
  let clean = String(num).replace(/[\s\-()+]/g, '');
  if (clean && !clean.startsWith('51') && clean.length <= 9) {
    clean = `51${clean}`;
  }
  return clean;
}

/** Construye el enlace wa.me con el mensaje de consulta de estado. */
function construirWaLink(numero, codigo) {
  const n = normalizarWhatsapp(numero);
  if (!n) return null;
  const mensaje = `Hola, quiero consultar el estado de mi pedido #${codigo}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`;
}

/** Convierte a número de forma segura (acepta strings tipo "120.00"). */
function toNum(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

/** Imagen de una línea: usa el producto del catálogo o la imagen personalizada. */
function imagenDeLinea(linea, productoCatalogo) {
  const fromCatalogo =
    productoCatalogo?.mainImage ||
    productoCatalogo?.images?.[0] ||
    productoCatalogo?.imageUrl ||
    null;
  // Fallback NUEVO tras el catálogo: las líneas de pedidos nuevos congelan la
  // imagen del producto al comprar (urlImagen). Así el detalle no se queda sin
  // foto si el producto fue borrado físicamente (legado) del catálogo.
  const url = linea?.urlImagenPersonalizada || fromCatalogo || linea?.urlImagen;
  return url ? toThumbnailImageUrl(url) : null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Página de detalle "Estado de la compra"
 * ────────────────────────────────────────────────────────────────────────── */
const CuentaCompraDetallePage = () => {
  const { id } = useParams();
  const { user, userProfile, loading: authLoading } = useAuth();
  const dni = userProfile?.dni ? String(userProfile.dni).trim() : '';
  const uid = user?.uid || undefined; // misma clave de caché que la lista; rescata espejos por usuario

  // 1) Reutilizamos el MISMO hook de la lista (usePedidos por DNI + userId). Sirve
  //    para encontrar el pedido normalizado y disparar la búsqueda si hace falta.
  const { loading: pedidosLoading, data, buscar } = usePedidos(dni, uid);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (authLoading || !dni || hasFetched) return;
    setHasFetched(true);
    buscar(dni, uid);
  }, [authLoading, dni, uid, hasFetched, buscar]);

  const pedidoNormalizado = useMemo(
    () => (data?.pedidos || []).find((p) => p.id === id) || null,
    [data, id]
  );

  // 2) El pedido normalizado NO conserva los campos crudos (productos,
  //    numeroPedido, metodoPago, envioDireccion, pagado, web...). Para el
  //    DETALLE necesitamos el pedido CRUDO: lo traemos por id del ERP.
  const {
    data: pedidoRaw,
    isLoading: rawLoading,
    isError: rawError,
  } = useQuery({
    queryKey: ['pedido-erp', id],
    queryFn: async () => {
      // Lee el pedido CRUDO por id en AMBAS colecciones del ERP (pedidos +
      // pedidos_web), así el detalle está completo tanto para pedidos validados
      // como para los recién comprados que siguen en la cola web. Si no se
      // encuentra, devolvemos null y caemos al crudo adjunto del normalizado.
      const { data: raw } = await getOrderByIdAnyCollection(id);
      return raw || null;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  // Pedido efectivo: preferimos el crudo del ERP (detalle completo); si no, el
  // crudo adjunto (_raw) del normalizado de usePedidos; y por último el normalizado.
  //
  // WALA = FUENTE DE VERDAD: el crudo del ERP (pedidoRaw) se carga fresco por id y
  // NO trae el estadoWala que searchOrdersByDniInERP adjuntó al doc de la LISTA
  // (_walaEstado/_walaPagado). Para que el detalle muestre el MISMO estado que la
  // lista (regla del más avanzado, vía derivarEstadoCompra), propagamos el estado
  // propio de WALA desde el crudo de la lista al pedido efectivo. Es ADITIVO: no
  // toca montos ni la lógica de pago; solo el estado mostrado.
  const crudoLista = pedidoNormalizado?._raw || null;
  const pedidoBase = pedidoRaw || crudoLista || pedidoNormalizado;
  const pedido = useMemo(() => {
    if (!pedidoBase) return pedidoBase;
    const walaEstado =
      pedidoBase.estadoWala ?? pedidoBase._walaEstado ?? crudoLista?.estadoWala ?? crudoLista?._walaEstado ?? null;
    const walaPagado = pedidoBase._walaPagado === true || crudoLista?._walaPagado === true || crudoLista?.pagado === true;
    if (walaEstado == null && !walaPagado) return pedidoBase;
    return {
      ...pedidoBase,
      ...(walaEstado != null && { _walaEstado: walaEstado }),
      ...(walaPagado && { _walaPagado: true }),
    };
  }, [pedidoBase, crudoLista]);

  // 3) Catálogo (imágenes + inferencia de marca) y marcas (números de asesor).
  // includeHidden: el detalle de una compra debe seguir resolviendo imagen/nombre
  // aunque el producto haya sido borrado lógicamente (tombstone). Los
  // "relacionados" siguen filtrando visible !== false más abajo.
  const { data: catalogo = [] } = useProducts([], { includeHidden: true });

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data: b, error } = await getBrands();
      if (error) throw new Error(error);
      return b || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  // Número general de respaldo (cuenta) para el botón de WhatsApp.
  const { data: numeroGeneral } = useQuery({
    queryKey: ['whatsapp_number_cuenta'],
    queryFn: async () => {
      const cuenta = await getMessage('whatsapp_number_cuenta');
      if (cuenta.data && cuenta.data.trim()) return cuenta.data.trim();
      const general = await getMessage('whatsapp_number');
      return general.data?.trim() || '';
    },
    staleTime: 1000 * 60 * 10,
  });

  // 3.5) Pedido normalizado a la forma que espera <Timeline> (fechas por
  //    etapa). El pedido EFECTIVO de esta página prioriza el crudo del ERP
  //    (pedidoRaw), que trae las fechas anidadas por etapa (ej.
  //    pedido.impresion.fechaSalida), NO el mapa plano {impresion, diseno,
  //    preparacion...} que Timeline lee de `fechas`. normalizarPedidoParaVista
  //    -la MISMA función que usePedidos ya usa para toda la lista- hace esa
  //    conversión; sin pasar por acá, Timeline no encontraba fecha para
  //    ninguna etapa y no marcaba ningún paso como completado, sin importar
  //    qué tan avanzado estuviera el pedido en la realidad.
  //    Tolerante a `pedido` aún no disponible (mismo criterio que el useMemo
  //    de abajo: se calcula ANTES de los early returns).
  const pedidoParaTimeline = useMemo(
    () => normalizarPedidoParaVista(pedido) || {},
    [pedido]
  );

  // 4) "También te puede interesar": recomendación POR CATEGORÍA del producto
  //    comprado, con fallback a destacados.
  //
  //    Primero derivamos, del pedido, el primer productoId con categoría conocida
  //    cruzándolo contra el catálogo (useProducts ya cargado). De ese producto
  //    tomamos su category/categories[0]. También calculamos el set de productoId
  //    ya comprados en ESTE pedido para excluirlos de los relacionados.
  //
  //    OJO: este useMemo se calcula ANTES de los early returns de carga para no
  //    romper el orden de hooks; es tolerante a que `pedido` o `catalogo` aún no
  //    estén disponibles (devuelve categoryId null e idsComprados vacío).
  const { categoryId, idsComprados } = useMemo(() => {
    const lineasPedido = getProductosPedido(pedido);

    // Set de productoId comprados en este pedido (para excluir de relacionados).
    // Filtramos ANTES de String() para no meter el string 'undefined' al Set
    // (líneas de pedidos nativos del ERP pueden no traer productoId).
    const comprados = new Set(
      lineasPedido.map((l) => l?.productoId).filter(Boolean).map(String)
    );

    // Índice productoId -> producto del catálogo (tolerante a catálogo vacío).
    const porId = new Map();
    (catalogo || []).forEach((p) => {
      if (p && p.id != null) porId.set(String(p.id), p);
    });

    // Primer productoId del pedido con categoría conocida (vía catálogo o la
    // propia línea), priorizando categories[0] y cayendo a category.
    let cat = null;
    for (const linea of lineasPedido) {
      const prod = porId.get(String(linea?.productoId));
      const candidata =
        prod?.categories?.[0] ||
        prod?.category ||
        linea?.categories?.[0] ||
        linea?.category ||
        null;
      if (candidata) {
        cat = String(candidata);
        break;
      }
    }

    return { categoryId: cat, idsComprados: comprados };
  }, [pedido, catalogo]);

  // Recomendación: si hay categoría, productos de esa categoría; si no hay o
  // devuelve poco (<2), caemos a destacados. La key incluye categoryId para que
  // cambie por pedido/categoría sin colisionar con la caché de otras vistas.
  const { data: reco = [] } = useQuery({
    queryKey: ['reco-detalle', categoryId],
    queryFn: async () => {
      if (categoryId) {
        const { data: porCat, error } = await getProductsByCategory(categoryId);
        if (!error && Array.isArray(porCat) && porCat.length >= 2) {
          return porCat;
        }
      }
      // Fallback a destacados (sin categoría, error, o muy pocos resultados).
      const { data: f, error: errF } = await getFeaturedProducts();
      if (errF) throw new Error(errF);
      return f || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  /* ── Estados de carga / no encontrado ─────────────────────────────────── */

  const cargando =
    authLoading || rawLoading || (pedidosLoading && !pedidoNormalizado);

  if (cargando && !pedido) {
    return (
      <div className={styles.page}>
        <div className={styles.skeletonWrap}>
          <div className={`${styles.skeletonBlock} ${styles.skeletonHeader}`} />
          <div className={`${styles.skeletonBlock} ${styles.skeletonList}`} />
        </div>
      </div>
    );
  }

  // Si terminó la carga (ambas fuentes) y no hay pedido -> no encontrado.
  // La búsqueda por lista solo aplica si hay DNI: sin DNI, basta con que el
  // lookup directo por id (pedidoRaw) haya terminado para decidir.
  const listaResuelta = !dni || (hasFetched && !pedidosLoading);
  if (!pedido && !rawLoading && (rawError || listaResuelta)) {
    return (
      <div className={styles.page}>
        <Reveal>
          <GlassCard variant="solid" padding="lg" animate={false} bodyClassName={styles.noEncontrado}>
            <h2 className={styles.noEncontradoTitulo}><T>No encontramos esta compra</T></h2>
            <p className={styles.noEncontradoTexto}>
              Es posible que el pedido ya no esté disponible o que no pertenezca a tu
              cuenta.
            </p>
            <Link to="/cuenta/pedidos" className={styles.btnSolido}>
              Volver a Mis Compras
            </Link>
          </GlassCard>
        </Reveal>
      </div>
    );
  }

  if (!pedido) {
    // Aún resolviendo alguna fuente: mantenemos el skeleton.
    return (
      <div className={styles.page}>
        <div className={styles.skeletonWrap}>
          <div className={`${styles.skeletonBlock} ${styles.skeletonHeader}`} />
          <div className={`${styles.skeletonBlock} ${styles.skeletonList}`} />
        </div>
      </div>
    );
  }

  /* ── Derivaciones para la vista ───────────────────────────────────────── */

  const estado = derivarEstadoCompra(pedido);
  const codigo = getCodigoPedido(pedido);
  const lineas = getProductosPedido(pedido);

  // ¿El pedido ya tiene fase REAL de producción del ERP (para mostrar el
  // stepper granular de 8 pasos), o todavía va por el seguimiento general de
  // 5 (Pago→Entregado, estado propio de Walá)? Mismo criterio que
  // CuentaRastreoPage.jsx (hayFaseErpReal): hay fase real si quedó alguna
  // fecha de etapa (diseño, impresión…) tras normalizar el pedido.
  const hayFaseReal = Object.keys(pedidoParaTimeline.fechas || {}).length > 0;
  // Paso actual (0-4) dentro del seguimiento general, mismo mapeo que usa
  // CuentaRastreoPage.jsx para el mismo `estado.key` (derivarEstadoCompra).
  const mapaPasoGeneral = { por_confirmar_pago: 0, pago_confirmado: 1, en_preparacion: 2, entregado: 4, anulado: -1 };
  const pasoGeneralIdx = mapaPasoGeneral[estado.key] ?? 0;

  // Índice productoId -> producto del catálogo (para imagen).
  const catalogoPorId = new Map();
  (catalogo || []).forEach((p) => {
    if (p && p.id != null) catalogoPorId.set(String(p.id), p);
  });

  // Fecha legible (createdAt puede ser Timestamp Firestore, Date o string).
  const fechaLegible = (() => {
    const raw = pedido.createdAt ?? pedido.fechaCompra;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    const d = raw?.toDate?.() ?? (raw instanceof Date ? raw : null);
    return d ? d.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
  })();

  // Dirección de entrega (alias defensivos: campos de envío o de cliente).
  const direccion =
    pedido.envioDireccion || pedido.direccion || pedido.clienteDireccion || '';
  const distrito =
    pedido.envioDistrito || pedido.clienteDistrito || pedido.distrito || '';
  const departamento =
    pedido.envioDepartamento ||
    pedido.envioCiudad ||
    pedido.clienteDepartamento ||
    pedido.ciudad ||
    '';
  const partesDireccionSecundaria = [distrito, departamento].filter(Boolean);

  // Totales (SOLO se leen y se pintan; no se recalcula ningún cobro).
  // Los pedidos NATIVOS del ERP (colección 'pedidos') traen líneas SIN precio ni
  // subtotal → totalProductos=0 y, al deducir el envío, este absorbía todo el
  // total ("Productos S/0.00, Envío S/<total>"). Detectamos si hay subtotales
  // reales en alguna línea para decidir cómo desglosar.
  const tieneSubtotalesReales = lineas.some(
    (l) => l?.subtotal != null || l?.precio != null
  );
  const totalProductosCalc = lineas.reduce((acc, l) => {
    const sub = l?.subtotal != null ? toNum(l.subtotal) : toNum(l?.precio) * toNum(l?.cantidad);
    return acc + sub;
  }, 0);
  const descuentoMonedas = toNum(pedido.descuentoMonedas);
  const total = toNum(pedido.montoTotal ?? pedido.total);
  // Envío: si el pedido lo persistió (costoEnvio), úsalo; si no (pedidos viejos),
  // dedúcelo SOLO cuando hay subtotales reales para que el desglose cuadre:
  // Total = Productos − Descuento + Envío.
  const envioPersistido = pedido.costoEnvio ?? pedido.envioMonto ?? pedido.montoEnvio;

  // Cuando NO hay subtotales reales (pedido nativo del ERP), mostramos el TOTAL
  // como Productos y NO deducimos envío (envioMonto=0, fila de envío oculta), así
  // evitamos el desglose confuso "Productos S/0.00 + Envío S/<total>".
  const totalProductos = tieneSubtotalesReales ? totalProductosCalc : total;
  const envioMonto = !tieneSubtotalesReales
    ? 0
    : envioPersistido != null
      ? toNum(envioPersistido)
      : Math.max(0, total - (totalProductosCalc - descuentoMonedas));

  // ── WhatsApp por marca ──────────────────────────────────────────────────
  const brandIds = getBrandIdsDePedido(pedido, catalogo);
  const brandsConNumero = brandIds
    .map((bid) => {
      const b = (brands || []).find((x) => x.id === bid);
      const numero = b?.whatsappNumber ? normalizarWhatsapp(b.whatsappNumber) : '';
      return numero ? { id: bid, name: b?.name || 'la marca', link: construirWaLink(numero, codigo) } : null;
    })
    .filter(Boolean);

  // Si ninguna marca tiene número, caemos al número general de la cuenta.
  const waGeneralLink = construirWaLink(numeroGeneral, codigo);

  // ── Relacionados (por categoría con fallback a destacados) ───────────────
  // Excluye los productoId ya comprados en ESTE pedido, filtra visible!==false
  // y corta a ~8. `idsComprados` viene del useMemo de recomendación.
  const relacionados = (reco || [])
    .filter((p) => p && p.visible !== false && !idsComprados.has(String(p.id)))
    .slice(0, 8);

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
        <Link to="/cuenta/pedidos" className={styles.breadcrumbLink}>
          Compras
        </Link>
        <span className={styles.breadcrumbSep} aria-hidden="true">
          ›
        </span>
        <span className={styles.breadcrumbCurrent}><T>Estado de la compra</T></span>
      </nav>

      <div className={styles.layout}>
        {/* ── Columna principal ──────────────────────────────────────────── */}
        <div className={styles.mainCol}>
          {/* Encabezado: código + fecha + badge de estado + pago */}
          <Reveal>
            <GlassCard variant="solid" padding="md" animate={false} bodyClassName={styles.headerCard}>
              <div className={styles.headerTop}>
                <div className={styles.headerMeta}>
                  <span className={styles.codigo}>Pedido #{codigo || '—'}</span>
                  {fechaLegible && (
                    <span className={styles.fecha}>Realizado el {fechaLegible}</span>
                  )}
                </div>
                <span
                  className={styles.estadoBadge}
                  style={{
                    color: estado.color,
                    backgroundColor: `${estado.color}1A`,
                    borderColor: `${estado.color}33`,
                  }}
                >
                  <span
                    className={styles.estadoDot}
                    style={{ background: estado.color }}
                    aria-hidden="true"
                  />
                  {estado.label}
                </span>
              </div>
              <div className={styles.pagoLinea}>
                <span
                  className={styles.pagoDot}
                  style={{ background: estado.color }}
                  aria-hidden="true"
                />
                {estado.paymentLabel}
              </div>
            </GlassCard>
          </Reveal>

          {/* Seguimiento: el stepper completo -de 8 pasos (Compra…Finalizado)
              si el taller ya reporta fase real del ERP, o de 5 (Pago…
              Entregado, estado propio de Walá) mientras no- que antes vivía
              apretado en la tarjeta de Rastreo y la desparejaba contra
              tarjetas vecinas en otra fase. Acá hay ancho real y no hay una
              fila de grid que desparejar, así que el detalle completo (los
              5 O los 8 pasos, no solo el actual) vive en este lugar; Rastreo
              solo muestra "Paso X de Y". No tiene sentido para un pedido
              anulado (no hay fase a la que seguirle el rastro). */}
          {estado.key !== 'anulado' && (
            <Reveal>
              <GlassCard variant="solid" padding="md" animate={false}>
                <h2 className={styles.cardTitle}>
                  {hayFaseReal ? <T>Seguimiento de producción</T> : <T>Seguimiento general</T>}
                </h2>
                {hayFaseReal ? (
                  <div className={styles.seguimientoWrap}>
                    <Timeline
                      fechas={pedidoParaTimeline.fechas}
                      fechaCompra={pedidoParaTimeline.fechaCompra}
                      pedido={pedidoParaTimeline}
                    />
                  </div>
                ) : (
                  <>
                    <p className={styles.seguimientoGeneralNota}>
                      <T>El detalle por etapas de producción (8 pasos) aparece aquí cuando el taller registra el pedido.</T>
                    </p>
                    {/* Mismo lenguaje visual que <Timeline> (el stepper de 8
                        pasos de producción): nodo circular + línea
                        conectora, en vez de una pila de pills sueltas. Así
                        "Seguimiento general" y "Seguimiento de producción"
                        se leen como la MISMA familia de componente. El paso
                        ACTUAL usa el color de estado.color (mismo color que
                        el badge del header); los completados van en verde
                        (--verde-exito, igual criterio que el resto del
                        sitio); los pendientes quedan en gris neutro. */}
                    <div className={styles.pasoGeneralWrap}>
                      <ol className={styles.seguimientoGeneral}>
                        {PASOS_GENERALES.map((label, i) => {
                          const done = pasoGeneralIdx >= 0 && i < pasoGeneralIdx;
                          const actual = i === pasoGeneralIdx;
                          const itemClass = [
                            styles.pasoGeneralItem,
                            done && styles.pasoGeneralItemDone,
                            actual && styles.pasoGeneralItemActual,
                          ].filter(Boolean).join(' ');
                          return (
                            <li key={label} className={itemClass}>
                              <span
                                className={styles.pasoGeneralDot}
                                style={actual ? { background: estado.color } : undefined}
                              >
                                {done && <Check size={14} strokeWidth={4} aria-hidden="true" />}
                                {actual && <span className={styles.pasoGeneralPuntito} aria-hidden="true" />}
                              </span>
                              <span className={styles.pasoGeneralLabel}>{label}</span>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  </>
                )}
              </GlassCard>
            </Reveal>
          )}

          {/* Lista de productos */}
          <Reveal>
          <GlassCard variant="solid" padding="md" animate={false}>
            <h2 className={styles.cardTitle}>
              Producto{lineas.length === 1 ? '' : 's'}
            </h2>
            {lineas.length === 0 ? (
              <p className={styles.direccionSecundaria}>
                No hay detalle de productos para este pedido.
              </p>
            ) : (
              <Stagger>
                {lineas.map((linea, i) => {
                  const prodCat = catalogoPorId.get(String(linea?.productoId));
                  const img = imagenDeLinea(linea, prodCat);
                  const nombre = linea?.producto || prodCat?.name || 'Producto';
                  const cantidad = toNum(linea?.cantidad) || 1;
                  const subtotal =
                    linea?.subtotal != null
                      ? toNum(linea.subtotal)
                      : toNum(linea?.precio) * cantidad;
                  return (
                    <StaggerItem
                      key={`${linea?.productoId || 'item'}-${i}`}
                      className={styles.linea}
                    >
                      <div className={styles.lineaImgWrap}>
                        {img ? (
                          <img
                            className={styles.lineaImg}
                            src={img}
                            alt={nombre}
                            loading="lazy"
                          />
                        ) : (
                          <span className={styles.lineaImgPlaceholder} aria-hidden="true">
                            ◇
                          </span>
                        )}
                      </div>
                      <div className={styles.lineaInfo}>
                        <span className={styles.lineaNombre}>{nombre}</span>
                        <div className={styles.lineaAtributos}>
                          {linea?.talla && (
                            <span className={styles.chip}>Talla: {linea.talla}</span>
                          )}
                          {linea?.color && (
                            <span className={styles.chip}>Color: {linea.color}</span>
                          )}
                          {linea?.personalizado && (
                            <span className={styles.chip}>Personalizado</span>
                          )}
                        </div>
                        <div className={styles.lineaFooter}>
                          <span className={styles.lineaCantidad}>
                            Cantidad: {cantidad}
                          </span>
                          <span className={styles.lineaSubtotal}>
                            {formatCurrency(subtotal)}
                          </span>
                        </div>
                      </div>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            )}
          </GlassCard>
          </Reveal>

          {/* Dirección de entrega */}
          {(direccion || partesDireccionSecundaria.length > 0) && (
            <Reveal>
              <GlassCard variant="solid" padding="md" animate={false}>
                <h2 className={styles.cardTitle}><T>Dirección de entrega</T></h2>
                {direccion && <p className={styles.direccionTexto}>{direccion}</p>}
                {partesDireccionSecundaria.length > 0 && (
                  <p className={styles.direccionSecundaria}>
                    {partesDireccionSecundaria.join(', ')}
                  </p>
                )}
              </GlassCard>
            </Reveal>
          )}
        </div>

        {/* ── Columna lateral: detalle de la compra + WhatsApp ───────────── */}
        <div className={styles.sideCol}>
          <Reveal>
          <GlassCard variant="solid" padding="md" animate={false}>
            <h2 className={styles.cardTitle}><T>Detalle de la compra</T></h2>

            <div className={styles.resumenRow}>
              <span className={styles.resumenLabel}>
                Producto{lineas.length === 1 ? '' : 's'}
              </span>
              <span>{formatCurrency(totalProductos)}</span>
            </div>

            {descuentoMonedas > 0 && (
              <div className={styles.resumenRow}>
                <span className={styles.resumenLabel}>Descuento (monedas)</span>
                <span className={styles.resumenDescuento}>
                  -{formatCurrency(descuentoMonedas)}
                </span>
              </div>
            )}

            {/* Fila de Envío: se OCULTA en pedidos nativos del ERP (sin subtotales
                reales), donde el Total ya se muestra como Productos. Mostrarla como
                "Gratis"/"S/0.00" ahí confundiría (el envío puede ir incluido en el total). */}
            {tieneSubtotalesReales && (
              <div className={styles.resumenRow}>
                <span className={styles.resumenLabel}><T>Envío</T></span>
                {envioMonto > 0 ? (
                  <span>{formatCurrency(envioMonto)}</span>
                ) : (
                  <span className={styles.resumenGratis}>Gratis</span>
                )}
              </div>
            )}

            <hr className={styles.resumenDivider} />

            <div className={styles.resumenTotal}>
              <span><T>Total</T></span>
              <span>{formatCurrency(total)}</span>
            </div>

            <p className={styles.resumenPago}>{estado.paymentLabel}</p>
          </GlassCard>
          </Reveal>

          {/* WhatsApp al asesor de la marca (o general) */}
          <Reveal>
          <GlassCard variant="solid" padding="md" animate={false} bodyClassName={styles.waBlock}>
            <p className={styles.waHint}><T>¿Dudas con tu pedido?</T></p>
            {brandsConNumero.length > 1 ? (
              brandsConNumero.map((b) => (
                <a
                  key={b.id}
                  href={b.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.btnSolido} ${styles.btnSolidoFull}`}
                >
                  Consultar a {b.name} por WhatsApp
                </a>
              ))
            ) : (
              (() => {
                const waLink = brandsConNumero[0]?.link || waGeneralLink || null;
                if (!waLink) {
                  return (
                    <span
                      className={`${styles.btnSolido} ${styles.btnSolidoFull} ${styles.btnSolidoDisabled}`}
                      aria-disabled="true"
                    >
                      Consultar estado de mi pedido
                    </span>
                  );
                }
                return (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.btnSolido} ${styles.btnSolidoFull}`}
                  >
                    Consultar estado de mi pedido
                  </a>
                );
              })()
            )}
          </GlassCard>
          </Reveal>
        </div>
      </div>

      {/* También te puede interesar */}
      {relacionados.length > 0 && (
        <Reveal className={styles.relacionados}>
          <h2 className={styles.relacionadosTitulo}><T>También te puede interesar</T></h2>
          <ProductGrid products={relacionados} categories={[]} />
        </Reveal>
      )}
    </div>
  );
};

export default CuentaCompraDetallePage;
