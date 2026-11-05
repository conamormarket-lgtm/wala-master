import React, { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Plus, RotateCcw, Star, X } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, EstadoVacio, useToast } from '../../Feedback';
import { EsqueletoFila } from '../../Esqueletos';
import { FotoProducto } from '../../piezas/FotoProducto';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { ListaOrdenable, SelectorProductos } from '../../piezas/admin/Datos';
import s from './Destacados.module.css';

/*
 * Destacados (/admin/destacados, D1): la fila «Destacados» de la tienda. En
 * el inicio salen todos; en la página de cada marca, solo los suyos; siempre
 * en este orden. Arriba la fila (se arrastra y se guarda con "Guardar orden"),
 * después agregar uno (buscar) y las ideas: lo más vendido de 30 días que aún
 * no está. Agregar y sacar se guardan al momento.
 */

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
const ids = (lista) => lista.map((p) => p.id).join('|');

function Producto({ p, detalle, children }) {
  return (
    <div className={s.producto}>
      <FotoProducto src={p.imagen} className={s.foto} />
      <span className={s.textos}>
        <strong>{p.nombre}</strong>
        <span>{detalle || soles(p.precio)}{p.oculto ? ' · Oculto en la tienda' : ''}</span>
      </span>
      {children}
    </div>
  );
}

/**
 * Los destacados de la portada.
 *  - productos: el catálogo ([{ id, nombre, imagen, precio, oculto, destacado, ordenDestacado }], productoAdminDesde)
 *  - cargando · error · onReintentar
 *  - masVendidos: { filas: [{ id, unidades }], cargando, error, disponible } (los 10 de 30 días;
 *    los que no están en el catálogo no salen)
 *  - marcas: [{ id, nombre }] (para decir en qué página de marca sale cada uno)
 *  - onDestacar(id) · onQuitar(id) → promesas · onGuardarOrden(ids) → promesa
 *  - onVerTienda() (abre la tienda)
 */
