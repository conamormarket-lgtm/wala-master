import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase/config';
import Button from '../../../components/common/Button';
import styles from './AdminFechasImportantesPage.module.css';

const AdminFechasImportantesPage = () => {
  const [activeTab, setActiveTab] = useState('universales');
  
  // Estado para fechas universales
  const [universales, setUniversales] = useState([]);
  const [loadingUniversales, setLoadingUniversales] = useState(true);
  
  // Estado para fechas de usuarios (encuesta)
  const [userDates, setUserDates] = useState([]);
  const [loadingUserDates, setLoadingUserDates] = useState(true);

  // Formulario para nueva fecha universal
  const [newDateName, setNewDateName] = useState('');
  const [newDateDay, setNewDateDay] = useState('');
  const [newDateMonth, setNewDateMonth] = useState('');

  useEffect(() => {
    fetchUniversales();
    fetchUserDates();
  }, []);

  const fetchUniversales = async () => {
    setLoadingUniversales(true);
    try {
      const snap = await getDocs(collection(db, 'universal_dates'));
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Si está vacía la colección, ponemos unos de prueba para el mockup
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
    } catch (error) {
      console.error('Error fetching universales:', error);
    }
    setLoadingUniversales(false);
  };

  const fetchUserDates = async () => {
    setLoadingUserDates(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const dates = [];
      
      usersSnap.forEach(userDoc => {
        const userData = userDoc.data();
        if (userData.giftRecipients && Array.isArray(userData.giftRecipients)) {
          userData.giftRecipients.forEach(recipient => {
            if (recipient.events && Array.isArray(recipient.events)) {
              recipient.events.forEach(event => {
                dates.push({
                  userId: userDoc.id,
                  userEmail: userData.email || 'Sin correo',
                  recipientName: recipient.name || 'Sin nombre',
                  recipientRole: recipient.roleDisplay || 'Otro',
                  eventType: event.type,
                  eventDate: event.date // formato YYYY-MM-DD
                });
              });
            }
          });
        }
      });
      
      // Ordenar por fecha más próxima
      dates.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
      setUserDates(dates);
    } catch (error) {
      console.error('Error fetching user dates:', error);
    }
    setLoadingUserDates(false);
  };

  const handleAddUniversal = async (e) => {
    e.preventDefault();
    if (!newDateName || !newDateDay || !newDateMonth) return;
    
    try {
      const docRef = await addDoc(collection(db, 'universal_dates'), {
        name: newDateName,
        day: parseInt(newDateDay),
        month: parseInt(newDateMonth)
      });
      setUniversales([...universales, { id: docRef.id, name: newDateName, day: parseInt(newDateDay), month: parseInt(newDateMonth) }]);
      setNewDateName('');
      setNewDateDay('');
      setNewDateMonth('');
    } catch (error) {
      console.error('Error adding universal date:', error);
    }
  };

  const handleDeleteUniversal = async (id) => {
    if (id.length < 5) {
      setUniversales(universales.filter(u => u.id !== id));
      return;
    }
    try {
      await deleteDoc(doc(db, 'universal_dates', id));
      setUniversales(universales.filter(u => u.id !== id));
    } catch (error) {
      console.error('Error deleting date:', error);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Gestión de Fechas Importantes</h1>
      <p className={styles.subtitle}>
        Administra las fechas universales (campañas globales) y visualiza las fechas que tus usuarios han registrado en la encuesta de regalos.
      </p>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'universales' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('universales')}
        >
          Fechas Universales
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'usuarios' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('usuarios')}
        >
          Fechas de Usuarios (Encuestas)
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'universales' && (
          <div className={styles.tabContent}>
            <div className={styles.header}>
              <h2>Calendario Global</h2>
              <p>Estas fechas aplican a todos los usuarios. El sistema sugerirá regalos para estos días.</p>
            </div>
            
            <form className={styles.addForm} onSubmit={handleAddUniversal}>
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

            {loadingUniversales ? (
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
                        <button onClick={() => handleDeleteUniversal(u.id)} className={styles.deleteBtn}>Eliminar</button>
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
        )}

        {activeTab === 'usuarios' && (
          <div className={styles.tabContent}>
             <div className={styles.header}>
              <h2>Fechas Importantes de Usuarios</h2>
              <p>Consolidado de todas las fechas (cumpleaños, aniversarios, etc.) registradas en la encuesta.</p>
            </div>

            {loadingUserDates ? (
              <p>Consultando base de datos de usuarios...</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Usuario (Email)</th>
                    <th>Destinatario</th>
                    <th>Relación</th>
                    <th>Tipo de Evento</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {userDates.map((d, index) => (
                    <tr key={index}>
                      <td>{d.userEmail}</td>
                      <td>{d.recipientName}</td>
                      <td>{d.recipientRole}</td>
                      <td><span className={styles.badge}>{d.eventType}</span></td>
                      <td>{d.eventDate}</td>
                    </tr>
                  ))}
                  {userDates.length === 0 && (
                    <tr>
                      <td colSpan="5" className={styles.empty}>No hay usuarios con fechas registradas en su perfil.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFechasImportantesPage;
