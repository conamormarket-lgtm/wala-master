import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Clock, Search, X } from 'lucide-react';
import { Enlace } from '../Enlace';
import { soles } from '../TarjetaProducto';
import { FotoProducto } from './FotoProducto';
import { LogoMarca } from './LogoMarca';
import s from './PanelBusqueda.module.css';

const CLAVE_RECIENTES = 'wala_busquedas_recientes';
const MAX_RECIENTES = 6;

/**
 * Lo que buscaste antes, en ESTE navegador (misma clave que el buscador de la
 * tienda: no se pierde al migrar). Si no hay almacenamiento, lista vacía.
 */
export function useBusquedasRecientes(clave = CLAVE_RECIENTES) {
  const leer = useCallback(() => {
    try {
      const lista = JSON.parse(localStorage.getItem(clave) || '[]');
      return Array.isArray(lista) ? lista.filter((t) => typeof t === 'string') : [];
    } catch (e) {
      return [];
    }
  }, [clave]);
  const [recientes, setRecientes] = useState(leer);
  const guardar = useCallback((termino) => {
    const limpio = String(termino || '').trim();
    if (!limpio) return;
    const nuevas = [limpio, ...leer().filter((t) => t.toLowerCase() !== limpio.toLowerCase())].slice(0, MAX_RECIENTES);
    try { localStorage.setItem(clave, JSON.stringify(nuevas)); } catch (e) { /* sin almacenamiento */ }
    setRecientes(nuevas);
  }, [clave, leer]);
  const limpiar = useCallback(() => {
    try { localStorage.removeItem(clave); } catch (e) { /* sin almacenamiento */ }
    setRecientes([]);
  }, [clave]);
  return { recientes, guardar, limpiar, releer: () => setRecientes(leer()) };
}

/**
 * Panel del buscador: con el campo vacío, lo que buscaste antes; escribiendo,
 * productos (con foto y precio), marcas y categorías que casan, y "Ver todos
 * los resultados". Va debajo del buscador de la cabecera (escritorio) o en una
 * hoja con su propio campo (celular, `conCampo`).
 *
 *  - texto, onTexto: lo escrito (controlado)
 *  - sugerencias: { productos: [{ id, nombre, imagen, precio, url }],
 *    marcas: [{ id, nombre, logo, cuenta, url }], categorias: [{ id, nombre,
 *    cuenta, url }], total } (sugerenciasDesdeBusqueda)
 *  - buscando: se están pidiendo
 *  - recientes, onLimpiarRecientes (useBusquedasRecientes)
 *  - onBuscar(termino): ir a la página de resultados
 *  - onNavegar: al elegir un producto, marca o categoría (para cerrar)
 *  - conCampo: el panel trae su propio campo (hoja del celular)
 */
export function PanelBusqueda({
  texto = '', onTexto, sugerencias, buscando = false, recientes = [], onLimpiarRecientes, onBuscar, onNavegar,
  conCampo = false, placeholder = '¿Qué buscas? (polo, taza, gorro…)',
}) {
  const campo = useRef(null);
  // En la hoja: el campo pide el foco cuando la hoja termina de subir (si no,
  // la hoja se lo queda al abrirse y el teclado no aparece).
  useEffect(() => {
    if (!conCampo) return undefined;
    const t = setTimeout(() => campo.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [conCampo]);
  const escribiendo = texto.trim().length >= 2;
  const { productos = [], marcas = [], categorias = [], total = 0 } = sugerencias || {};

  return (
    <div className={s.panel}>
      {conCampo && (
        <form className={s.campo} role="search" onSubmit={(e) => { e.preventDefault(); onBuscar?.(texto.trim()); }}>
          <Search aria-hidden="true" />
          <input
            ref={campo}
            type="search"
            enterKeyHint="search"
            value={texto}
            onChange={(e) => onTexto?.(e.target.value)}
            placeholder={placeholder}
            aria-label="Qué buscas"
          />
          {texto && (
            <button type="button" className={s.limpiarCampo} onClick={() => { onTexto?.(''); campo.current?.focus(); }} aria-label="Borrar lo escrito">
              <X aria-hidden="true" />
            </button>
          )}
        </form>
      )}

      {!escribiendo && (recientes.length > 0 ? (
        <section className={s.bloque}>
          <div className={s.bloqueCabeza}>
            <h3 className={s.bloqueTitulo}>Buscaste hace poco</h3>
            {onLimpiarRecientes && <button type="button" className={s.enlaceChico} onClick={onLimpiarRecientes}>Borrar</button>}
          </div>
          <ul className={s.recientes}>
            {recientes.map((r) => (
              <li key={r}>
                <button type="button" className={s.reciente} onClick={() => onBuscar?.(r)}>
                  <Clock aria-hidden="true" />{r}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className={s.pista}>Escribe para ver productos, marcas y categorías.</p>
      ))}

      {escribiendo && (
        <div className={s.columnas} aria-busy={buscando}>
          <section className={s.bloque}>
            <h3 className={s.bloqueTitulo}>Productos</h3>
            {productos.length === 0 ? (
              <p className={s.pista}>{buscando ? 'Buscando…' : 'Nada con ese nombre.'}</p>
            ) : (
              <ul className={s.productos}>
                {productos.map((p) => (
                  <li key={p.id}>
                    <Enlace to={p.url} className={s.producto} onClick={onNavegar}>
                      <FotoProducto className={s.productoFoto} src={p.imagen} relleno="3px" />
                      <span className={s.productoNombre}>{p.nombre}</span>
                      {p.precio != null && <span className={s.productoPrecio}>{soles(p.precio)}</span>}
                    </Enlace>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(marcas.length > 0 || categorias.length > 0) && (
            <div className={s.atajos}>
              {marcas.length > 0 && (
                <section className={s.bloque}>
                  <h3 className={s.bloqueTitulo}>Marcas</h3>
                  <ul className={s.lista}>
                    {marcas.map((m) => (
                      <li key={m.id}>
                        <Enlace to={m.url} className={s.atajo} onClick={onNavegar}>
                          <LogoMarca variante="sello" className={s.atajoLogo} nombre={m.nombre} imagen={m.logo} alt="" giro={-6} />
                          <span className={s.atajoNombre}>{m.nombre}</span>
                          {m.cuenta != null && <span className={s.cuenta}>{m.cuenta}</span>}
                        </Enlace>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {categorias.length > 0 && (
                <section className={s.bloque}>
                  <h3 className={s.bloqueTitulo}>Categorías</h3>
                  <ul className={s.lista}>
                    {categorias.map((c) => (
                      <li key={c.id}>
                        <Enlace to={c.url} className={s.atajo} onClick={onNavegar}>
                          <span className={s.atajoNombre}>{c.nombre}</span>
                          {c.cuenta != null && <span className={s.cuenta}>{c.cuenta}</span>}
                        </Enlace>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {escribiendo && (
        <button type="button" className={s.verTodo} onClick={() => onBuscar?.(texto.trim())}>
          <span>Ver todos los resultados de <strong>«{texto.trim()}»</strong></span>
          {total > 0 && <span className={s.cuenta}>{total}</span>}
          <ArrowRight aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
