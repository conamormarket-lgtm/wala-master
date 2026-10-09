import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Users, RefreshCw, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { publicarEnComunidad, retirarDeComunidad } from '../../services/comunidad';
import CapaModal from '../Crear/CapaModal';
import estilosModal from '../Crear/EliminarCreacion.module.css';
import styles from './Comunidad.module.css';

const PERMISOS = ['superadmin', 'manage_design'];

/** ¿Puede esta cuenta publicar esta creación? (El servidor lo vuelve a comprobar.) */
export const usePuedePublicar = (design) => {
  const { user, isAdmin, adminPermissions } = useAuth();
  return Boolean(
    user && isAdmin && (adminPermissions || []).some((p) => PERMISOS.includes(p))
    && design?.tipo === 'crear' && design.userId === user.uid && design.estado !== 'borrador'
  );
};

/** Insignia "En la comunidad" para la tarjeta de la creación. */
export const InsigniaPublicada = ({ design }) => (design?.comunidad === 'publicada' ? (
  <span className={styles.insigniaPublicada} title="Se ve en Diseños de la comunidad">
    <Users size={12} strokeWidth={2.5} aria-hidden="true" /> En la comunidad
  </span>
) : null);

const TEXTOS = {
  publicar: {
    titulo: '¿Publicar en la comunidad?',
    texto: 'Se verá en Diseños de la comunidad, también sin iniciar sesión, y cualquiera podrá usarlo como punto de partida. Tu creación no cambia.',
    boton: 'Publicar',
    hecho: 'Publicada en la comunidad.',
  },
  actualizar: {
    titulo: '¿Actualizar la publicación?',
    texto: 'La comunidad verá la versión de ahora. Lo que otros ya hicieron con ella no cambia.',
    boton: 'Actualizar',
    hecho: 'Publicación actualizada.',
  },
  retirar: {
    titulo: '¿Retirar de la comunidad?',
    texto: 'Deja de verse en la galería. Lo que otros ya hicieron con ella sigue funcionando, y puedes volver a publicarla cuando quieras.',
    boton: 'Retirar',
    hecho: 'Retirada de la comunidad.',
  },
};

/**
 * Publicar / actualizar / retirar una creación de la galería. Solo para
 * admins y sobre creaciones propias (por ahora la comunidad la arma Walá).
 * `onCambio(nuevoEstado)` deja la tarjeta al día sin recargar.
 */
const AccionesComunidad = ({ design, onCambio }) => {
  const puede = usePuedePublicar(design);
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const [accion, setAccion] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  if (!puede) return null;
  const publicada = design.comunidad === 'publicada';

  const confirmar = async () => {
    setTrabajando(true);
    const { error } = accion === 'retirar'
      ? await retirarDeComunidad(design.id)
      : await publicarEnComunidad(design.id);
    setTrabajando(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(TEXTOS[accion].hecho);
    const nuevo = accion === 'retirar' ? 'retirada' : 'publicada';
    setAccion(null);
    onCambio?.(nuevo);
    queryClient.invalidateQueries({ queryKey: ['comunidad'] });
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['creacion', design.id] });
  };

  const cerrar = () => { if (!trabajando) setAccion(null); };
  const t = accion ? TEXTOS[accion] : null;

  return (
    <>
      {publicada ? (
        <div className={styles.filaComunidad}>
          <button type="button" className={styles.botonComunidad} onClick={() => setAccion('actualizar')}>
            <RefreshCw size={14} aria-hidden="true" /> Actualizar
          </button>
          <button type="button" className={`${styles.botonComunidad} ${styles.botonRetirar}`} onClick={() => setAccion('retirar')}>
            <EyeOff size={14} aria-hidden="true" /> Retirar
          </button>
        </div>
      ) : (
        <button type="button" className={styles.botonComunidad} onClick={() => setAccion('publicar')}>
          <Users size={14} aria-hidden="true" />
          {design.comunidad === 'retirada' ? 'Volver a publicar' : 'Publicar en la comunidad'}
        </button>
      )}

      {t && (
        <CapaModal className={estilosModal.capa} role="dialog" aria-modal="true" aria-labelledby="comunidad-titulo" onClick={cerrar}>
          <div className={estilosModal.caja} onClick={(e) => e.stopPropagation()}>
            <span className={`${estilosModal.icono} ${styles.iconoComunidad}`}>
              {accion === 'retirar' ? <EyeOff size={22} aria-hidden="true" /> : <Users size={22} aria-hidden="true" />}
            </span>
            <h2 id="comunidad-titulo" className={estilosModal.titulo}>{t.titulo}</h2>
            <p>{t.texto}</p>
            <button type="button" className={`${estilosModal.eliminar} ${styles.confirmar}`} onClick={confirmar} disabled={trabajando}>
              {trabajando
                ? <><Loader2 size={18} className={styles.girando} aria-hidden="true" /> Un momento…</>
                : t.boton}
            </button>
            <button type="button" className={estilosModal.cancelar} onClick={cerrar} disabled={trabajando}>Cancelar</button>
          </div>
        </CapaModal>
      )}
    </>
  );
};

export default AccionesComunidad;
