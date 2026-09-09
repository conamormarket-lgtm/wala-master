import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Save, Trash2, X } from 'lucide-react';
import { getBrands } from '../../services/brands';
import { getProducts } from '../../services/products';
import { getProductTypes, createProductType, updateProductType, deleteProductType } from '../../services/productTypes';
import { getTags, createTag, updateTag, deleteTag } from '../../services/tags';
import { getCharacters, createCharacter, updateCharacter, deleteCharacter } from '../../services/characters';
import styles from './AdminCatalogAttributes.module.css';

const ATTRIBUTE_CONFIG = {
  productTypes: {
    title: 'Tipos de producto',
    description: 'Clasificación que aparece en el filtro “Tipo de producto”.',
    singular: 'tipo de producto',
    queryKey: ['admin-product-types'],
    publicQueryKey: ['productTypes'],
    load: getProductTypes,
    create: createProductType,
    update: updateProductType,
    remove: deleteProductType,
    productField: 'productType',
    supportsBrands: false,
  },
  tags: {
    title: 'Etiquetas',
    description: 'Palabras temáticas para clasificar y filtrar productos.',
    singular: 'etiqueta',
    queryKey: ['admin-tags'],
    publicQueryKey: ['tags'],
    load: getTags,
    create: createTag,
    update: updateTag,
    remove: deleteTag,
    productField: 'tags',
    supportsBrands: true,
  },
  characters: {
    title: 'Personajes',
    description: 'Personajes o protagonistas asociados a cada diseño.',
    singular: 'personaje',
    queryKey: ['admin-characters'],
    publicQueryKey: ['characters'],
    load: getCharacters,
    create: createCharacter,
    update: updateCharacter,
    remove: deleteCharacter,
    productField: 'characters',
    supportsBrands: true,
  },
};

const idOf = (value) => (value && typeof value === 'object')
  ? (value.id || value.slug || value.name || '')
  : value;

function BrandPicker({ brands, value, onChange }) {
  return (
    <div className={styles.brandPicker}>
      {brands.map((brand) => (
        <label key={brand.id} className={styles.brandOption}>
          <input
            type="checkbox"
            checked={value.includes(brand.id)}
            onChange={(event) => onChange(event.target.checked
              ? [...new Set([...value, brand.id])]
              : value.filter((id) => id !== brand.id))}
          />
          <span>{brand.name}</span>
        </label>
      ))}
      {brands.length === 0 && <span className={styles.muted}>No hay marcas configuradas.</span>}
    </div>
  );
}

