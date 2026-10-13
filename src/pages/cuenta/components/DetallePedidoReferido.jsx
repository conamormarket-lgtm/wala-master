import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, AlertCircle } from 'lucide-react';
import { getReferralOrderDetail } from '../../../services/referrals';
import styles from '../CuentaReferidosPage.module.css';

// Etapa del pedido como la ve quien refirió (la calcula detalleReferidoSecure a
// partir del estadoGeneral del ERP; ver functions/referidosLogic.js).
const ETAPAS = {
  por_confirmar: { label: 'Por confirmar', chip: 'chipOff', nota: 'Walá todavía está confirmando este pedido.' },
  confirmado: { label: 'Confirmado', chip: 'chipEtapa', nota: 'El pedido ya está confirmado.' },
  produccion: { label: 'En producción', chip: 'chipEtapa', nota: 'Lo estamos preparando.' },
  enviado: { label: 'En camino', chip: 'chipEtapa', nota: 'Ya salió a reparto.' },
  entregado: { label: 'Entregado', chip: 'chipOk', nota: 'Ya se entregó: puedes reclamar tus monedas.' },
  anulado: { label: 'Anulado', chip: 'chipOff', nota: 'Este pedido se anuló, así que no genera monedas.' },
};

const fechaCorta = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Lo que compró la persona referida: productos, total y en qué etapa va. Sin
 * ningún dato suyo (nombre, teléfono, dirección) ni sus diseños.
 */
const DetallePedidoReferido = ({ referralId }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['referralOrder', referralId],
    queryFn: () => getReferralOrderDetail(referralId),
    staleTime: 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return <div className={styles.detalleCargando} aria-busy="true">Cargando el pedido…</div>;
  }

  if (error || !data) {
    return (
      <p className={styles.detalleError}>
        <AlertCircle size={15} aria-hidden="true" />
        {error?.message || 'No pudimos cargar este pedido.'}
      </p>
    );
  }

  const etapa = ETAPAS[data.etapa] || ETAPAS.confirmado;
  const fecha = fechaCorta(data.fecha);
  // "En Estampado", "En Reparto"…: el paso exacto del ERP, solo como detalle.
  const pasoErp = data.etapa === 'produccion' || data.etapa === 'confirmado' ? data.estadoErp : '';

  return (
    <div className={styles.detalle}>
      <div className={styles.detalleHead}>
        <span className={`${styles.estadoChip} ${styles[etapa.chip]}`}>{etapa.label}</span>
        {pasoErp && <span className={styles.detallePaso}>{pasoErp}</span>}
      </div>
      <p className={styles.detalleNota}>
        {etapa.nota}
        {fecha && <> Comprado el {fecha}.</>}
      </p>

      <ul className={styles.detalleProductos}>
        {data.productos.map((p, i) => {
          const extra = [p.talla && `Talla ${p.talla}`, p.color, p.personalizado && 'Personalizado']
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={`${p.productoId}-${i}`} className={styles.detalleProducto}>
              {p.imagen ? (
                <img src={p.imagen} alt="" className={styles.detalleFoto} loading="lazy" />
              ) : (
                <span className={styles.detalleFoto} aria-hidden="true">
                  <Package size={18} />
                </span>
              )}
              <div className={styles.detalleTexto}>
                <span className={styles.detalleNombre}>{p.nombre}</span>
                {extra && <span className={styles.detalleExtra}>{extra}</span>}
              </div>
              <span className={styles.detalleCantidad}>×{p.cantidad}</span>
            </li>
          );
        })}
      </ul>

      <p className={styles.detalleTotal}>
        Total del pedido: <strong>S/ {Number(data.montoTotal || 0).toFixed(2)}</strong>
      </p>
    </div>
  );
};

export default DetallePedidoReferido;
