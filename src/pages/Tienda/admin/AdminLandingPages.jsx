import React, { useState, useEffect } from 'react';
import { getLandingPages, saveLandingPage, deleteLandingPage, moverDisenoDeLanding } from '../services/landingPages';
import { getBrands } from '../../../services/brands';
import Button from '../../../components/common/Button';
import styles from '../../admin/AdminLandingPages.module.css';
import { useNavigate, useSearchParams } from 'react-router-dom';

// La URL sin mayúsculas ni símbolos (como el slug de una marca).
const llave = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Las páginas de la tienda que también se diseñan con el editor (no son landings).
const PAGINAS_DE_LA_TIENDA = [
  { id: 'home', title: 'Inicio', ruta: '/' },
  { id: 'tienda', title: 'Tienda', ruta: '/tienda' },
];

/*
 * "Páginas": la lista de todas las páginas que se diseñan con el editor (el
 * inicio, la tienda, las de cada marca y las de campaña), con "Diseñar
 * página". Aquí solo se crean, se les pone nombre, URL y marca, y se borran.
 * Lo que va dentro (secciones, portada, tema, ocultar la cabecera o el pie)
 * se hace en la página con el editor (pestaña "Página"), un solo lugar.
 * Antes también se elegían aquí el tema, la cabecera y el pie (repetido con el
 * editor) y unos "productos enlazados" que ninguna parte de la tienda leía.
 */
