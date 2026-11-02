import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { Archive, Eye, EyeOff, Trash2 } from 'lucide-react';
import {
  MarcoAdmin, SinPermiso, CabezaAdmin, PaginaInicioAdmin, PaginaCategorias, InsigniaEstado, ESTADOS_ADMIN, AccionesLote,
  PaginaColecciones, PaginaAtributos, PaginaEnvios, PaginaCliparts, PaginaMarcas, PaginaProductosMarca, PaginaDestacados,
  PaginaProductos, PaginaInventario, PaginaRecomendar, PaginaFichaProducto, fichaDesdeProducto, fichaAProducto,
  PaginaPersonalizables, PaginaPacks, personalizableDesde, packDesdeFirestore,
  CampoImagen, TablaAdmin, EstadoVacio, Boton, Chip, Pestanas, ProveedorEnlaces, useToast,
  menuAdminPara, accesosAdminPara, puedeVer, opcionActiva, categoriaDesdeFirestore, marcaAdminDesdeFirestore,
  coleccionDesdeFirestore, atributoDesdeFirestore, usosDeAtributo, zonaDesdeFirestore, clipartDesdeFirestore, marcaDesdeFirestore,
  productoAdminDesde, tarjetaDesdeProducto,
} from './kit';
import TIENDA from './demo/tienda.json';
import CREAR from './demo/crear.json';
import { leerPlantillas, prendaBaseParaGuardar } from '../utils/prendaBase';
import MARCAS_TIENDA from './demo/marcas.json';
import cs from './ComponentesPage.module.css';
import s from './DemoAdmin.module.css';

/*
 * El panel administrativo armado solo con el kit (guía: kit/guia/ADMIN.md).
 *  - Panel de prueba: MarcoAdmin con el menú real filtrado por permiso; los
 *    enlaces navegan. Hechos: el inicio (D0) y el catálogo base (D1):
 *    categorías, colecciones, marcas y sus productos, atributos, zonas de
 *    envío, cliparts y destacados; y de D2a, productos, inventario y
 *    datos para recomendar, con la copia real de la tienda
 *    (demo/tienda.json y demo/marcas.json; las zonas y los cliparts son de
 *    ejemplo). El resto de las secciones dice en qué apartado se hará.
 *  - Piezas del admin: las piezas sueltas con sus estados.
 * Guardar, eliminar y subir se simulan ("Guardar y subir fallan" para ver el error).
 */

const PERFILES = [
  { id: 'super', texto: 'Super Admin', permisos: ['superadmin'], rol: 'Super Admin' },
  { id: 'catalogo', texto: 'Catálogo', permisos: ['manage_products', 'manage_inventory'], rol: 'Catálogo e inventario' },
  { id: 'inventario', texto: 'Solo inventario', permisos: ['manage_inventory'], rol: 'Inventario' },
  { id: 'clientes', texto: 'Clientes', permisos: ['manage_clients'], rol: 'Clientes y pagos' },
];

const TAMANOS = [
  { id: 'ancho', texto: 'Computadora' },
  { id: 'celular', texto: 'Celular' },
];

const ESTADOS = [
  ['cargando', 'Cargando'],
  ['error', 'Error al cargar'],
  ['vacio', 'Sin datos'],
  ['falla', 'Guardar y subir fallan'],
];

/* Las páginas que ya están, para los chips de "Ir a". */
const HECHAS = [
  ['/admin', 'Inicio'],
  ['/admin/categorias', 'Categorías'],
  ['/admin/colecciones', 'Colecciones'],
  ['/admin/marcas', 'Marcas'],
  ['/admin/atributos-catalogo', 'Atributos'],
  ['/admin/envios', 'Envíos'],
  ['/admin/cliparts', 'Cliparts'],
  ['/admin/destacados', 'Destacados'],
  ['/admin/productos', 'Productos'],
  ['/admin/inventario', 'Inventario'],
  ['/admin/publico-productos', 'Recomendar'],
];

/* El apartado de ADMIN.md donde se hará cada sección que todavía no está. */
const APARTADOS = {
  pedidos: 'D3 · Pedidos y pagos', catalogo: 'D2 · Productos', resultados: 'D4 · Resultados', clientes: 'D5 · Clientes y fidelidad',
  campanas: 'D6 · Campañas', diseno: 'D7 · Juegos y Kapi', ajustes: 'D8 · Ajustes',
};

