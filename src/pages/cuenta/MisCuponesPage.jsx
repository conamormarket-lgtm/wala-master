// =========================================================================
// Mis cupones
// -------------------------------------------------------------------------
// Los cupones se creaban desde el canje de recompensas (y ahora también desde
// la ruleta) pero no había ninguna pantalla donde verlos: el usuario recibía un
// código en un mensaje que desaparecía al recargar. Aquí están todos, con su
// estado real —usado, vencido o disponible— y el código a un clic.
// =========================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, Ticket } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getMisCupones, estadoCupon } from '../../services/cupones';
import styles from './MisCuponesPage.module.css';
import { T } from '../../i18n/useTranslatedText';

const ETIQUETA_ESTADO = {
  activo: 'Disponible',
  usado: 'Usado',
  caducado: 'Vencido',
};

const ORIGEN = {
  ruleta: 'Ruleta Semanal',
  recompensa: 'Catálogo de recompensas',
};

const MisCuponesPage = () => {
  const { user } = useAuth();
  const { addToast } = useGlobalToast();
  const [cupones, setCupones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(null);

  const cargar = useCallback(async () => {
    if (!user?.uid) { setCupones([]); setCargando(false); return; }
    setCargando(true);
    const { data, error: err } = await getMisCupones(user.uid);
    setCupones(data);
    setError(err || '');
    setCargando(false);
  }, [user?.uid]);

  useEffect(() => { cargar(); }, [cargar]);

  const copiar = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiado(code);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      addToast('No pudimos copiar el código', 'error');
    }
  };

  if (cargando) {
    return <p className={styles.estado}><T>Cargando tus cupones...</T></p>;
  }

  if (error) {
    return (
      <div className={styles.estado}>
        <p>{error}</p>
        <button type="button" className={styles.reintentar} onClick={cargar}>
          <T>Reintentar</T>
        </button>
      </div>
    );
  }

  if (cupones.length === 0) {
    return (
      <div className={styles.vacio}>
        <Ticket size={40} aria-hidden="true" className={styles.vacioIcono} />
        <h2 className={styles.vacioTitulo}><T>Todavía no tienes cupones</T></h2>
        <p className={styles.vacioTexto}>
          <T>Los ganarás en la Ruleta Semanal o canjeándolos en el catálogo de recompensas.</T>
        </p>
        <Link to="/ruleta" className={styles.vacioBtn}><T>Ir a la ruleta</T></Link>
      </div>
    );
  }

  // Los disponibles primero: son los únicos con los que el usuario puede hacer algo.
  const ordenados = [...cupones].sort((a, b) => {
    const peso = (c) => (estadoCupon(c) === 'activo' ? 0 : 1);
    return peso(a) - peso(b);
  });

  return (
    <div className={styles.pagina}>
      <h1 className={styles.titulo}><T>Mis cupones</T></h1>
      <p className={styles.subtitulo}>
        <T>Escribe el código en el carrito, en el paso de pago, para aplicar el descuento.</T>
      </p>

      <ul className={styles.lista}>
        {ordenados.map((c) => {
          const estado = estadoCupon(c);
          const usable = estado === 'activo';
          return (
            <li key={c.id} className={`${styles.cupon} ${usable ? '' : styles.cuponInactivo}`}>
              <div className={styles.cuponCabecera}>
                <span className={`${styles.estado} ${styles[`estado_${estado}`]}`}>
                  <T>{ETIQUETA_ESTADO[estado]}</T>
                </span>
                {c.origen && (
                  <span className={styles.origen}><T>{ORIGEN[c.origen] || c.origen}</T></span>
                )}
              </div>

              <p className={styles.cuponTexto}>{c.texto || c.titulo || c.title}</p>

              <div className={styles.codigoFila}>
                <code className={styles.codigo}>{c.code}</code>
                {usable && (
                  <button
                    type="button"
                    className={styles.copiar}
                    onClick={() => copiar(c.code)}
                    aria-label={`Copiar el código ${c.code}`}
                  >
                    {copiado === c.code
                      ? <Check size={16} aria-hidden="true" />
                      : <Copy size={16} aria-hidden="true" />}
                  </button>
                )}
              </div>

              {/* Solo se dice la fecha cuando aún sirve de algo saberla. */}
              {c.expiraEn && estado !== 'usado' && (
                <span className={styles.caduca}>
                  {estado === 'caducado'
                    ? <T>Venció el</T>
                    : <T>Válido hasta el</T>} {c.expiraEn}
                </span>
              )}

              {/* Los cupones viejos del catálogo no llevan tipo ni valor: no hay
                  nada que el carrito pueda descontar solo. */}
              {usable && !c.tipo && (
                <span className={styles.nota}>
                  <T>Este cupón se canjea con un asesor.</T>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default MisCuponesPage;
