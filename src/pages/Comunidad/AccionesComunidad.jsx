import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Users, RefreshCw, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { publicarEnComunidad, retirarDeComunidad } from '../../services/comunidad';
// La confirmación con el kit (paso 3 de la migración; antes, CapaModal).
import { Confirmar } from '../../componentes/kit/Feedback';
import styles from './Comunidad.module.css';

const PERMISOS = ['superadmin', 'manage_design'];

/** ¿Puede esta cuenta publicar esta creación? (El servidor lo vuelve a comprobar.) */
export const usePuedePublicar = (design) => {
  const { user, isAdmin, adminPermissions } = useAuth();
  return Boolean(
    user && isAdmin && (adminPermissions || []).some((p) => PERMISOS.includes(p))
    && ['crear', 'comboCrear'].includes(design?.tipo) && design.userId === user.uid && design.estado !== 'borrador'
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
  // La última acción, para que la ventana se vaya con sus textos.
  const ultima = useRef(null);
  if (accion) ultima.current = accion;

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
    queryClient.invalidateQueries({ queryKey: ['comunidad-diseno'] });
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['creacion', design.id] });
  };

  const cerrar = () => { if (!trabajando) setAccion(null); };
  const t = ultima.current ? TEXTOS[ultima.current] : null;

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

      <Confirmar
        abierta={Boolean(accion)}
        titulo={t?.titulo}
        texto={t?.texto}
        confirmar={t?.boton}
        onConfirmar={confirmar}
        onCancelar={cerrar}
      />
    </>
  );
};

export default AccionesComunidad;
