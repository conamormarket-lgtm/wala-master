import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getCombosCrear } from '../../services/combosCrear';
import { copiarCreacionParaCombo } from '../../services/misCombos';
import { precioBase } from '../../utils/prendaBase';
import { empezarComboCon } from './comboCrear';
// La ventana con el kit (paso 3 de la migración; antes, CapaModal).
import { HojaInferior } from '../../componentes/kit/Feedback';
import styles from './LlevarEnCombo.module.css';

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

/** Combos publicados (pareja, trío, conjunto…) que llevan esta prenda. */
export const useCombosDePrenda = (productId) => {
  const { data: combos = [] } = useQuery({
    // La misma consulta (y caché) que la página de la creación.
    queryKey: ['combos-crear', false],
    enabled: Boolean(productId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await getCombosCrear()).data,
  });
  return combos.filter((c) => c.piezas.some((p) => p.prendaId === productId));
};

/**
 * Lleva una creación (guardada o borrador) a un combo NUEVO: hace una copia
 * para el combo (la creación sigue igual, suelta) y la pone en las prendas
 * del combo que son su misma prenda; lo demás se diseña en el combo.
 */
export const useLlevarEnCombo = () => {
  const { user } = useAuth();
  const toast = useGlobalToast();
  const navigate = useNavigate();
  const [llevando, setLlevando] = useState(null);
  const llevar = async (combo, creacion) => {
    if (!user || llevando) return;
    setLlevando(combo.id);
    const pieza = combo.piezas.findIndex((p) => p.prendaId === creacion.productId);
    const { id, error } = await copiarCreacionParaCombo(user.uid, creacion, combo, Math.max(0, pieza));
    if (error || !id) {
      setLlevando(null);
      toast.error(`No pudimos armar el combo: ${error || 'inténtalo de nuevo.'}`);
      return;
    }
    empezarComboCon(combo, id, creacion.productId);
    navigate(`/combo/${combo.id}`);
  };
  return { llevar, llevando };
};

/** Ventana para elegir el combo (mientras arma la copia, no se cierra). */
const ElegirCombo = ({ abierta, creacion, combos, onCerrar }) => {
  const { llevar, llevando } = useLlevarEnCombo();

  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo="Llevar en combo" bloqueada={Boolean(llevando)}>
      <div>
        <p className={styles.ayuda}>
          Usamos una copia de «{creacion.name || 'tu diseño'}»: tu creación sigue igual. En el combo
          le cambias el color o el diseño a cada prenda.
        </p>
        <ul className={styles.lista}>
          {combos.map((c) => (
            <li key={c.id}>
              <button type="button" className={styles.opcion} onClick={() => llevar(c, creacion)} disabled={Boolean(llevando)}>
                <span className={styles.opcionTexto}>
                  <strong>{c.name}</strong>
                  <span>{c.piezas.length} prendas · {soles(precioBase(c))}</span>
                </span>
                {llevando === c.id
                  ? <Loader2 size={18} className={styles.girando} aria-hidden="true" />
                  : <ArrowRight size={18} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </HojaInferior>
  );
};

/**
 * Botón "Llevar en combo" de una tarjeta (creación o borrador). No se
 * muestra si su prenda no tiene combos publicados.
 */
export const BotonLlevarEnCombo = ({ creacion, className }) => {
  const combos = useCombosDePrenda(creacion?.productId);
  const [abierto, setAbierto] = useState(false);
  if (!combos.length) return null;
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setAbierto(true)}
        aria-label="Llevar en combo (pareja, trío…)"
        title="Llevar en combo (pareja, trío…)"
      >
        <Users size={16} aria-hidden="true" />
      </button>
      <ElegirCombo abierta={abierto} creacion={creacion} combos={combos} onCerrar={() => setAbierto(false)} />
    </>
  );
};
