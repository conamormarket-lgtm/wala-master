import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { getBrands } from '../../../../services/brands';
import CategoryNavEditor from '../../../../components/admin/CategoryNavEditor/CategoryNavEditor';
import styles from '../../AdminElementosDiseno.module.css';

/**
 * EDITOR DEL ELEMENTO "Navegación por categorías".
 *
 * Es el contenido que antes vivía inline en AdminElementosDiseno: un selector de
 * marca (getBrands) que, una vez elegida una marca, monta el editor reutilizable
 * <CategoryNavEditor/> para esa marca.
 *
 * Se usa como `Editor` de la entrada 'navegacion-categorias' del registro de
 * elementos (registry.jsx) y se renderiza desde la página por elemento
 * (/admin/elementos-diseno/:elementSlug).
 */
const NavegacionCategoriasEditor = () => {
  // Marca seleccionada (id del doc tienda_brands).
  const [marcaSeleccionada, setMarcaSeleccionada] = useState('');

  // Marcas disponibles para el selector.
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

  return (
    <div>
      {/* ── Selector de marca ── */}
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

      {/* ── Contenido del editor para la marca elegida ── */}
      <section className={styles.panel}>
        {!marcaSeleccionada ? (
          <div className={styles.placeholder}>
            Selecciona una marca arriba para editar su navegación por categorías.
          </div>
        ) : (
          <CategoryNavEditor brandId={marcaSeleccionada} brandName={brandName} />
        )}
      </section>
    </div>
  );
};

export default NavegacionCategoriasEditor;
