import React, { useState } from 'react';
import { LOGO_URL } from '../../utils/constants';
import PartnerBrands from '../PartnerBrands/PartnerBrands';
import styles from './Login.module.css';

const Login = ({ onSearch, loading, error }) => {
  const [telefono, setTelefono] = useState('');
  const [dni, setDni] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (telefono && dni) {
      onSearch(telefono, dni);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.branding}>
        <img src={LOGO_URL} alt="Logo de la Empresa" />
        <h2>El seguimiento de tus pedidos, más fácil que nunca.</h2>
        <p>Walá</p>
        <PartnerBrands />
      </div>
      <div className={styles.formContainer}>
        <img src={LOGO_URL} alt="Logo de la Empresa" className={styles.logoMovil} />
        <h1>Consulta de Pedido</h1>
        <p>Ingresa tus datos para ver el estado de tus pedidos.</p>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="telefono">Número de Teléfono</label>
            <input
              type="tel"
              id="telefono"
              name="telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="dni">Número de DNI</label>
            <input
              type="text"
              id="dni"
              name="dni"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <button 
            type="submit" 
            className={styles.button}
            disabled={loading}
          >
            {loading ? 'Buscando...' : 'Consultar Pedidos'}
          </button>
          <div className={styles.mensaje}>
            {loading && <span className={styles.mensajeExito}>Buscando...</span>}
            {error && <span className={styles.mensajeError}>{error}</span>}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
