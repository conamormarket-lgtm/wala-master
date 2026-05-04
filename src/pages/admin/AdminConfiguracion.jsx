import React, { useState, useEffect } from 'react';
import { getAdminRoles, setAdminRole, deleteAdminRole } from '../../services/adminRoles';
import { getLockedPages, saveLockedPages } from '../../services/lockedPages';
import { getLandingPages } from '../Tienda/services/landingPages';
import Button from '../../components/common/Button';
import styles from './AdminConfiguracion.module.css';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Unlock } from 'lucide-react';

const AVAILABLE_PERMISSIONS = [
  { id: 'superadmin', label: 'Super Admin (Control Total)', desc: 'Tiene acceso a todo, incluyendo añadir otros administradores.' },
  { id: 'manage_design', label: 'Diseño de Tienda', desc: 'Puede usar el Editor Visual, modificar banners, destacados y WhatsApp.' },
  { id: 'manage_products', label: 'Catálogo de Productos', desc: 'Puede crear y editar productos, categorías, colecciones y marcas.' },
  { id: 'manage_inventory', label: 'Gestión de Inventario', desc: 'Puede acceder a la tabla de inventario rápido.' },
  { id: 'manage_clients', label: 'Clientes y Pagos', desc: 'Puede ver usuarios, crear referidos y configurar métodos de pago.' },
  { id: 'manage_landing_pages', label: 'Embudos y Landing Pages', desc: 'Puede crear y editar páginas de aterrizaje (Landing Pages).' }
];

