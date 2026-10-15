import React, { useMemo, useState } from 'react';
import { PaginaProducto, fichaProductoDesde, opinionesDesde, tarjetaDesdeProducto } from './kit';
import FICHAS from './demo/producto.json';
import TIENDA from './demo/tienda.json';
import INICIO from './demo/inicio.json';

/*
 * La ficha de producto (/producto/:id) en la Tienda de prueba. Cualquier
 * tarjeta de la demo abre la suya: con el documento completo de
 * demo/producto.json (descripción, variantes y las prendas de un combo) si
 * está, o con el de la lista (sin descripción) si no.
 */

const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** Estados para probar la ficha. */
export const ESTADOS_PRODUCTO = [
  ['cargando', 'Cargando'],
  ['error', 'Error al cargar'],
  ['noDisponible', 'Ya no está disponible'],
  ['agotado', 'Agotado'],
  ['personalizable', 'Personalizable'],
  ['sinOpiniones', 'Sin opiniones'],
];

/** Para "Cómo se abre": un producto de cada tipo. */
export const ABRIR_PRODUCTO = [
  ['Prenda con colores y tallas', '/producto/sqxf0goHABLcnqVFxoS7'],
  ['Sin opciones', '/producto/mussa-skin1004-centella-soothing-cream'],
  ['Combo de pareja', '/producto/parejas-rodar-contigo-combo'],
  ['Un modelo', '/producto/z4CmzlhW29u3eOdIlNfw'],
];

const TODOS = (() => {
  const m = new Map();
  [...TIENDA.productos, ...Object.values(INICIO.productos).flat()].forEach((p) => { if (p?.id && !m.has(p.id)) m.set(p.id, p); });
  FICHAS.productos.forEach((p) => m.set(p.id, { ...m.get(p.id), ...p }));
  return m;
})();

/*
 * Opiniones DE EJEMPLO (la tienda casi no tiene reseñas todavía): sirven para
 * ver el resumen, la destacada, las fotos y "Útil". No son de clientes reales.
 */
const OPINIONES_EJEMPLO = [
  { id: 'o1', userName: 'Andrea Pérez', rating: 5, comment: 'La tela es gruesa y abriga un montón. El estampado no se despegó después de varias lavadas.', helpfulVotes: ['a', 'b', 'c'], foto: true, dias: 3 },
  { id: 'o2', userName: 'Luis Mendoza', rating: 5, comment: 'Llegó en dos días a Arequipa. La talla M me quedó perfecta.', helpfulVotes: ['a'], dias: 9 },
  { id: 'o3', userName: 'Camila', rating: 4, comment: 'Muy bonita, el color es un poco más claro que en la foto pero igual me encantó.', helpfulVotes: [], foto: true, dias: 15 },
  { id: 'o4', userName: 'Jorge Quispe', rating: 5, comment: 'Se la regalé a mi hermano y le encantó. Volveré a comprar.', helpfulVotes: [], dias: 21 },
  { id: 'o5', userName: 'Valeria Rojas', rating: 3, comment: 'Bonita, pero la manga me quedó un poco larga. Pediría una talla menos.', helpfulVotes: ['b'], dias: 34 },
  { id: 'o6', userName: 'Diego Salas', rating: 5, comment: 'Excelente calidad por el precio.', helpfulVotes: [], dias: 40 },
];

const opinionesDe = (p) => OPINIONES_EJEMPLO.map((o) => ({
  ...o,
  productId: p.id,
  createdAt: Date.now() - o.dias * 864e5,
  imageUrls: o.foto ? [p.images?.[0] || p.mainImage].filter(Boolean) : [],
}));

