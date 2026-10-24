import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useProducts } from '../../../hooks/useProducts';
import { getCategories } from '../../../services/products';
import { getPerfilesPorUid } from '../../../services/adminProductInterest';
import { urlWhatsApp, telefonoDePerfil, aceptoWhatsApp, mensajeProductoVisto } from '../../../utils/whatsappLink';
import { fmtInt, fmtDuration } from '../dashboard/dashShared';
import { Tarjeta, Columnas, Barras, Cifras, Interruptor, Vacio } from './piezas';
import styles from './Productos.module.css';

/*
 * Productos: ¿qué se vende y qué no? Vistos contra vendidos, quién pasa tiempo
 * mirando cada producto (con WhatsApp a quien lo aceptó), líneas, colecciones,
 * búsquedas, lista de deseos y Crear. Todo del resumen diario.
 */

const soles = (cents) =>
  `S/ ${((Number(cents) || 0) / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MAX_INTERESADOS = 20;
const cuenta = (n, uno, varios) => `${fmtInt(n)} ${Number(n) === 1 ? uno : varios}`;
const fmtFecha = (ms) =>
  (ms ? new Date(ms).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export default function Productos() {
  const { analitica } = useOutletContext();
  const { data, isLoading, error } = analitica;
  const [medidaVentas, setMedidaVentas] = useState('ingresos');
  const [soloConPermiso, setSoloConPermiso] = useState(false);

  const { data: catalogo } = useProducts([], { includeHidden: true });
  const porId = useMemo(() => new Map((catalogo || []).map((p) => [String(p.id), p])), [catalogo]);
  const { data: categorias } = useQuery({
    queryKey: ['resultados-categorias'],
    queryFn: async () => (await getCategories()).data || [],
    staleTime: 30 * 60 * 1000,
  });
  const nombreCategoria = useMemo(() => {
    const m = new Map((categorias || []).map((c) => [String(c.id), c.name]));
    return (id) => m.get(String(id)) || id;
  }, [categorias]);

  const producto = (id, fallback) => {
    const p = porId.get(String(id));
    return { nombre: p?.name || fallback || 'Producto sin nombre', imagen: p?.mainImage || p?.images?.[0] || '' };
  };

  // Más vistos y más vendidos.
  const vistos = (data?.topProducts || []).map((p) => {
    const x = producto(p.productId, p.name);
    return { id: p.productId || p.name, label: x.nombre, imagen: x.imagen, valor: p.total, texto: cuenta(p.total, "vista", "vistas") };
  });
  const vendidos = (data?.topVendidos || []).map((p) => {
    const x = producto(p.productId);
    const valor = medidaVentas === 'ingresos' ? p.ingresosCents : p.unidades;
    return {
      id: p.productId,
      label: x.nombre,
      imagen: x.imagen,
      valor,
      texto: medidaVentas === 'ingresos' ? soles(p.ingresosCents) : `${fmtInt(p.unidades)} u.`,
      sub: `${fmtInt(p.pedidos)} ${p.pedidos === 1 ? 'pedido' : 'pedidos'}`,
    };
  });
  vendidos.sort((a, b) => b.valor - a.valor);

  // Interés: ranking por producto y quién lo mira (con su perfil para escribirle).
  const pares = (data?.interes?.pares || []).slice(0, 60);
  const uids = useMemo(
    () => [...new Set((data?.interes?.pares || []).slice(0, 60).map((p) => p.uid))].sort(),
    [data?.interes?.pares]
  );
  const { data: perfiles, isLoading: cargandoPerfiles } = useQuery({
    queryKey: ['resultados-perfiles-interes', uids],
    queryFn: () => getPerfilesPorUid(uids),
    enabled: uids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const interesados = pares
    .map((p) => ({ ...p, perfil: perfiles?.get(p.uid) || null }))
    .filter((p) => !soloConPermiso || aceptoWhatsApp(p.perfil))
    .slice(0, MAX_INTERESADOS);
  const masMirados = (data?.interes?.productos || []).map((p) => {
    const x = producto(p.productId);
    return {
      id: p.productId,
      label: x.nombre,
      imagen: x.imagen,
      valor: p.dwellMs,
      texto: fmtDuration(p.dwellMs),
      sub: p.personas ? `${cuenta(p.personas, 'persona', 'personas')} con cuenta` : 'Solo visitantes sin cuenta',
    };
  });

  // Líneas: vistas (categorías de lo visto) y vendidas (línea de lo vendido).
  const lineasVistas = (data?.topCategoriesByViews || []).map((c) => ({
    id: c.id || c.name, label: c.name || nombreCategoria(c.id), valor: c.total, texto: cuenta(c.total, "vista", "vistas"),
  }));
  const lineasVendidas = useMemo(() => {
    const m = new Map();
    (data?.topVendidos || []).forEach((p) => {
      const clave = p.linea || 'Sin línea';
      const x = m.get(clave) || { id: clave, cents: 0, unidades: 0 };
      x.cents += p.ingresosCents;
      x.unidades += p.unidades;
      m.set(clave, x);
    });
    return [...m.values()]
      .map((l) => ({ id: l.id, label: l.id === 'Sin línea' ? l.id : nombreCategoria(l.id), valor: l.cents, texto: soles(l.cents), sub: `${fmtInt(l.unidades)} u.` }))
      .sort((a, b) => b.valor - a.valor);
  }, [data?.topVendidos, nombreCategoria]);

  const colecciones = (data?.topCollectionsByViews || []).map((c) => ({
    id: c.id || c.name, label: c.name || c.id, valor: c.total, texto: cuenta(c.total, "vista", "vistas"),
  }));
  const busquedas = (data?.topSearches || []).map((s) => ({
    id: s.query, label: `"${s.query}"`, valor: s.total, texto: cuenta(s.total, "vez", "veces"),
  }));
  const deseos = (data?.deseos?.topProductos || []).map((p) => {
    const x = producto(p.productId, p.nombre);
    return { id: p.productId, label: x.nombre, imagen: x.imagen, valor: p.agregados, texto: cuenta(p.agregados, 'vez', 'veces') };
  });

  if (error) return <Vacio>No se pudieron cargar los datos: {error.message}</Vacio>;
  if (isLoading && !data) return <Vacio>Cargando…</Vacio>;
  const sinResultados = !data?.diasConResultados;

  return (
    <div className={styles.pagina}>
      {sinResultados && (
        <p className={styles.nota}>
          Ventas, interés, deseos y Crear se suman desde el 24/10/2026. Para los días anteriores, usa "Reconstruir el resumen diario" en Detalle técnico.
        </p>
      )}

      <Columnas>
        <Tarjeta id="mas-vistos" titulo="Más vistos" ayuda="Veces que abrieron la ficha del producto.">
          <Barras filas={vistos} vacio="Nadie abrió fichas de producto en este periodo." />
        </Tarjeta>
        <Tarjeta
          id="mas-vendidos"
          titulo="Más vendidos"
          ayuda="De los pedidos enviados desde la tienda y la app."
          acciones={(
            <Interruptor
              etiqueta="Ordenar ventas por"
              valor={medidaVentas}
              onChange={setMedidaVentas}
              opciones={[{ id: 'ingresos', label: 'Soles' }, { id: 'unidades', label: 'Unidades' }]}
            />
          )}
        >
          <Barras filas={vendidos} color="#0E7F57" vacio="Sin pedidos en este periodo." />
        </Tarjeta>
      </Columnas>

      <Tarjeta
        id="interes"
        titulo="Los que más miran"
        ayuda="Tiempo en la ficha de cada producto y quién se quedó mirando al menos 30 segundos. Escríbeles mientras lo tienen en mente."
      >
        <Columnas>
          <Barras filas={masMirados} vacio="Sin tiempo registrado en fichas de producto." />
          <div className={styles.interesados}>
            <label className={styles.filtro}>
              <input
                id="solo-con-permiso"
                type="checkbox"
                checked={soloConPermiso}
                onChange={(e) => setSoloConPermiso(e.target.checked)}
              />
              Solo quienes aceptaron WhatsApp
            </label>
            {interesados.length === 0 ? (
              <Vacio>{soloConPermiso ? 'Nadie de este periodo aceptó recibir mensajes por WhatsApp.' : 'Nadie con cuenta se quedó mirando un producto.'}</Vacio>
            ) : (
              <ul className={styles.listaInteresados}>
                {interesados.map((l) => {
                  const p = porId.get(String(l.productId));
                  const nombre = l.perfil?.displayName || l.nombre || 'Cliente';
                  const telefono = telefonoDePerfil(l.perfil);
                  const permiso = aceptoWhatsApp(l.perfil);
                  const url = p && telefono && permiso ? urlWhatsApp(telefono, mensajeProductoVisto(nombre, p)) : null;
                  return (
                    <li key={`${l.uid}|${l.productId}`} className={styles.interesado}>
                      <div className={styles.interesadoTexto}>
                        <strong>{nombre}</strong>
                        <span>{p?.name || 'Producto'} · {fmtDuration(l.dwellMs)} · {fmtFecha(l.ultimaMs)}</span>
                      </div>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.whatsapp}>WhatsApp</a>
                      ) : (
                        <span className={styles.sinBoton}>
                          {cargandoPerfiles ? '…' : !telefono ? 'Sin teléfono' : !permiso ? 'No aceptó WhatsApp' : '—'}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Columnas>
      </Tarjeta>

      <Columnas>
        <Tarjeta id="lineas-vistas" titulo="Líneas más vistas">
          <Barras filas={lineasVistas} vacio="Los productos vistos no tienen línea asignada." />
        </Tarjeta>
        <Tarjeta id="lineas-vendidas" titulo="Líneas más vendidas">
          <Barras filas={lineasVendidas} color="#0E7F57" vacio="Sin pedidos en este periodo." />
        </Tarjeta>
      </Columnas>

      <Columnas>
        <Tarjeta id="colecciones" titulo="Colecciones más vistas" ayuda="Cuando filtran la tienda por una colección o temporada.">
          <Barras filas={colecciones} vacio="Nadie filtró por colección en este periodo." />
        </Tarjeta>
        <Tarjeta id="busquedas" titulo="Lo más buscado" ayuda="Si algo se busca mucho y no lo tienes, es una idea de producto.">
          <Barras filas={busquedas} vacio="Sin búsquedas en este periodo." />
        </Tarjeta>
      </Columnas>

      <Columnas>
        <Tarjeta id="deseos" titulo="Lista de deseos">
          <Cifras items={[
            { label: 'Agregados', valor: fmtInt(data?.deseos?.agregados?.total || 0) },
            { label: 'Quitados', valor: fmtInt(data?.deseos?.quitados?.total || 0) },
          ]}
          />
          <Barras filas={deseos} vacio="Nadie agregó productos a su lista en este periodo." />
        </Tarjeta>
        <Tarjeta id="crear" titulo="Crear" ayuda="El estudio donde diseñan su prenda.">
          <Cifras items={[
            { label: 'Abrieron Crear', valor: fmtInt(data?.crear?.aperturas?.total || 0) },
            { label: 'Abrieron un combo', valor: fmtInt(data?.crear?.aperturasCombo?.total || 0) },
            { label: 'Creaciones guardadas', valor: fmtInt(data?.crear?.guardados?.total || 0) },
          ]}
          />
        </Tarjeta>
      </Columnas>
    </div>
  );
}
