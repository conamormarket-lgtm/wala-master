import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessage, setMessage } from '../../services/messages';
import Button from '../../components/common/Button';
import styles from './AdminTiendaTextos.module.css';

const AdminWhatsApp = () => {
  const queryClient = useQueryClient();
  const [numbers, setNumbers] = useState({
    tienda: '',
    crear: '',
    cuenta: '',
    text_tienda: '',
    text_crear: '',
    text_cuenta: '',
  });

  const { data: savedNumbers, isLoading } = useQuery({
    queryKey: ['admin-whatsapp-numbers'],
    queryFn: async () => {
      const [tienda, crear, cuenta, textTienda, textCrear, textCuenta] = await Promise.all([
        getMessage('whatsapp_number_tienda'),
        getMessage('whatsapp_number_crear'),
        getMessage('whatsapp_number_cuenta'),
        getMessage('whatsapp_text_tienda'),
        getMessage('whatsapp_text_crear'),
        getMessage('whatsapp_text_cuenta')
      ]);

      // Fallback a whatsapp_number si las específicas están vacías (retrocompatibilidad)
      const fallback = await getMessage('whatsapp_number');

      return {
        tienda: tienda.data?.trim() || fallback.data?.trim() || '',
        crear: crear.data?.trim() || fallback.data?.trim() || '',
        cuenta: cuenta.data?.trim() || fallback.data?.trim() || '',
        text_tienda: textTienda.data || 'Solicitud de Pedido\n\nHola! Vengo de la tienda virtual y quiero confirmar mi pedido con código {id}.',
        text_crear: textCrear.data || '*Mi Creación Libre*\n\nHola! Diseñé esto con el Creador Libre, ayúdame a cotizar.',
        text_cuenta: textCuenta.data || 'Hola, necesito ayuda con mi cuenta / mi pedido.'
      };
    }
  });

  useEffect(() => {
    if (savedNumbers) {
      setNumbers(savedNumbers);
    }
  }, [savedNumbers]);

  const saveMutation = useMutation({
    mutationFn: async (updatedNumbers) => {
      await Promise.all([
        setMessage('whatsapp_number_tienda', updatedNumbers.tienda?.trim() || ''),
        setMessage('whatsapp_number_crear', updatedNumbers.crear?.trim() || ''),
        setMessage('whatsapp_number_cuenta', updatedNumbers.cuenta?.trim() || ''),
        // Textos
        setMessage('whatsapp_text_tienda', updatedNumbers.text_tienda || ''),
        setMessage('whatsapp_text_crear', updatedNumbers.text_crear || ''),
        setMessage('whatsapp_text_cuenta', updatedNumbers.text_cuenta || ''),
        // Mantener whatsapp_number como fallback general
        setMessage('whatsapp_number', updatedNumbers.tienda?.trim() || '')
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-whatsapp-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers-config'] });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(numbers);
  };

  const formatNumber = (value) => {
    return value.replace(/[^\d\s\-\(\)\+]/g, '');
  };

  const handleChange = (key, value) => {
    // Si es una key de texto no formateamos a numero
    if (key.startsWith('text_')) {
      setNumbers(prev => ({
        ...prev,
        [key]: value
      }));
    } else {
      setNumbers(prev => ({
        ...prev,
        [key]: formatNumber(value)
      }));
    }
  };

  const renderPreview = (num) => {
    if (!num) return null;
    const clean = num.replace(/[\s\-\(\)]/g, '');
    const formatted = clean.startsWith('+') ? clean : `+51${clean}`;
    return `https://wa.me/${formatted.replace(/\+/g, '')}`;
  };

  if (isLoading) {
    return <p className={styles.loading}>Cargando...</p>;
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Configuración de WhatsApp</h1>
      <p className={styles.subtitle}>
        Personaliza a qué número de WhatsApp se redirigirá al cliente según la pestaña donde se encuentre.
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

          <div className={styles.configBlock} style={{ background: 'var(--gris-fondo)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--gris-borde)' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>1. Configuración de Tienda (Checkout)</h3>
            <div className={styles.field}>
              <label htmlFor="whatsapp_tienda">Número de WhatsApp</label>
              <input
                id="whatsapp_tienda"
                type="text"
                value={numbers.tienda}
                onChange={(e) => handleChange('tienda', e.target.value)}
                placeholder="Ej: +51 987 654 321"
                className={styles.input}
              />
              {numbers.tienda && <p className={styles.sectionHint}>{renderPreview(numbers.tienda)}</p>}
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label htmlFor="whatsapp_text_tienda">Mensaje Principal (Usa {'{id}'} para el N° de Pedido)</label>
              <textarea
                id="whatsapp_text_tienda"
                value={numbers.text_tienda}
                onChange={(e) => handleChange('text_tienda', e.target.value)}
                rows={3}
                className={styles.input}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          <div className={styles.configBlock} style={{ background: 'var(--gris-fondo)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--gris-borde)' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>2. Configuración de Creador (Diseño Libre)</h3>
            <div className={styles.field}>
              <label htmlFor="whatsapp_crear">Número de WhatsApp</label>
              <input
                id="whatsapp_crear"
                type="text"
                value={numbers.crear}
                onChange={(e) => handleChange('crear', e.target.value)}
                placeholder="Ej: +51 987 654 321"
                className={styles.input}
              />
              {numbers.crear && <p className={styles.sectionHint}>{renderPreview(numbers.crear)}</p>}
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label htmlFor="whatsapp_text_crear">Mensaje de Cotización</label>
              <textarea
                id="whatsapp_text_crear"
                value={numbers.text_crear}
                onChange={(e) => handleChange('text_crear', e.target.value)}
                rows={3}
                className={styles.input}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          <div className={styles.configBlock} style={{ background: 'var(--gris-fondo)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--gris-borde)' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>3. Configuración para Mi Cuenta (Soporte)</h3>
            <div className={styles.field}>
              <label htmlFor="whatsapp_cuenta">Número de WhatsApp</label>
              <input
                id="whatsapp_cuenta"
                type="text"
                value={numbers.cuenta}
                onChange={(e) => handleChange('cuenta', e.target.value)}
                placeholder="Ej: +51 987 654 321"
                className={styles.input}
              />
              {numbers.cuenta && <p className={styles.sectionHint}>{renderPreview(numbers.cuenta)}</p>}
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label htmlFor="whatsapp_text_cuenta">Mensaje de Ayuda General</label>
              <textarea
                id="whatsapp_text_cuenta"
                value={numbers.text_cuenta}
                onChange={(e) => handleChange('text_cuenta', e.target.value)}
                rows={3}
                className={styles.input}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

        </div>

        <p className={styles.sectionHint} style={{ marginTop: '1rem', fontSize: '0.8125rem', color: '#666' }}>
          * Si dejas un número vacío, el botón no aparecerá en esa sección específica. El código +51 se agrega automáticamente si no incluyes código de país.
        </p>

        <div className={styles.actions} style={{ marginTop: '2rem' }}>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando...' : 'Guardar todas las configuraciones'}
          </Button>
        </div>
      </form>

      {saveMutation.isSuccess && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#d4edda', color: '#155724', borderRadius: '6px', fontSize: '0.875rem' }}>
          ✓ Configuraciones guardadas exitosamente. El botón de WhatsApp se actualizará en las pestañas correspondientes.
        </div>
      )}

      {saveMutation.isError && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8d7da', color: '#721c24', borderRadius: '6px', fontSize: '0.875rem' }}>
          ✗ Error al guardar: {saveMutation.error?.message || 'Error desconocido'}
        </div>
      )}
    </div>
  );
};

export default AdminWhatsApp;
