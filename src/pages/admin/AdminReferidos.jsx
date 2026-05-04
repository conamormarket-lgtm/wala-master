import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, getDocs, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase/config';
import { useGlobalToast } from '../../contexts/ToastContext';
import styles from './AdminReferidos.module.css';

const AdminReferidos = () => {
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const [procesandoId, setProcesandoId] = useState(null);

  const { data: referidos, isLoading } = useQuery({
    queryKey: ['adminReferrals'],
    queryFn: async () => {
      const q = query(collection(db, 'referrals'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  });

  const aprobarRestriccion = async (referidoId, totalGanancia) => {
    if (!window.confirm(`¿Confirmas que este pedido ya se entregó y el referido puede reclamar S/ ${totalGanancia} monedas?`)) return;
    
    setProcesandoId(referidoId);
    try {
      const docRef = doc(db, 'referrals', referidoId);
      await updateDoc(docRef, {
        status: 'completed',
        earnedCoins: totalGanancia,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('Referido aprobado exitosamente');
      queryClient.invalidateQueries(['adminReferrals']);
    } catch (error) {
      toast.error('Error al aprobar');
    } finally {
      setProcesandoId(null);
    }
  };

  const rechazarRestriccion = async (referidoId) => {
    if (!window.confirm('¿Confirmas que esta venta fue cancelada o no califica?')) return;
    
    setProcesandoId(referidoId);
    try {
      const docRef = doc(db, 'referrals', referidoId);
      await updateDoc(docRef, {
        status: 'ineligible',
        earnedCoins: 0,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('Referido marcado como no elegible');
      queryClient.invalidateQueries(['adminReferrals']);
    } catch (error) {
      toast.error('Error al rechazar');
    } finally {
      setProcesandoId(null);
    }
  };

  if (isLoading) return <div style={{ padding: '2rem' }}>Cargando panel de referidos...</div>;

  return (
    <div className="admin-container">
      <h2>Gestión de Referidos (Ventas por WhatsApp)</h2>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        Como las ventas finalizan por WhatsApp y tu ERP externo, el sistema no sabe automáticamente cuándo se completa el envío. 
        Aquí verás las ventas iniciadas con código de referido. Cuando confirmes que el pedido se entregó, haz clic en "Aprobar" para que el usuario pueda reclamar sus monedas.
      </p>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Código Referente</th>
              <th>Cód. Pedido WA</th>
              <th>Monto Venta</th>
              <th>Monedas a Ganar</th>
              <th>Estado Actual</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {referidos?.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center' }}>No hay referidos registrados aún.</td></tr>
            )}
            {referidos?.map(ref => {
              const d = ref.createdAt?.toDate()?.toLocaleDateString() || 'N/A';
              const monedasCalculadas = Math.floor((ref.orderTotal || 0) / 100) * 5;
              
              let statusLabel = 'Etapa 2 (Solo Clic)';
              if (ref.status === 'purchased') statusLabel = 'Etapa 3 (Compró por WA)';
              if (ref.status === 'completed') statusLabel = 'Etapa 4 (Aprobado/Esperando Reclamo)';
              if (ref.status === 'claimed') statusLabel = 'Finalizado (Monedas Reclamadas)';
              if (ref.status === 'ineligible') statusLabel = 'No califica / Cancelado';

              const isPending = ref.status === 'purchased';

              return (
                <tr key={ref.id}>
                  <td>{d}</td>
                  <td><strong>{ref.referrerCode}</strong></td>
                  <td>{ref.orderId || '-'}</td>
                  <td>{ref.orderTotal ? `S/ ${ref.orderTotal}` : '-'}</td>
                  <td style={{ color: '#d35400', fontWeight: 'bold' }}>{monedasCalculadas > 0 ? monedasCalculadas : 0}</td>
                  <td>{statusLabel}</td>
                  <td>
                    {isPending && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className={styles.btnApprove}
                          onClick={() => aprobarRestriccion(ref.id, monedasCalculadas)}
                          disabled={procesandoId === ref.id}
                        >
                          Aprobar
                        </button>
                        <button 
                          className={styles.btnReject}
                          onClick={() => rechazarRestriccion(ref.id)}
                          disabled={procesandoId === ref.id}
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </td>
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