const AdminConfiguracion = () => {
  const { adminPermissions, user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isAdding, setIsAdding] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState([]);

  const [activeTab, setActiveTab] = useState('admins'); // 'admins' o 'locks'
  const [lockedPages, setLockedPages] = useState([]);
  const [landingPages, setLandingPages] = useState([]);

  const isSuperAdmin = adminPermissions?.includes('superadmin');

  const fetchAdmins = async () => {
    setLoading(true);
    const data = await getAdminRoles();
    setAdmins(data);
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchAdmins();
      fetchSecurityData();
    } else {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  const fetchSecurityData = async () => {
    const [lockedData, landingData] = await Promise.all([
      getLockedPages(),
      getLandingPages()
    ]);
    setLockedPages(lockedData);
    setLandingPages(landingData);
  };

  const togglePageLock = async (pageId) => {
    const isLocked = lockedPages.includes(pageId);
    let newLocked = [];
    if (isLocked) {
      newLocked = lockedPages.filter(p => p !== pageId);
    } else {
      newLocked = [...lockedPages, pageId];
    }
    
    setLockedPages(newLocked);
    await saveLockedPages(newLocked);
  };

  const handleTogglePerm = (permId) => {
    setSelectedPerms(prev => 
      prev.includes(permId) 
        ? prev.filter(p => p !== permId) 
        : [...prev, permId]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editEmail) return;

    if (selectedPerms.length === 0) {
      alert("Debes asignar al menos un permiso.");
      return;
    }

    const { error } = await setAdminRole(editEmail, {
      name: editName || editEmail.split('@')[0],
      permissions: selectedPerms
    });

    if (error) {
      alert("Error guardando administrador: " + error);
    } else {
      setIsAdding(false);
      setEditEmail('');
      setEditName('');
      setSelectedPerms([]);
      fetchAdmins();
    }
  };

  const handleEdit = (admin) => {
    setEditEmail(admin.email);
    setEditName(admin.name || '');
    setSelectedPerms(admin.permissions || []);
    setIsAdding(true);
  };

  const handleDelete = async (email) => {
    if (email === user?.email) {
      alert("No puedes eliminarte a ti mismo.");
      return;
    }
    if (window.confirm(`¿Seguro que quieres quitar todos los accesos a ${email}?`)) {
      const { error } = await deleteAdminRole(email);
      if (error) alert("Error: " + error);
      else fetchAdmins();
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className={styles.container}>
        <h2>Acceso Denegado</h2>
        <p>No tienes los permisos de Super Admin necesarios para ver esta página.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Configuración Avanzada</h2>
          <p>Gestiona los accesos de tu equipo y la seguridad de las páginas.</p>
        </div>
        {activeTab === 'admins' && !isAdding && (
          <Button variant="primary" onClick={() => {
            setIsAdding(true);
            setEditEmail('');
            setEditName('');
            setSelectedPerms([]);
          }}>
            + Añadir Administrador
          </Button>
        )}
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'admins' ? styles.activeTab : ''}`}
          onClick={() => { setActiveTab('admins'); setIsAdding(false); }}
        >
          Cuentas de Equipo
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'locks' ? styles.activeTab : ''}`}
          onClick={() => { setActiveTab('locks'); setIsAdding(false); }}
        >
          Administración de páginas fijas
        </button>
      </div>

      {activeTab === 'admins' && isAdding && (
        <div className={styles.formCard}>
          <h3>{editEmail ? 'Editar Administrador' : 'Nuevo Administrador'}</h3>
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.formRow}>
              <div className={styles.inputGroup}>
                <label>Email de Google del usuario</label>
                <input 
                  type="email" 
                  value={editEmail} 
                  onChange={e => setEditEmail(e.target.value)} 
                  required 
                  disabled={!!admins.find(a => a.email === editEmail) && !editName} // disable email edit if existing
                />
              </div>
              <div className={styles.inputGroup}>
                <label>Nombre identificador</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  placeholder="Ej: Juan Pérez"
                />
              </div>
            </div>

            <div className={styles.permissionsGroup}>
              <h4>Permisos Asignados</h4>
              <div className={styles.permissionsGrid}>
                {AVAILABLE_PERMISSIONS.map(perm => (
                  <label key={perm.id} className={styles.permissionCard}>
                    <input 
                      type="checkbox" 
                      checked={selectedPerms.includes(perm.id)}
                      onChange={() => handleTogglePerm(perm.id)}
                    />
                    <div className={styles.permInfo}>
                      <strong>{perm.label}</strong>
                      <span>{perm.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.formActions}>
              <Button type="button" variant="secondary" onClick={() => setIsAdding(false)}>Cancelar</Button>
              <Button type="submit" variant="primary">Guardar Administrador</Button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'admins' && (
        loading ? (
          <p>Cargando administradores...</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Permisos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(admin => (
                  <tr key={admin.id}>
                    <td><strong>{admin.name}</strong></td>
                    <td>{admin.email}</td>
                    <td>
                      <div className={styles.tags}>
                        {admin.permissions?.map(p => {
                          const permDef = AVAILABLE_PERMISSIONS.find(ap => ap.id === p);
                          return <span key={p} className={styles.tag}>{permDef ? permDef.label : p}</span>
                        })}
                      </div>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button onClick={() => handleEdit(admin)} className={styles.actionBtn}>Editar</button>
                        {admin.email !== user?.email && (
                          <button onClick={() => handleDelete(admin.email)} className={`${styles.actionBtn} ${styles.danger}`}>Eliminar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {admins.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No hay administradores registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeTab === 'locks' && (
        <div className={styles.locksContainer}>
          <div className={styles.locksWarning}>
            <Lock size={20} />
            <p><strong>CUIDADO:</strong> Bloquear una página impedirá que <strong>cualquier persona (incluyéndote a ti)</strong> pueda guardar cambios visuales en ella, evitando daños accidentales. Para editarla de nuevo, tendrás que quitarle el candado aquí primero.</p>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre de la Página</th>
                  <th>ID Interno / URL</th>
                  <th>Estado de Seguridad</th>
                </tr>
              </thead>
              <tbody>
                {/* Fixed Pages */}
                <tr>
                  <td><strong>Página Principal (Home)</strong></td>
                  <td>home</td>
                  <td>
                    <button 
                      onClick={() => togglePageLock('home')}
                      className={`${styles.lockBtn} ${lockedPages.includes('home') ? styles.locked : styles.unlocked}`}
                    >
                      {lockedPages.includes('home') ? <><Lock size={16}/> Bloqueada</> : <><Unlock size={16}/> Desbloqueada</>}
                    </button>
                  </td>
                </tr>
                <tr>
                  <td><strong>Tienda Principal</strong></td>
                  <td>tienda</td>
                  <td>
                    <button 
                      onClick={() => togglePageLock('tienda')}
                      className={`${styles.lockBtn} ${lockedPages.includes('tienda') ? styles.locked : styles.unlocked}`}
                    >
                      {lockedPages.includes('tienda') ? <><Lock size={16}/> Bloqueada</> : <><Unlock size={16}/> Desbloqueada</>}
                    </button>
                  </td>
                </tr>
                <tr>
                  <td><strong>Pie de Página (Footer)</strong></td>
                  <td>footer</td>
                  <td>
                    <button 
                      onClick={() => togglePageLock('footer')}
                      className={`${styles.lockBtn} ${lockedPages.includes('footer') ? styles.locked : styles.unlocked}`}
                    >
                      {lockedPages.includes('footer') ? <><Lock size={16}/> Bloqueada</> : <><Unlock size={16}/> Desbloqueada</>}
                    </button>
                  </td>
                </tr>

                {/* Landing Pages */}
                {landingPages.map(page => (
                  <tr key={page.id}>
                    <td><strong>{page.title}</strong> <span className={styles.badge}>Landing Page</span></td>
                    <td>{page.slug || page.id}</td>
                    <td>
                      <button 
                        onClick={() => togglePageLock(page.id)}
                        className={`${styles.lockBtn} ${lockedPages.includes(page.id) ? styles.locked : styles.unlocked}`}
                      >
                        {lockedPages.includes(page.id) ? <><Lock size={16}/> Bloqueada</> : <><Unlock size={16}/> Desbloqueada</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminConfiguracion;
