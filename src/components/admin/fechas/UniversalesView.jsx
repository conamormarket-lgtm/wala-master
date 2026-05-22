import React, { useState, useEffect } from 'react';
import Button from '../../common/Button';
import { getUniversalDates, addUniversalDate, deleteUniversalDate } from '../../../services/fechasImportantes';
import styles from './fechasStyles.module.css';

const UniversalesView = () => {
  const [universales, setUniversales] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newDateName, setNewDateName] = useState('');
  const [newDateDay, setNewDateDay] = useState('');
  const [newDateMonth, setNewDateMonth] = useState('');

  useEffect(() => {
    fetchUniversales();
  }, []);

  const fetchUniversales = async () => {
    setLoading(true);
    const data = await getUniversalDates();
    if (data.length === 0) {
      setUniversales([
        { id: '1', name: 'San Valentín', day: 14, month: 2 },
        { id: '2', name: 'Día de la Madre', day: 10, month: 5 },
        { id: '3', name: 'Día del Padre', day: 15, month: 6 },
        { id: '4', name: 'Navidad', day: 25, month: 12 },
      ]);
    } else {
      setUniversales(data);
    }
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newDateName || !newDateDay || !newDateMonth) return;
    
    try {
      const data = {
        name: newDateName,
        day: parseInt(newDateDay),
        month: parseInt(newDateMonth)
      };
      const result = await addUniversalDate(data);
      setUniversales([...universales, result]);
      setNewDateName('');
      setNewDateDay('');
      setNewDateMonth('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    if (id.length < 5) { // mockup ids
      setUniversales(universales.filter(u => u.id !== id));
      return;
    }
    try {
      await deleteUniversalDate(id);
      setUniversales(universales.filter(u => u.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <div>
          <h2>Fechas Universales</h2>
          <p>Configura los eventos globales que aplican a todos los usuarios de la plataforma.</p>
        </div>
      </div>
      
      <form className={styles.addForm} onSubmit={handleAdd}>
        <input 
          type="text" 
          placeholder="Nombre (ej. San Valentín)" 
          value={newDateName} 
          onChange={e => setNewDateName(e.target.value)} 
          required 
        />
        <input 
          type="number" 
          placeholder="Día (1-31)" 
          min="1" max="31"
          value={newDateDay} 
          onChange={e => setNewDateDay(e.target.value)} 
          required 
        />
        <input 
          type="number" 
          placeholder="Mes (1-12)" 
          min="1" max="12"
          value={newDateMonth} 
          onChange={e => setNewDateMonth(e.target.value)} 
          required 
        />
        <Button type="submit">Agregar Fecha</Button>
      </form>

      {loading ? (
        <p>Cargando fechas...</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Día</th>
              <th>Mes</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {universales.map(u => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.day}</td>
                <td>{u.month}</td>
                <td>
                  <button onClick={() => handleDelete(u.id)} className={styles.deleteBtn}>Eliminar</button>
                </td>
              </tr>
            ))}
            {universales.length === 0 && (
              <tr>
                <td colSpan="4" className={styles.empty}>No hay fechas registradas.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UniversalesView;
