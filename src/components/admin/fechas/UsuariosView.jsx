import React, { useState, useEffect, useCallback } from 'react';
import { addDays, isWithinInterval, startOfDay, addWeeks, startOfMonth, addMonths, endOfMonth, startOfWeek, endOfWeek, parseISO, setYear } from 'date-fns';
import { getUserDates, getSuggestedPackages, updateSuggestedPackage, deleteSuggestedPackage } from '../../../services/fechasImportantes';
import Button from '../../common/Button';
import PackageCreatorModal from './PackageCreatorModal';
import { ChevronRight, Plus, Edit2, Copy, CheckCircle, Trash2 } from 'lucide-react';
import styles from './fechasStyles.module.css';

const UsuariosView = () => {
  const [allDates, setAllDates] = useState([]);
  const [filteredDates, setFilteredDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  // Packages state
  const [packages, setPackages] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});

  // Modal state
  const [modalConfig, setModalConfig] = useState(null); // { recipientData, existingPackage?, reuseProducts?, isFirstPackage? }
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [datesData, packagesData] = await Promise.all([
        getUserDates(),
        getSuggestedPackages()
      ]);
      setAllDates(datesData);
      setFilteredDates(datesData);
      setPackages(packagesData);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Helper: build a row key from a date entry
  const getRowKey = useCallback((d) => {
    return `${d.userId}_${d.recipientId}_${d.eventType}`;
  }, []);

  // Get packages for a specific row
  const getPackagesForRow = useCallback((d) => {
    return packages.filter(p => 
      p.userId === d.userId && 
      p.recipientId === d.recipientId && 
      p.eventType === d.eventType
    );
  }, [packages]);

  const applyFilter = (type) => {
    setFilter(type);
    setCurrentPage(1);
    if (type === 'all') {
      setFilteredDates(allDates);
      return;
    }

    const today = startOfDay(new Date());
    const currentYear = today.getFullYear();
    
    const filterByInterval = (start, end) => {
      return allDates.filter(d => {
        if (!d.eventDate) return false;
        let parsed = parseISO(d.eventDate);
        parsed = setYear(parsed, currentYear);
        
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

  // Toggle expand row
  const toggleRow = (rowKey) => {
    setExpandedRows(prev => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

  // Open modal in create mode
  const handleCreatePackage = (d) => {
    const rowPackages = getPackagesForRow(d);
    setModalConfig({
      recipientData: d,
      isFirstPackage: rowPackages.length === 0,
    });
  };

  // Open modal in edit mode
  const handleEditPackage = (d, pkg) => {
    setModalConfig({
      recipientData: d,
      existingPackage: pkg,
    });
  };

  // Open modal in reuse mode
  const handleReusePackage = (d, pkg) => {
    const rowPackages = getPackagesForRow(d);
    setModalConfig({
      recipientData: d,
      reuseProducts: pkg.products,
      isFirstPackage: rowPackages.length === 0,
    });
  };

  // Select a package (deselect others for same row)
  const handleSelectPackage = async (d, pkg) => {
    const rowPackages = getPackagesForRow(d);
    
    // Deselect all others, select this one
    const updatedPackages = packages.map(p => {
      const belongsToRow = rowPackages.find(rp => rp.id === p.id);
      if (!belongsToRow) return p;
      
      if (p.id === pkg.id) {
        return { ...p, isSelected: true };
      } else {
        return { ...p, isSelected: false };
      }
    });
    
    setPackages(updatedPackages);
    
    // Persist changes
    try {
      for (const rp of rowPackages) {
        if (rp.id === pkg.id) {
          await updateSuggestedPackage(rp.id, { isSelected: true });
        } else if (rp.isSelected) {
          await updateSuggestedPackage(rp.id, { isSelected: false });
        }
      }
    } catch (e) {
      console.error('Error selecting package:', e);
    }
  };

  // Delete a package
  const handleDeletePackage = async (pkg) => {
    if (!window.confirm('¿Seguro que deseas eliminar este paquete?')) return;
    try {
      await deleteSuggestedPackage(pkg.id);
      const newPackages = packages.filter(p => p.id !== pkg.id);
      
      // If deleted package was selected and there are others, auto-select the first
      if (pkg.isSelected) {
        const siblings = newPackages.filter(p => 
          p.userId === pkg.userId && p.recipientId === pkg.recipientId && p.eventType === pkg.eventType
        );
        if (siblings.length > 0) {
          siblings[0].isSelected = true;
          await updateSuggestedPackage(siblings[0].id, { isSelected: true });
        }
      }
      
      setPackages(newPackages);
    } catch (e) {
      console.error('Error deleting package:', e);
    }
  };

  // Callback when modal saves
  const handlePackageSaved = (savedPackage) => {
    if (modalConfig?.existingPackage) {
      // Edit: replace in state
      setPackages(prev => prev.map(p => p.id === savedPackage.id ? { ...p, ...savedPackage } : p));
    } else {
      // Create/reuse: add to state
      setPackages(prev => [...prev, savedPackage]);
    }
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
                <th style={{ width: '32px' }}></th>
                <th>Usuario (Email)</th>
                <th>Destinatario</th>
                <th>Relación</th>
                <th>Evento</th>
                <th>Fecha Original</th>
                <th>Paquetes</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((d, index) => {
                const rowKey = getRowKey(d);
                const isExpanded = expandedRows[rowKey];
                const rowPackages = getPackagesForRow(d);
                const selectedPkg = rowPackages.find(p => p.isSelected);

                return (
                  <React.Fragment key={index}>
                    {/* Main row */}
                    <tr 
                      className={styles.expandableRow}
                      onClick={() => toggleRow(rowKey)}
                    >
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <span 
                          className={`${styles.expandToggle} ${isExpanded ? styles.expandToggleOpen : ''}`}
                        >
                          <ChevronRight size={16} />
                        </span>
                      </td>
                      <td>{d.userEmail}</td>
                      <td>{d.recipientName}</td>
                      <td>{d.recipientRole}</td>
                      <td><span className={styles.badge}>{d.eventType}</span></td>
                      <td>{d.eventDate}</td>
                      <td>
                        {rowPackages.length > 0 ? (
                          <span className={`${styles.packageBadge} ${selectedPkg ? styles.packageBadgeSelected : styles.packageBadgeDraft}`}>
                            {rowPackages.length} {rowPackages.length === 1 ? 'paquete' : 'paquetes'}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        <Button 
                          variant="primary" 
                          onClick={(e) => { e.stopPropagation(); handleCreatePackage(d); }} 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        >
                          <Plus size={14} style={{ marginRight: '0.25rem' }} />
                          Crear Paquete
                        </Button>
                      </td>
                    </tr>

                    {/* Expanded packages row */}
                    {isExpanded && (
                      <tr className={styles.packagesRow}>
                        <td colSpan="8">
                          <div className={styles.packagesContainer}>
                            <div className={styles.packagesHeader}>
                              <h4>Paquetes para {d.recipientName} — {d.eventType}</h4>
                            </div>

                            {rowPackages.length === 0 ? (
                              <div className={styles.emptyPackages}>
                                No hay paquetes creados para este destinatario.
                              </div>
                            ) : (
                              rowPackages.map(pkg => (
                                <div 
                                  key={pkg.id} 
                                  className={`${styles.packageCard} ${pkg.isSelected ? styles.packageCardSelected : ''}`}
                                >
                                  {/* Badge */}
                                  <span className={`${styles.packageBadge} ${pkg.isSelected ? styles.packageBadgeSelected : styles.packageBadgeDraft}`}>
                                    {pkg.isSelected ? 'Seleccionado' : 'Borrador'}
                                  </span>

                                  {/* Product thumbnails */}
                                  <div className={styles.packageProducts}>
                                    {(pkg.products || []).map((prod, i) => (
                                      <div key={i} className={styles.packageProductThumb}>
                                        <img 
                                          src={prod.image || 'https://via.placeholder.com/50'} 
                                          alt={prod.name} 
                                        />
                                        <span>{prod.name}</span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Action buttons */}
                                  <div className={styles.packageActions}>
                                    <button 
                                      className={styles.packageActionBtn} 
                                      title="Editar"
                                      onClick={() => handleEditPackage(d, pkg)}
                                    >
                                      <Edit2 size={15} />
                                    </button>
                                    <button 
                                      className={styles.packageActionBtn} 
                                      title="Reutilizar para otro"
                                      onClick={() => handleReusePackage(d, pkg)}
                                    >
                                      <Copy size={15} />
                                    </button>
                                    {!pkg.isSelected && (
                                      <button 
                                        className={`${styles.packageActionBtn} ${styles.packageActionBtnSelect}`}
                                        title="Seleccionar como oferta"
                                        onClick={() => handleSelectPackage(d, pkg)}
                                      >
                                        <CheckCircle size={15} />
                                      </button>
                                    )}
                                    <button 
                                      className={`${styles.packageActionBtn} ${styles.packageActionBtnDanger}`}
                                      title="Eliminar"
                                      onClick={() => handleDeletePackage(pkg)}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}

                            <button 
                              className={styles.addPackageBtn}
                              onClick={() => handleCreatePackage(d)}
                            >
                              <Plus size={16} />
                              Agregar otro paquete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {currentItems.length === 0 && (
                <tr>
                  <td colSpan="8" className={styles.empty}>No hay fechas que coincidan con el filtro.</td>
                </tr>
              )}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
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

      {/* Package Creator/Editor Modal */}
      {modalConfig && (
        <PackageCreatorModal 
          recipientData={modalConfig.recipientData}
          existingPackage={modalConfig.existingPackage}
          reuseProducts={modalConfig.reuseProducts}
          isFirstPackage={modalConfig.isFirstPackage}
          onClose={() => setModalConfig(null)}
          onSave={handlePackageSaved}
        />
      )}
    </div>
  );
};

export default UsuariosView;
