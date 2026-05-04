import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessage, setMessage } from '../../services/messages';
import Button from '../../components/common/Button';
import styles from './AdminTiendaTextos.module.css';

const KEYS = {
  store_title: 'Título de la tienda',
  store_subtitle: 'Subtítulo',
  store_empty_message: 'Mensaje cuando no hay productos'
};

const AdminTiendaTextos = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    store_title: '',
    store_subtitle: '',
    store_empty_message: ''
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ['admin-store-messages'],
    queryFn: async () => {
      const result = {};
      for (const key of Object.keys(KEYS)) {
        const { data } = await getMessage(key);
        result[key] = data ?? '';
      }
      return result;
    }
  });

  useEffect(() => {
    if (messages) setForm((f) => ({ ...f, ...messages }));
  }, [messages]);

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      for (const [key, value] of Object.entries(values)) {
        const { error } = await setMessage(key, value ?? '');
        if (error) throw new Error(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-messages'] });
      queryClient.invalidateQueries({ queryKey: ['store-messages'] });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  if (isLoading) {
    return <p className={styles.loading}>Cargando...</p>;
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Textos de la tienda</h1>
      <p className={styles.subtitle}>Estos textos se muestran en la página principal de la tienda.</p>

      <form onSubmit={handleSubmit} className={styles.form}>
        {Object.entries(KEYS).map(([key, label]) => (
          <div key={key} className={styles.field}>
            <label htmlFor={key}>{label}</label>
            {key === 'store_subtitle' || key === 'store_empty_message' ? (
              <textarea
                id={key}
                value={form[key] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                rows={3}
                className={styles.input}
              />
            ) : (
              <input
                id={key}
                type="text"
                value={form[key] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className={styles.input}
              />
            )}
          </div>
        ))}

        <div className={styles.actions}>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando...' : 'Guardar textos'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AdminTiendaTextos;
