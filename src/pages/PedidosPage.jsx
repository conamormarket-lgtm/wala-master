import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PedidosLoginPrompt from '../components/PedidosLoginPrompt';
import Results from '../components/Results';
import { usePedidos } from '../hooks/usePedidos';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/common/Button';
import styles from './PedidosPage.module.css';
import { T } from '../i18n/useTranslatedText';

const PedidosPage = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { loading, error, data, buscar } = usePedidos();
  const [hasFetched, setHasFetched] = useState(false);

  const isLoggedIn = !!user;
  const hasDni = !!(userProfile?.dni && String(userProfile.dni).trim());
  const dni = userProfile?.dni ? String(userProfile.dni).trim() : '';

  useEffect(() => {
    if (!isLoggedIn || !hasDni || hasFetched) return;
    setHasFetched(true);
    buscar(dni);
  }, [isLoggedIn, hasDni, dni, hasFetched, buscar]);

  if (!isLoggedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <PedidosLoginPrompt />
        </div>
      </div>
    );
  }

  if (authLoading || !userProfile) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.loadingInline}>
            <span className={styles.loadingDot} />
            <span>Verificando...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!hasDni) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.profileCard}>
            <h2><T>Completa tu perfil</T></h2>
            <p><T>Para ver tus pedidos necesitamos tu DNI o CE en tu perfil.</T></p>
            <Link to="/completar-perfil">
              <Button variant="primary">Completar perfil</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.loadingInline}>
            <span className={styles.loadingDot} />
            <span><T>Buscando tus pedidos...</T></span>
          </div>
        </div>
      </div>
    );
  }

  const pedidos = data?.pedidos ?? [];
  const showResults = pedidos.length > 0;
  const showEmpty = !loading && hasFetched && !error && pedidos.length === 0;

  if (showResults) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <Results
            pedidos={pedidos}
            onNewSearch={null}
            dataSource={data?.dataSource}
          />
        </div>
      </div>
    );
  }

  if (showEmpty) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.profileCard}>
            <h2><T>No hay pedidos</T></h2>
            <p><T>Aún no tienes pedidos asociados a tu cuenta. Cuando hagas un pedido, aparecerá aquí.</T></p>
            <Link to="/tienda">
              <Button variant="primary"><T>Ir a la tienda</T></Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.profileCard}>
            <h2><T>Error al cargar pedidos</T></h2>
            <p className={styles.errorText}>{error}</p>
            <Button variant="primary" onClick={() => { setHasFetched(false); }}>
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.loadingInline}>
          <span className={styles.loadingDot} />
          <span><T>Cargando...</T></span>
        </div>
      </div>
    </div>
  );
};

export default PedidosPage;
