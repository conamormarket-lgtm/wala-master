import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Palette, Loader2 } from 'lucide-react';
import { getBrands } from '../../services/brands';
import CategoryNavEditor from '../../components/admin/CategoryNavEditor/CategoryNavEditor';
import styles from './AdminElementosDiseno.module.css';

/**
 * PÁGINA ADMIN · "Elementos con diseño".
 *
 * Hub para editar los distintos elementos visuales por marca de la tienda.
 * Hoy contiene UNA sub-sección: "Navegación por categorías" (el nav de burbujas
 * de categorías por marca, editado con <CategoryNavEditor/>).
 *
 * La estructura está pensada para CRECER: las sub-secciones se declaran en el
 * array `SECCIONES` y se pintan como pestañas. Para añadir un nuevo elemento de
 * diseño basta con agregar una entrada nueva (id, label, icono y render).
 *
 * Flujo:
 *  1) Se elige una marca en el <select> de arriba (getBrands).
 *  2) La pestaña activa renderiza su editor para esa marca.
 */

// Catálogo de sub-secciones (pestañas). Cada `render` recibe { brandId, brandName }.
// Añadir aquí futuros elementos de diseño (banners, destacados por marca, etc.).
const SECCIONES = [
  {
    id: 'categories_nav',
    label: 'Navegación por categorías',
    render: ({ brandId, brandName }) => (
      <CategoryNavEditor brandId={brandId} brandName={brandName} />
    ),
  },
];

const AdminElementosDiseno = () => {
  // Marca seleccionada (id del doc tienda_brands).
  const [marcaSeleccionada, setMarcaSeleccionada] = useState('');
  // Pestaña / sub-sección activa.
  const [tabActiva, setTabActiva] = useState(SECCIONES[0].id);

  // Marcas disponibles para el selector superior.
  const {
    data: brands,
    isLoading: loadingBrands,
    error: errorBrands,
  } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: async () => {
      const { data, error } = await getBrands();
      if (error) throw new Error(error);
      return data || [];
    },
  });

  // Nombre de la marca elegida (solo para textos del editor).
  const brandName = useMemo(() => {
    return (brands || []).find((b) => b.id === marcaSeleccionada)?.name || '';
  }, [brands, marcaSeleccionada]);

  const seccionActiva = SECCIONES.find((s) => s.id === tabActiva) || SECCIONES[0];

  return (
    <div className={styles.wrapper}>
      {/* ── Cabecera ── */}
      <header className={styles.header}>
        <h1 className={styles.title}>
          <Palette size={26} className={styles.titleIcon} /> Elementos con diseño
        </h1>
        <p className={styles.subtitle}>
          Personaliza los elementos visuales de cada marca de tu tienda. Elige una marca
          y edita su navegación, destacados y demás piezas de diseño.
        </p>
      </header>

      {/* ── Selector de marca (común a todas las sub-secciones) ── */}
      <div className={styles.brandPicker}>
        <label className={styles.brandLabel} htmlFor="elementos-marca-select">
          Marca
        </label>
        {loadingBrands ? (
          <div className={styles.loading}>
            <Loader2 size={18} className={styles.spin} /> Cargando marcas…
          </div>
        ) : errorBrands ? (
          <div className={styles.errorBox}>{errorBrands.message}</div>
        ) : (
          <select
            id="elementos-marca-select"
            className={styles.brandSelect}
            value={marcaSeleccionada}
            onChange={(e) => setMarcaSeleccionada(e.target.value)}
          >
            <option value="">— Elige una marca —</option>
            {(brands || []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || 'Sin nombre'}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Pestañas de sub-secciones (preparado para crecer) ── */}
      <div className={styles.tabs} role="tablist" aria-label="Elementos de diseño">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={tabActiva === s.id}
            className={`${styles.tab} ${tabActiva === s.id ? styles.tabActive : ''}`}
            onClick={() => setTabActiva(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Contenido de la sub-sección activa ── */}
      <section className={styles.panel}>
        {!marcaSeleccionada ? (
          <div className={styles.placeholder}>
            Selecciona una marca arriba para editar su {seccionActiva.label.toLowerCase()}.
          </div>
        ) : (
          seccionActiva.render({ brandId: marcaSeleccionada, brandName })
        )}
      </section>
    </div>
  );
};

export default AdminElementosDiseno;
