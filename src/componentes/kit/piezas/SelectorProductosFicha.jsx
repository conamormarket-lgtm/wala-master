import React, { useEffect, useRef, useState } from 'react';
import { moveDetailItem } from '../../../utils/productDetails.mjs';
import s from './EditorDetallesProducto.module.css';

async function catalog({ ids, term, local }) {
  if (local) {
    const { default: fixture } = await import('../../demo/producto.json');
    return fixture.productos.filter(p => ids ? ids.includes(p.id) : p.name.toLocaleLowerCase().includes(term.toLocaleLowerCase()));
  }
  if (ids) {
    const { getVisibleProductsByIds } = await import('../../../services/products');
    const result = await getVisibleProductsByIds(ids);
    if (result.error) throw new Error('No se pudieron cargar los productos.');
    return result.data;
  }
  const { searchProductsFirestore } = await import('../../../services/search');
  return (await searchProductsFirestore({ term, pageSize: 12 })).items;
}

export default function SelectorProductosFicha({ ids, onChange, productId, local }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [known, setKnown] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const knownRef = useRef(known); knownRef.current = known;
  const key = ids.join(',');
  useEffect(() => {
    const missing = key.split(',').filter(id => id && !knownRef.current[id]);
    if (!missing.length) return undefined;
    let active = true;
    catalog({ ids: missing, local }).then(rows => {
      if (active) setKnown(old => ({ ...old, ...Object.fromEntries(rows.map(p => [p.id, p])) }));
    }).catch(() => { if (active) setError('No se pudieron cargar los nombres. Puedes volver a abrir esta sección.'); });
    return () => { active = false; };
  }, [key, local]);
  useEffect(() => () => { request.current += 1; }, []);
  const search = async () => {
    if (term.trim().length < 2) return;
    const current = ++request.current;
    setLoading(true); setError('');
    try {
      const rows = await catalog({ term: term.trim(), local });
      if (current !== request.current) return;
      setResults(rows.filter(p => p.id !== productId));
      setKnown(old => ({ ...old, ...Object.fromEntries(rows.map(p => [p.id, p])) }));
    } catch { if (current === request.current) setError('No se pudo buscar. Inténtalo de nuevo.'); }
    finally { if (current === request.current) setLoading(false); }
  };
  const picture = p => p?.images?.[0]?.url || p?.images?.[0] || p?.variants?.[0]?.imageUrl;
  return <div>
    <label className={s.campo}><span>Buscar productos recomendados</span><input aria-label="Buscar productos recomendados" value={term} onChange={e => setTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} placeholder="Nombre del producto" /></label>
    <button type="button" disabled={loading || term.trim().length < 2} onClick={search}>{loading ? 'Buscando…' : 'Buscar productos'}</button>
    {error && <p role="alert">{error}</p>}
    <div className={s.biblioteca}>{results.map(p => <button type="button" key={p.id} disabled={ids.includes(p.id) || ids.length >= 12} onClick={() => onChange([...ids, p.id])}>{picture(p) && <img src={picture(p)} alt="" loading="lazy" />}<span>{p.name}</span><small>{ids.includes(p.id) ? 'Seleccionado' : 'Añadir'}</small></button>)}</div>
    {!loading && results.length === 0 && term && <small>Escribe al menos dos letras y pulsa Buscar productos.</small>}
    <ol className={s.lista}>{ids.map((id, i) => <li key={id}><span>{known[id]?.name || 'Producto no disponible'}</span><div className={s.acciones}>
      <button type="button" aria-label={`Subir recomendado ${i + 1}`} disabled={!i} onClick={() => onChange(moveDetailItem(ids, i, -1))}>↑</button>
      <button type="button" aria-label={`Bajar recomendado ${i + 1}`} disabled={i === ids.length - 1} onClick={() => onChange(moveDetailItem(ids, i, 1))}>↓</button>
      <button type="button" aria-label={`Quitar recomendado ${i + 1}`} onClick={() => onChange(ids.filter(x => x !== id))}>Quitar</button>
    </div></li>)}</ol>
    <small>Sin selección, Walá recomienda por categoría y marca. Máximo 12; solo aparecen productos visibles.</small>
  </div>;
}