export function ProductoDemo({ ruta = ABRIR_PRODUCTO[0][1], sesion, estados = [], marcas = [], carrito = 0, onCarrito, onAgregar, toast, onIrA }) {
  const id = ruta.split('?')[0].split('/')[2];
  const crudo = TODOS.get(id) || TODOS.get(ABRIR_PRODUCTO[0][1].split('/')[2]);
  const p = {
    ...crudo,
    ...(estados.includes('agotado') && { inStock: 0 }),
    ...(estados.includes('personalizable') && { customizable: true }),
  };
  const catalogo = { marcas, categorias: TIENDA.categorias };
  const subproductos = Object.fromEntries((p.comboItems || []).map((it) => [it.productId, TODOS.get(it.productId)]).filter(([, x]) => x));
  const ficha = fichaProductoDesde(p, { catalogo, subproductos });
  const [resenas, setResenas] = useState(() => opinionesDe(p));
  const opiniones = useMemo(() => opinionesDesde(estados.includes('sinOpiniones') ? [] : resenas, { uid: sesion ? 'yo' : undefined }), [resenas, estados, sesion]);
  const relacionadosCrudos = useMemo(() => [...TODOS.values()]
    .filter((x) => x.id !== p.id && x.visible !== false && !x.esPrendaBase && (x.categories || []).some((c) => (p.categories || []).includes(c)))
    .slice(0, 12), [p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const avisar = (titulo, texto, tipo = 'exito') => toast?.({ tipo, titulo, texto, duracion: 2200 });

  const describir = ({ variante, opcion, piezas }) => [
    ficha.opciones.piezas.length ? ficha.opciones.piezas.map((pz, i) => `${pz.nombre}: ${piezas[i]}`).join(', ') : ficha.opciones.variantes.length > 1 && variante?.nombre,
    opcion && `${ficha.opciones.etiquetaOpcion} ${opcion}`,
  ].filter(Boolean).join(' · ');
  const agregar = async (e) => {
    await espera(500);
    onCarrito?.({ id: `${p.id}-${Date.now()}`, imagen: ficha.fotos.base[0]?.url, nombre: p.name, precio: ficha.producto.precio, precioAntes: ficha.producto.precioAntes, cantidad: e.cantidad, variante: describir(e), url: `/producto/${p.id}` });
    avisar('¡Agregado al carrito!', `${p.name}${describir(e) ? ` · ${describir(e)}` : ''} × ${e.cantidad}`);
  };

  let estado;
  if (estados.includes('cargando')) estado = 'cargando';
  else if (estados.includes('error')) estado = 'error';
  else if (estados.includes('noDisponible')) estado = 'noDisponible';

  return (
    <PaginaProducto
      key={`${id}-${estados.join()}`}
      estado={estado}
      {...ficha}
      opiniones={opiniones}
      sesion={sesion}
      carrito={carrito}
      relacionados={relacionadosCrudos.map((x) => tarjetaDesdeProducto(x, { catalogo }))}
      onAgregarRelacionado={(i) => onAgregar?.(relacionadosCrudos[i])}
      onAgregar={agregar}
      onComprar={async (e) => { await agregar(e); onIrA?.('/checkout'); }}
      onPersonalizar={() => onIrA?.(`/editor/${p.id}`)}
      onCompartir={async () => { await espera(200); avisar('¡Enlace copiado!', 'Compártelo y gana monedas cuando alguien compre.'); }}
      onOpinar={async ({ puntuacion, texto, fotos }) => {
        await espera(700);
        setResenas((r) => [{ id: `n${Date.now()}`, userName: 'Tú', rating: puntuacion, comment: texto, helpfulVotes: [], createdAt: Date.now(), imageUrls: fotos.map((f) => URL.createObjectURL(f)) }, ...r]);
        avisar('¡Gracias por tu opinión!');
      }}
      onUtil={(rid) => {
        if (!sesion) { avisar('Inicia sesión para votar', undefined, 'info'); return; }
        setResenas((r) => r.map((o) => (o.id !== rid ? o : { ...o, helpfulVotes: o.helpfulVotes.includes('yo') ? o.helpfulVotes.filter((v) => v !== 'yo') : [...o.helpfulVotes, 'yo'] })));
      }}
      onReintentar={() => avisar('Volviendo a cargar', undefined, 'info')}
    />
  );
}
