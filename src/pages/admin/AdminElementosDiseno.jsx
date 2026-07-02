import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, ChevronRight } from 'lucide-react';
import { ELEMENTOS_DISENO } from './elementosDiseno/registry';
import styles from './AdminElementosDiseno.module.css';

/**
 * PÁGINA ADMIN · "Elementos con diseño" (catálogo).
 *
 * Landing de /admin/elementos-diseno. Muestra una GRID DE TARJETAS, una por
 * cada elemento del registro (elementosDiseno/registry.jsx). Al hacer click en
 * una tarjeta navega a /admin/elementos-diseno/{slug}, donde se edita ese
 * elemento concreto (AdminElementoDisenoPage).
 *
 * El catálogo es extensible: para sumar un elemento basta con añadir su entrada
 * al registro; aquí aparecerá automáticamente como una tarjeta nueva.
 */
const AdminElementosDiseno = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.wrapper}>
      {/* ── Cabecera ── */}
      <header className={styles.header}>
        <h1 className={styles.title}>
          <Palette size={26} className={styles.titleIcon} /> Elementos con diseño
        </h1>
        <p className={styles.subtitle}>
          Personaliza las piezas visuales de tu tienda. Elige un elemento para
          editarlo.
        </p>
      </header>

      {/* ── Grid de tarjetas (una por elemento del registro) ── */}
      <div className={styles.cardGrid}>
        {ELEMENTOS_DISENO.map((el) => (
          <button
            key={el.slug}
            type="button"
            className={styles.card}
            onClick={() => navigate(`/admin/elementos-diseno/${el.slug}`)}
          >
            <span className={styles.cardIcon}>{el.icon}</span>
            <span className={styles.cardBody}>
              <span className={styles.cardName}>{el.nombre}</span>
              <span className={styles.cardDesc}>{el.descripcion}</span>
            </span>
            <ChevronRight size={20} className={styles.cardChevron} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default AdminElementosDiseno;
