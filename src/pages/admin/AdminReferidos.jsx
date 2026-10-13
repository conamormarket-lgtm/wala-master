import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase/config';
import { estimateReferralReward } from '../../services/referrals';
import styles from './AdminReferidos.module.css';

// Antes este panel tenía "Aprobar" / "Rechazar", que escribían el estado del
// referido desde el navegador. Ya no deciden nada: claimReferralSecure paga
// solo si el pedido salió de ese enlace y el ERP lo marca Finalizado, y no paga
// si está Anulado. Queda como seguimiento.
const ETIQUETAS = {
  sent: 'Enlace creado (nadie lo abrió)',
  clicked: 'Abrió el enlace',
  purchased: 'Compró (esperando entrega)',
  completed: 'Aprobado (sistema anterior)',
  claimed: 'Monedas reclamadas',
  ineligible: 'No califica',
};

const AdminReferidos = () => {
  const { data: referidos, isLoading } = useQuery({
    queryKey: ['adminReferrals'],
    queryFn: async () => {
      const q = query(collection(db, 'referrals'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  });

  if (isLoading) return <div style={{ padding: '2rem' }}>Cargando panel de referidos...</div>;

  return (
    <div className="admin-container">
      <h2>Referidos</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted, #666)' }}>
        Enlaces de referido y las compras que salieron de ellos. No hace falta aprobar nada: quien
        refirió puede reclamar sus monedas cuando el pedido queda <strong>Finalizado</strong> en el
        ERP (5&nbsp;% del total, 10&nbsp;% si supera S/&nbsp;200). Un pedido Anulado no paga.
      </p>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Código Referente</th>
              <th>Pedido web</th>
              <th>Monto Venta</th>
              <th>Monedas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {referidos?.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center' }}>No hay referidos registrados aún.</td></tr>
            )}
            {referidos?.map(ref => {
              const d = ref.createdAt?.toDate()?.toLocaleDateString() || 'N/A';
              // Reclamado: lo que pagó el servidor. Si no, el estimado con la
              // misma fórmula que claimReferralSecure.
              const monedas = ref.status === 'claimed'
                ? (ref.earnedCoins || 0)
                : estimateReferralReward(ref.orderTotal);

              return (
                <tr key={ref.id}>
                  <td>{d}</td>
                  <td><strong>{ref.referrerCode}</strong></td>
                  <td>{ref.orderId || '-'}</td>
                  <td>{ref.orderTotal ? `S/ ${Number(ref.orderTotal).toFixed(2)}` : '-'}</td>
                  <td style={{ color: '#d35400', fontWeight: 'bold' }}>
                    {ref.orderId ? `${monedas}${ref.status === 'claimed' ? '' : ' (estimado)'}` : '-'}
                  </td>
                  <td>{ETIQUETAS[ref.status] || ref.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminReferidos;
