import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './CatalogReward.module.css';

const REWARDS = [
  { id: 'stickers', title: 'Pack de stickers exclusivos', cost: 30, desc: 'Decora con estilo', value: 'S/ 2-3' },
  { id: 'premium', title: 'Personalización premium gratis', cost: 60, desc: 'Destaca tu producto', value: 'S/ 5-8' },
  { id: 'accessory', title: 'Accesorio gratis', cost: 100, desc: 'Taza, gorro o pin', value: 'S/ 10-15' },
  { id: 'box_discount', title: 'S/ 30 de descuento en box', cost: 200, desc: 'Ahorro gigante', value: 'S/ 30' }
];

const CatalogReward = () => {
  const { userProfile, activeMainCoins, spendMonedas } = useAuth();
  const [claimingId, setClaimingId] = useState(null);
  const [message, setMessage] = useState('');

  if (!userProfile) return null;

  const handleClaim = async (reward) => {
    if (activeMainCoins < reward.cost) return;
    setClaimingId(reward.id);
    setMessage('');
    
    // Gastar monedas (FIFO logic en AuthContext)
    const res = await spendMonedas(reward.cost);
    setClaimingId(null);
    
    if (res.error) {
      setMessage(`Error: ${res.error}`);
    } else {
      setMessage(`¡Has canjeado con éxito: ${reward.title}! (El beneficio ha sido agregado a tu cuenta)`);
      // Nota: Aquí en el futuro se guardaría en Firestore un "perk" o "cupón"
      // para que esté disponible en el checkout.
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Catálogo de Recompensas</h2>
      <p className={styles.subtitle}>Canjea tus monedas principales por beneficios exclusivos.</p>
      
      {message && <div className={styles.messageBox}>{message}</div>}

      <div className={styles.grid}>
        {REWARDS.map(reward => {
          const canAfford = activeMainCoins >= reward.cost;
          return (
            <div key={reward.id} className={`${styles.card} ${canAfford ? '' : styles.disabled}`}>
              <div className={styles.cardHeader}>
                <h3 className={styles.rewardTitle}>{reward.title}</h3>
                <span className={styles.rewardValue}>Valor ref: {reward.value}</span>
              </div>
              <p className={styles.rewardDesc}>{reward.desc}</p>
              
              <div className={styles.cardFooter}>
                <div className={styles.costBadge}>🪙 {reward.cost}</div>
                <button 
                  className={styles.claimBtn}
                  disabled={!canAfford || claimingId === reward.id}
                  onClick={() => handleClaim(reward)}
                >
                  {claimingId === reward.id ? 'Canjeando...' : (canAfford ? 'Canjear' : 'Faltan monedas')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CatalogReward;
