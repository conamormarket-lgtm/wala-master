import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Clock, Search, X } from 'lucide-react';
import { IconoWala } from '../IconosWala';
import { Trazo } from '../Marca';
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

const sinTildes = (t) => String(t || '').normalize('NFC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Un texto con lo buscado resaltado (sin importar tildes ni mayúsculas):
 * "Casaca One Piece" con "casaca" → la palabra en violeta y negrita.
 *  - texto, buscado
 */
export function TextoResaltado({ texto = '', buscado = '' }) {
  const original = String(texto).normalize('NFC');
  const base = sinTildes(original);
  const palabras = sinTildes(buscado).split(/\s+/).filter((p) => p.length >= 2);
  if (!palabras.length || base.length !== original.length) return original;
  const marca = new Array(original.length).fill(false);
  palabras.forEach((p) => {
    let i = base.indexOf(p);
    while (i !== -1) { for (let k = i; k < i + p.length; k++) marca[k] = true; i = base.indexOf(p, i + p.length); }
  });
  const trozos = [];
  for (let i = 0; i < original.length;) {
    let j = i;
    while (j < original.length && marca[j] === marca[i]) j++;
    trozos.push(marca[i] ? <mark key={i} className={s.coincide}>{original.slice(i, j)}</mark> : original.slice(i, j));
    i = j;
  }
  return <>{trozos}</>;
}

/**
 * Chips para buscar o afinar: recientes (reloj), ideas (violeta suave),
 * categorías para afinar (con su foto y su cuenta; la elegida, llena).
 *  - items: [{ id?, texto, onClick, imagen?, cuenta?, activo? }]
 *  - tipo: 'reciente' | 'idea' | 'afinar'
 */
export function ChipsBusqueda({ items = [], tipo = 'idea' }) {
  if (!items.length) return null;
  return (
    <ul className={s.chips}>
      {items.map((it) => (
        <li key={it.id || it.texto}>
          <button
            type="button"
            className={[s.chip, s[`chip_${tipo}`], it.activo && s.chipActivo].filter(Boolean).join(' ')}
            aria-pressed={tipo === 'afinar' ? Boolean(it.activo) : undefined}
            onClick={it.onClick}
          >
            {tipo === 'reciente' && <Clock aria-hidden="true" />}
            {tipo === 'idea' && <Search aria-hidden="true" />}
            {tipo === 'afinar' && it.imagen && <img src={it.imagen} alt="" loading="lazy" decoding="async" className={s.chipFoto} />}
            <span className={s.chipTexto}>{it.texto}</span>
            {it.cuenta != null && <span className={s.chipCuenta}>{it.cuenta}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Lo que se está buscando, con la voz de Walá. Sin término: "¿Qué se te
 * antoja hoy?"; con término: "Resultados para" y «el término» en grande con
 * su subrayado a mano. La usan el panel vacío y la página de resultados.
 *  - termino · grande (página) · como: etiqueta del título ('p' o 'h1')
 *  - titulo: otro título sin término (el que guarde el admin); sin él, la
 *    pregunta de Walá
 *  - texto: la línea de abajo (sin término)
 */
export function InvitacionBusqueda({ termino = '', grande = false, como: Titulo = 'p', titulo, texto = 'Escribe un producto, una marca o tu personaje favorito.' }) {
  return (
    <div className={[s.invitacion, grande && s.invitacionGrande].filter(Boolean).join(' ')}>
      <IconoWala nombre={termino ? 'estrella' : 'destello'} tamano={grande ? 58 : 46} girar={-8} />
      <div className={s.invitacionTexto}>
        {termino ? (
          <>
            <p className={s.invitacionAntes}>Resultados para</p>
            <Titulo className={s.invitacionTitulo}>
              <span className={s.resaltado}>«{termino}»<Trazo className={s.trazo} /></span>
            </Titulo>
          </>
        ) : (
          <>
            <Titulo className={s.invitacionTitulo}>
              {titulo || <>¿Qué se te <span className={s.resaltado}>antoja<Trazo className={s.trazo} /></span> hoy?</>}
            </Titulo>
            {texto && <p className={s.pista}>{texto}</p>}
          </>
        )}
      </div>
    </div>
  );
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
 *  - ideas: términos para empezar ("Lo más buscado": en la tienda, las
 *    categorías con más productos o los términos más buscados). Con el campo
 *    vacío y sin recientes, el panel invita a buscar con ellos.
 *  - onBuscar(termino): ir a la página de resultados
 *  - onNavegar: al elegir un producto, marca o categoría (para cerrar)
 *  - conCampo: el panel trae su propio campo (hoja del celular)
 */
export function PanelBusqueda({
  texto = '', onTexto, sugerencias, buscando = false, recientes = [], ideas = [], onLimpiarRecientes, onBuscar, onNavegar,
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

      {/* Sin nada que recordar: una invitación de Walá, no una línea gris. */}
      {!escribiendo && recientes.length === 0 && <InvitacionBusqueda />}

      {!escribiendo && recientes.length > 0 && (
        <section className={s.bloque}>
          <div className={s.bloqueCabeza}>
            <h3 className={s.bloqueTitulo}>Buscaste hace poco</h3>
            {onLimpiarRecientes && <button type="button" className={s.enlaceChico} onClick={onLimpiarRecientes}>Borrar</button>}
          </div>
          <ChipsBusqueda tipo="reciente" items={recientes.map((r) => ({ texto: r, onClick: () => onBuscar?.(r) }))} />
        </section>
      )}

      {!escribiendo && ideas.length > 0 && (
        <section className={s.bloque}>
          <h3 className={s.bloqueTitulo}>Lo más buscado</h3>
          <ChipsBusqueda tipo="idea" items={ideas.map((idea) => ({ texto: idea, onClick: () => onBuscar?.(idea) }))} />
        </section>
      )}

      {escribiendo && (
        <div className={s.columnas} aria-busy={buscando}>
          <section className={s.bloque}>
            <h3 className={s.seccionTitulo}>Productos{total > 0 && <span> · {total}</span>}</h3>
            {productos.length === 0 ? (
              <p className={s.pista}>{buscando ? 'Buscando…' : 'Nada con ese nombre.'}</p>
            ) : (
              <ul className={s.productos}>
                {productos.map((p) => (
                  <li key={p.id}>
                    <Enlace to={p.url} className={s.producto} onClick={onNavegar}>
                      <FotoProducto className={s.productoFoto} src={p.imagen} relleno="3px" />
                      <span className={s.productoNombre}><TextoResaltado texto={p.nombre} buscado={texto} /></span>
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
                  <h3 className={s.seccionTitulo}>Marcas</h3>
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
                  <h3 className={s.seccionTitulo}>Categorías</h3>
                  <ul className={s.chips}>
                    {categorias.map((c) => (
                      <li key={c.id}>
                        <Enlace to={c.url} className={`${s.chip} ${s.chip_afinar}`} onClick={onNavegar}>
                          {c.imagen && <img src={c.imagen} alt="" loading="lazy" decoding="async" className={s.chipFoto} />}
                          <span className={s.chipTexto}>{c.nombre}</span>
                          {c.cuenta != null && <span className={s.chipCuenta}>{c.cuenta}</span>}
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
          <span className={s.verTodoTexto}>
            {total > 0 ? <>Ver {total === 1 ? 'el resultado' : <>los <strong>{total}</strong> resultados</>} de </> : 'Buscar '}
            <strong>«{texto.trim()}»</strong>
          </span>
          <span className={s.verTodoSello} aria-hidden="true"><ArrowRight /></span>
        </button>
      )}
    </div>
  );
}
