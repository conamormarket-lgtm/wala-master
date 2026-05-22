import React, { useState, useEffect } from 'react';
import { getRuletaPrizes, saveRuletaPrize, deleteRuletaPrize } from '../../services/firebase/ruleta';
import { useGlobalToast } from '../../contexts/ToastContext';

const AdminRuletaPage = () => {
  const { addToast } = useGlobalToast();
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPrize, setEditingPrize] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'Monedas',
    probability: 0,
    amount: 0,
  });

  const loadPrizes = async () => {
    setLoading(true);
    const data = await getRuletaPrizes();
    setPrizes(data);
    setLoading(false);
  };

  useEffect(() => {
    loadPrizes();
  }, []);

  const totalProbability = prizes.reduce((sum, p) => sum + Number(p.probability || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || formData.probability <= 0) {
      addToast('Nombre y probabilidad son obligatorios', 'error');
      return;
    }

    const res = await saveRuletaPrize(formData, editingPrize?.id);
    if (res.success) {
      addToast('Premio guardado correctamente', 'success');
      setEditingPrize(null);
      setFormData({ name: '', type: 'Monedas', probability: 0, amount: 0 });
      loadPrizes();
    } else {
      addToast('Error al guardar: ' + res.error?.message, 'error');
    }
  };

  const handleEdit = (prize) => {
    setEditingPrize(prize);
    setFormData({
      name: prize.name,
      type: prize.type,
      probability: prize.probability,
      amount: prize.amount || 0,
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este premio?')) {
      const res = await deleteRuletaPrize(id);
      if (res.success) {
        addToast('Premio eliminado', 'success');
        loadPrizes();
      }
    }
  };

  if (loading) return <div>Cargando premios...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Administrar Ruleta Semanal</h1>
      
      <div style={{ background: totalProbability === 100 ? '#dcfce7' : '#fee2e2', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <strong>Suma de probabilidades: {totalProbability}%</strong>
        {totalProbability !== 100 && <span style={{color: 'red', marginLeft: '1rem'}}>¡Atención! Las probabilidades deben sumar exactamente 100% para evitar comportamientos inesperados.</span>}
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h2>{editingPrize ? 'Editar Premio' : 'Nuevo Premio'}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <label>
              Nombre del premio (Ej. 10 Kapicoins)
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required style={{width: '100%', padding: '0.5rem', marginTop: '0.25rem'}} />
            </label>
            
            <label>
              Tipo de premio
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} style={{width: '100%', padding: '0.5rem', marginTop: '0.25rem'}}>
                <option value="Monedas">Monedas (Kapicoins)</option>
                <option value="Accesorio">Accesorio (Mascota)</option>
                <option value="Descuento">Descuento (%)</option>
                <option value="Beneficio">Beneficio (Ej. Envío gratis)</option>
                <option value="Producto">Producto (Caja Gratis)</option>
              </select>
            </label>

            {formData.type === 'Monedas' && (
              <label>
                Cantidad de Kapicoins
                <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} style={{width: '100%', padding: '0.5rem', marginTop: '0.25rem'}} />
              </label>
            )}

            <label>
              Probabilidad (%)
              <input type="number" step="0.1" value={formData.probability} onChange={e => setFormData({...formData, probability: Number(e.target.value)})} required style={{width: '100%', padding: '0.5rem', marginTop: '0.25rem'}} />
            </label>

            <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
              <button type="submit" style={{padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Guardar</button>
              {editingPrize && (
                <button type="button" onClick={() => { setEditingPrize(null); setFormData({name:'', type:'Monedas', probability:0, amount:0}); }} style={{padding: '0.5rem 1rem', background: '#9ca3af', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Cancelar</button>
              )}
            </div>
          </form>
        </div>

        <div style={{ flex: 2, minWidth: '300px' }}>
          <h2>Premios Actuales</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Nombre</th>
                <th style={{ padding: '0.75rem' }}>Tipo</th>
                <th style={{ padding: '0.75rem' }}>Valor</th>
                <th style={{ padding: '0.75rem' }}>Probabilidad</th>
                <th style={{ padding: '0.75rem' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {prizes.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem' }}>{p.name}</td>
                  <td style={{ padding: '0.75rem' }}>{p.type}</td>
                  <td style={{ padding: '0.75rem' }}>{p.type === 'Monedas' ? p.amount : '-'}</td>
                  <td style={{ padding: '0.75rem' }}>{p.probability}%</td>
                  <td style={{ padding: '0.75rem' }}>
                    <button onClick={() => handleEdit(p)} style={{marginRight: '0.5rem', cursor: 'pointer'}}>Editar</button>
                    <button onClick={() => handleDelete(p.id)} style={{color: 'red', cursor: 'pointer'}}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminRuletaPage;
