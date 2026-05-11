import React from 'react';
import { Truck, ShieldCheck, Clock, CreditCard, RotateCcw, Heart, Star, CheckCircle } from 'lucide-react';
import styles from './TrustBadges.module.css';

const ICON_MAP = {
  truck: Truck,
  shield: ShieldCheck,
  clock: Clock,
  credit_card: CreditCard,
  return: RotateCcw,
  heart: Heart,
  star: Star,
  check: CheckCircle
};

const TrustBadges = ({ badges = [] }) => {
  if (!badges || badges.length === 0) return null;

  return (
    <div className={styles.container}>
      {badges.map((badge, index) => {
        const IconComponent = ICON_MAP[badge.icon] || CheckCircle;
        return (
          <div key={index} className={styles.badge}>
            <div className={styles.icon}>
              <IconComponent size={24} strokeWidth={1.5} />
            </div>
            <span className={styles.text}>{badge.text}</span>
          </div>
        );
      })}
    </div>
  );
};

export default TrustBadges;