// La copia real: categories, collections, tags, characters, productTypes y
// 35 productos (tienda.json) y tienda_brands (marcas.json); las marcas de
// cada categoría salen de su categoryNav.
const MARCAS_CORTAS = MARCAS_TIENDA.map(marcaAdminDesdeFirestore);
const MARCAS = MARCAS_TIENDA.map(marcaDesdeFirestore);
const CATEGORIAS = (() => {
  const de = {};
  MARCAS_TIENDA.forEach((b) => (b.categoryNav || []).forEach((n) => { (de[n.categoryId] ||= []).push(b.id); }));
  return TIENDA.categorias.map((c, i) => categoriaDesdeFirestore({ ...c, order: c.order ?? i, brandIds: c.brandIds || de[c.id] || [] }));
})();
const COLECCIONES = TIENDA.colecciones.map((c, i) => coleccionDesdeFirestore({ ...c, order: c.order ?? i }));
const ATRIBUTOS_DEMO = {
  tipos: TIENDA.tipos.map((d) => atributoDesdeFirestore(d, usosDeAtributo(TIENDA.productos, 'tipos'))),
  etiquetas: TIENDA.etiquetas.map((d) => atributoDesdeFirestore(d, usosDeAtributo(TIENDA.productos, 'etiquetas'))),
  personajes: TIENDA.personajes.map((d) => atributoDesdeFirestore(d, usosDeAtributo(TIENDA.productos, 'personajes'))),
};
// De ejemplo (no hay copia de shippingZones ni de cliparts).
const ZONAS = [
  { id: 'z1', name: 'Lima Metropolitana', departamento: 'Lima', cost: 10, etaDays: 2, order: 0 },
  { id: 'z2', name: 'Callao', departamento: 'Callao', cost: 10, etaDays: 2, order: 1 },
  { id: 'z3', name: 'Arequipa', departamento: 'Arequipa', cost: 18, etaDays: 4, order: 2 },
  { id: 'z4', name: 'Cusco', departamento: 'Cusco', cost: 20, etaDays: 5, order: 3 },
  { id: 'z5', name: 'Trujillo', departamento: 'La Libertad', cost: 18, etaDays: 4, order: 4, active: false },
].map(zonaDesdeFirestore);
const CLIPARTS = [
  { id: 'k1', name: 'Kapi feliz', url: '/assets/kapi/kapi-happy.webp', category: 'Kapi' },
  { id: 'k2', name: 'Kapi con hambre', url: '/assets/kapi/kapi-hungry.webp', category: 'Kapi' },
  { id: 'k3', name: 'Kapi triste', url: '/assets/kapi/kapi-sad.webp', category: 'Kapi' },
  { id: 'k4', name: 'Etiqueta Walá', url: '/assets/marca/splash-etiqueta-w.webp', category: 'Marca' },
  { id: 'k5', name: 'Logo Walá', url: '/assets/marca/logo-header-v2.webp', category: 'Marca' },
].map(clipartDesdeFirestore);
// Los productos, con cinco destacados, algunos ocultos, el stock variado y
// dos con la personalización de antes (de ejemplo).
const PRODUCTOS = TIENDA.productos.map((p, i) => productoAdminDesde({
  ...p,
  featured: i < 5,
  featuredOrder: i,
  visible: i % 9 === 4 ? false : p.visible,
  inStock: [0, 2, 12, 40, 3, 25, 0, 8][i % 8],
  sku: i % 3 === 0 ? `WL-${1000 + i}` : '',
  customizable: i === 6 || i === 13 ? true : p.customizable,
  publico: i % 4 === 0 ? 'unisex' : undefined,
  edadMinima: i % 4 === 0 ? 0 : undefined,
}));
const TIPOS = TIENDA.tipos.map((x) => ({ id: x.id, nombre: x.name }));
const CATEGORIAS_CORTAS = TIENDA.categorias.map((x) => ({ id: x.id, nombre: x.name }));
const COLECCIONES_CORTAS = TIENDA.colecciones.map((x) => ({ id: x.id, nombre: x.name }));
// La ficha: los productos crudos (como en Firestore) por id, para abrirla y guardarla.
const CRUDOS = Object.fromEntries(TIENDA.productos.map((p) => [p.id, p]));
const coloresDemo = (id) => (CRUDOS[id]?.variants || []).map((v) => ({ nombre: v.name, foto: v.imageUrl }));
const DESTINOS_CREAR = [
  { valor: '/crear/polo-kapi', texto: 'Polo Kapi · Crear' },
  { valor: '/combo/pareja-kapi', texto: 'Pareja Kapi · pack de Crear' },
];
const conMarcas = (lista) => lista.map((x) => ({ id: x.id, nombre: x.nombre, marcas: x.marcas || [] }));
// Crear: las 4 prendas y los 2 packs de la copia (demo/crear.json).
// La copia no trae plantillas: dos de ejemplo en la casaca, para probar "Traer de otro".
const PLANTILLAS_DEMO = [
  { id: 'demo-corazones', nombre: 'Corazones', grupo: 'Parejas', imagen: '/assets/kapi/kapi-happy.webp', capas: { frente: [{ tipo: 'texto', texto: 'Te amo' }] } },
  { id: 'demo-escudo', nombre: 'Escudo', grupo: 'Equipos', imagen: '/assets/marca/splash-etiqueta-w.webp', capas: { frente: [{ tipo: 'imagen' }] } },
];
const PRENDAS_CRUDAS = Object.fromEntries(CREAR.prendas.map((p, i) => [p.id, { ...p, inStock: p.inStock ?? null, ...(i === 0 && { prendaBase: { ...p.prendaBase, plantillas: PLANTILLAS_DEMO } }) }]));
const PACKS_CRUDOS = CREAR.combos.map((c) => ({ ...c, esComboCrear: true, comboCrear: { publicado: c.publicado, piezas: c.piezas, tallas: 'auto' } }));
const opcionDePrenda = (p) => ({ id: p.id, nombre: p.name, foto: (p.variants || [])[0]?.imageUrl || p.prendaBase?.vistas?.[0]?.imagen || '', precio: Number(p.salePrice) > 0 ? p.salePrice : p.price, colores: (p.variants || []).map((v) => ({ id: String(v.id), nombre: v.name, hex: v.colorHex })) });
const TAL_CUAL = TIENDA.productos.filter((p) => (p.variants || []).length && !p.isComboProduct).map(opcionDePrenda);
const BORRADORES = [{ id: 'borrador-1', nombre: 'Polo Kapi edición Navidad', fecha: 'Hace 2 días' }];
// Lo que deduciría giftRecommender, a grandes rasgos (solo para la demo).
const sugerenciaDemo = (p) => {
  const n = p.nombre.toLowerCase();
  return {
    publico: /ella|mujer|collagen|mask|cream|balm/.test(n) ? 'mujer' : /él |hombre/.test(n) ? 'hombre' : /pareja|conjunto/.test(n) ? 'unisex' : null,
    edadMinima: 0,
    equipo: /alianza/.test(n) ? 'Alianza Lima' : /universitario/.test(n) ? 'Universitario' : null,
  };
};
const MAS_VENDIDOS = [3, 8, 12, 0, 20, 15].map((i, k) => ({ id: TIENDA.productos[i].id, unidades: [41, 33, 27, 19, 12, 7][k] }));
const MUESTRAS = (() => {
  const m = {};
  TIENDA.productos.forEach((p) => { if (p.brandId && !m[p.brandId] && p.mainImage) m[p.brandId] = tarjetaDesdeProducto(p); });
  return m;
})();
const WHATSAPP = { principal: '', multimarca: false, fabrica: '+51924426791' };

