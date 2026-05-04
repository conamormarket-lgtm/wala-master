import React from 'react';
import styles from './HistorialPagos.module.css';

const HistorialPagos = ({ pedido }) => {
  // 1. Array de pagos iterado de atrás hacia adelante (Mapeo Inverso)
  const historial = Array.isArray(pedido.historialPagos) ? [...pedido.historialPagos].reverse() : [];

  // 2. Cálculos de Integridad
  // Se lee el monto total desde pedido.montoTotal (Total Comprado)
  const totalComprado = Number(pedido.montoTotal || 0);
  // Se suman todos los montos en el historial
  const totalAbonado = historial.reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
  // Diferencia
  const faltaPagar = totalComprado - totalAbonado;

  // 3. Caso Vacío
  if (historial.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <span className={styles.emptyIcon}>💳</span>
        <p>Aún no tienes registros de pagos para este pedido.</p>
      </div>
    );
  }

  // 4. Render normal (sin mostrar usuarioEmail bajo ninguna circunstancia)
  return (
    <div className={styles.container}>
      <div className={styles.resumenWrap}>
        <div className={styles.resumenItem}>
          <span className={styles.resumenLabel}>Total Comprado</span>
          <strong className={styles.resumenValor}>S/ {totalComprado.toFixed(2)}</strong>
        </div>
        <div className={styles.resumenItem}>
          <span className={styles.resumenLabel}>Total Abonado</span>
          <strong className={`${styles.resumenValor} ${styles.textGreen}`}>S/ {totalAbonado.toFixed(2)}</strong>
        </div>
        <div className={`${styles.resumenItem} ${styles.resumenHighlight}`}>
          <span className={styles.resumenLabel}>Falta Pagar</span>
          <strong className={`${styles.resumenValor} ${faltaPagar > 0 ? styles.textRed : styles.textGreen}`}>
            S/ {Math.max(0, faltaPagar).toFixed(2)}
          </strong>
        </div>
      </div>

      <h5 className={styles.listaTitulo}>Desglose de Movimientos</h5>
      <div className={styles.listaPagos}>
        {historial.map((pago, index) => (
          <div key={index} className={styles.pagoFila}>
            <div className={styles.pagoMonto}>
              <span className={styles.pagoIndicador}>+</span>
              S/ {Number(pago.monto || 0).toFixed(2)}
            </div>
            <div className={styles.pagoFechaHora}>
              {pago.fecha || 'Sin fecha'} {pago.hora ? `• ${pago.hora}` : ''}
            </div>
            {/* NO SE MUESTRA usuarioEmail AQUÍ INTENCIONALMENTE */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistorialPagos;