const AdminLandingPages = () => {
  const [pages, setPages] = useState([]);
  const [brands, setBrands] = useState([]); // marcas (tienda_brands) para asignar a la landing
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();
  // ?nueva=<slug>: viene del atajo "Crear landing" de Enlaces rotos
  // (dashboard/paginas) y abre una landing nueva con esa URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const slugNueva = searchParams.get('nueva');

  const [formData, setFormData] = useState({
    id: null,
    title: '',
    slug: '',
    brandId: '', // marca de la página (multimarca); '' = página global
  });

  // La página de una marca (la de su URL): su URL y su marca se cambian en
  // Marcas, que mueve la página con ellas. Aquí no, para que no se separen.
  const marcaDuena = (page) => {
    const marca = page?.brandId ? brands.find((b) => b.id === page.brandId) : null;
    return marca && llave(marca.slug) === llave(page.slug || page.id) ? marca : null;
  };
  const duenaDelForm = marcaDuena(pages.find((p) => p.id === formData.id));

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (loading || !slugNueva) return;
    handleAddNew();
    setFormData((f) => ({ ...f, slug: slugNueva }));
    setSearchParams({}, { replace: true });
  }, [loading, slugNueva]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    setLoading(true);
    const [pagesData, brandsData] = await Promise.all([
      getLandingPages(),
      getBrands()
    ]);
    setPages(pagesData);
    setBrands(brandsData.data || []);
    setLoading(false);
  };

  const handleAddNew = () => {
    setFormData({ id: null, title: '', slug: '', brandId: '' });
    setIsEditing(true);
  };

  const handleEdit = (page) => {
    setFormData({
      id: page.id,
      title: page.title || '',
      slug: page.slug || '',
      brandId: page.brandId || '',
    });
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Seguro que quieres eliminar esta página? Esto también borrará su diseño.')) {
      await deleteLandingPage(id);
      fetchData();
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.slug) {
      alert("El nombre y la URL son obligatorios.");
      return;
    }
    // Formato slug (remover slash inicial si lo puso)
    // La de una marca guarda su URL tal cual (aunque tenga mayúsculas): se cambia en Marcas.
    const cleanSlug = duenaDelForm ? formData.slug : formData.slug.replace(/^\/+/, '').toLowerCase().trim().replace(/\s+/g, '-');

    // Check if slug is unique
    const existing = pages.find(p => p.slug === cleanSlug && p.id !== formData.id);
    if (existing) {
      alert("Ya existe una página con esa URL. Escoge otra.");
      return;
    }

    // Cambio de URL: el diseño se va con la landing y la URL vieja queda
    // anotada para redirigir los links ya compartidos.
    const previa = pages.find(p => p.id === formData.id);
    const slugViejo = previa?.slug || '';
    let slugsAnteriores = previa?.slugsAnteriores || [];
    if (slugViejo && slugViejo !== cleanSlug) {
      const { error: errorDiseno } = await moverDisenoDeLanding(slugViejo, cleanSlug);
      if (errorDiseno) {
        alert("No se pudo mover el diseño a la nueva URL: " + errorDiseno);
        return;
      }
      slugsAnteriores = [...new Set([...slugsAnteriores, slugViejo])];
    }
    slugsAnteriores = slugsAnteriores.filter(s => s !== cleanSlug);

    // Solo nombre, URL y marca: lo demás de la landing (tema, cabecera, pie)
    // se conserva tal cual (saveLandingPage mezcla con lo guardado).
    const { error } = await saveLandingPage(formData.id, {
      title: formData.title,
      brandId: formData.brandId,
      slug: cleanSlug,
      slugsAnteriores
    });

    if (error) {
      alert("Error guardando: " + error);
    } else {
      setIsEditing(false);
      fetchData();
    }
  };

  const disenar = (ruta) => navigate(`${ruta}?editar`);

  if (loading) return <div className={styles.container}>Cargando...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Páginas</h2>
          <p>Todas las páginas que se arman con el editor. Pulsa "Diseñar página" para cambiar lo que tienen dentro.</p>
        </div>
        {!isEditing && (
          <Button variant="primary" onClick={handleAddNew}>+ Nueva página</Button>
        )}
      </div>

      {isEditing ? (
        <div className={styles.formCard}>
          <h3>{formData.id ? 'Nombre, URL y marca' : 'Nueva página'}</h3>
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label>Nombre (solo lo ves tú)</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="Ej: Promo Navidad 2026"
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label>Dirección (URL)</label>
                <div className={styles.slugInput}>
                  <span>wala.pe/</span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={e => setFormData({...formData, slug: e.target.value})}
                    placeholder="promo-navidad"
                    required
                    disabled={Boolean(duenaDelForm)}
                  />
                </div>
                {duenaDelForm && (
                  <small className={styles.notaMarca}>Es la página de {duenaDelForm.name}: su URL y su marca se cambian en Marcas.</small>
                )}
              </div>
            </div>

            <div className={styles.row}>
              {/* Marca de la página (multimarca). Si se asigna, carruseles/destacados/
                  flash y el catálogo se acotan a esa marca. '' = página global (actual). */}
              <div className={styles.inputGroup}>
                <label>Marca de la página (opcional)</label>
                <select
                  value={formData.brandId}
                  onChange={e => setFormData({...formData, brandId: e.target.value})}
                  disabled={Boolean(duenaDelForm)}
                  className={styles.input}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  <option value="">-- Sin marca (toda la tienda) --</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name || b.slug || b.id}</option>
                  ))}
                </select>
                <small className={styles.notaMarca}>Con marca, sus productos, ofertas y categorías son solo de esa marca.</small>
              </div>
            </div>

            <p className={styles.notaMarca}>
              El tema y ocultar la cabecera o el pie se eligen en la página con el editor (pestaña "Página").
            </p>

            <div className={styles.formActions}>
              <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancelar</Button>
              <Button type="submit" variant="primary">Guardar</Button>
            </div>
          </form>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Página</th>
                <th>Dirección</th>
                <th>Diseño</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {PAGINAS_DE_LA_TIENDA.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.title}</strong>
                    <span className={styles.badgeTienda}>De la tienda</span>
                  </td>
                  <td><a href={p.ruta} target="_blank" rel="noreferrer" className={styles.urlLink}>{p.ruta}</a></td>
                  <td>
                    <Button variant="primary" onClick={() => disenar(p.ruta)} className={styles.editDesignBtn}>
                      Diseñar página
                    </Button>
                  </td>
                  <td><span className={styles.mutedText}>Siempre está</span></td>
                </tr>
              ))}
              {pages.map(page => {
                const marca = marcaDuena(page);
                return (
                  <tr key={page.id}>
                    <td>
                      <strong>{page.title || page.slug}</strong>
                      {marca && <span className={styles.badgeMarca}>Página de marca</span>}
                    </td>
                    <td><a href={`/${page.slug}`} target="_blank" rel="noreferrer" className={styles.urlLink}>/{page.slug}</a></td>
                    <td>
                      {/* La página con el editor ya abierto (?editar, BarraDeAdmin). */}
                      <Button variant="primary" onClick={() => disenar(`/${page.slug}`)} className={styles.editDesignBtn}>
                        Diseñar página
                      </Button>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button onClick={() => handleEdit(page)} className={styles.actionBtn}>{marca ? 'Nombre' : 'Nombre y URL'}</button>
                        {/* La de una marca se borra con la marca (Marcas), no sola. */}
                        {marca
                          ? <span className={styles.mutedText} title="Se borra al borrar la marca, en Marcas">Se borra con la marca</span>
                          : <button onClick={() => handleDelete(page.id)} className={`${styles.actionBtn} ${styles.danger}`}>Eliminar</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pages.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Todavía no hay páginas de marca ni de campaña.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminLandingPages;
