import React, { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Star, X } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, EstadoVacio, useToast } from '../../Feedback';
import { EsqueletoFila } from '../../Esqueletos';
import { FotoProducto } from '../../piezas/FotoProducto';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { ListaOrdenable, SelectorProductos } from '../../piezas/admin/Datos';
import s from './Destacados.module.css';

/*
 * Destacados (/admin/destacados, D1): los productos de la portada en su
 * orden, buscar uno para destacarlo y lo más vendido de Walá (30 días) para
 * destacarlo con un toque. Destacar y quitar se guardan al momento; el orden,
 * con "Guardar orden" (se arrastra o con las flechas).
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
 *  - onDestacar(id) · onQuitar(id) → promesas · onGuardarOrden(ids) → promesa
 */
export function PaginaDestacados({ productos = [], cargando, error, onReintentar, masVendidos = {}, onDestacar, onQuitar, onGuardarOrden }) {
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

  const accion = async (fn, p, titulo) => {
    try {
      await fn(p.id);
      toast({ tipo: 'exito', titulo, texto: p.nombre });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se guardó', texto: err?.message || 'Vuelve a intentar.' });
    }
  };
  const destacar = (p) => accion(onDestacar, p, 'Destacado en la portada');
  const quitar = async (p) => { setQuitando(p.id); await accion(onQuitar, p, 'Quitado de la portada'); setQuitando(null); };
  const guardarOrden = async () => {
    setGuardando(true);
    try {
      await onGuardarOrden(orden.map((p) => p.id));
      toast({ tipo: 'exito', titulo: 'Orden guardado', texto: 'Así salen en la portada.' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se guardó el orden', texto: err?.message || 'Vuelve a intentar.' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={s.pagina} data-componente="PaginaDestacados">
      <CabezaAdmin icono="destacados" tono="rosa" titulo="Destacados" subtitulo="Los productos que salen como destacados en la portada, en este orden." />

      <section className={s.bloque} aria-labelledby="destacados-portada">
        <div className={s.bloqueCabeza}>
          <h2 id="destacados-portada" className={s.bloqueTitulo}>En la portada{!cargando && !error ? ` · ${orden.length}` : ''}</h2>
          {cambiado && <span className={s.cambiado}>Cambiaste el orden</span>}
        </div>
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
                <Producto p={p}>
                  <Boton soloIcono tamano="sm" variante="fantasma" icono={<X aria-hidden="true" />} cargando={quitando === p.id} onClick={() => quitar(p)} aria-label={`Quitar ${p.nombre} de la portada`} title="Quitar de la portada" />
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
            <EstadoVacio imagen={null} icono={<Star aria-hidden="true" />} titulo="La portada no tiene destacados" texto="Busca un producto abajo o destaca uno de los más vendidos." />
          </div>
        )}
      </section>

      <section className={s.bloque} aria-labelledby="destacados-agregar">
        <h2 id="destacados-agregar" className={s.bloqueTitulo}>Destacar otro</h2>
        <p className={s.bloqueAyuda}>Sirve para impulsar productos que todavía no venden. Sale al final; después lo ordenas.</p>
        <SelectorProductos productos={productos} yaEstan={orden.map((p) => p.id)} onElegir={destacar} accion="Destacar" accionHecha="Destacado" />
      </section>

      <section className={s.bloque} aria-labelledby="destacados-vendidos">
        <h2 id="destacados-vendidos" className={s.bloqueTitulo}>Lo más vendido · 30 días</h2>
        <p className={s.bloqueAyuda}>Las compras de la tienda (web y app), por unidades. No cuenta los pedidos del ERP.</p>
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
                      <Boton tamano="sm" variante="fantasma" cargando={quitando === p.id} onClick={() => quitar(p)}>Quitar</Boton>
                    ) : (
                      <Boton tamano="sm" variante="secundario" icono={<Star aria-hidden="true" />} onClick={() => destacar(p)}>Destacar</Boton>
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
