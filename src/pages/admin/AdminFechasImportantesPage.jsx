import React, { useState } from 'react';
import styles from './AdminFechasImportantesPage.module.css';

// Componentes secundarios a implementar
import GlobalCalendarView from '../../components/admin/fechas/GlobalCalendarView';
import UniversalesView from '../../components/admin/fechas/UniversalesView';
import UsuariosView from '../../components/admin/fechas/UsuariosView';
import EventosView from '../../components/admin/fechas/EventosView';

const AdminFechasImportantesPage = () => {
  const [activeView, setActiveView] = useState('calendario'); // 'calendario', 'universales', 'usuarios', 'eventos'

  const renderContent = () => {
    switch (activeView) {
      case 'calendario':
        return <GlobalCalendarView onChangeView={setActiveView} />;
      case 'universales':
        return <UniversalesView />;
      case 'usuarios':
        return <UsuariosView />;
      case 'eventos':
        return <EventosView />;
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
            className={`${styles.drawerBtn} ${activeView === 'universales' ? styles.active : ''}`}
            onClick={() => setActiveView('universales')}
          >
            Fechas Universales
          </button>
          <button 
            className={`${styles.drawerBtn} ${activeView === 'usuarios' ? styles.active : ''}`}
            onClick={() => setActiveView('usuarios')}
          >
            Fechas de Usuarios
          </button>
          <button 
            className={`${styles.drawerBtn} ${activeView === 'eventos' ? styles.active : ''}`}
            onClick={() => setActiveView('eventos')}
          >
            Eventos Organizables
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
