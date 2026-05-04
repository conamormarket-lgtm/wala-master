import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../../services/firebase/config';
import { setDocument } from '../../services/firebase/firestore';
import { getInventoryLogs } from '../../services/inventoryLogs';
import Button from '../../components/common/Button';
import styles from './AdminBackups.module.css';

const AdminBackups = () => {
  const [logs, setLogs] = useState([]);
  const [inventoryLogs, setInventoryLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);
  const [activeTab, setActiveTab] = useState('design'); // 'design' | 'inventory'

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'storeConfigLogs'), orderBy('timestamp', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data);

      const invLogs = await getInventoryLogs();
      setInventoryLogs(invLogs);
    } catch (error) {
      console.error("Error fetching logs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const downloadCSV = () => {
    if (inventoryLogs.length === 0) return;
    const headers = ['Fecha', 'Hora', 'Usuario', 'Producto', 'Stock Anterior', 'Stock Nuevo'];
    const rows = inventoryLogs.map(log => {
      const d = new Date(log.timestamp);
      return [
        d.toLocaleDateString(),
        d.toLocaleTimeString(),
        log.userEmail || 'Desconocido',
        `"${log.productName || 'Producto'}"`,
        log.oldStock,
        log.newStock
      ].join(',');
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventario_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestore = async (log) => {
    if (!window.confirm('¿Estás seguro de que deseas restaurar esta versión? Esto sobreescribirá el diseño actual de la tienda.')) {
      return;
    }

    setRestoringId(log.id);
    const { error } = await setDocument('storeConfig', 'homePage', log.config);
    setRestoringId(null);

    if (error) {
      alert('Error al restaurar: ' + error);
    } else {
      alert('Versión restaurada con éxito. Ve a "Vista Tienda" para ver los cambios.');
    }
  };

  return (
    <div className={styles.container}>
      <h2>Historial y Backups</h2>
      <p>Aquí puedes ver el historial de cambios del diseño de la tienda y del inventario.</p>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <Button 
          variant={activeTab === 'design' ? 'primary' : 'secondary'} 
          onClick={() => setActiveTab('design')}
        >
          Diseño de Tienda
        </Button>
        <Button 
          variant={activeTab === 'inventory' ? 'primary' : 'secondary'} 
          onClick={() => setActiveTab('inventory')}
        >
          Registros de Inventario
        </Button>
      </div>

      {loading ? (
        <p>Cargando registros...</p>
      ) : activeTab === 'design' ? (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Usuario</th>
                <th>Descripción</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const d = new Date(log.timestamp);
                return (
                  <tr key={log.id}>
                    <td>
                      {d.toLocaleDateString()} a las {d.toLocaleTimeString()}
                    </td>
                    <td>{log.user || 'Admin'}</td>
                    <td>{log.description || 'Guardado'}</td>
                    <td>
                      <Button 
                        variant="secondary" 
                        onClick={() => handleRestore(log)}
                        disabled={restoringId === log.id}
                      >
                        {restoringId === log.id ? 'Restaurando...' : 'Restaurar'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                    No hay backups guardados aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
            <Button variant="primary" onClick={downloadCSV}>Descargar CSV</Button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Usuario</th>
                <th>Producto</th>
                <th>Cambio de Stock</th>
              </tr>
            </thead>
            <tbody>
              {inventoryLogs.map(log => {
                const d = new Date(log.timestamp);
                const increased = log.newStock > log.oldStock;
                return (
                  <tr key={log.id}>
                    <td>
                      {d.toLocaleDateString()} a las {d.toLocaleTimeString()}
                    </td>
                    <td>{log.userEmail || 'Desconocido'}</td>
                    <td>{log.productName}</td>
                    <td>
                      <span style={{ color: increased ? '#059669' : '#dc2626', fontWeight: 'bold' }}>
                        {log.oldStock} → {log.newStock}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {inventoryLogs.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                    No hay registros de cambios de inventario.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminBackups;