function AttributePanel({ kind, items, brands, usageByKind, onChanged }) {
  const config = ATTRIBUTE_CONFIG[kind];
  const [newName, setNewName] = useState('');
  const [newBrandIds, setNewBrandIds] = useState([]);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);

  const run = async (id, operation, successMessage) => {
    setBusyId(id);
    setMessage(null);
    try {
      const result = await operation();
      if (result?.error) throw new Error(result.error);
      setMessage({ type: 'success', text: successMessage });
      await onChanged(config);
      return true;
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'No se pudo guardar el cambio.' });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const duplicate = items.some((item) => String(item.name || '').trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setMessage({ type: 'error', text: `Ya existe ${config.singular === 'etiqueta' ? 'una' : 'un'} ${config.singular} con ese nombre.` });
      return;
    }
    const payload = config.supportsBrands ? { name, brandIds: newBrandIds } : { name };
    const ok = await run('new', () => config.create(payload), `${name} se creó correctamente.`);
    if (ok) {
      setNewName('');
      setNewBrandIds([]);
    }
  };

  const handleSave = async (item) => {
    const name = editing.name.trim();
    if (!name) return;
    const duplicate = items.some((candidate) => candidate.id !== item.id
      && String(candidate.name || '').trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setMessage({ type: 'error', text: 'Ya existe otro valor con ese nombre.' });
      return;
    }
    const payload = config.supportsBrands
      ? { name, brandIds: editing.brandIds }
      : { name };
    const ok = await run(item.id, () => config.update(item.id, payload), `${name} se actualizó correctamente.`);
    if (ok) setEditing(null);
  };

  const handleDelete = async (item) => {
    const uses = usageByKind[kind]?.get(item.id) || 0;
    if (uses > 0) {
      setMessage({
        type: 'error',
        text: `No se puede eliminar “${item.name}”: está asignado a ${uses} producto${uses === 1 ? '' : 's'}. Retíralo de esos productos primero.`,
      });
      return;
    }
    if (!window.confirm(`¿Eliminar “${item.name}”? Esta acción no se puede deshacer.`)) return;
    await run(item.id, () => config.remove(item.id), `${item.name} se eliminó correctamente.`);
  };

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2>{config.title}</h2>
          <p>{config.description}</p>
        </div>
        <span className={styles.total}>{items.length}</span>
      </div>

      <form className={styles.createForm} onSubmit={handleCreate}>
        <label>
          <span>Nuevo nombre</span>
          <div className={styles.createRow}>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={`Ej. ${kind === 'productTypes' ? 'Accesorio' : kind === 'tags' ? 'Dragon Ball' : 'Goku'}`}
            />
            <button type="submit" className={styles.primaryButton} disabled={!newName.trim() || busyId === 'new'}>
              <Plus size={17} /> Crear
            </button>
          </div>
        </label>
        {config.supportsBrands && (
          <div>
            <span className={styles.fieldLabel}>Disponible para marcas</span>
            <BrandPicker brands={brands} value={newBrandIds} onChange={setNewBrandIds} />
            <p className={styles.hint}>Sin marcas seleccionadas queda como valor global.</p>
          </div>
        )}
      </form>

      {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

      <div className={styles.list}>
        {items.map((item) => {
          const isEditing = editing?.id === item.id;
          const uses = usageByKind[kind]?.get(item.id) || 0;
          return (
            <div className={styles.item} key={item.id}>
              <div className={styles.itemContent}>
                {isEditing ? (
                  <>
                    <input
                      className={styles.editInput}
                      value={editing.name}
                      onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))}
                      autoFocus
                    />
                    {config.supportsBrands && (
                      <BrandPicker
                        brands={brands}
                        value={editing.brandIds}
                        onChange={(brandIds) => setEditing((current) => ({ ...current, brandIds }))}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <strong>{item.name || item.id}</strong>
                    <div className={styles.itemMeta}>
                      <span>{uses} producto{uses === 1 ? '' : 's'}</span>
                      {config.supportsBrands && (
                        <span>{(item.brandIds || []).map((id) => brands.find((brand) => brand.id === id)?.name).filter(Boolean).join(', ') || 'Global'}</span>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className={styles.actions}>
                {isEditing ? (
                  <>
                    <button type="button" title="Guardar" onClick={() => handleSave(item)} disabled={busyId === item.id}>
                      <Save size={17} />
                    </button>
                    <button type="button" title="Cancelar" onClick={() => setEditing(null)}><X size={17} /></button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => setEditing({ id: item.id, name: item.name || '', brandIds: item.brandIds || [] })}
                    >
                      <Edit2 size={17} />
                    </button>
                    <button type="button" className={styles.deleteButton} title="Eliminar" onClick={() => handleDelete(item)} disabled={busyId === item.id}>
                      <Trash2 size={17} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className={styles.empty}>Todavía no hay valores creados.</div>}
      </div>
    </section>
  );
}

export default function AdminCatalogAttributes() {
  const queryClient = useQueryClient();
  const [activeKind, setActiveKind] = useState('productTypes');

  const loadAttribute = async (kind) => {
    const result = await ATTRIBUTE_CONFIG[kind].load();
    if (result?.error) throw new Error(result.error);
    return result?.data || [];
  };
  const productTypesQuery = useQuery({
    queryKey: ATTRIBUTE_CONFIG.productTypes.queryKey,
    queryFn: () => loadAttribute('productTypes'),
  });
  const tagsQuery = useQuery({
    queryKey: ATTRIBUTE_CONFIG.tags.queryKey,
    queryFn: () => loadAttribute('tags'),
  });
  const charactersQuery = useQuery({
    queryKey: ATTRIBUTE_CONFIG.characters.queryKey,
    queryFn: () => loadAttribute('characters'),
  });
  const queries = {
    productTypes: productTypesQuery,
    tags: tagsQuery,
    characters: charactersQuery,
  };

  const { data: brands = [] } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: async () => (await getBrands()).data || [],
  });
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['admin-products-attribute-usage'],
    queryFn: async () => {
      const result = await getProducts([], null, null, { includeHidden: true });
      if (result?.error) throw new Error(result.error);
      return result?.data || [];
    },
  });

  const usageByKind = useMemo(() => {
    const usage = {
      productTypes: new Map(),
      tags: new Map(),
      characters: new Map(),
    };
    products.forEach((product) => {
      const productType = idOf(product.productType);
      if (productType) usage.productTypes.set(productType, (usage.productTypes.get(productType) || 0) + 1);
      ['tags', 'characters'].forEach((kind) => {
        const ids = new Set((Array.isArray(product[kind]) ? product[kind] : []).map(idOf).filter(Boolean));
        ids.forEach((id) => usage[kind].set(id, (usage[kind].get(id) || 0) + 1));
      });
    });
    return usage;
  }, [products]);

  const handleChanged = async (config) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: config.queryKey }),
      queryClient.invalidateQueries({ queryKey: config.publicQueryKey }),
      queryClient.invalidateQueries({ queryKey: ['admin-products-attribute-usage'] }),
    ]);
  };

  const activeQuery = queries[activeKind];

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1>Atributos del catálogo</h1>
        <p>Administra los valores que se asignan a los productos y aparecen como filtros en la tienda.</p>
      </header>

      <div className={styles.notice}>
        En la tienda solo se muestran atributos usados por productos visibles. Aquí puedes crear, renombrar y eliminar los valores maestros.
      </div>

      <nav className={styles.tabs} aria-label="Tipo de atributo">
        {Object.entries(ATTRIBUTE_CONFIG).map(([kind, config]) => (
          <button
            key={kind}
            type="button"
            className={activeKind === kind ? styles.activeTab : ''}
            onClick={() => setActiveKind(kind)}
          >
            {config.title}
          </button>
        ))}
      </nav>

      {(activeQuery.isLoading || productsLoading) && <div className={styles.loading}>Cargando atributos…</div>}
      {activeQuery.error && <div className={`${styles.message} ${styles.error}`}>{activeQuery.error.message}</div>}
      {!activeQuery.isLoading && (
        <AttributePanel
          key={activeKind}
          kind={activeKind}
          items={activeQuery.data || []}
          brands={brands}
          usageByKind={usageByKind}
          onChanged={handleChanged}
        />
      )}
    </div>
  );
}
