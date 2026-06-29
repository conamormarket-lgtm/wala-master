import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Palette } from 'lucide-react';
import { getElementoBySlug } from './registry';
import styles from './AdminElementoDisenoPage.module.css';
import wrapperStyles from '../AdminElementosDiseno.module.css';

/**
 * PÁGINA POR ELEMENTO · /admin/elementos-diseno/:elementSlug
 *
 * Busca el elemento en el registro (registry.jsx) por su slug y renderiza su
 * `Editor` con un encabezado: nombre del elemento + enlace para volver al
 * catálogo "Elementos con diseño".
 *
 * Si el slug no existe en el registro, muestra un aviso con un botón de vuelta.
 */
const AdminElementoDisenoPage = () => {
  const { elementSlug } = useParams();
  const elemento = getElementoBySlug(elementSlug);

  // Slug desconocido → aviso + volver.
  if (!elemento) {
    return (
      <div className={wrapperStyles.wrapper}>
        <Link to="/admin/elementos-diseno" className={styles.backLink}>
          <ArrowLeft size={16} /> Volver a Elementos con diseño
        </Link>
        <div className={wrapperStyles.errorBox}>
          No existe el elemento «{elementSlug}».
        </div>
      </div>
    );
  }

  const { nombre, descripcion, icon, Editor } = elemento;

  return (
    <div className={wrapperStyles.wrapper}>
      {/* ── Volver al catálogo ── */}
      <Link to="/admin/elementos-diseno" className={styles.backLink}>
        <ArrowLeft size={16} /> Volver a Elementos con diseño
      </Link>

      {/* ── Encabezado del elemento ── */}
      <header className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>{icon || <Palette size={26} />}</span>
          {nombre}
        </h1>
        {descripcion && <p className={styles.subtitle}>{descripcion}</p>}
      </header>

      {/* ── Editor del elemento ── */}
      <Editor />
    </div>
  );
};

export default AdminElementoDisenoPage;
