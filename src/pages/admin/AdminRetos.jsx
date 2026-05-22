import React, { useState, useEffect } from 'react';
import { getCollection, createDocument, updateDocument, deleteDocument, setDocument, getDocument } from '../../services/firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import styles from './AdminRetos.module.css';

const AdminRetos = () => {
  const [activeTab, setActiveTab] = useState('catalog');
  const [challenges, setChallenges] = useState([]);
  const [evidences, setEvidences] = useState([]);
  const [activeGlobalChallenge, setActiveGlobalChallenge] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '', description: '', actionType: '', goal: 1, rewardCoins: 10, rewardType: 'main'
  });
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    fetchChallenges();
    fetchActiveChallenge();
    fetchEvidences();
  }, []);

  const fetchChallenges = async () => {
    const { data } = await getCollection('weeklyChallenges');
    setChallenges(data || []);
  };

  const fetchActiveChallenge = async () => {
    const { data } = await getDocument('globals', 'activeChallenge');
    setActiveGlobalChallenge(data || null);
  };

  const fetchEvidences = async () => {
    const { data } = await getCollection('challengeEvidences', [{ field: 'status', operator: '==', value: 'pending' }]);
    setEvidences(data || []);
  };

  const handleSaveChallenge = async (e) => {
    e.preventDefault();
    if (editId) {
      await updateDocument('weeklyChallenges', editId, formData);
    } else {
      await createDocument('weeklyChallenges', formData);
    }
    setFormData({ title: '', description: '', actionType: '', goal: 1, rewardCoins: 10, rewardType: 'main' });
    setEditId(null);
    fetchChallenges();
  };

  const handleEdit = (c) => {
    setFormData(c);
    setEditId(c.id);
  };

  const handleDelete = async (id) => {
    if(window.confirm('¿Eliminar reto?')) {
      await deleteDocument('weeklyChallenges', id);
      fetchChallenges();
    }
  };

  const handleSetActive = async (c) => {
    if(window.confirm(`¿Activar "${c.title}" como el reto de esta semana para todos los usuarios?`)) {
      await setDocument('globals', 'activeChallenge', {
        challengeId: c.id,
        title: c.title,
        description: c.description,
        actionType: c.actionType,
        goal: c.goal,
        rewardCoins: c.rewardCoins,
        rewardType: c.rewardType,
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
      fetchActiveChallenge();
      alert('Reto activado');
    }
  };

  const handleProcessEvidence = async (evidenceId, action, rewardCoins, rewardType) => {
    try {
      const functions = getFunctions();
      const approveEvidence = httpsCallable(functions, 'approveChallengeEvidence');
      await approveEvidence({ evidenceId, action, rewardCoins, rewardType });
      alert(`Evidencia ${action === 'approve' ? 'aprobada' : 'rechazada'}`);
      fetchEvidences();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sistema de Retos Semanales</h1>
        <p>Administra los retos semanales y aprueba evidencias de los usuarios.</p>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'catalog' ? styles.activeTab : ''}`} onClick={() => setActiveTab('catalog')}>Catálogo de Retos</button>
        <button className={`${styles.tab} ${activeTab === 'moderation' ? styles.activeTab : ''}`} onClick={() => setActiveTab('moderation')}>Moderación de Evidencias ({evidences.length})</button>
        <button className={`${styles.tab} ${activeTab === 'current' ? styles.activeTab : ''}`} onClick={() => setActiveTab('current')}>Reto Activo</button>
      </div>

      {activeTab === 'catalog' && (
        <>
          <div className={styles.card}>
            <h3>{editId ? 'Editar Reto' : 'Crear Nuevo Reto'}</h3>
            <form onSubmit={handleSaveChallenge}>
              <div className={styles.formGrid}>
                <div className={styles.inputGroup}>
                  <label>Título</label>
                  <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ej: Agrega 3 productos" />
                </div>
                <div className={styles.inputGroup}>
                  <label>Tipo de Acción (ID)</label>
                  <input required value={formData.actionType} onChange={e => setFormData({...formData, actionType: e.target.value})} placeholder="Ej: add_wishlist" />
                </div>
                <div className={styles.inputGroup}>
                  <label>Meta (Cantidad)</label>
                  <input required type="number" value={formData.goal} onChange={e => setFormData({...formData, goal: Number(e.target.value)})} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Tipo de Recompensa</label>
                  <select value={formData.rewardType} onChange={e => setFormData({...formData, rewardType: e.target.value})}>
                    <option value="main">Wala Coins (Principal)</option>
                    <option value="kapi_double_3d">Doble KapiCoins x 3 días</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>Monedas de Recompensa</label>
                  <input required type="number" value={formData.rewardCoins} onChange={e => setFormData({...formData, rewardCoins: Number(e.target.value)})} disabled={formData.rewardType === 'kapi_double_3d'} />
                </div>
              </div>
              <div className={styles.inputGroup} style={{marginBottom: 16}}>
                <label>Descripción corta</label>
                <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <button type="submit" className={styles.btnPrimary}>{editId ? 'Actualizar' : 'Guardar'}</button>
              {editId && <button type="button" onClick={() => {setEditId(null); setFormData({title:'', description:'', actionType:'', goal:1, rewardCoins:10, rewardType:'main'})}} style={{marginLeft: 10}}>Cancelar</button>}
            </form>
          </div>

          <div className={styles.card}>
            <div className={styles.tableContainer}>
              <table>
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Acción</th>
                    <th>Meta</th>
                    <th>Recompensa</th>
                    <th>Opciones</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map(c => (
                    <tr key={c.id}>
                      <td>{c.title}</td>
                      <td>{c.actionType}</td>
                      <td>{c.goal}</td>
                      <td>{c.rewardType === 'main' ? `${c.rewardCoins} WalaCoins` : 'Doble KapiCoins'}</td>
                      <td>
                        <button className={styles.actionBtn} onClick={() => handleEdit(c)}>✏️</button>
                        <button className={styles.actionBtn} onClick={() => handleDelete(c.id)}>🗑️</button>
                        <button className={styles.actionBtn} onClick={() => handleSetActive(c)} title="Forzar como reto activo">🚀 Activar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'moderation' && (
        <div className={styles.card}>
          <h3>Evidencias Pendientes</h3>
          {evidences.length === 0 ? <p>No hay evidencias pendientes de revisión.</p> : (
            <div className={styles.tableContainer}>
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Reto (ID)</th>
                    <th>Evidencia</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {evidences.map(ev => {
                    const challengeRef = challenges.find(c => c.id === ev.challengeId) || activeGlobalChallenge;
                    const rewCoins = challengeRef ? challengeRef.rewardCoins : 0;
                    const rewType = challengeRef ? challengeRef.rewardType : 'main';

                    return (
                      <tr key={ev.id}>
                        <td>{ev.userName} ({ev.userId})</td>
                        <td>{ev.challengeId}</td>
                        <td>
                          {ev.evidenceType === 'image' ? (
                            <img src={ev.evidenceUrl} alt="Evidencia" className={styles.evidenceImage} onClick={() => window.open(ev.evidenceUrl)} />
                          ) : (
                            <a href={ev.evidenceUrl} target="_blank" rel="noreferrer">Ver Link</a>
                          )}
                        </td>
                        <td>{new Date(ev.submittedAt?.toDate() || Date.now()).toLocaleDateString()}</td>
                        <td>
                          <button className={`${styles.actionBtn} ${styles.approveBtn}`} onClick={() => handleProcessEvidence(ev.id, 'approve', rewCoins, rewType)}>✅ Aprobar</button>
                          <button className={`${styles.actionBtn} ${styles.rejectBtn}`} onClick={() => handleProcessEvidence(ev.id, 'reject', 0, 'main')}>❌ Rechazar</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'current' && (
        <div className={styles.card}>
          <h3>Reto Activo (Global)</h3>
          {activeGlobalChallenge ? (
            <div>
              <p><strong>Título:</strong> {activeGlobalChallenge.title}</p>
              <p><strong>Descripción:</strong> {activeGlobalChallenge.description}</p>
              <p><strong>Acción:</strong> {activeGlobalChallenge.actionType} (Meta: {activeGlobalChallenge.goal})</p>
              <p><strong>Recompensa:</strong> {activeGlobalChallenge.rewardType === 'main' ? `${activeGlobalChallenge.rewardCoins} WalaCoins` : 'Doble KapiCoins'}</p>
              <p><strong>Inició:</strong> {new Date(activeGlobalChallenge.startedAt).toLocaleString()}</p>
              <p><strong>Expira:</strong> {new Date(activeGlobalChallenge.expiresAt).toLocaleString()}</p>
              <button className={styles.btnPrimary} style={{marginTop: 16}} onClick={() => setActiveTab('catalog')}>Cambiar Reto (Desde Catálogo)</button>
            </div>
          ) : (
            <p>No hay ningún reto activo actualmente.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminRetos;
