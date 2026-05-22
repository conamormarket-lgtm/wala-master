import React, { useState, useEffect } from 'react';
import { addDays, isWithinInterval, startOfDay, addWeeks, startOfMonth, addMonths, endOfMonth, startOfWeek, endOfWeek, parseISO, setYear } from 'date-fns';
import { getUserDates } from '../../../services/fechasImportantes';
import Button from '../../common/Button';
import PackageCreatorModal from './PackageCreatorModal';
import styles from './fechasStyles.module.css';

const ITEMS_PER_PAGE = 10;

const UsuariosView = () => {
  const [allDates, setAllDates] = useState([]);
  const [filteredDates, setFilteredDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'tomorrow', 'next_week', 'next_month'
  
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getUserDates();
      setAllDates(data);
      setFilteredDates(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  const applyFilter = (type) => {
    setFilter(type);
    setCurrentPage(1); // Reset page on filter change
    if (type === 'all') {
      setFilteredDates(allDates);
      return;
    }

    const today = startOfDay(new Date());
    const currentYear = today.getFullYear();
    
    const filterByInterval = (start, end) => {
      return allDates.filter(d => {
        if (!d.eventDate) return false;
        // Parse date and normalize to current year to see if birthday is upcoming
        let parsed = parseISO(d.eventDate);
        parsed = setYear(parsed, currentYear);
        
        // if the date already passed this year, check next year
        if (parsed.getTime() < today.getTime()) {
          parsed = setYear(parsed, currentYear + 1);
        }

        return isWithinInterval(parsed, { start, end });
      });
    };

    if (type === 'tomorrow') {
      const tomorrow = addDays(today, 1);
      setFilteredDates(filterByInterval(today, tomorrow));
    } else if (type === 'next_week') {
      const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
      const nextWeekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
      setFilteredDates(filterByInterval(nextWeekStart, nextWeekEnd));
    } else if (type === 'next_month') {
      const nextMonthStart = startOfMonth(addMonths(today, 1));
      const nextMonthEnd = endOfMonth(nextMonthStart);
      setFilteredDates(filterByInterval(nextMonthStart, nextMonthEnd));
    }
  };

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredDates.length / itemsPerPage));
  const currentItems = filteredDates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const handlePageChange = (e) => {
    const page = Number(e.target.value);
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleCrearPaquete = (recipientData) => {
    setSelectedRecipient(recipientData);
    setIsPackageModalOpen(true);
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <div>
          <h2>Fechas Importantes de Usuarios</h2>
          <p>Consolidado y filtrado de las fechas registradas por los usuarios (Cumpleaños, Aniversarios).</p>
        </div>
      </div>

      <div className={styles.filterBar} style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => applyFilter('all')}
          >
            Todas
          </button>
          <button 
            className={`${styles.filterBtn} ${filter === 'tomorrow' ? styles.active : ''}`}
            onClick={() => applyFilter('tomorrow')}
          >
            Próximas 24h
          </button>
          <button 
            className={`${styles.filterBtn} ${filter === 'next_week' ? styles.active : ''}`}
            onClick={() => applyFilter('next_week')}
          >
            Próxima Semana
          </button>
          <button 
            className={`${styles.filterBtn} ${filter === 'next_month' ? styles.active : ''}`}
            onClick={() => applyFilter('next_month')}
          >
            Próximo Mes
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#475569' }}>
          <label>Mostrar:</label>
          <select 
            value={itemsPerPage} 
            onChange={handleItemsPerPageChange}
            style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p>Consultando base de datos de usuarios...</p>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Usuario (Email)</th>
                <th>Destinatario</th>
                <th>Relación</th>
                <th>Evento</th>
                <th>Fecha Original</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((d, index) => (
                <tr key={index}>
                  <td>{d.userEmail}</td>
                  <td>{d.recipientName}</td>
                  <td>{d.recipientRole}</td>
                  <td><span className={styles.badge}>{d.eventType}</span></td>
                  <td>{d.eventDate}</td>
                  <td>
                    <Button variant="primary" onClick={() => handleCrearPaquete(d)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                      Crear Paquete
                    </Button>
                  </td>
                </tr>
              ))}
              {currentItems.length === 0 && (
                <tr>
                  <td colSpan="5" className={styles.empty}>No hay fechas que coincidan con el filtro.</td>
                </tr>
              )}
            </tbody>
          </table>
          
          {/* Controles de Paginación */}
          {filteredDates.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
              <Button 
                variant="secondary" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Anterior
              </Button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                <span>Página</span>
                <select 
                  value={currentPage} 
                  onChange={handlePageChange}
                  style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                    <option key={pageNum} value={pageNum}>{pageNum}</option>
                  ))}
                </select>
                <span>de {totalPages}</span>
              </div>

              <Button 
                variant="secondary" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}

      {isPackageModalOpen && selectedRecipient && (
        <PackageCreatorModal 
          recipientData={selectedRecipient}
          onClose={() => setIsPackageModalOpen(false)}
        />
      )}
    </div>
  );
};

export default UsuariosView;
