import React, { useState, useEffect } from 'react';
import Button from '../../common/Button';
import { getOrganizableEvents, saveOrganizableEvent, deleteOrganizableEvent } from '../../../services/fechasImportantes';
import styles from './fechasStyles.module.css';

const INITIAL_FORM = {
  title: '',
  reason: '',
  startDate: '',
  endDate: '',
  type: 'discount',
  targetType: 'all',
  targetValue: '',
  rewardValue: '',
  landingPageUrl: ''
};

const EventosView = () => {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    fetchEventos();
  }, []);

  const fetchEventos = async () => {
    setLoading(true);
    const data = await getOrganizableEvents();
    setEventos(data);
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...form,
        rewardValue: Number(form.rewardValue),
        // Convertir dates strings locales a ISO strings simulando Timestamps
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      };
      
      const result = await saveOrganizableEvent(dataToSave);
      setEventos([...eventos, result]);
      setForm(INITIAL_FORM);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteOrganizableEvent(id);
      setEventos(eventos.filter(e => e.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <div>
          <h2>Eventos Organizables</h2>
          <p>Crea campañas que aplican descuentos o regalan monedas extra basadas en condiciones específicas.</p>
        </div>
      </div>

      <form className={styles.addForm} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }} onSubmit={handleSave}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Título de Campaña *</label>
          <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Razón (Ej. Día del Padre)</label>
          <input type="text" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Fecha de Inicio *</label>
          <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} required />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Fecha de Fin *</label>
          <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} required />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Tipo de Evento *</label>
          <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} required>
            <option value="discount">Descuento (%)</option>
            <option value="extra_coins">Monedas Extra</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
            <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Aplica a (Target) *</label>
            <select value={form.targetType} onChange={e => setForm({...form, targetType: e.target.value})} required>
              <option value="all">Toda la Tienda</option>
              <option value="category">Categoría Específica</option>
              <option value="brand">Marca Específica</option>
              <option value="tag">Etiqueta</option>
              <option value="product">Un Producto (ID)</option>
            </select>
          </div>
          {form.targetType !== 'all' && (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
              <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Valor del Target *</label>
              <input type="text" placeholder="Ej. regalos-romanticos" value={form.targetValue} onChange={e => setForm({...form, targetValue: e.target.value})} required={form.targetType !== 'all'} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Valor del Premio (% o Monedas) *</label>
          <input type="number" value={form.rewardValue} onChange={e => setForm({...form, rewardValue: e.target.value})} required />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Landing Page URL (Opcional)</label>
          <input type="text" placeholder="/url-personalizada" value={form.landingPageUrl} onChange={e => setForm({...form, landingPageUrl: e.target.value})} />
        </div>

        <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
          <Button type="submit" style={{ width: '100%' }}>Crear Evento</Button>
        </div>
      </form>

      {loading ? (
        <p>Cargando eventos...</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Título</th>
              <th>Tipo</th>
              <th>Target</th>
              <th>Premio</th>
              <th>Vigencia</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map(e => (
              <tr key={e.id}>
                <td style={{ fontWeight: 'bold' }}>{e.title}<br/><span style={{fontWeight: 'normal', color: '#64748b', fontSize:'0.8rem'}}>{e.reason}</span></td>
                <td><span className={styles.badge}>{e.type === 'discount' ? 'Descuento' : 'Monedas'}</span></td>
                <td>{e.targetType === 'all' ? 'Toda la tienda' : `${e.targetType}: ${e.targetValue}`}</td>
                <td>{e.type === 'discount' ? `${e.rewardValue}%` : `+${e.rewardValue} 💰`}</td>
                <td style={{ fontSize: '0.875rem' }}>
                  {e.startDate ? new Date(e.startDate).toLocaleDateString() : ''} - 
                  {e.endDate ? new Date(e.endDate).toLocaleDateString() : ''}
                </td>
                <td>
                  <button onClick={() => handleDelete(e.id)} className={styles.deleteBtn}>Eliminar</button>
                </td>
              </tr>
            ))}
            {eventos.length === 0 && (
              <tr>
                <td colSpan="6" className={styles.empty}>No hay eventos organizables activos.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default EventosView;
