import React from 'react';
import { ETAPAS_TIMELINE, estadoToKey, getQueueStage } from '../../utils/constants';
import { toDirectImageUrl, toThumbnailImageUrl } from '../../utils/imageUrl';
import styles from './DetalleEtapaModal.module.css';

const TITULOS_ETAPA = Object.fromEntries(
  ETAPAS_TIMELINE.map((e) => [e.key, e.nombre])
);

/** Convierte productos (array u objeto del ERP) a texto legible, sin JSON crudo. */
function formatProductosParaModal(productos) {
  if (productos == null) return null;
  if (typeof productos === 'string') return productos;
  if (Array.isArray(productos)) {
    const lineas = productos.map((p) => {
      if (p == null) return '';
      if (typeof p === 'string') return p;
      if (typeof p === 'object') {
        const cant = p.cantidad ?? p.cant;
        const nombre = p.producto ?? p.nombre ?? p.productoId ?? '';
        if (cant != null && nombre) return `${cant} × ${nombre}`;
        if (nombre) return nombre;
        return Object.entries(p)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
      }
      return String(p);
    });
    return lineas.filter(Boolean).join(' · ') || null;
  }
  if (typeof productos === 'object') {
    const cant = productos.cantidad ?? productos.cant;
    const nombre = productos.producto ?? productos.nombre ?? productos.productoId;
    if (cant != null && nombre) return `${cant} × ${nombre}`;
    if (nombre) return String(nombre);
    return Object.entries(productos)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }
  return null;
}

function Fila({ label, value }) {
  const display = value != null && value !== '' ? String(value) : 'Pendiente';
  return (
    <div className={styles.fila}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.valor}>{display}</dd>
    </div>
  );
}

function Seccion({ titulo, children }) {
  if (!children) return null;
  return (
    <section className={styles.seccion}>
      <h4 className={styles.seccionTitulo}>{titulo}</h4>
      {children}
    </section>
  );
}

function DesignImageWithFallback({ url, index }) {
  const handleError = (e) => {
    const target = e.target;
    if (target.dataset.fallbackTried) return;
    target.dataset.fallbackTried = '1';
    const fallback = toThumbnailImageUrl(url);
    if (fallback && fallback !== target.src) target.src = fallback;
  };
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.imgLink}>
      <img
        src={toDirectImageUrl(url)}
        alt={`Diseño ${index + 1}`}
        className={styles.miniImg}
        loading="lazy"
        onError={handleError}
      />
    </a>
  );
}

export default function DetalleEtapaModal({ etapaKey, pedido }) {
  const detalles = pedido?.detallesEtapas ?? {};
  const d = detalles[etapaKey] ?? {};

  const currentKey = getQueueStage(pedido?.estadoGeneral);
  const showQueue = currentKey === etapaKey && pedido?.numeroColaDisplay != null && pedido?.numeroColaDisplay !== '';
  
  const queueBadge = showQueue ? (
    <div className={styles.colaContainer}>
      <span className={styles.colaBadge}>
        🎟️ COLA: {pedido.numeroColaDisplay}
      </span>
    </div>
  ) : null;

  if (etapaKey === 'compra') {
    const compra = d;
    const productosRaw = compra.productos;
    const prendas = compra.prendas ?? pedido?.tallas;
    const productosTexto = formatProductosParaModal(productosRaw);
    return (
      <div className={styles.wrapper}>
        <Seccion titulo="Fecha y hora">
          <Fila label="Fecha de compra" value={compra.fecha ?? pedido?.fechaCompra} />
        </Seccion>
        <Seccion titulo="Productos y tallas">
          <Fila label="Prendas / descripción" value={prendas} />
          <Fila label="Productos" value={productosTexto} />
          <Fila label="Cantidad" value={compra.cantidad} />
        </Seccion>
        <Seccion titulo="Venta">
          <Fila label="Vendedor" value={compra.vendedor} />
          <Fila label="Canal de venta" value={compra.canalVenta} />
          <Fila label="Monto total" value={compra.montoTotal != null ? `S/ ${compra.montoTotal}` : pedido?.montoTotal != null ? `S/ ${pedido.montoTotal}` : null} />
          <Fila label="Adelanto" value={compra.montoAdelanto != null ? `S/ ${compra.montoAdelanto}` : pedido?.montoAdelantado != null ? `S/ ${pedido.montoAdelantado}` : null} />
          <Fila label="Observación" value={compra.observación} />
        </Seccion>
      </div>
    );
  }

  if (etapaKey === 'diseno') {
    const rawUrls = d.urlImagen != null ? (Array.isArray(d.urlImagen) ? d.urlImagen : [d.urlImagen]) : (pedido?.imageURLs ?? []);
    const urls = rawUrls
      .flatMap((u) => (u != null ? String(u).trim().split(/\s+/).map((p) => p.trim()).filter(Boolean) : []))
      .filter((u) => u.length > 0);
    return (
      <div className={styles.wrapper}>
        {queueBadge}
        <Seccion titulo="Fechas">
          <Fila label="Entrada a diseño" value={d.fechaEntrada} />
          <Fila label="Salida de diseño" value={d.fechaSalida} />
        </Seccion>
        <Fila label="Diseñador asignado" value={d.diseñadorAsignado} />
        {urls.length > 0 && (
          <Seccion titulo="Imágenes">
            <div className={styles.galeria}>
              {urls.map((url, i) => (
                <DesignImageWithFallback key={i} url={url} index={i} />
              ))}
            </div>
          </Seccion>
        )}
      </div>
    );
  }

  if (etapaKey === 'impresion') {
    return (
      <div className={styles.wrapper}>
        <Seccion titulo="Fechas">
          <Fila label="Entrada" value={d.fechaEntrada} />
          <Fila label="Salida" value={d.fechaSalida} />
        </Seccion>
        <Fila label="Estado" value={d.estado} />
        <Fila label="Primer pago" value={d.pago1} />
        <Fila label="Segundo pago" value={d.pago2} />
        <Fila label="Monto pendiente" value={d.montoPendiente != null ? `S/ ${d.montoPendiente}` : null} />
      </div>
    );
  }

  if (['preparacion', 'estampado', 'empaquetado'].includes(etapaKey)) {
    return (
      <div className={styles.wrapper}>
        {queueBadge}
        <Fila label="Operador" value={d.operador} />
        <Seccion titulo="Fechas">
          <Fila label="Entrada" value={d.fechaEntrada} />
          <Fila label="Salida" value={d.fechaSalida} />
        </Seccion>
      </div>
    );
  }

  if (etapaKey === 'reparto') {
    return (
      <div className={styles.wrapper}>
        <Fila label="Repartidor" value={d.repartidor} />
        <Seccion titulo="Fechas">
          <Fila label="Entrada" value={d.fechaEntrada} />
          <Fila label="Salida" value={d.fechaSalida} />
          <Fila label="Finalizado" value={d.fechaFinalizado} />
        </Seccion>
      </div>
    );
  }

  if (etapaKey === 'finalizado') {
    return (
      <div className={styles.wrapper}>
        <Seccion titulo="Cierre">
          <Fila label="Fecha" value={d.fecha} />
        </Seccion>
        <p className={styles.mensaje}>Pedido finalizado.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.mensaje}>No hay detalles para esta etapa.</p>
    </div>
  );
}

export { TITULOS_ETAPA };
