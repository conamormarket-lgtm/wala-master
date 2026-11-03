import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllDailyWords, setDailyWord, deleteDailyWord } from '../../services/wordle';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from './AdminWordlePage.module.css';

const AdminWordlePage = () => {
  const [date, setDate] = useState('');
  const [word, setWord] = useState('');
  const queryClient = useQueryClient();

  const wordsQuery = useQuery({
    queryKey: ['admin-wordle-words'],
    queryFn: getAllDailyWords
  });

  const saveMutation = useMutation({
    mutationFn: async ({ dateStr, wordStr }) => {
      if (!dateStr || !wordStr) throw new Error("Fecha y palabra son obligatorias");
      if (wordStr.length < 5 || wordStr.length > 8) throw new Error("La palabra debe tener entre 5 y 8 letras");
      
      const regex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ]+$/;
      if (!regex.test(wordStr)) throw new Error("La palabra solo debe contener letras");

      // Remover tildes y convertir a mayúsculas
      const cleanWord = wordStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      return await setDailyWord(dateStr, cleanWord);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wordle-words'] });
      setDate('');
      setWord('');
      alert("Palabra guardada correctamente");
    },
    onError: (error) => {
      alert(error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (dateStr) => {
      if(window.confirm(`¿Estás seguro de eliminar la palabra para la fecha ${dateStr}?`)) {
        return await deleteDailyWord(dateStr);
      }
      throw new Error("Cancelado");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wordle-words'] });
    },
    onError: (error) => {
      if(error.message !== "Cancelado") alert(error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate({ dateStr: date, wordStr: word });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Administrar "La Palabra del Día"</h1>
        <p>Configura las palabras personalizadas para fechas específicas. Si no hay una palabra configurada, el sistema usará una automática.</p>
      </header>

      <div className={styles.grid}>
        <section className={styles.formSection}>
          <div className={styles.card}>
            <h2>Agregar o Editar Palabra</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Fecha</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  required 
                />
              </div>
              <div className={styles.formGroup}>
                <label>Palabra (5 a 8 letras sin espacios)</label>
                <input 
                  type="text" 
                  value={word} 
                  onChange={(e) => setWord(e.target.value.toUpperCase())}
                  placeholder="Ej. REGALO"
                  required 
                  minLength={5}
                  maxLength={8}
                />
              </div>
              <button 
                type="submit" 
                className={styles.submitBtn}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Guardando...' : 'Guardar Palabra'}
              </button>
            </form>
          </div>
        </section>

        <section className={styles.listSection}>
          <div className={styles.card}>
            <h2>Palabras Configuradas</h2>
            {wordsQuery.isLoading && <p>Cargando palabras...</p>}
            {wordsQuery.isError && <p className={styles.error}>Error cargando las palabras.</p>}
            
            {wordsQuery.data && wordsQuery.data.length === 0 && (
              <p className={styles.empty}>No has configurado ninguna palabra manual aún.</p>
            )}

            {wordsQuery.data && wordsQuery.data.length > 0 && (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Palabra</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {wordsQuery.data
                    .sort((a, b) => a.id.localeCompare(b.id))
                    .map((item) => {
                      let formattedDate = item.id;
                      try {
                        formattedDate = format(parseISO(item.id), "dd 'de' MMMM, yyyy", { locale: es });
                      } catch(e) {}

                      return (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.id}</strong>
                            <div style={{fontSize: '0.8rem', color: '#666'}}>{formattedDate}</div>
                          </td>
                          <td>
                            <span className={styles.wordBadge}>{item.word}</span>
                          </td>
                          <td>
                            <button 
                              className={styles.deleteBtn}
                              onClick={() => deleteMutation.mutate(item.id)}
                              disabled={deleteMutation.isPending}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminWordlePage;
