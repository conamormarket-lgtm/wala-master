import React from 'react';
import { Link } from 'react-router-dom';
import { LOGO_URL } from '../../utils/constants';
import Button from '../common/Button';
import PartnerBrands from '../PartnerBrands/PartnerBrands';
import styles from './PedidosLoginPrompt.module.css';

/**
 * Muestra el logo, la frase y pide al usuario que inicie sesión para rastrear sus pedidos.
 * Sin formulario de teléfono/DNI.
 */
const PedidosLoginPrompt = () => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.branding}>
        <img src={LOGO_URL} alt="Walá" />
        <h2>El seguimiento de tus pedidos, más fácil que nunca.</h2>
        <p>Walá</p>
        <PartnerBrands />
      </div>
      <div className={styles.ctaContainer}>
        <img src={LOGO_URL} alt="Walá" className={styles.logoMovil} />
        <h1>Mis Pedidos</h1>
        <p>Inicia sesión con tu cuenta para ver y rastrear tus pedidos.</p>
        <Link to="/login">
          <Button variant="primary" fullWidth size="large">
            Iniciar sesión
          </Button>
        </Link>
        <p className={styles.registro}>
          ¿No tienes cuenta? <Link to="/registro" className={styles.link}>Regístrate aquí</Link>
        </p>
      </div>
    </div>
  );
};

export default PedidosLoginPrompt;
