import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getReferralsByReferrer, createReferralShare, claimReferralCoins } from '../../services/referrals';
import styles from './CuentaReferidosPage.module.css';

const STAGES = {
  sent: 1,
  clicked: 2,
  purchased: 3,
  completed: 4,
  claimed: 4,
  ineligible: 3,
};

const CuentaReferidosPage = () => {
  const { user, userProfile } = useAuth();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const referralCode = userProfile?.referralCode || '';

  const { data: referrals, isLoading } = useQuery({
    queryKey: ['myReferrals', referralCode],
    queryFn: async () => {
      const res = await getReferralsByReferrer(referralCode);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    enabled: !!referralCode,
  });

  const generateLink = async () => {
    if (!referralCode) return;
    setGenerating(true);
    const { id, error } = await createReferralShare(referralCode);
    if (error) {
      toast.error('Error al generar enlace');
      setGenerating(false);
      return;
    }
    
    // Invalidate queries so it shows in the list as "Etapa 1"
    queryClient.invalidateQueries(['myReferrals', referralCode]);

    const url = `${window.location.origin}?ref=${referralCode}&shareId=${id}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success('¡Enlace general copiado al portapapeles!'))
      .catch(() => toast.error('Error copiando al portapapeles'));
    
    setGenerating(false);
  };

  const handleClaim = async (referralDoc) => {
    if (referralDoc.status !== 'completed' || !referralDoc.earnedCoins) return;
    
    const { error } = await claimReferralCoins(
      referralDoc.id, 
      referralDoc.earnedCoins, 
      user.uid, 
      userProfile?.monedas || 0
    );

    if (error) {
      toast.error('Error al reclamar monedas');
    } else {
      toast.success(`¡Has reclamado ${referralDoc.earnedCoins} monedas con éxito!`);
      queryClient.invalidateQueries(['myReferrals', referralCode]);
      // También se actualiza el userProfile globalmente a través del effect en AuthContext 
      // Si quieres forzar actualización inmediata de UI sin refrescar:
      // updateUserProfile({ monedas: currentMonedas + ... }) pero ya Firebase snapshot hará el update.
    }
  };

  const copyCodeOnly = () => {
    navigator.clipboard.writeText(referralCode)
      .then(() => toast.success('Código copiado'))
      .catch(() => toast.error('Error al copiar'));
  };

  if (isLoading) {
    return <div className={styles.loading}>Cargando panel de referidos...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerCard}>
        <div className={styles.recompensaTitle}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
          RECOMPENSAS
        </div>
        <div className={styles.balance}>
          <div className={styles.coinIcon}>🪙</div>
          <span className={styles.balanceNumber}>{userProfile?.monedas || 0}</span>
          <span className={styles.balanceCurrency}>Monedas</span>
        </div>
        
        <div className={styles.codeRow}>
          <div className={styles.codeBox}>
            {referralCode}
            <button className={styles.copyBtn} onClick={copyCodeOnly} title="Copiar código">Copiar</button>
          </div>
          <button className={styles.generateBtn} onClick={generateLink} disabled={generating}>
            {generating ? 'Generando...' : 'Generar Link de Referido'}
          </button>
        </div>
        
        <div className={styles.infoText}>
          Genera un enlace y compártelo. Ganarás <strong>5 monedas</strong> por cada S/100 que gaste la persona (en compras finalizadas exitosamente).
        </div>
      </div>

      <h3 className={styles.listTitle}>Historial de Referidos</h3>
      
      {!referrals || referrals.length === 0 ? (
        <div className={styles.empty}>
          Aún no tienes referidos. ¡Comienza a compartir tu enlace!
        </div>
      ) : (
        <div className={styles.list}>
          {referrals.map((ref) => {
            const currentStage = STAGES[ref.status] || 1;
            const isCompleted = ref.status === 'completed';
            const isClaimed = ref.status === 'claimed';
            const isIneligible = ref.status === 'ineligible';

            const d = ref.clickedAt?.toDate() || ref.createdAt?.toDate();
            const dateStr = d ? d.toLocaleDateString() : 'N/A';

            return (
              <div key={ref.id} className={`${styles.referralCard} ${isClaimed ? styles.cardClaimed : ''}`}>
                <div className={styles.cardHeader}>
                  <span className={styles.dateText}>{dateStr}</span>
                  {ref.orderId && <span className={styles.orderLabel}>Pedido #{ref.orderId}</span>}
                </div>

                <div className={styles.stepperContainer}>
                  {/* Etapa 1 */}
                  <div className={`${styles.step} ${currentStage >= 1 ? styles.activeStep : ''}`}>
                    <div className={styles.stepCircle}>1</div>
                    <div className={styles.stepLabel}>Enviado</div>
                  </div>
                  <div className={`${styles.stepLine} ${currentStage >= 2 ? styles.activeLine : ''}`} />
                  
                  {/* Etapa 2 */}
                  <div className={`${styles.step} ${currentStage >= 2 ? styles.activeStep : ''}`}>
                    <div className={styles.stepCircle}>2</div>
                    <div className={styles.stepLabel}>Clic</div>
                  </div>
                  <div className={`${styles.stepLine} ${currentStage >= 3 ? styles.activeLine : ''}`} />
                  
                  {/* Etapa 3 */}
                  <div className={`${styles.step} ${currentStage >= 3 ? styles.activeStep : ''}`}>
                    <div className={styles.stepCircle}>3</div>
                    <div className={styles.stepLabel}>Compra</div>
                  </div>
                  <div className={`${styles.stepLine} ${currentStage >= 4 && !isIneligible ? styles.activeLine : ''}`} />
                  
                  {/* Etapa 4 */}
                  <div className={`${styles.step} ${currentStage >= 4 ? styles.activeStep : ''}`}>
                    <div className={styles.stepCircle}>4</div>
                    <div className={styles.stepLabel}>Reclamar</div>
                  </div>
                </div>

                {isIneligible && (
                  <div className={styles.statusBox}>
                    <p className={styles.errorText}>Esta compra no califica (Monto S/{ref.orderTotal}). Se requieren tramos completos de S/100.</p>
                  </div>
                )}

                {(isCompleted || isClaimed) && (
                  <div className={styles.actionBox}>
                    <div className={styles.earnedStats}>
                      Venta Total: <strong>S/ {ref.orderTotal?.toFixed(2) || '0.00'}</strong> <br/>
                      Ganancia: <strong className={styles.highlightCoins}>{ref.earnedCoins} Monedas</strong>
                    </div>
                    {isCompleted && (
                      <button className={styles.claimActionBtn} onClick={() => handleClaim(ref)}>
                        🪙 Reclamar Monedas
                      </button>
                    )}
                    {isClaimed && (
                      <span className={styles.claimedBadge}>✔️ Reclamado</span>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CuentaReferidosPage;
