import React, { useState, useEffect } from 'react';
import { getAdminRoles, setAdminRole, deleteAdminRole } from '../../services/adminRoles';
import { getLockedPages, saveLockedPages } from '../../services/lockedPages';
import { getLandingPages } from '../Tienda/services/landingPages';
import Button from '../../components/common/Button';
import styles from './AdminConfiguracion.module.css';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Unlock, ImageDown, Languages } from 'lucide-react';
import { reconvertirImagenesAWebp, contarImagenesPorConvertir } from '../../services/imagenesWebp';
import { guardarTraduccionesEnNube, traduccionesPendientes } from '../../services/translate';

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

  const [activeTab, setActiveTab] = useState('admins'); // 'admins' | 'locks' | 'imagenes'
  const [lockedPages, setLockedPages] = useState([]);
  const [landingPages, setLandingPages] = useState([]);

  // ── Reconversion de imagenes a WebP ────────────────────────────────────
  const [imgConteo, setImgConteo] = useState(null);
  const [imgProgreso, setImgProgreso] = useState(null);
  const [imgResultado, setImgResultado] = useState(null);
  const [imgTrabajando, setImgTrabajando] = useState(false);

  const revisarImagenes = async () => {
    setImgConteo('cargando');
    try {
      setImgConteo(await contarImagenesPorConvertir());
    } catch (e) {
      setImgConteo({ error: e?.message || String(e) });
    }
  };

  // ── Traducciones del contenido ─────────────────────────────────────────
  // Al navegar la tienda en ingles o portugues, el traductor va resolviendo los
  // textos y los deja anotados en memoria. Aqui se publican en Firestore para
  // que TODOS los visitantes los reciban ya traducidos, sin volver a traducir.
  const [tradPendientes, setTradPendientes] = useState({});
  const [tradMsg, setTradMsg] = useState('');
  const [tradGuardando, setTradGuardando] = useState(false);

  const revisarTraducciones = () => setTradPendientes(traduccionesPendientes());

  const publicarTraducciones = async () => {
    setTradGuardando(true);
    setTradMsg('');
    try {
      const res = await guardarTraduccionesEnNube();
      setTradMsg(res.error
        ? '❌ No se pudieron publicar: ' + res.error
        : (res.guardadas > 0
          ? `✅ Se publicaron ${res.guardadas} traduccion(es).`
          : '✅ No habia traducciones nuevas que publicar.'));
      revisarTraducciones();
    } catch (e) {
      setTradMsg('❌ Error: ' + (e?.message || e));
    } finally {
      setTradGuardando(false);
    }
  };

  const convertirImagenes = async () => {
    if (!imgConteo || !imgConteo.imagenes) return;
    const ok = window.confirm(
      `Se van a reconvertir ${imgConteo.imagenes} imagen(es) a WebP.\n\n`
      + 'Cada una se vuelve a subir convertida y se actualiza el enlace en su documento. '
      + 'Los archivos originales NO se borran, asi que si algo saliera mal siguen ahi.\n\n'
      + 'Puede tardar un rato. No cierres esta pestana mientras corre.'
    );
    if (!ok) return;
    setImgTrabajando(true);
    setImgResultado(null);
    setImgProgreso({ hechas: 0, total: imgConteo.imagenes, actual: '' });
    try {
      const res = await reconvertirImagenesAWebp({ onProgreso: setImgProgreso });
      setImgResultado(res);
      await revisarImagenes();
    } catch (e) {
      setImgResultado({ convertidas: 0, documentos: 0, saltadas: 0, errores: [e?.message || String(e)] });
    } finally {
      setImgTrabajando(false);
      setImgProgreso(null);
    }
  };

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
        <button
          className={`${styles.tabBtn} ${activeTab === 'imagenes' ? styles.activeTab : ''}`}
          onClick={() => { setActiveTab('imagenes'); setIsAdding(false); if (imgConteo === null) revisarImagenes(); revisarTraducciones(); }}
        >
          Optimización de imágenes
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

      {activeTab === 'imagenes' && (
        <div className={styles.formCard}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ImageDown size={18} /> Convertir imágenes antiguas a WebP
          </h3>
          <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.6, marginTop: 4 }}>
            Todo lo que subas de ahora en adelante ya se guarda en WebP automáticamente. Esto es para las
            imágenes que se subieron antes: revisa los banners, los slides del hero y los logos y fondos de
            marca, vuelve a subir en WebP las que sigan en PNG o JPG y actualiza el enlace en cada página.
            <br /><br />
            Los archivos originales <strong>no se borran</strong>: si algo saliera mal, siguen en su sitio.
            Las imágenes externas (Google Drive y demás), los SVG y los GIF se dejan como están. Los productos
            no entran aquí, son muchos más y conviene tratarlos aparte.
          </p>

          {imgConteo === 'cargando' && <p style={{ color: '#888' }}>Revisando…</p>}

          {imgConteo && imgConteo.error && (
            <p style={{ color: '#e03131' }}>No se pudo revisar: {imgConteo.error}</p>
          )}

          {imgConteo && typeof imgConteo.imagenes === 'number' && (
            <p style={{ fontSize: '0.95rem' }}>
              {imgConteo.imagenes === 0
                ? 'No queda ninguna imagen por convertir.'
                : `Quedan ${imgConteo.imagenes} imagen(es) por convertir, repartidas en ${imgConteo.documentos} documento(s).`}
            </p>
          )}

          {imgProgreso && (
            <div style={{ margin: '1rem 0' }}>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${imgProgreso.total ? Math.round((imgProgreso.hechas / imgProgreso.total) * 100) : 0}%`,
                  background: 'var(--primary-color, #7c3aed)',
                  transition: 'width 0.2s ease',
                }} />
              </div>
              <p style={{ fontSize: '0.82rem', color: '#888', marginTop: 6 }}>
                {imgProgreso.hechas} de {imgProgreso.total}
                {imgProgreso.actual ? ` · ${imgProgreso.actual}` : ''}
              </p>
            </div>
          )}

          {imgResultado && (
            <div style={{ margin: '1rem 0', fontSize: '0.9rem' }}>
              <p style={{ color: '#16a34a' }}>
                Listo: {imgResultado.convertidas} imagen(es) convertida(s) en {imgResultado.documentos} documento(s)
                {imgResultado.saltadas ? ` · ${imgResultado.saltadas} se dejaron como estaban porque el WebP no las mejoraba` : ''}.
              </p>
              {imgResultado.errores.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ color: '#e03131', cursor: 'pointer' }}>
                    {imgResultado.errores.length} no se pudo(ieron) convertir
                  </summary>
                  <ul style={{ color: '#e03131', fontSize: '0.82rem', marginTop: 6 }}>
                    {imgResultado.errores.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: '1rem' }}>
            <Button variant="secondary" onClick={revisarImagenes} disabled={imgTrabajando}>
              Volver a revisar
            </Button>
            <Button
              variant="primary"
              onClick={convertirImagenes}
              disabled={imgTrabajando || !imgConteo || !imgConteo.imagenes}
            >
              {imgTrabajando ? 'Convirtiendo…' : 'Convertir a WebP'}
            </Button>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.08)', margin: '1.75rem 0 1.25rem' }} />

          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Languages size={18} /> Publicar traducciones del contenido
          </h3>
          <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.6, marginTop: 4 }}>
            Los nombres de producto y los textos que escribes en el builder se traducen sobre la marcha
            cuando alguien navega en inglés o portugués. Al publicarlas, quedan guardadas y el resto de
            visitantes las recibe ya hechas, sin esperar ni volver a traducir.
            <br /><br />
            Para llenar la lista, cambia el idioma y recorre la tienda; luego vuelve aquí y publícalas.
            Solo un administrador puede publicar, así que nadie de fuera puede inyectar textos.
          </p>

          {Object.keys(tradPendientes).length === 0 ? (
            <p style={{ fontSize: '0.95rem' }}>No hay traducciones nuevas sin publicar.</p>
          ) : (
            <p style={{ fontSize: '0.95rem' }}>
              Sin publicar:{' '}
              {Object.entries(tradPendientes).map(([idioma, n]) => `${n} en ${idioma.toUpperCase()}`).join(' · ')}.
            </p>
          )}

          {tradMsg && (
            <p style={{ fontSize: '0.9rem', color: tradMsg.startsWith('❌') ? '#e03131' : '#16a34a' }}>{tradMsg}</p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={revisarTraducciones} disabled={tradGuardando}>
              Volver a revisar
            </Button>
            <Button
              variant="primary"
              onClick={publicarTraducciones}
              disabled={tradGuardando || Object.keys(tradPendientes).length === 0}
            >
              {tradGuardando ? 'Publicando…' : 'Publicar traducciones'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminConfiguracion;