const espera = (ms) => new Promise((r) => { window.setTimeout(r, ms); });

/* Una lista de la demo con su guardar y eliminar simulados. */
function useListaDemo(inicial, falla) {
  const [lista, setLista] = useState(inicial);
  const guardar = useCallback(async (datos, id) => {
    await espera(700);
    if (falla) throw new Error('Sin conexión con el servidor (es una prueba). Lo escrito sigue aquí.');
    setLista((l) => (id ? l.map((x) => (x.id === id ? { ...x, ...datos } : x)) : [...l, { ...datos, id: `nuevo-${Date.now()}` }]));
  }, [falla]);
  const eliminar = useCallback(async (id) => {
    await espera(600);
    if (falla) throw new Error('Sin conexión con el servidor (es una prueba).');
    setLista((l) => l.filter((x) => x.id !== id));
  }, [falla]);
  return [lista, guardar, eliminar, setLista];
}

function PanelDePrueba() {
  const toast = useToast();
  const [perfil, setPerfil] = useState('super');
  const [tamano, setTamano] = useState('ancho');
  const [estados, setEstados] = useState([]);
  const [ruta, setRuta] = useState('/admin/categorias');
  const marco = useRef(null);
  const p = PERFILES.find((x) => x.id === perfil);
  const grupos = useMemo(() => menuAdminPara(p.permisos), [p]);
  const accesos = useMemo(() => accesosAdminPara(p.permisos), [p]);
  const con = (e) => estados.includes(e);
  const falla = con('falla');

  const [categorias, guardarCategoria, eliminarCategoria, setCategorias] = useListaDemo(CATEGORIAS, falla);
  const [colecciones, guardarColeccion, eliminarColeccion] = useListaDemo(COLECCIONES, falla);
  const [zonas, guardarZona, eliminarZona] = useListaDemo(ZONAS, falla);
  const [cliparts, guardarClipart, eliminarClipart] = useListaDemo(CLIPARTS, falla);
  const [marcas, guardarMarca, eliminarMarca] = useListaDemo(MARCAS, falla);
  const [atributos, setAtributos] = useState(ATRIBUTOS_DEMO);
  const [productos, setProductos] = useState(PRODUCTOS);
  const [whatsapp, setWhatsapp] = useState(WHATSAPP);
  const [borradores, setBorradores] = useState(BORRADORES);
  const [crudos, setCrudos] = useState(CRUDOS);
  const [prendasCrudas, setPrendasCrudas] = useState(PRENDAS_CRUDAS);
  const [packsCrudos, setPacksCrudos] = useState(PACKS_CRUDOS);
  const [creados, setCreados] = useState({ categoria: [], coleccion: [], tipo: [], personaje: [], etiqueta: [] });

  const navegar = useRef(null);
  navegar.current = (to) => {
    if (!to.startsWith('/admin')) {
      toast({ tipo: 'info', titulo: 'En el admin abriría la tienda', texto: to, duracion: 2200 });
      return;
    }
    setRuta(to);
    if (marco.current) marco.current.scrollTop = 0;
  };
  const rutaSola = ruta.split('?')[0];
  const verDeRuta = new URLSearchParams(ruta.split('?')[1] || '').get('ver') || 'tienda';
  const EnlaceAdmin = useMemo(() => forwardRef(function EnlaceAdmin({ to, onClick, children, ...rest }, ref) {
    return (
      <a ref={ref} href={to} {...rest} onClick={(e) => { onClick?.(e); if (e.defaultPrevented) return; e.preventDefault(); navegar.current(to); }}>
        {children}
      </a>
    );
  }), []);

  const subir = useCallback((blob, { alAvanzar } = {}) => new Promise((resolver, rechazar) => {
    let n = 0;
    const t = window.setInterval(() => {
      n += 20;
      alAvanzar?.(n);
      if (falla && n >= 60) { window.clearInterval(t); rechazar(new Error('Se cortó la subida (es una prueba).')); }
      if (n >= 100) { window.clearInterval(t); resolver(URL.createObjectURL(blob)); }
    }, 220);
  }), [falla]);
  const fallar = (texto = 'Sin conexión con el servidor (es una prueba).') => { if (falla) throw new Error(texto); };
  const cambiarProductos = async (ids, cambio) => {
    await espera(700);
    fallar();
    setProductos((ps) => ps.map((x) => (ids.includes(x.id) ? { ...x, ...cambio(x) } : x)));
    return { ok: ids.length, fallaron: 0 };
  };

  const comunes = {
    cargando: con('cargando'),
    error: con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined,
    onReintentar: () => setEstados((e) => e.filter((x) => x !== 'error')),
  };
  const vacio = con('vacio');

  // Las fichas de Crear viven bajo Productos en el menú.
  const rutaMenu = rutaSola.startsWith('/admin/prendas-crear') ? '/admin/productos' : rutaSola;
  const actual = opcionActiva(grupos, rutaMenu);
  const dePaso = opcionActiva(menuAdminPara(['superadmin']), rutaMenu);
  const prendaDeRuta = rutaSola.match(/^\/admin\/prendas-crear\/([^/]+)$/)?.[1];
  const inicialPrenda = useMemo(
    () => (prendaDeRuta ? fichaDesdeProducto(prendaDeRuta === 'nueva' ? null : prendasCrudas[prendaDeRuta], { prenda: true }) : null),
    [prendaDeRuta], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const plantillasPrenda = prendaDeRuta && prendaDeRuta !== 'nueva' ? leerPlantillas(prendasCrudas[prendaDeRuta]?.prendaBase?.plantillas) : undefined;
  const cambiarPlantillas = async (fn) => {
    await espera(400);
    fallar();
    setPrendasCrudas((m) => { const p = m[prendaDeRuta]; return { ...m, [prendaDeRuta]: { ...p, prendaBase: { ...p.prendaBase, plantillas: fn(p.prendaBase?.plantillas || []) } } }; });
  };
  const fichaDeRuta = rutaSola.match(/^\/admin\/productos\/([^/]+)$/)?.[1];
  // La ficha se arma una vez por producto (si no, cada render la volvería a empezar).
  const inicialFicha = useMemo(
    () => (fichaDeRuta ? fichaDesdeProducto(fichaDeRuta === 'nuevo' ? null : crudos[fichaDeRuta], { marcaId: new URLSearchParams(ruta.split('?')[1] || '').get('brandId') || '' }) : null),
    [fichaDeRuta], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const marcaDeRuta = ruta.match(/^\/admin\/marcas\/([^/]+)\/productos$/)?.[1];
  let pagina;
  if (!actual) {
    pagina = <SinPermiso permiso={dePaso?.grupo.id === 'catalogo' ? 'Catálogo de productos' : undefined} />;
  } else if (ruta === '/admin') {
    pagina = (
      <PaginaInicioAdmin
        usuario={{ nombre: 'Isaac Castro' }}
        cargando={con('cargando')}
        pendientes={[
          { id: 'pedidos', texto: 'Pedidos por recibir', detalle: 'Pagados y sin organizar el envío', cuenta: vacio ? 0 : 7, to: '/admin/recepcion-pedidos', icono: 'pedidos', tono: 'menta', permiso: ['manage_design'] },
          { id: 'reclamos', texto: 'Reclamos sin responder', detalle: 'El plazo legal es de 15 días hábiles', cuenta: vacio ? 0 : 2, to: '/admin/libro-reclamaciones', icono: 'reclamos', tono: 'rosa', permiso: ['manage_clients'] },
          { id: 'referidos', texto: 'Referidos por aprobar', detalle: 'Monedas esperando que las liberes', cuenta: 0, to: '/admin/referidos', icono: 'referidos', tono: 'oro', permiso: ['manage_clients'] },
          { id: 'retos', texto: 'Evidencias de retos', detalle: 'Fotos que mandaron los clientes', cuenta: vacio ? 0 : 4, to: '/admin/retos', icono: 'retos', tono: 'oro', permiso: ['manage_clients'] },
        ].filter((x) => puedeVer(x, p.permisos))}
        atajos={[
          { to: '/admin/productos', texto: 'Productos', detalle: 'Crear, editar y ocultar', icono: 'productos', tono: 'degradado', permiso: ['manage_products'] },
          { to: '/admin/resultados', texto: 'Resultados', detalle: 'Cómo va la tienda', icono: 'resultados', tono: 'oro', permiso: ['manage_design', 'manage_clients'] },
          { to: '/admin/categorias', texto: 'Categorías', detalle: 'Las burbujas de cada marca', icono: 'categorias', tono: 'degradado', permiso: ['manage_products'] },
          { to: '/admin/notificaciones', texto: 'Notificaciones', detalle: 'Ofertas y novedades', icono: 'notificaciones', tono: 'rosa', permiso: ['manage_design'] },
          { to: '/admin/fechas-importantes', texto: 'Fechas importantes', detalle: 'El calendario de campañas', icono: 'fechas', tono: 'rosa', permiso: ['manage_clients'] },
          { to: '/admin/inventario', texto: 'Inventario', detalle: 'El stock de todo', icono: 'inventario', tono: 'degradado', permiso: ['manage_inventory'] },
        ].filter((x) => puedeVer(x, p.permisos))}
      />
    );
  } else if (ruta === '/admin/categorias') {
    pagina = <PaginaCategorias {...comunes} categorias={vacio ? [] : categorias} marcas={MARCAS_CORTAS} onGuardar={guardarCategoria} onEliminar={eliminarCategoria} subirImagen={subir} />;
  } else if (ruta === '/admin/colecciones') {
    pagina = <PaginaColecciones {...comunes} colecciones={vacio ? [] : colecciones} onGuardar={guardarColeccion} onEliminar={eliminarColeccion} subirImagen={subir} />;
  } else if (ruta === '/admin/atributos-catalogo') {
    pagina = (
      <PaginaAtributos
        {...comunes}
        atributos={vacio ? {} : atributos}
        marcas={MARCAS_CORTAS}
        onGuardar={async (tipo, datos, id) => {
          await espera(600);
          fallar();
          setAtributos((a) => ({ ...a, [tipo]: id ? a[tipo].map((x) => (x.id === id ? { ...x, ...datos } : x)) : [...a[tipo], { ...datos, id: `nuevo-${Date.now()}`, usos: 0 }] }));
        }}
        onEliminar={async (tipo, id) => {
          await espera(600);
          fallar();
          setAtributos((a) => ({ ...a, [tipo]: a[tipo].filter((x) => x.id !== id) }));
        }}
      />
    );
  } else if (ruta === '/admin/envios') {
    pagina = <PaginaEnvios {...comunes} zonas={vacio ? [] : zonas} onGuardar={guardarZona} onEliminar={eliminarZona} />;
  } else if (ruta === '/admin/cliparts') {
    pagina = <PaginaCliparts {...comunes} cliparts={vacio ? [] : cliparts} onGuardar={guardarClipart} onEliminar={eliminarClipart} subirImagen={subir} />;
  } else if (ruta === '/admin/marcas') {
    pagina = (
      <PaginaMarcas
        {...comunes}
        marcas={vacio ? [] : marcas}
        onGuardar={guardarMarca}
        onEliminar={eliminarMarca}
        subirImagen={subir}
        muestraDe={(id) => MUESTRAS[id] || null}
        whatsapp={whatsapp}
        onGuardarWhatsapp={async (c) => { await espera(600); fallar(); setWhatsapp((w) => ({ ...w, ...c })); }}
        onProductos={(m) => navegar.current(`/admin/marcas/${m.id}/productos`)}
        onDisenar={(m) => toast({ tipo: 'info', titulo: 'En el admin abriría su página con el editor', texto: `/${m.slug}?editar`, duracion: 2500 })}
        onAplicarPlantilla={async () => { await espera(1200); fallar(); return '8 conservadas por estar editadas a mano, 0 creadas.'; }}
        onQuitarRepetidas={async () => { await espera(900); fallar(); return 'No había páginas repetidas.'; }}
      />
    );
  } else if (marcaDeRuta) {
    const m = marcas.find((x) => x.id === marcaDeRuta) || marcas[0];
    pagina = (
      <PaginaProductosMarca
        {...comunes}
        marca={m}
        marcas={MARCAS_CORTAS}
        productos={vacio ? [] : productos}
        urlCrear={`/admin/productos/nuevo?brandId=${m.id}`}
        onDisenar={(x) => toast({ tipo: 'info', titulo: 'En el admin abriría su página con el editor', texto: `/${x.slug}?editar`, duracion: 2500 })}
        onAsignar={(ids) => cambiarProductos(ids, () => ({ marcaId: m.id }))}
        onQuitar={(ids) => cambiarProductos(ids, () => ({ marcaId: '' }))}
      />
    );
  } else if (prendaDeRuta) {
    const listasP = {
      categoria: [...conMarcas(CATEGORIAS), ...creados.categoria],
      coleccion: [...conMarcas(COLECCIONES), ...creados.coleccion],
      tipo: [...TIPOS, ...creados.tipo],
      personaje: [...conMarcas(ATRIBUTOS_DEMO.personajes), ...creados.personaje],
      etiqueta: [...conMarcas(ATRIBUTOS_DEMO.etiquetas), ...creados.etiqueta],
    };
    pagina = (
      <PaginaFichaProducto
        key={prendaDeRuta}
        inicial={inicialPrenda}
        nuevo={prendaDeRuta === 'nueva'}
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        marcas={MARCAS.map((m) => ({ id: m.id, nombre: m.nombre, logo: m.logo, whatsapp: m.whatsapp }))}
        categorias={listasP.categoria}
        colecciones={listasP.coleccion}
        tipos={listasP.tipo}
        personajes={listasP.personaje}
        etiquetas={listasP.etiqueta}
        subirImagen={subir}
        fotoConPlantilla={async () => { await espera(900); fallar(); return '/assets/kapi/kapi-happy.webp'; }}
        plantillas={plantillasPrenda}
        accionesPlantillas={{
          onRenombrar: (id, nombre) => cambiarPlantillas((l) => l.map((x) => (x.id === id ? { ...x, nombre } : x))),
          onGrupo: (id, grupo) => cambiarPlantillas((l) => l.map((x) => (x.id === id ? { ...x, grupo } : x))),
          onQuitar: (id) => cambiarPlantillas((l) => l.filter((x) => x.id !== id)),
          otras: Object.values(prendasCrudas).filter((p) => p.id !== prendaDeRuta && leerPlantillas(p.prendaBase?.plantillas).length).map((p) => ({ id: p.id, nombre: p.name, plantillas: leerPlantillas(p.prendaBase.plantillas) })),
          onTraer: (origenId, ids) => cambiarPlantillas((l) => [...l, ...leerPlantillas(prendasCrudas[origenId]?.prendaBase?.plantillas).filter((x) => ids.includes(x.id)).map((x) => ({ ...x, id: `${x.id}-copia-${Date.now()}` }))]),
          urlNueva: `/crear/${prendaDeRuta}?nuevaPlantilla=1`,
          urlEditar: (id) => `/crear/${prendaDeRuta}?editarPlantilla=${id}`,
        }}
        onGuardar={async (datos) => {
          await espera(900);
          fallar('Sin conexión con el servidor (es una prueba). Lo escrito sigue aquí.');
          const id = prendaDeRuta === 'nueva' ? `prenda-${Date.now()}` : prendaDeRuta;
          const antes = prendasCrudas[id] || {};
          setPrendasCrudas((m) => ({ ...m, [id]: { ...antes, ...fichaAProducto(datos, antes, { prendaBaseParaGuardar }), id } }));
        }}
        onVolver={() => navegar.current('/admin/productos?ver=crear')}
      />
    );
  } else if (fichaDeRuta) {
    const listas = {
      categoria: [...conMarcas(CATEGORIAS), ...creados.categoria],
      coleccion: [...conMarcas(COLECCIONES), ...creados.coleccion],
      tipo: [...TIPOS, ...creados.tipo],
      personaje: [...conMarcas(ATRIBUTOS_DEMO.personajes), ...creados.personaje],
      etiqueta: [...conMarcas(ATRIBUTOS_DEMO.etiquetas), ...creados.etiqueta],
    };
    pagina = (
      <PaginaFichaProducto
        key={fichaDeRuta}
        inicial={inicialFicha}
        nuevo={fichaDeRuta === 'nuevo'}
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={comunes.onReintentar}
        marcas={MARCAS.map((m) => ({ id: m.id, nombre: m.nombre, logo: m.logo, whatsapp: m.whatsapp }))}
        categorias={listas.categoria}
        colecciones={listas.coleccion}
        tipos={listas.tipo}
        personajes={listas.personaje}
        etiquetas={listas.etiqueta}
        onCrear={async (lista, { nombre, marcaId }) => {
          await espera(400);
          fallar();
          const nuevoItem = { id: `nuevo-${Date.now()}`, nombre, marcas: marcaId && lista !== 'tipo' ? [marcaId] : [] };
          setCreados((c) => ({ ...c, [lista]: [...c[lista], nuevoItem] }));
          return nuevoItem;
        }}
        productos={productos}
        coloresDe={coloresDemo}
        destinosCrear={DESTINOS_CREAR}
        subirImagen={subir}
        onGuardar={async (datos) => {
          await espera(900);
          fallar('Sin conexión con el servidor (es una prueba). Lo escrito sigue aquí.');
          const id = fichaDeRuta === 'nuevo' ? `nuevo-${Date.now()}` : fichaDeRuta;
          const crudo = { ...(crudos[id] || {}), ...fichaAProducto(datos, crudos[id] || {}), id };
          setCrudos((c) => ({ ...c, [id]: crudo }));
          setProductos((ps) => (ps.some((x) => x.id === id) ? ps.map((x) => (x.id === id ? { ...x, ...productoAdminDesde(crudo) } : x)) : [...ps, productoAdminDesde(crudo)]));
        }}
        onVolver={() => navegar.current('/admin/productos')}
        onPasarACrear={() => toast({ tipo: 'info', titulo: 'Abriría su ficha de Crear (D2c)', duracion: 2200 })}
        onBorrador={() => {}}
      />
    );
  } else if (rutaSola === '/admin/productos') {
    pagina = (
      <PaginaProductos
        {...comunes}
        productos={vacio ? [] : productos}
        categorias={CATEGORIAS_CORTAS}
        marcas={MARCAS_CORTAS}
        vista={verDeRuta}
        onVista={(v) => navegar.current(v === 'tienda' ? '/admin/productos' : `/admin/productos?ver=${v}`)}
        onAbrir={(x) => (x.personalizable || x.pack ? toast({ tipo: 'info', titulo: 'Su ficha es de Crear (D2c)', texto: x.nombre, duracion: 2200 }) : navegar.current(`/admin/productos/${x.id}`))}
        urlNuevo="/admin/productos/nuevo"
        onIr={(to) => toast({ tipo: 'info', titulo: 'Iría a', texto: to, duracion: 2000 })}
        onVisible={async (id, visible) => { await espera(500); fallar(); setProductos((ps) => ps.map((x) => (x.id === id ? { ...x, oculto: !visible } : x))); }}
        onVarios={(ids, visible) => cambiarProductos(ids, () => ({ oculto: !visible }))}
        onArchivar={async (ids) => { await espera(700); fallar(); setProductos((ps) => ps.filter((x) => !ids.includes(x.id))); return { ok: ids.length, fallaron: 0 }; }}
        onDuplicar={async (x) => { await espera(600); fallar(); setProductos((ps) => [...ps, { ...x, id: `copia-${Date.now()}`, nombre: `${x.nombre} (Copia)`, oculto: true, destacado: false }]); }}
        onExportar={() => {}}
        onQuitarPersonalizacionVieja={(ids) => cambiarProductos(ids, () => ({ personalizacionVieja: false }))}
        borradores={borradores}
        cuentas={{ crear: Object.values(prendasCrudas).filter((p) => !p.deleted).length, packs: packsCrudos.filter((c) => !c.deleted).length }}
        personalizables={(
          <PaginaPersonalizables
            embebido
            {...comunes}
            prendas={vacio ? [] : Object.values(prendasCrudas).filter((p) => !p.deleted).map((p) => personalizableDesde(p, packsCrudos))}
            onAbrir={(x) => navegar.current(`/admin/prendas-crear/${x.id}`)}
            onVer={(x) => toast({ tipo: 'info', titulo: 'Abriría Crear', texto: `/crear/${x.id}`, duracion: 2000 })}
            onPublicar={async (id, publicada) => { await espera(500); fallar(); setPrendasCrudas((m) => ({ ...m, [id]: { ...m[id], visible: publicada } })); }}
            onArchivar={async (id) => { await espera(600); fallar(); setPrendasCrudas((m) => ({ ...m, [id]: { ...m[id], deleted: true } })); }}
          />
        )}
        packs={(
          <PaginaPacks
            embebido
            {...comunes}
            packs={vacio ? [] : packsCrudos.filter((c) => !c.deleted).map(packDesdeFirestore)}
            prendas={Object.values(prendasCrudas).filter((p) => !p.deleted).map(opcionDePrenda)}
            talCual={TAL_CUAL}
            marcas={MARCAS_CORTAS}
            categorias={CATEGORIAS.map((c) => ({ id: c.id, nombre: c.nombre, marcas: c.marcas }))}
            subirImagen={subir}
            nuevoInicial={new URLSearchParams(ruta.split('?')[1] || '').get('nuevo') === '1'}
            onVer={(k) => toast({ tipo: 'info', titulo: 'Abriría el pack', texto: `/combo/${k.id}`, duracion: 2000 })}
            onGuardar={async (datos, id) => {
              await espera(700);
              fallar();
              const doc = { id: id || `pack-${Date.now()}`, name: datos.nombre, description: datos.descripcion, price: Number(datos.precio), salePrice: Number(datos.oferta) || 0, brandId: datos.marcaId, categories: datos.categoria ? [datos.categoria] : [], mainImage: datos.portada, enTienda: datos.enTienda, esComboCrear: true, comboCrear: { publicado: datos.publicado, tallas: datos.tallas, piezas: datos.piezas } };
              setPacksCrudos((l) => (id ? l.map((c) => (c.id === id ? doc : c)) : [...l, doc]));
            }}
            onArchivar={async (id) => { await espera(500); fallar(); setPacksCrudos((l) => l.map((c) => (c.id === id ? { ...c, deleted: true } : c))); }}
            onSugerir={() => Object.values(prendasCrudas).filter((p) => p.visible !== false && !p.deleted).flatMap((p) => [2, 3].map((n) => ({ clave: `${p.id}-${n}`, nombre: `${n === 2 ? 'Pareja' : 'Trío'} · ${p.name}`, precio: Math.floor((Number(p.price) * n * (n === 2 ? 0.9 : 0.85)) / 5) * 5, piezas: Array.from({ length: n }, () => ({ prendaId: p.id })) })))}
            onCrearSugeridos={async (lista, publicar) => {
              await espera(900);
              fallar();
              setPacksCrudos((l) => [...l, ...lista.map((c, i) => ({ id: `sug-${Date.now()}-${i}`, name: c.nombre, price: Number(c.precio), esComboCrear: true, comboCrear: { publicado: publicar, tallas: 'auto', piezas: c.piezas } }))]);
              return lista.length;
            }}
          />
        )}
        urlBorrador={(id) => `/admin/productos/nuevo?draftId=${id}`}
        onDescartarBorrador={async (id) => { await espera(400); setBorradores((b) => b.filter((x) => x.id !== id)); }}
      />
    );
  } else if (rutaSola === '/admin/inventario') {
    pagina = (
      <PaginaInventario
        {...comunes}
        productos={vacio ? [] : productos}
        categorias={CATEGORIAS_CORTAS}
        colecciones={COLECCIONES_CORTAS}
        marcas={MARCAS_CORTAS}
        tipos={TIPOS}
        onGuardarStock={async (id, n) => { await espera(500); fallar('No se guardó el stock (es una prueba).'); setProductos((ps) => ps.map((x) => (x.id === id ? { ...x, stock: n } : x))); }}
      />
    );
  } else if (rutaSola === '/admin/publico-productos') {
    pagina = (
      <PaginaRecomendar
        {...comunes}
        productos={vacio ? [] : productos}
        categorias={CATEGORIAS_CORTAS}
        sugerenciaDe={sugerenciaDemo}
        equipos={['Alianza Lima', 'Universitario', 'Sporting Cristal']}
        onGuardar={async (id, campos) => { await espera(300); fallar(); setProductos((ps) => ps.map((x) => (x.id === id ? { ...x, ...Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, v ?? (k === 'edadMinima' ? null : '')])) } : x))); }}
        onAceptarSugerencias={async () => { await espera(700); fallar(); }}
        onMarcarTodos={async () => { await espera(700); fallar(); }}
      />
    );
  } else if (ruta === '/admin/destacados') {
    pagina = (
      <PaginaDestacados
        {...comunes}
        productos={vacio ? [] : productos}
        masVendidos={{ filas: MAS_VENDIDOS, disponible: !vacio, cargando: con('cargando') }}
        onDestacar={async (id) => {
          await espera(500);
          fallar();
          setProductos((ps) => {
            const ultimo = ps.filter((x) => x.destacado).reduce((m2, x) => Math.max(m2, x.ordenDestacado + 1), 0);
            return ps.map((x) => (x.id === id ? { ...x, destacado: true, ordenDestacado: ultimo } : x));
          });
        }}
        onQuitar={async (id) => { await espera(500); fallar(); setProductos((ps) => ps.map((x) => (x.id === id ? { ...x, destacado: false, ordenDestacado: 0 } : x))); }}
        onGuardarOrden={async (ids) => { await espera(700); fallar(); setProductos((ps) => ps.map((x) => (ids.includes(x.id) ? { ...x, ordenDestacado: ids.indexOf(x.id) } : x))); }}
      />
    );
  } else {
    const productosD2 = ['/admin/productos', '/admin/inventario', '/admin/plantillas-yoryo', '/admin/blueprints', '/admin/publico-productos'];
    const grupo = productosD2.includes(dePaso?.item.to) ? 'D2 · Productos' : APARTADOS[dePaso?.grupo.id];
    pagina = (
      <>
        <CabezaAdmin icono={dePaso?.item.icono} tono={dePaso?.grupo.tono} titulo={dePaso?.item.texto || 'Sección'} migas={[{ texto: 'Inicio', to: '/admin' }, { texto: dePaso?.item.texto }]} />
        <div className={s.pronto}>
          <EstadoVacio imagen="/assets/kapi/3d/kapi-hambre-256.webp" titulo="Esta sección todavía no está en el kit" texto={grupo ? `Se arma en el apartado ${grupo} (guia/ADMIN.md).` : 'Se arma en un apartado de guia/ADMIN.md.'}>
            <Boton to="/admin/categorias" variante="secundario">Ver Categorías</Boton>
          </EstadoVacio>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={cs.controlesInicio}>
        <div>
          <span className={cs.controlesTitulo}>Ver como</span>
          <Pestanas opciones={PERFILES} valor={perfil} onChange={setPerfil} etiqueta="Permisos del admin" />
        </div>
        <div>
          <span className={cs.controlesTitulo}>Tamaño</span>
          <Pestanas opciones={TAMANOS} valor={tamano} onChange={setTamano} etiqueta="Tamaño del panel" />
        </div>
        <div>
          <span className={cs.controlesTitulo}>Estado</span>
          <div className={cs.controlesChips}>
            {ESTADOS.map(([id, texto]) => (
              <Chip key={id} tamano="sm" activo={con(id)} onClick={() => setEstados((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))}>{texto}</Chip>
            ))}
          </div>
        </div>
        <div>
          <span className={cs.controlesTitulo}>Ir a</span>
          <div className={cs.controlesChips}>
            {HECHAS.map(([to, texto]) => (
              <Chip key={to} tamano="sm" activo={rutaSola === to} onClick={() => navegar.current(to)}>{texto}</Chip>
            ))}
            <Chip tamano="sm" onClick={() => { setCategorias(CATEGORIAS); setProductos(PRODUCTOS); }}>Restaurar datos</Chip>
          </div>
        </div>
      </div>
      <div ref={marco} className={[s.lienzo, tamano === 'celular' && s.lienzoCelular].filter(Boolean).join(' ')}>
        <ProveedorEnlaces componente={EnlaceAdmin}>
          <MarcoAdmin
            grupos={grupos}
            activo={marcaDeRuta ? '/admin/marcas' : rutaSola}
            accesos={accesos}
            usuario={{ nombre: 'Isaac Castro', email: 'isaac@correo.com', rol: p.rol }}
            onCerrarSesion={() => toast({ tipo: 'info', titulo: 'En el admin cerraría la sesión', duracion: 2000 })}
          >
            {pagina}
          </MarcoAdmin>
        </ProveedorEnlaces>
      </div>
    </>
  );
}

