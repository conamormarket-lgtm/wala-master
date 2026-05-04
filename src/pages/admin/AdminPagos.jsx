import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessage, setMessage } from '../../services/messages';
import Button from '../../components/common/Button';
import styles from './AdminTiendaTextos.module.css';

const AdminPagos = () => {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState({
    yape_number: '',
    yape_name: '',
    plin_number: '',
    plin_name: '',
    whatsapp_pagos: '',
    whatsapp_pagos_text: 'Hola, quiero pagar mi saldo pendiente del pedido *#{id}*. Adjunto mi comprobante por S/ *{monto}*.',
  });

  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ['admin-pagos-config'],
    queryFn: async () => {
      const [
        yapeNum, yapeName, plinNum, plinName, waPagos, waText
      ] = await Promise.all([
        getMessage('yape_number'),
        getMessage('yape_name'),
        getMessage('plin_number'),
        getMessage('plin_name'),
        getMessage('whatsapp_number_pagos'),
        getMessage('whatsapp_text_pagos'),
      ]);

      const waFallback = await getMessage('whatsapp_number_cuenta');

      return {
        yape_number: yapeNum.data?.trim() || '',
        yape_name: yapeName.data?.trim() || '',
        plin_number: plinNum.data?.trim() || '',
        plin_name: plinName.data?.trim() || '',
        whatsapp_pagos: waPagos.data?.trim() || waFallback.data?.trim() || '',
        whatsapp_pagos_text: waText.data || 'Hola, quiero pagar mi saldo pendiente del pedido *#{id}*. Adjunto mi comprobante por S/ *{monto}*.',
      };
    }
  });

  useEffect(() => {
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, [savedConfig]);

  const saveMutation = useMutation({
    mutationFn: async (updatedConfig) => {
      await Promise.all([
        setMessage('yape_number', updatedConfig.yape_number?.trim() || ''),
        setMessage('yape_name', updatedConfig.yape_name?.trim() || ''),
        setMessage('plin_number', updatedConfig.plin_number?.trim() || ''),
        setMessage('plin_name', updatedConfig.plin_name?.trim() || ''),
        setMessage('whatsapp_number_pagos', updatedConfig.whatsapp_pagos?.trim() || ''),
        setMessage('whatsapp_text_pagos', updatedConfig.whatsapp_pagos_text || ''),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pagos-config'] });
      queryClient.invalidateQueries({ queryKey: ['user-pagos-config'] });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(config);
  };

  const handleChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return <p className={styles.loading}>Cargando...</p>;
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Métodos de Pago</h1>
      <p className={styles.subtitle}>
        Configura los números de Yape/Plin y el WhatsApp al que tus clientes enviarán sus comprobantes cuando paguen una deuda de sus pedidos.
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

          <div className={styles.configBlock} style={{ background: 'var(--gris-fondo)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--gris-borde)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#7E1B73' }}>Configuración de Yape</h3>
            <div className={styles.field}>
              <label htmlFor="yape_number">Número de Yape</label>
              <input
                id="yape_number"
                type="text"
                value={config.yape_number}
                onChange={(e) => handleChange('yape_number', e.target.value)}
                placeholder="Ej: 987 654 321"
                className={styles.input}
              />
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label htmlFor="yape_name">Nombre del Titular (Opcional pero recomendado)</label>
              <input
                id="yape_name"
                type="text"
                value={config.yape_name}
                onChange={(e) => handleChange('yape_name', e.target.value)}
                placeholder="Ej: Juan Pérez"
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.configBlock} style={{ background: 'var(--gris-fondo)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--gris-borde)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#00B4D8' }}>Configuración de Plin</h3>
            <div className={styles.field}>
              <label htmlFor="plin_number">Número de Plin (Déjalo vacío si no usas Plin)</label>
              <input
                id="plin_number"
                type="text"
                value={config.plin_number}
                onChange={(e) => handleChange('plin_number', e.target.value)}
                placeholder="Ej: 987 654 321"
                className={styles.input}
              />
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label htmlFor="plin_name">Nombre del Titular</label>
              <input
                id="plin_name"
                type="text"
                value={config.plin_name}
                onChange={(e) => handleChange('plin_name', e.target.value)}
                placeholder="Ej: Juan Pérez"
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.configBlock} style={{ background: 'var(--gris-fondo)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--gris-borde)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#25D366' }}>Recepción de Comprobantes (WhatsApp)</h3>
            <div className={styles.field}>
              <label htmlFor="whatsapp_pagos">Número de WhatsApp para Validar Pagos</label>
              <input
                id="whatsapp_pagos"
                type="text"
                value={config.whatsapp_pagos}
                onChange={(e) => handleChange('whatsapp_pagos', e.target.value)}
                placeholder="Ej: +51 987 654 321"
                className={styles.input}
              />
            </div>
            <div className={styles.field} style={{ marginTop: '1rem' }}>
              <label htmlFor="whatsapp_pagos_text">Mensaje Predeterminado (Usa {'{id}'} para el pedido y {'{monto}'} para el saldo)</label>
              <textarea
                id="whatsapp_pagos_text"
                value={config.whatsapp_pagos_text}
                onChange={(e) => handleChange('whatsapp_pagos_text', e.target.value)}
                rows={3}
                className={styles.input}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

        </div>

        <div className={styles.actions} style={{ marginTop: '2rem' }}>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando...' : 'Guardar Métodos de Pago'}
          </Button>
        </div>
      </form>

      {saveMutation.isSuccess && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#d4edda', color: '#155724', borderRadius: '6px', fontSize: '0.875rem' }}>
          ✓ Métodos de pago guardados exitosamente.
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

export default AdminPagos;
