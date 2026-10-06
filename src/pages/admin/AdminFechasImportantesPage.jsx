import React, { useState } from 'react';
import styles from './AdminFechasImportantesPage.module.css';

// Componentes secundarios a implementar
import GlobalCalendarView from '../../components/admin/fechas/GlobalCalendarView';
import FechasFestivasView from '../../components/admin/fechas/FechasFestivasView';
import UsuariosView from '../../components/admin/fechas/UsuariosView';

const AdminFechasImportantesPage = () => {
  const [activeView, setActiveView] = useState('calendario'); // 'calendario', 'festivas', 'usuarios'

  const renderContent = () => {
    switch (activeView) {
      case 'calendario':
        return <GlobalCalendarView onChangeView={setActiveView} />;
      case 'festivas':
        return <FechasFestivasView />;
      case 'usuarios':
        return <UsuariosView />;
      default:
        return <GlobalCalendarView onChangeView={setActiveView} />;
    }
  };

  return (
    <div className={styles.layout}>
      {/* Drawer / Sidebar Interno */}
      <aside className={styles.drawer}>
        <h2 className={styles.drawerTitle}>Campañas y Fechas</h2>
        <nav className={styles.drawerNav}>
          <button 
            className={`${styles.drawerBtn} ${activeView === 'calendario' ? styles.active : ''}`}
            onClick={() => setActiveView('calendario')}
          >
            Calendario Global
          </button>
          <button 
            className={`${styles.drawerBtn} ${activeView === 'festivas' ? styles.active : ''}`}
            onClick={() => setActiveView('festivas')}
          >
            Avisos y fechas festivas
          </button>
          <button 
            className={`${styles.drawerBtn} ${activeView === 'usuarios' ? styles.active : ''}`}
            onClick={() => setActiveView('usuarios')}
          >
            Fechas de Usuarios
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {renderContent()}
      </main>
    </div>
  );
};

export default AdminFechasImportantesPage;