/* ── Piezas sueltas ── */

const FILAS_DEMO = [
  { id: 'a', nombre: 'Sorteo de Navidad', estado: 'activo', fin: '24 dic' },
  { id: 'b', nombre: 'Rifa del polo firmado', estado: 'borrador', fin: '—' },
  { id: 'c', nombre: 'Sorteo de octubre', estado: 'cerrado', fin: '31 oct' },
];

function PiezasAdmin() {
  const toast = useToast();
  const [imagen, setImagen] = useState('');
  const [elegidas, setElegidas] = useState(['a']);
  const subir = (blob, { alAvanzar } = {}) => new Promise((r) => {
    let n = 0;
    const t = window.setInterval(() => { n += 25; alAvanzar?.(n); if (n >= 100) { window.clearInterval(t); r(URL.createObjectURL(blob)); } }, 200);
  });
  return (
    <div className={s.piezas}>
      <div className={s.ficha}>
        <h3>InsigniaEstado</h3>
        <p>Siempre con texto y su punto de color (nunca solo el color). Una página puede pasar sus propios estados.</p>
        <div className={s.fila}>
          {Object.keys(ESTADOS_ADMIN).map((k) => <InsigniaEstado key={k} estado={k} />)}
        </div>
      </div>
      <div className={s.ficha}>
        <h3>TablaAdmin con casillas + AccionesLote</h3>
        <p>Cambia el ancho de la ventana: a menos de 720 px la misma tabla son tarjetas. Clic derecho en una fila abre sus opciones.</p>
        <TablaAdmin
          etiqueta="Sorteos de ejemplo"
          columnas={[
            { id: 'nombre', titulo: 'Sorteo', tarjeta: 'titulo', celda: (f) => f.nombre },
            { id: 'fin', titulo: 'Termina', tarjeta: 'detalle', celda: (f) => f.fin },
            { id: 'estado', titulo: 'Estado', tarjeta: 'estado', celda: (f) => <InsigniaEstado estado={f.estado} /> },
          ]}
          filas={FILAS_DEMO}
          nombreDe={(f) => f.nombre}
          seleccion={elegidas}
          onSeleccion={setElegidas}
          onFila={(f) => toast({ tipo: 'info', titulo: `Abriría «${f.nombre}»`, duracion: 1800 })}
          acciones={(f) => [
            { id: 'ver', etiqueta: 'Ver en la tienda', Icono: Eye, accion: () => toast({ titulo: f.nombre }) },
            { id: 'ocultar', etiqueta: 'Ocultar', Icono: EyeOff, accion: () => {} },
            'separador',
            { id: 'eliminar', etiqueta: 'Eliminar', Icono: Trash2, peligro: true, accion: () => {} },
          ]}
        />
        <AccionesLote
          cantidad={elegidas.length}
          onLimpiar={() => setElegidas([])}
          acciones={[
            { id: 'archivar', texto: 'Archivar', Icono: Archive, onClick: () => { toast({ tipo: 'exito', titulo: `${elegidas.length} archivados` }); setElegidas([]); } },
            { id: 'eliminar', texto: 'Eliminar', Icono: Trash2, peligro: true, onClick: () => setElegidas([]) },
          ]}
        />
      </div>
      <div className={s.ficha}>
        <h3>CampoImagen</h3>
        <p>Elegir o soltar, recortar en círculo, el avance de la subida, cambiar y quitar.</p>
        <div className={s.campos}>
          <CampoImagen etiqueta="Burbuja (recorte en círculo)" valor={imagen} onCambiar={setImagen} subir={subir} recorte="circulo" forma="circulo" ayuda="Se recorta antes de subir." />
          <CampoImagen etiqueta="Banner (tal cual)" subir={subir} forma="ancho" ayuda="Sin recorte: se sube como llega." onCambiar={() => {}} />
          <CampoImagen etiqueta="Con error" error="Ese archivo no es una imagen (JPG, PNG o WEBP)." subir={subir} onCambiar={() => {}} />
        </div>
      </div>
    </div>
  );
}

export { PanelDePrueba, PiezasAdmin };
