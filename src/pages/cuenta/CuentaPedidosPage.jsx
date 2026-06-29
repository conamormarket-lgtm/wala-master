import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePedidos } from '../../hooks/usePedidos';
import { useAuth } from '../../contexts/AuthContext';
import { useProducts } from '../../hooks/useProducts';
// Sistema de diseño Walá: tarjeta + botón premium y envoltorios de movimiento.
// SOLO estética; no se altera la búsqueda de pedidos por DNI ni el flujo de datos
// del hook, ni se toca ninguna lógica de cobro/totales.
import { GlassCard, GlassButton, Reveal, Stagger, StaggerItem } from '../../components/ui';
// Utilidades puras de "estado de la compra" (estilo MercadoLibre).
import {
  derivarEstadoCompra,
  getProductosPedido,
  getCodigoPedido,
} from '../../utils/estadoCompra';
import { toThumbnailImageUrl } from '../../utils/imageUrl';
import { PLACEHOLDER_IMG } from '../../constants/placeholder';
import styles from '../PedidosPage.module.css';
// CSS Module propio (aditivo) para los toques glass de esta vista, sin tocar el
// PedidosPage.module.css compartido con la página de pedidos pública.
import glass from './CuentaPedidosPage.module.css';

/**
 * Resuelve la miniatura de un producto del catálogo (mismo orden de prioridad
 * que la tarjeta de la tienda: mainImage -> images[0]). Devuelve '' si no hay.
 */
function thumbDeProductoCatalogo(producto) {
  if (!producto || typeof producto !== 'object') return '';
  const url = producto.mainImage || (Array.isArray(producto.images) ? producto.images[0] : '') || '';
  return url ? toThumbnailImageUrl(url) : '';
}

/**
 * Construye el resumen visual de un pedido enriquecido con el catálogo:
 *   - miniatura del 1er producto (cruzando productoId con el catálogo; si el
 *     pedido normalizado no trae productos, cae a su imagen de diseño),
 *   - texto de productos (nombre(s) + cantidad),
 *   - estado derivado, fecha, total y código.
 *
 * @param {object} pedido           Pedido (normalizado por usePedidos).
 * @param {Map<string,object>} indiceCatalogo  productoId -> producto del catálogo.
 */
function resumirPedido(pedido, indiceCatalogo) {
  // El pedido normalizado de usePedidos descarta productos/código/pago; usamos el
  // doc CRUDO adjunto (_raw) cuando existe para mostrar datos reales (estilo ML).
  const fuente = (pedido && pedido._raw) || pedido;
  const estado = derivarEstadoCompra(fuente);
  const lineas = getProductosPedido(fuente);
  const codigo = getCodigoPedido(fuente);

  // Nombre + miniatura del primer producto (cruzando con el catálogo).
  let miniatura = '';
  let nombrePrincipal = '';
  if (lineas.length > 0) {
    const primera = lineas[0];
    const prodCat = primera?.productoId != null ? indiceCatalogo.get(String(primera.productoId)) : null;
    miniatura = thumbDeProductoCatalogo(prodCat);
    nombrePrincipal = primera?.producto || prodCat?.name || '';
  }

  // Fallbacks de miniatura: imagen de diseño del propio pedido (el pedido
  // normalizado suele NO traer productos pero sí imageURLs) -> placeholder.
  if (!miniatura) {
    const diseno = Array.isArray(fuente?.imageURLs) ? fuente.imageURLs[0]
      : (Array.isArray(pedido?.imageURLs) ? pedido.imageURLs[0] : '');
    miniatura = diseno ? toThumbnailImageUrl(diseno) : PLACEHOLDER_IMG;
  }

  // Texto de productos: nombre del 1ro + "y N más" si hay varias líneas.
  // Si no hay líneas (pedido normalizado sin productos), usamos la marca como
  // pista legible o un texto neutro.
  let textoProductos;
  if (lineas.length > 0) {
    const total = lineas.length;
    const cant = lineas[0]?.cantidad;
    const base = nombrePrincipal || 'Producto';
    const conCant = cant != null ? `${base} (x${cant})` : base;
    textoProductos = total > 1 ? `${conCant} y ${total - 1} más` : conCant;
  } else if (fuente?.marca || pedido?.marca) {
    textoProductos = String(fuente?.marca || pedido?.marca);
  } else {
    textoProductos = 'Tu compra Walá';
  }

  // Total: respeta el dato tal cual (NO se recalcula nada de cobro/totales).
  const totalCrudo = fuente?.montoTotal ?? pedido?.montoTotal ?? pedido?.total;
  const totalNum = totalCrudo != null ? Number(totalCrudo) : NaN;
  const totalTexto = !Number.isNaN(totalNum)
    ? `S/ ${totalNum.toFixed(2)}`
    : (totalCrudo != null ? `S/ ${totalCrudo}` : null);

  const fecha = pedido?.fechaCompra && pedido.fechaCompra !== 'N/A' ? pedido.fechaCompra : null;

  return {
    id: pedido?.id,
    estado,
    miniatura,
    textoProductos,
    totalTexto,
    fecha,
    codigo,
  };
}

