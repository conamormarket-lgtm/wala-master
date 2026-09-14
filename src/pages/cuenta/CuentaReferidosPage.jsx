import React, { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line no-unused-vars
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getReferralsByReferrer, createReferralShare, claimReferralCoins, updateReferralCode, estimateReferralReward } from '../../services/referrals';
import ReferralRanking from '../../components/analytics/ReferralRanking';
import styles from './CuentaReferidosPage.module.css';
import { T } from '../../i18n/useTranslatedText';

const STAGES = {
  sent: 1,
  clicked: 2,
  purchased: 3,
  completed: 4,
  claimed: 4,
  ineligible: 3,
};

const CuentaReferidosPage = () => {
  const { user, userProfile, updateUserProfile } = useAuth();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  
  // States para edición de código
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [newCodeInput, setNewCodeInput] = useState('');
  const [savingCode, setSavingCode] = useState(false);

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

  // Notificaciones al cargar la página (música figurativa)
  useEffect(() => {
    if (referrals && referrals.length > 0) {
      // Mostrar notificaciones de las actividades más recientes (últimos 3 días)
      const now = new Date();
      const recent = referrals.filter(r => {
        const d = r.updatedAt?.toDate() || r.createdAt?.toDate();
        if (!d) return false;
        return (now - d) / (1000 * 60 * 60 * 24) <= 3;
      });
      
      const unnotifiedKey = 'notified_referrals_' + referralCode;
      const notifiedStr = localStorage.getItem(unnotifiedKey) || '[]';
      const notified = JSON.parse(notifiedStr);
      let newNotified = [...notified];

      recent.forEach(r => {
        if (!notified.includes(r.id + '_' + r.status)) {
          if (r.status === 'clicked') {
            toast.info('👀 Alguien acaba de ver un producto desde tu enlace.');
          } else if (r.status === 'purchased' || r.status === 'completed') {
            toast.success('🎉 ¡Vendiste! Alguien compró por tu enlace.');
          }
          newNotified.push(r.id + '_' + r.status);
        }
      });
      
      if (newNotified.length > notified.length) {
        localStorage.setItem(unnotifiedKey, JSON.stringify(newNotified));
      }
    }
  }, [referrals, referralCode, toast]);

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
    if (!['completed', 'purchased'].includes(referralDoc.status)) return;

    // claimReferralCoins solo necesita el id: el monto real (5%/10% del
    // pedido) lo calcula y valida claimReferralSecure server-side contra el
    // ERP, no lo que haya en earnedCoins/monedas del cliente.
    const { earned, error } = await claimReferralCoins(referralDoc.id);

    if (error) {
      // Para 'purchased' (sin aprobación de Admin) es normal que el ERP
      // todavía no marque el pedido como finalizado — mostrar el motivo
      // real del servidor en vez de un genérico ayuda a entender por qué.
      toast.error(error || 'Error al reclamar monedas');
    } else {
      toast.success(`¡Has reclamado ${earned ?? ''} monedas con éxito!`);
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

  const handleSaveNewCode = async () => {
    if (!newCodeInput || newCodeInput.trim().length < 4) {
      toast.error('El código debe tener al menos 4 caracteres');
      return;
    }
    setSavingCode(true);
    const { error } = await updateReferralCode(user.uid, newCodeInput);
    if (error) {
      toast.error(error);
      setSavingCode(false);
    } else {
      toast.success('Código actualizado exitosamente');
      await updateUserProfile({ referralCode: newCodeInput.trim().toUpperCase(), referralCodeEdited: true });
      setIsEditingCode(false);
      setSavingCode(false);
    }
  };

  if (isLoading) {
    return <div className={styles.loading}><T>Cargando panel de referidos...</T></div>;
  }

  // Cálculos de estadísticas
  const totalVisitas = referrals?.filter(r => STAGES[r.status] >= 2).length || 0;
  const totalCompras = referrals?.filter(r => STAGES[r.status] >= 3 && r.status !== 'ineligible').length || 0;
  const totalMonedas = referrals?.reduce((acc, r) => acc + (r.earnedCoins || 0), 0) || 0;

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
        
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{totalVisitas}</span>
            <span className={styles.statLabel}>Visitas</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{totalCompras}</span>
            <span className={styles.statLabel}>Compras</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{totalMonedas}</span>
            <span className={styles.statLabel}>Monedas Ganadas</span>
          </div>
        </div>

        <div className={styles.codeRow}>
          <div className={styles.codeBox}>
            {isEditingCode ? (
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <input 
                  type="text" 
                  value={newCodeInput} 
                  onChange={e => setNewCodeInput(e.target.value)} 
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', textTransform: 'uppercase', flex: 1, minWidth: '120px' }}
                  maxLength={15}
                  placeholder="NUEVO_CODIGO"
                />
                <button onClick={handleSaveNewCode} disabled={savingCode} style={{ background: '#28a745', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}>✓</button>
                <button onClick={() => setIsEditingCode(false)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <>
                {referralCode}
                {!userProfile?.referralCodeEdited && (
                  <button onClick={() => { setIsEditingCode(true); setNewCodeInput(referralCode); }} title="Editar código (solo se puede 1 vez)" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✏️</button>
                )}
                <button className={styles.copyBtn} onClick={copyCodeOnly} title="Copiar código">Copiar</button>
              </>
            )}
          </div>
          <button className={styles.generateBtn} onClick={generateLink} disabled={generating}>
            {generating ? 'Generando...' : 'Generar Link de Referido'}
          </button>
        </div>
        
        <div className={styles.infoText}>
          Genera un enlace y compártelo. Cuando alguien compre con tu link, ganás
          {' '}<strong>5% del monto de esa compra en monedas</strong> (10% si la compra supera los S/200).
        </div>
      </div>

      <h3 className={styles.listTitle}><T>Historial de Referidos</T></h3>
      
      {!referrals || referrals.length === 0 ? (
        <div className={styles.empty}>
          Aún no tienes referidos. ¡Comienza a compartir tu enlace!
        </div>
      ) : (
        <div className={styles.list}>
          {referrals.map((ref) => {
            const currentStage = STAGES[ref.status] || 1;
            // 'purchased' también puede reclamarse, no solo 'completed': ese
            // paso de Admin (AdminReferidos) es para ventas por WhatsApp, que
            // no pasan por linkPurchaseToReferral. Para las que SÍ se
            // registran solas (compra con el link ?ref=&shareId= del
            // checkout web), claimReferralSecure ya valida por su cuenta
            // contra el ERP -si el pedido aún no está finalizado, rechaza con
            // un mensaje claro (ver handleClaim)-, así que no hace falta
            // esperar una aprobación manual aparte.
            const canClaim = ref.status === 'completed' || ref.status === 'purchased';
            const isClaimed = ref.status === 'claimed';
            const isIneligible = ref.status === 'ineligible';
            // Antes de reclamar no hay earnedCoins confirmado (lo fija el
            // servidor recién al reclamar) — se muestra un estimado con la
            // misma fórmula que usa el backend.
            const gananciaMostrada = isClaimed || ref.status === 'completed'
              ? (ref.earnedCoins || 0)
              : estimateReferralReward(ref.orderTotal);

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
                    <p className={styles.errorText}>Esta compra no calificó para el premio de referido.</p>
                  </div>
                )}

                {(canClaim || isClaimed) && (
                  <div className={styles.actionBox}>
                    <div className={styles.earnedStats}>
                      Venta Total: <strong>S/ {ref.orderTotal?.toFixed(2) || '0.00'}</strong> <br/>
                      {isClaimed || ref.status === 'completed' ? 'Ganancia' : 'Ganancia estimada'}:{' '}
                      <strong className={styles.highlightCoins}>{gananciaMostrada} Monedas</strong>
                    </div>
                    {canClaim && (
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

      {/* Nuevo componente de Ranking Mensual */}
      <ReferralRanking />
    </div>
  );
};

export default CuentaReferidosPage;