export function PaginaDestacados({ productos = [], cargando, error, onReintentar, masVendidos = {}, marcas = [], onDestacar, onQuitar, onGuardarOrden, onVerTienda }) {
  const toast = useToast();
  const destacados = useMemo(
    () => productos.filter((p) => p.destacado).sort((a, b) => (a.ordenDestacado - b.ordenDestacado) || a.nombre.localeCompare(b.nombre, 'es')),
    [productos],
  );
  const [orden, setOrden] = useState(destacados);
  const [guardando, setGuardando] = useState(false);
  const [quitando, setQuitando] = useState(null);

  // Llega uno nuevo o se va uno: se suma al final o se quita, sin perder el orden que estás armando.
  useEffect(() => {
    setOrden((actual) => {
      const vigentes = new Map(destacados.map((p) => [p.id, p]));
      const quedan = actual.filter((p) => vigentes.has(p.id)).map((p) => vigentes.get(p.id));
      const nuevos = destacados.filter((p) => !quedan.some((q) => q.id === p.id));
      return [...quedan, ...nuevos];
    });
  }, [destacados]);

  const cambiado = ids(orden) !== ids(destacados);
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const vendidos = (masVendidos.filas || []).map((f) => ({ ...f, p: porId.get(f.id) })).filter((f) => f.p);
  const nombreMarca = useMemo(() => new Map(marcas.map((m) => [m.id, m.nombre])), [marcas]);
  // Dónde sale: siempre en el inicio y, si es de una marca, también en su página.
  const dondeSale = (p) => (nombreMarca.get(p.marcaId) ? `Inicio y ${nombreMarca.get(p.marcaId)}` : 'Solo en el inicio');
  const puestoDe = (id) => orden.findIndex((x) => x.id === id) + 1;

  const accion = async (fn, p, titulo) => {
    try {
      await fn(p.id);
      toast({ tipo: 'exito', titulo, texto: p.nombre });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se guardó', texto: err?.message || 'Vuelve a intentar.' });
    }
  };
  const destacar = (p) => accion(onDestacar, p, 'Agregado al final de la fila');
  const quitar = async (p) => { setQuitando(p.id); await accion(onQuitar, p, 'Sacado de la fila'); setQuitando(null); };
  const guardarOrden = async () => {
    setGuardando(true);
    try {
      await onGuardarOrden(orden.map((p) => p.id));
      toast({ tipo: 'exito', titulo: 'Orden guardado', texto: 'Así salen en la tienda.' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se guardó el orden', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={s.pagina} data-componente="PaginaDestacados">
      <CabezaAdmin
        icono="destacados"
        tono="rosa"
        titulo="Destacados"
        subtitulo="La fila «Destacados» de la tienda. En el inicio salen todos; en la página de cada marca, solo los de esa marca. Siempre en este orden."
        acciones={onVerTienda ? <Boton tamano="sm" variante="secundario" icono={<ExternalLink aria-hidden="true" />} onClick={onVerTienda}>Ver en la tienda</Boton> : undefined}
      />

      <section className={s.bloque} aria-labelledby="destacados-portada">
        <div className={s.bloqueCabeza}>
          <h2 id="destacados-portada" className={s.bloqueTitulo}>En la fila{!cargando && !error ? ` · ${orden.length}` : ''}</h2>
          {cambiado && <span className={s.cambiado}>Cambiaste el orden: guárdalo abajo</span>}
        </div>
        <p className={s.bloqueAyuda}>El 1 sale primero. Arrastra (o usa las flechas) para cambiar el orden. La × lo saca de la fila.</p>
        {cargando ? (
          <div className={s.esqueleto}>{[0, 1, 2].map((i) => <EsqueletoFila key={i} />)}</div>
        ) : error ? (
          <Aviso tipo="error" titulo="No pudimos cargar los destacados" accion={onReintentar && <Boton tamano="sm" variante="contorno" onClick={onReintentar}>Reintentar</Boton>}>{error}</Aviso>
        ) : orden.length ? (
          <>
            <ListaOrdenable
              items={orden}
              nombreDe={(p) => p.nombre}
              onCambiar={setOrden}
              etiqueta="Orden de los destacados"
              render={(p) => (
                <Producto p={p} detalle={`${soles(p.precio)} · ${dondeSale(p)}`}>
                  <Boton soloIcono tamano="sm" variante="fantasma" icono={<X aria-hidden="true" />} cargando={quitando === p.id} onClick={() => quitar(p)} aria-label={`Sacar ${p.nombre} de la fila`} title="Sacar de la fila" />
                </Producto>
              )}
            />
            {cambiado && (
              <div className={s.guardar}>
                <Boton variante="fantasma" icono={<RotateCcw aria-hidden="true" />} onClick={() => setOrden(destacados)} disabled={guardando}>Deshacer</Boton>
                <Boton icono={<Check aria-hidden="true" />} cargando={guardando} onClick={guardarOrden}>Guardar orden</Boton>
              </div>
            )}
          </>
        ) : (
          <div className={s.vacio}>
            <EstadoVacio imagen={null} icono={<Star aria-hidden="true" />} titulo="La fila está vacía" texto="Agrega productos abajo: búscalos o elige de lo más vendido. Sin destacados, la fila no sale en la tienda." />
          </div>
        )}
      </section>

      <section className={s.bloque} aria-labelledby="destacados-agregar">
        <h2 id="destacados-agregar" className={s.bloqueTitulo}>Agregar a la fila</h2>
        <p className={s.bloqueAyuda}>Busca cualquier producto (también uno que todavía no vende y quieres impulsar). Entra al final; después lo subes.</p>
        <SelectorProductos productos={productos} yaEstan={orden.map((p) => p.id)} onElegir={destacar} accion="Agregar" accionHecha="Ya está en la fila" />
      </section>

      <section className={s.bloque} aria-labelledby="destacados-vendidos">
        <h2 id="destacados-vendidos" className={s.bloqueTitulo}>Ideas: lo más vendido · 30 días</h2>
        <p className={s.bloqueAyuda}>Lo que más se vendió en la tienda (web y app) este último mes, para que no falte en la fila. Solo es una ayuda: esta lista no sale en la tienda.</p>
        {masVendidos.cargando ? (
          <div className={s.esqueleto}>{[0, 1, 2].map((i) => <EsqueletoFila key={i} />)}</div>
        ) : masVendidos.error ? (
          <Aviso tipo="error" titulo="No pudimos leer las ventas">{masVendidos.error}</Aviso>
        ) : !masVendidos.disponible || !vendidos.length ? (
          <p className={s.bloqueAyuda}>Todavía no hay ventas de la tienda en estos 30 días.</p>
        ) : (
          <ol className={s.vendidos}>
            {vendidos.map(({ p, unidades }, i) => {
              const esta = orden.some((x) => x.id === p.id);
              return (
                <li key={p.id}>
                  <span className={s.puesto}>{i + 1}</span>
                  <Producto p={p} detalle={`${unidades} ${unidades === 1 ? 'vendido' : 'vendidos'} · ${soles(p.precio)}`}>
                    {esta ? (
                      <span className={s.enFila}><Check aria-hidden="true" /> En la fila · puesto {puestoDe(p.id)}</span>
                    ) : (
                      <Boton tamano="sm" variante="secundario" icono={<Plus aria-hidden="true" />} onClick={() => destacar(p)}>Agregar</Boton>
                    )}
                  </Producto>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
