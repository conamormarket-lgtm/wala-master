import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Calendar, Truck, Heart, ArrowRight, ShieldCheck } from 'lucide-react';
import styles from './SubscriptionLandingPage.module.css';
import Button from '../components/common/Button';
import { T } from '../i18n/useTranslatedText';

const SubscriptionLandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.badge}>Nuevo Modelo Wala</span>
          <h1 className={styles.heroTitle}><T>Regalos Perfectos, Todo el Año</T></h1>
          <p className={styles.heroSubtitle}>
            Olvídate del estrés de buscar regalos a última hora. Programa las fechas importantes de tus seres queridos y recibe cajas personalizadas justo a tiempo, pagando en cómodas cuotas mensuales.
          </p>
          <div className={styles.ctaGroup}>
            <Button variant="primary" size="large" onClick={() => navigate('/encuesta-suscripcion')}>
              Configurar Mis Fechas <ArrowRight size={20} className={styles.iconRight} />
            </Button>
          </div>
          <p className={styles.disclaimer}>
            <ShieldCheck size={16} /> Configura tus fechas hoy. El método de pago mensual estará disponible muy pronto.
          </p>
        </div>
        <div className={styles.heroImageContainer}>
          <div className={styles.mockupBox}>
            <div className={styles.boxTop}></div>
            <Gift size={64} color="#8b5cf6" />
            <h3>Wala Box</h3>
            <p><T>Especial para Mamá</T></p>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className={styles.howItWorks}>
        <div className={styles.sectionHeader}>
          <h2><T>¿Cómo funciona la suscripción?</T></h2>
          <p><T>Un proceso simple diseñado para hacerte quedar bien siempre.</T></p>
        </div>
        
        <div className={styles.stepsGrid}>
          <div className={styles.stepCard}>
            <div className={styles.stepIcon}><Calendar size={32} /></div>
            <h3><T>1. Programa tus Fechas</T></h3>
            <p><T>Cuéntanos cuándo son los cumpleaños, aniversarios y días especiales de tus seres queridos.</T></p>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepIcon}><Heart size={32} /></div>
            <h3><T>2. Curaduría Especial</T></h3>
            <p><T>Nuestros expertos diseñan y preparan regalos personalizados basados en la ocasión y la persona.</T></p>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepIcon}><ShieldCheck size={32} /></div>
            <h3>3. Pago Mensual</h3>
            <p><T>El valor total de tus regalos anuales se divide en pequeñas y cómodas cuotas mensuales.</T></p>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepIcon}><Truck size={32} /></div>
            <h3>4. Entrega a Tiempo</h3>
            <p><T>Recibe cada Wala Box justo antes de la fecha especial, listo para entregar y sorprender.</T></p>
          </div>
        </div>
      </section>

      {/* Pricing / CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaCard}>
          <h2><T>Adelántate a las fechas especiales</T></h2>
          <p>
            Estamos finalizando los detalles de nuestra pasarela de pagos para ofrecerte las comisiones más bajas y las mejores opciones de cuotas. 
            <strong> <T>¡Pero no tienes que esperar!</T></strong>
          </p>
          <ul className={styles.benefitsList}>
            <li><span className={styles.check}>✓</span> <T>Planifica todo tu año hoy mismo</T></li>
            <li><span className={styles.check}>✓</span> <T>Acceso anticipado cuando habilitemos los pagos</T></li>
            <li><span className={styles.check}>✓</span> <T>Diseños exclusivos para los primeros suscriptores</T></li>
          </ul>
          <Button variant="primary" size="large" onClick={() => navigate('/encuesta-suscripcion')}>
            Separar Mis Fechas Ahora
          </Button>
        </div>
      </section>
    </div>
  );
};

export default SubscriptionLandingPage;
