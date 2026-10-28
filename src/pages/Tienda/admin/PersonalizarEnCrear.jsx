import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPrendasBase } from '../../../services/prendasBase';
import { getCombosCrear } from '../../../services/combosCrear';
import styles from './AdminProductoFormV2.module.css';

/**
 * "Se personaliza en Crear con…": un producto de la tienda (un cuadro, un
 * tomatodo) muestra "Personalizar" y lleva a la prenda o combo de Crear que se
 * elija aquí. Guarda la ruta en `personalizarEn` (utils/personalizarEn.js).
 */
export default function PersonalizarEnCrear({ valor, onChange }) {
  const opciones = useQuery({
    queryKey: ['admin-personalizar-en'],
    queryFn: async () => {
      const [prendas, combos] = await Promise.all([
        getPrendasBase({ incluirBorradores: true }),
        getCombosCrear({ incluirBorradores: true }),
      ]);
      return {
        prendas: (prendas.data || []).map((p) => ({ ruta: `/crear/${p.id}`, nombre: p.name || p.id, borrador: p.visible === false })),
        combos: (combos.data || []).map((c) => ({ ruta: `/combo/${c.id}`, nombre: c.name || c.id, borrador: !c.publicado })),
      };
    },
  });
  const { prendas = [], combos = [] } = opciones.data || {};
  const conocida = !valor || [...prendas, ...combos].some((o) => o.ruta === valor);
  return (
    <div className={styles.card} style={{ marginTop: '1.5rem' }}>
      <h2 className={styles.cardTitle}>Personalizar en Crear</h2>
      <p className={styles.cardSubtitle}>
        Si eliges una prenda o un combo de Crear, la ficha muestra <strong>Personalizar</strong> y lleva a diseñarlo
        allí. El producto se sigue vendiendo tal cual en la tienda.
      </p>
      <label className={styles.field}>
        <span className={styles.label}>Se personaliza con</span>
        <select className={styles.input} value={valor} disabled={opciones.isLoading} onChange={(e) => onChange(e.target.value)}>
          <option value="">No se personaliza</option>
          {!conocida && <option value={valor}>{valor} (ya no existe)</option>}
          {prendas.length > 0 && (
            <optgroup label="Prendas y productos de Crear">
              {prendas.map((o) => <option key={o.ruta} value={o.ruta}>{o.nombre}{o.borrador ? ' (borrador)' : ''}</option>)}
            </optgroup>
          )}
          {combos.length > 0 && (
            <optgroup label="Combos de Crear">
              {combos.map((o) => <option key={o.ruta} value={o.ruta}>{o.nombre}{o.borrador ? ' (borrador)' : ''}</option>)}
            </optgroup>
          )}
        </select>
      </label>
      {opciones.isError && <p className={styles.cardSubtitle}>No se pudo cargar la lista de Crear. Recarga la página.</p>}
    </div>
  );
}
