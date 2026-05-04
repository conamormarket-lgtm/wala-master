import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Results from '../../components/Results';
import { usePedidos } from '../../hooks/usePedidos';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/common/Button';
import styles from '../PedidosPage.module.css';

/**
 * Contenido de "Mis Pedidos" dentro de Mi cuenta. Carga pedidos por DNI del perfil (clienteNumeroDocumento en ERP).
 */
const CuentaPedidosPage = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const hasDni = !!(userProfile?.dni && String(userProfile.dni).trim());
  const dni = userProfile?.dni ? String(userProfile.dni).trim() : '';
  const { loading, error, data, buscar } = usePedidos(dni);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!user || (!hasDni && !authLoading) || hasFetched) return;
    setHasFetched(true);
    // Disparar búsqueda sin await (lo maneja el hook, que a su vez usa su propia caché)
    buscar(dni);
  }, [user, hasDni, dni, hasFetched, buscar, authLoading]);

  // Si todavía estamos validando al usuario con Firebase, o si falta extraer el perfil local
  if (authLoading) {
    return (
      <div className={styles.content}>
        <div className={styles.skeletonList}>
          {[1, 2, 3].map(n => (
            <div key={n} className={styles.skeletonOrder} />
          ))}
        </div>
      </div>
    );
  }

  // Si terminó authLoading pero no hay perfil o DNI guardado.
  if (!userProfile || !hasDni) {
    return (
      <div className={styles.content}>
        <div className={styles.profileCard}>
          <h2>Completa tu perfil</h2>
          <p>Para ver tus pedidos necesitamos tu DNI o CE en tu perfil.</p>
          <Link to="/completar-perfil">
            <Button variant="primary">Completar perfil</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Para evitar "flash de spinner" si sabemos que vienen datos locales, priorizamos si 'data' ya tiene algun valor (por cache)
  if (loading && !data) {
    return (
      <div className={styles.content}>
        <div className={styles.skeletonList}>
          {[1, 2, 3].map(n => (
            <div key={n} className={styles.skeletonOrder} />
          ))}
        </div>
      </div>
    );
  }

  const pedidos = data?.pedidos ?? [];
  const showResults = pedidos.length > 0;
  const showEmpty = !loading && hasFetched && !error && pedidos.length === 0;

  if (showResults) {
    return (
      <div className={styles.content}>
        <Results
          pedidos={pedidos}
          onNewSearch={null}
          dataSource={data?.dataSource}
        />
      </div>
    );
  }

  if (showEmpty) {
    return (
      <div className={styles.content}>
        <div className={styles.profileCard}>
          <h2>No hay pedidos</h2>
          <p>Aún no tienes pedidos asociados a tu cuenta. Cuando hagas un pedido, aparecerá aquí.</p>
          <Link to="/tienda">
            <Button variant="primary">Ir a la tienda</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.content}>
        <div className={styles.profileCard}>
          <h2>Error al cargar pedidos</h2>
          <p className={styles.errorText}>{error}</p>
          <Button variant="primary" onClick={() => setHasFetched(false)}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <div className={styles.skeletonList}>
        {[1, 2].map(n => (
          <div key={n} className={styles.skeletonOrder} />
        ))}
      </div>
    </div>
  );
};

export default CuentaPedidosPage;
