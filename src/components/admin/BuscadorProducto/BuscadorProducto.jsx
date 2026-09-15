// =========================================================================
// Buscador de producto del catálogo (por nombre)
// -------------------------------------------------------------------------
// Extraído de AdminRuletaPage.jsx para reutilizarlo también en AdminRecompensas.jsx:
// ambos necesitan elegir un producto para premios/recompensas de tipo
// "producto_descuento" o "producto_gratis", y pedir el productId escrito a
// mano (como hacía Ofertas Flash) obliga a ir a buscarlo a otra pestaña y a
// pegarlo sin saber si es el correcto.
// =========================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { getProducts } from '../../../services/products';
import styles from './BuscadorProducto.module.css';

const BuscadorProducto = ({ productId, productName, onElegir }) => {
  const [termino, setTermino] = useState('');
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    // Una sola lectura del catálogo y se filtra en memoria: buscar contra
    // Firestore en cada tecla sería una lectura completa por pulsación.
    getProducts().then(({ data }) => {
      if (!vivo) return;
      setProductos(data || []);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  const resultados = useMemo(() => {
    const t = termino.trim().toLowerCase();
    if (t.length < 2) return [];
    return productos
      .filter((p) => String(p.name || '').toLowerCase().includes(t))
      .slice(0, 8);
  }, [termino, productos]);

  if (productId) {
    return (
      <div className={styles.productoElegido}>
        <span className={styles.productoNombre}>{productName || productId}</span>
        <button
          type="button"
          className={styles.enlaceBoton}
          onClick={() => onElegir({ id: '', name: '' })}
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.buscador}>
      <input
        type="text"
        className={styles.input}
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder={cargando ? 'Cargando catálogo...' : 'Escribe el nombre del producto'}
        disabled={cargando}
      />
      {resultados.length > 0 && (
        <ul className={styles.resultados}>
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={styles.resultado}
                onClick={() => { onElegir(p); setTermino(''); }}
              >
                <span>{p.name}</span>
                <span className={styles.resultadoPrecio}>S/ {Number(p.salePrice || p.price || 0).toFixed(2)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {termino.trim().length >= 2 && resultados.length === 0 && !cargando && (
        <p className={styles.ayuda}>Ningún producto coincide con «{termino}».</p>
      )}
    </div>
  );
};

export default BuscadorProducto;
