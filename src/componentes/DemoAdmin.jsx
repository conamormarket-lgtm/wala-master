import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { Archive, Eye, EyeOff, Trash2 } from 'lucide-react';
import {
  MarcoAdmin, SinPermiso, CabezaAdmin, PaginaInicioAdmin, PaginaCategorias, InsigniaEstado, ESTADOS_ADMIN, AccionesLote,
  CampoImagen, TablaAdmin, EstadoVacio, Boton, Chip, Pestanas, ProveedorEnlaces, useToast,
  menuAdminPara, accesosAdminPara, puedeVer, opcionActiva, categoriaDesdeFirestore, marcaAdminDesdeFirestore,
} from './kit';
import TIENDA from './demo/tienda.json';
import MARCAS_TIENDA from './demo/marcas.json';
import cs from './ComponentesPage.module.css';
import s from './DemoAdmin.module.css';

/*
 * El panel administrativo armado solo con el kit (guía: kit/guia/ADMIN.md).
 *  - Panel de prueba: MarcoAdmin con el menú real filtrado por permiso; los
 *    enlaces navegan. Hecho: el inicio y Categorías (con la copia real de
 *    categories y tienda_brands); el resto de las secciones dice en qué
 *    apartado se hará.
 *  - Piezas del admin: las piezas sueltas con sus estados.
 * Guardar, eliminar y subir se simulan (con "Que falle" para ver el error).
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

/* El apartado de ADMIN.md donde se hará cada sección que todavía no está. */
const APARTADOS = {
  pedidos: 'D3 · Pedidos y pagos', catalogo: 'D1 · Catálogo base', resultados: 'D4 · Resultados', clientes: 'D5 · Clientes y fidelidad',
  campanas: 'D6 · Campañas', diseno: 'D7 · Juegos y Kapi', ajustes: 'D8 · Ajustes',
};
const PRODUCTOS = ['/admin/productos', '/admin/inventario', '/admin/plantillas-yoryo', '/admin/blueprints', '/admin/publico-productos'];

// La copia real: categories (tienda.json) y tienda_brands (marcas.json); las
// marcas de cada categoría salen de su categoryNav.
const MARCAS = MARCAS_TIENDA.map(marcaAdminDesdeFirestore);
const CATEGORIAS = (() => {
  const de = {};
  MARCAS_TIENDA.forEach((b) => (b.categoryNav || []).forEach((n) => { (de[n.categoryId] ||= []).push(b.id); }));
  return TIENDA.categorias.map((c, i) => categoriaDesdeFirestore({ ...c, order: c.order ?? i, brandIds: c.brandIds || de[c.id] || [] }));
})();

const espera = (ms) => new Promise((r) => { window.setTimeout(r, ms); });