/**
 * Contenido de "Mis Compras" dentro de Mi cuenta (estilo MercadoLibre).
 * Carga pedidos por DNI del perfil (clienteNumeroDocumento en ERP) y los
 * enriquece con el catálogo (useProducts) para mostrar imagen y nombre.
 */
const CuentaPedidosPage = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  // Navegación programática para que TODA la tarjeta sea clickeable (no solo el
  // botón "Ver compra"). No tocamos carrito/precios/cobro.
  const navigate = useNavigate();
  const hasDni = !!(userProfile?.dni && String(userProfile.dni).trim());
  const dni = userProfile?.dni ? String(userProfile.dni).trim() : '';
  // UID del usuario autenticado: se hila al hook para recuperar también los
  // pedidos del espejo (wala_pedidos) por buyerUid, no solo por DNI.
  const uid = user?.uid || undefined;
  const { loading, error, data, buscar } = usePedidos(dni, uid);
  const [hasFetched, setHasFetched] = useState(false);

  // Catálogo para enriquecer cada pedido con imagen/nombre del 1er producto.
  // No bloquea la vista: si aún no carga, caemos a la imagen de diseño/placeholder.
  const { data: productos } = useProducts([]);

  useEffect(() => {
    if (!user || (!hasDni && !authLoading) || hasFetched) return;
    setHasFetched(true);
    // Disparar búsqueda sin await (lo maneja el hook, que a su vez usa su propia caché).
    // Pasamos el uid para que la lectura incluya la copia espejo por buyerUid.
    buscar(dni, uid);
  }, [user, hasDni, dni, uid, hasFetched, buscar, authLoading]);

  // Índice productoId -> producto del catálogo (memoizado para no recorrerlo por pedido).
  const indiceCatalogo = useMemo(() => {
    const idx = new Map();
    if (Array.isArray(productos)) {
      for (const p of productos) {
        if (p && p.id != null) idx.set(String(p.id), p);
      }
    }
    return idx;
  }, [productos]);

  // Si todavía estamos validando al usuario con Firebase, o si falta extraer el perfil local
  if (authLoading) {
    return (
      <div className={styles.content}>
        <div className={styles.skeletonList}>
          {[1, 2, 3].map(n => (
            <div key={n} className={styles.skeletonOrder} />
          ))}
        </div>
      </div>
    );
  }

  // Si terminó authLoading pero no hay perfil o DNI guardado.
  if (!userProfile || !hasDni) {
    return (
      <div className={styles.content}>
        <Reveal className={`${styles.profileCard} ${glass.card}`}>
          <h2>Completa tu perfil</h2>
          <p>Para ver tus compras necesitamos tu DNI o CE en tu perfil.</p>
          <GlassButton as={Link} to="/completar-perfil" variant="primary">Completar perfil</GlassButton>
        </Reveal>
      </div>
    );
  }

  // Para evitar "flash de spinner" si sabemos que vienen datos locales, priorizamos si 'data' ya tiene algun valor (por cache)
  if (loading && !data) {
    return (
      <div className={styles.content}>
        <div className={styles.skeletonList}>
          {[1, 2, 3].map(n => (
            <div key={n} className={styles.skeletonOrder} />
          ))}
        </div>
      </div>
    );
  }

  const pedidos = data?.pedidos ?? [];
  const showResults = pedidos.length > 0;
  const showEmpty = !loading && hasFetched && !error && pedidos.length === 0;

  if (showResults) {
    return (
      <div className={styles.content}>
        <Reveal className={glass.header}>
          <h2 className={glass.headerTitle}>Mis compras</h2>
          <p className={glass.headerSub}>
            {pedidos.length === 1 ? '1 compra' : `${pedidos.length} compras`} en tu cuenta
          </p>
        </Reveal>

        <Stagger as="ul" className={glass.grid}>
          {pedidos.map((pedido) => {
            const r = resumirPedido(pedido, indiceCatalogo);
            // Destino del detalle de la compra (mismo que el botón "Ver compra").
            const destino = `/cuenta/pedidos/${r.id}`;
            // Toda la tarjeta navega al detalle. El <Link> interno sigue funcionando
            // (no anidamos <a>: el card usa onClick, no as={Link}).
            const irADetalle = () => navigate(destino);
            const onCardKeyDown = (e) => {
              // Enter o Espacio activan la "tarjeta-enlace" (accesibilidad).
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                irADetalle();
              }
            };
            return (
              <StaggerItem as="li" key={r.id} className={glass.gridItem}>
                <GlassCard
                  as="article"
                  variant="solid"
                  padding="md"
                  hover
                  animate={false}
                  className={glass.compraCard}
                  bodyClassName={glass.compraBody}
                  role="link"
                  tabIndex={0}
                  aria-label={`Ver compra: ${r.textoProductos}`}
                  onClick={irADetalle}
                  onKeyDown={onCardKeyDown}
                >
                  {/* Cabecera de la tarjeta: badge de estado bien visible. */}
                  <div className={glass.estadoRow}>
                    <span
                      className={glass.estadoBadge}
                      style={{
                        // Color del estado derivado (violeta/verde/azul/ámbar/gris).
                        color: r.estado.color,
                        backgroundColor: `${r.estado.color}1A`, // ~10% de opacidad
                        borderColor: `${r.estado.color}33`,     // ~20% de opacidad
                      }}
                    >
                      <span className={glass.estadoDot} style={{ backgroundColor: r.estado.color }} aria-hidden="true" />
                      {r.estado.label}
                    </span>
                  </div>

                  {/* Cuerpo: miniatura + datos del pedido. */}
                  <div className={glass.compraMain}>
                    <div className={glass.thumbWrap}>
                      <img
                        className={glass.thumb}
                        src={r.miniatura}
                        alt={r.textoProductos}
                        loading="lazy"
                        onError={(e) => {
                          // Si la imagen del catálogo/diseño falla, mostramos el placeholder.
                          if (e.currentTarget.src !== PLACEHOLDER_IMG) {
                            e.currentTarget.src = PLACEHOLDER_IMG;
                          }
                        }}
                      />
                    </div>

                    <div className={glass.compraInfo}>
                      <p className={glass.productoNombre} title={r.textoProductos}>
                        {r.textoProductos}
                      </p>
                      <p className={glass.paymentLabel}>{r.estado.paymentLabel}</p>

                      <dl className={glass.metaList}>
                        {r.fecha && (
                          <div className={glass.metaItem}>
                            <dt className={glass.metaLabel}>Fecha</dt>
                            <dd className={glass.metaValue}>{r.fecha}</dd>
                          </div>
                        )}
                        {r.totalTexto && (
                          <div className={glass.metaItem}>
                            <dt className={glass.metaLabel}>Total</dt>
                            <dd className={`${glass.metaValue} ${glass.total}`}>{r.totalTexto}</dd>
                          </div>
                        )}
                        {r.codigo && (
                          <div className={glass.metaItem}>
                            <dt className={glass.metaLabel}>Código</dt>
                            <dd className={`${glass.metaValue} ${glass.codigo}`}>{r.codigo}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>

                  {/* Acción: ir al detalle de la compra. */}
                  <div className={glass.compraActions}>
                    <GlassButton
                      as={Link}
                      to={`/cuenta/pedidos/${r.id}`}
                      variant="primary"
                      size="sm"
                      fullWidth
                    >
                      Ver compra
                    </GlassButton>
                  </div>
                </GlassCard>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    );
  }

  if (showEmpty) {
    return (
      <div className={styles.content}>
        <Reveal className={`${styles.profileCard} ${glass.card}`}>
          <h2>No hay compras</h2>
          <p>Aún no tienes compras asociadas a tu cuenta. Cuando hagas una compra, aparecerá aquí.</p>
          <GlassButton as={Link} to="/tienda" variant="primary">Ir a la tienda</GlassButton>
        </Reveal>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.content}>
        <Reveal className={`${styles.profileCard} ${glass.card}`}>
          <h2>Error al cargar compras</h2>
          <p className={styles.errorText}>{error}</p>
          <GlassButton variant="primary" onClick={() => setHasFetched(false)}>
            Reintentar
          </GlassButton>
        </Reveal>
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <div className={styles.skeletonList}>
        {[1, 2].map(n => (
          <div key={n} className={styles.skeletonOrder} />
        ))}
      </div>
    </div>
  );
};

export default CuentaPedidosPage;
