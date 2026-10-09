import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, RotateCcw, Shirt } from 'lucide-react';
import TarjetaComunidad, { useComunidad } from './TarjetaComunidad';
import { MiCreacionCardSkeleton } from '../cuenta/components/MiCreacionCard';
import styles from '../cuenta/MisCreacionesPage.module.css';
import propios from './Comunidad.module.css';
import { T } from '../../i18n/useTranslatedText';

/**
 * Diseños de la comunidad: los que publica Walá para usarlos de punto de
 * partida. Se ve sin iniciar sesión; el estudio pide la sesión recién al
 * subir una imagen, guardar o comprar.
 */
const ComunidadPage = () => {
  const { data: disenos = [], isLoading, error, refetch } = useComunidad();
  const [prenda, setPrenda] = useState('');

  // Filtro por prenda, solo si hay más de una.
  const prendas = useMemo(() => {
    const mapa = new Map();
    disenos.forEach((d) => { if (d.productId && !mapa.has(d.productId)) mapa.set(d.productId, d.productName || 'Prenda'); });
    return [...mapa.entries()];
  }, [disenos]);
  const visibles = prenda ? disenos.filter((d) => d.productId === prenda) : disenos;

  return (
    <div className={`${styles.container} ${propios.pagina}`}>
      <div className={styles.headerRow}>
        <div className={styles.headerTexto}>
          <h1 className={styles.title}>
            <Users className={styles.titleIcon} size={26} aria-hidden="true" />
            <T>Diseños de la comunidad</T>
          </h1>
          <p className={styles.subtitle}>
            <T>Elige uno, cámbialo a tu gusto y hazlo tuyo.</T>
          </p>
        </div>
        <Link to="/personalizar" className={styles.primaryBtn}>
          <Shirt size={18} aria-hidden="true" />
          Empezar desde cero
        </Link>
      </div>

      {prendas.length > 1 && (
        <div className={propios.filtros} role="group" aria-label="Filtrar por prenda">
          <button type="button" className={`${propios.filtro} ${!prenda ? propios.filtroActivo : ''}`} onClick={() => setPrenda('')}>
            Todas
          </button>
          {prendas.map(([pid, nombre]) => (
            <button
              key={pid}
              type="button"
              className={`${propios.filtro} ${prenda === pid ? propios.filtroActivo : ''}`}
              onClick={() => setPrenda(pid)}
            >
              {nombre}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <ul className={styles.grid} aria-label="Cargando diseños">
          {[1, 2, 3, 4, 5, 6].map((i) => <MiCreacionCardSkeleton key={i} />)}
        </ul>
      ) : error ? (
        <div className={styles.emptyState}>
          <h3><T>No pudimos cargar los diseños</T></h3>
          <p><T>Revisa tu conexión e inténtalo de nuevo.</T></p>
          <button type="button" className={styles.primaryBtn} onClick={() => refetch()}>
            <RotateCcw size={17} aria-hidden="true" />
            Reintentar
          </button>
        </div>
      ) : visibles.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><Users size={52} aria-hidden="true" /></div>
          <h3><T>Muy pronto</T></h3>
          <p><T>Aquí verás diseños listos para usar. Mientras tanto, crea el tuyo desde cero.</T></p>
          <Link to="/personalizar" className={styles.primaryBtn}>
            <Shirt size={18} aria-hidden="true" />
            Empezar a crear
          </Link>
        </div>
      ) : (
        <ul className={styles.grid}>
          {visibles.map((d) => <TarjetaComunidad key={d.id} diseno={d} />)}
        </ul>
      )}
    </div>
  );
};

export default ComunidadPage;
