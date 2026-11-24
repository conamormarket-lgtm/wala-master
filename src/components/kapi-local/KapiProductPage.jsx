import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import s from './KapiProductPage.module.css';

// A DEV-only, read-only catalog view: the rest of the local app keeps its emulator.
export default function KapiProductPage() {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    fetch(`/__kapi/product/${encodeURIComponent(id)}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setResult(data);
    }).catch(error => { if (!controller.signal.aborted) setResult({ error: error.message }); });
    return () => controller.abort();
  }, [id, attempt]);
  const product = result?.product;
  const explain = () => window.dispatchEvent(new CustomEvent('wala:kapi-explain-product', { detail: { id } }));
  return <div className={s.page} data-kapi-product-page={id}>
    <nav aria-label="Ruta del producto"><Link to="/?kapiDemo=1">Inicio</Link><span>/</span><Link to="/tienda?kapiDemo=1">Tienda</Link></nav>
    {!result ? <p role="status">Cargando producto…</p> : result.error ? <section role="alert">
      <h1>No pudimos mostrar esta ficha</h1><p>{result.error}</p><button onClick={() => setAttempt(n => n + 1)}>Reintentar</button>
    </section> : <>
      <div className={s.grid}>
        <div className={s.photo} data-kapi-important>{product.image ? <img src={product.image} alt={product.name} /> : <span>Imagen no disponible</span>}</div>
        <section className={s.details}>
          <p className={s.eyebrow}>DESCUBRE CON KAPI</p>
          <h1>{product.name}</h1>
          <p className={s.price}>{product.price == null ? 'Precio por confirmar' : new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(product.price)}</p>
          <p>{product.stock === 'out' ? 'Agotado por ahora' : product.stock === 'available' ? 'Disponible en el catálogo' : 'Disponibilidad por confirmar'}</p>
          {!!product.variants.length && <div><h2>Colores / variantes</h2><ul className={s.options} data-kapi-important>{product.variants.map((v, i) => <li key={i}>{v.name}{v.sizes.length ? ` · ${v.sizes.join(', ')}` : ''}</li>)}</ul></div>}
          {!!product.sizes.length && <div><h2>Tallas</h2><p>{product.sizes.join(' · ')}</p></div>}
          {(product.variants.length > 0 || product.sizes.length > 0) && <p className={s.note}>Las opciones publicadas no confirman stock por talla o color.</p>}
          <button className={s.explain} onClick={explain}>Kapi, explícame este producto</button>
          <p className={s.note}>Vista local del catálogo publicado. Aquí puedes explorar y conversar con Kapi.</p>
        </section>
      </div>
      <section className={s.description}><h2>Sobre este producto</h2><p>{product.description || 'Aún no hay una descripción publicada para este producto.'}</p>
        {product.customizable && <p>Este producto admite personalización.</p>}
      </section>
    </>}
  </div>;
}