function PanelDePrueba() {
  const toast = useToast();
  const [perfil, setPerfil] = useState('super');
  const [tamano, setTamano] = useState('ancho');
  const [estados, setEstados] = useState([]);
  const [ruta, setRuta] = useState('/admin/categorias');
  const [categorias, setCategorias] = useState(CATEGORIAS);
  const marco = useRef(null);
  const p = PERFILES.find((x) => x.id === perfil);
  const grupos = useMemo(() => menuAdminPara(p.permisos), [p]);
  const accesos = useMemo(() => accesosAdminPara(p.permisos), [p]);
  const con = (e) => estados.includes(e);
  const falla = con('falla');

  const navegar = useRef(null);
  navegar.current = (to) => {
    if (!to.startsWith('/admin')) {
      toast({ tipo: 'info', titulo: 'En el admin abriría la tienda', texto: to, duracion: 2200 });
      return;
    }
    setRuta(to);
    if (marco.current) marco.current.scrollTop = 0;
  };
  const EnlaceAdmin = useMemo(() => forwardRef(function EnlaceAdmin({ to, onClick, children, ...rest }, ref) {
    return (
      <a ref={ref} href={to} {...rest} onClick={(e) => { onClick?.(e); if (e.defaultPrevented) return; e.preventDefault(); navegar.current(to); }}>
        {children}
      </a>
    );
  }), []);

  const guardar = useCallback(async (datos, id) => {
    await espera(800);
    if (falla) throw new Error('Sin conexión con el servidor (es una prueba). Lo escrito sigue aquí.');
    setCategorias((cs2) => (id ? cs2.map((c) => (c.id === id ? { ...c, ...datos } : c)) : [...cs2, { ...datos, id: `nueva-${Date.now()}` }]));
  }, [falla]);
  const eliminar = useCallback(async (id) => {
    await espera(700);
    if (falla) throw new Error('Sin conexión con el servidor (es una prueba).');
    setCategorias((cs2) => cs2.filter((c) => c.id !== id));
  }, [falla]);
  const subir = useCallback((blob, { alAvanzar } = {}) => new Promise((resolver, rechazar) => {
    let n = 0;
    const t = window.setInterval(() => {
      n += 20;
      alAvanzar?.(n);
      if (falla && n >= 60) { window.clearInterval(t); rechazar(new Error('Se cortó la subida (es una prueba).')); }
      if (n >= 100) { window.clearInterval(t); resolver(URL.createObjectURL(blob)); }
    }, 220);
  }), [falla]);

  const actual = opcionActiva(grupos, ruta);
  const dePaso = opcionActiva(menuAdminPara(['superadmin']), ruta);
  let pagina;
  if (!actual) {
    pagina = <SinPermiso permiso={ruta === '/admin/categorias' ? 'Catálogo de productos' : undefined} />;
  } else if (ruta === '/admin') {
    pagina = (
      <PaginaInicioAdmin
        usuario={{ nombre: 'Isaac Castro' }}
        cargando={con('cargando')}
        pendientes={[
          { id: 'pedidos', texto: 'Pedidos por recibir', detalle: 'Pagados y sin organizar el envío', cuenta: con('vacio') ? 0 : 7, to: '/admin/recepcion-pedidos', icono: 'pedidos', tono: 'menta', permiso: ['manage_design'] },
          { id: 'reclamos', texto: 'Reclamos sin responder', detalle: 'El plazo legal es de 15 días hábiles', cuenta: con('vacio') ? 0 : 2, to: '/admin/libro-reclamaciones', icono: 'reclamos', tono: 'rosa', permiso: ['manage_clients'] },
          { id: 'referidos', texto: 'Referidos por aprobar', detalle: 'Monedas esperando que las liberes', cuenta: 0, to: '/admin/referidos', icono: 'referidos', tono: 'oro', permiso: ['manage_clients'] },
          { id: 'retos', texto: 'Evidencias de retos', detalle: 'Fotos que mandaron los clientes', cuenta: con('vacio') ? 0 : 4, to: '/admin/retos', icono: 'retos', tono: 'oro', permiso: ['manage_clients'] },
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
    pagina = (
      <PaginaCategorias
        categorias={con('vacio') ? [] : categorias}
        marcas={MARCAS}
        cargando={con('cargando')}
        error={con('error') ? 'No hay conexión con Firestore (es una prueba).' : undefined}
        onReintentar={() => setEstados((e) => e.filter((x) => x !== 'error'))}
        onGuardar={guardar}
        onEliminar={eliminar}
        subirImagen={subir}
      />
    );
  } else {
    const grupo = PRODUCTOS.includes(dePaso?.item.to) ? 'D2 · Productos' : APARTADOS[dePaso?.grupo.id];
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
            <Chip tamano="sm" activo={ruta === '/admin'} onClick={() => navegar.current('/admin')}>Inicio</Chip>
            <Chip tamano="sm" activo={ruta === '/admin/categorias'} onClick={() => navegar.current('/admin/categorias')}>Categorías</Chip>
            <Chip tamano="sm" onClick={() => setCategorias(CATEGORIAS)}>Restaurar categorías</Chip>
          </div>
        </div>
      </div>
      <div ref={marco} className={[s.lienzo, tamano === 'celular' && s.lienzoCelular].filter(Boolean).join(' ')}>
        <ProveedorEnlaces componente={EnlaceAdmin}>
          <MarcoAdmin
            grupos={grupos}
            activo={ruta}
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
