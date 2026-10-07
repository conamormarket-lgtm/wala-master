import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { renombrarCreacion } from '../../services/designs';
import styles from './NombreEditable.module.css';

const LARGO_MAXIMO = 60;

/**
 * Nombre de una creación que se cambia ahí mismo: el lápiz lo vuelve un
 * campo; Enter o salir del campo lo guarda, Esc cancela. Guarda solo el
 * nombre: no vuelve a generar las imágenes del diseño.
 *
 * `como` es la etiqueta del nombre (h1, strong, h3…) y `className` su estilo.
 */
const NombreEditable = ({ designId, nombre, onCambiado, como: Etiqueta = 'span', className = '' }) => {
  const { user } = useAuth();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nombre || '');
  const [guardando, setGuardando] = useState(false);
  const campoRef = useRef(null);
  const cancelarRef = useRef(false);

  useEffect(() => { if (!editando) setValor(nombre || ''); }, [nombre, editando]);
  useEffect(() => {
    if (!editando) return;
    campoRef.current?.focus();
    campoRef.current?.select();
  }, [editando]);

  const terminar = async () => {
    if (!editando) return;
    setEditando(false);
    const limpio = valor.trim().slice(0, LARGO_MAXIMO);
    if (cancelarRef.current || !limpio || limpio === nombre) {
      cancelarRef.current = false;
      setValor(nombre || '');
      return;
    }
    setGuardando(true);
    const { error } = await renombrarCreacion(designId, limpio);
    setGuardando(false);
    if (error) {
      toast.error('No pudimos cambiar el nombre. Inténtalo de nuevo.');
      setValor(nombre || '');
      return;
    }
    queryClient.setQueryData(['creacion', designId, user?.uid], (prev) => (prev ? { ...prev, name: limpio } : prev));
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    toast.success('Nombre actualizado.');
    onCambiado?.(limpio);
  };

  if (editando) {
    // El campo va dentro del título y hereda su letra (tamaño y peso).
    return (
      <Etiqueta className={`${className} ${styles.editandoTitulo}`}>
        <input
          ref={campoRef}
          className={styles.campo}
          value={valor}
          maxLength={LARGO_MAXIMO}
          aria-label="Nombre de la creación"
          onChange={(e) => setValor(e.target.value)}
          onBlur={terminar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancelarRef.current = true;
              e.currentTarget.blur();
            }
          }}
        />
      </Etiqueta>
    );
  }

  return (
    <span className={styles.envoltura}>
      <Etiqueta className={className}>{nombre || 'Mi diseño'}</Etiqueta>
      <button
        type="button"
        className={styles.lapiz}
        onClick={() => setEditando(true)}
        disabled={guardando || !designId}
        aria-label="Cambiar el nombre"
        title="Cambiar el nombre"
      >
        {guardando
          ? <Loader2 size={15} className={styles.girando} aria-hidden="true" />
          : <Pencil size={15} aria-hidden="true" />}
      </button>
    </span>
  );
};

export default NombreEditable;
