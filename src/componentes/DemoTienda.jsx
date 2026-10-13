import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { RotateCcw, User, Package, Settings, Gift, Ticket, Sparkles } from 'lucide-react';
import {
  PaginaTienda, MarcoTienda, PaginaCarrito, PaginaPedidos, Pestanas, Chip, Interruptor, Boton,
  BarraAdmin, AvisoSistema, BannerApp, BotonWhatsApp, KapiFlotante, BurbujaRegalos, PildoraRecompensa,
  VentanaCampana, AvisoIdioma, ProveedorEnlaces, PanelEditor, useBorrador, SeccionEditable, InsertarAqui,
  moverSeccion, duplicarSeccion, rutaDeMarca, tarjetaDesdeProducto, REGISTRO_SECCIONES, enlaceWhatsApp,
} from './kit';
import { empresa } from '../config/empresa';
import INICIO from './demo/inicio.json';
import cs from './ComponentesPage.module.css';
import s from './DemoTienda.module.css';

/*
 * Una tienda de prueba: el mismo marco (avisos, cabecera, pie, barra inferior
 * y flotantes) para todas las páginas, y los enlaces navegan entre ellas.
 *  - Inicio: las secciones de pages/home. Viendo como admin, "Editar esta
 *    página" abre el editor del builder sobre esta misma página.
 *  - Carrito y Mis pedidos: con los mismos productos reales.
 * "Ver componentes" marca cada parte con su número y su componente; los
 * números son los de kit/guia/INICIO.md.
 * Datos: demo/inicio.json (copia de pages/home, pages/footer y una muestra
 * de productos_wala y tienda_brands).
 */

const ROLES = [
  { id: 'visitante', texto: 'Visitante' },
  { id: 'sesion', texto: 'Con sesión' },
  { id: 'admin', texto: 'Admin' },
];

const PAGINAS = [
  { id: 'inicio', texto: 'Inicio', ruta: '/' },
  { id: 'carrito', texto: 'Carrito', ruta: '/carrito' },
  { id: 'pedidos', texto: 'Mis pedidos', ruta: '/cuenta/pedidos' },
];

/** Ruta de la tienda → página de esta demo (las demás solo avisan). */
const PAGINA_DE_RUTA = { '/': 'inicio', '/carrito': 'carrito', '/cuenta': 'pedidos', '/cuenta/pedidos': 'pedidos' };

/** Pestaña de la barra inferior que se enciende en cada página. */
const PESTANA_DE_PAGINA = { inicio: 'inicio', carrito: 'tienda', pedidos: 'cuenta' };

const EXTRAS = [
  ['aviso', 'Aviso del sistema'],
  ['app', 'Banner de la app'],
  ['idioma', 'Sugerencia de idioma'],
  ['campana', 'Ventana de campaña'],
];

const PIE_LEGAL = {
  empresa: { nombre: empresa.nombreComercial, email: empresa.email, telefono: empresa.telefono, direccion: empresa.domicilioFiscal },
  enlaces: [
    { texto: 'Términos y Condiciones', url: '/terminos-y-condiciones' },
    { texto: 'Políticas de Privacidad', url: '/politicas-de-privacidad' },
  ],
};

/* Menú de la cuenta: los mismos accesos que el header de la tienda
   (ACCESOS_RAPIDOS_HEADER sobre useCuentaNavGroups). */
const GRUPOS_CUENTA = [
  { titulo: 'Cuenta', items: [
    { to: '/cuenta/perfil', texto: 'Mi perfil', Icono: User },
    { to: '/cuenta/pedidos', texto: 'Mis pedidos', Icono: Package },
    { to: '/cuenta/ajustes', texto: 'Ajustes', Icono: Settings },
  ] },
  { titulo: 'Recompensas', items: [
    { to: '/cuenta/catalogo', texto: 'Catálogo de recompensas', Icono: Gift },
    { to: '/cuenta/cupones', texto: 'Mis cupones', Icono: Ticket },
  ] },
  { titulo: 'Personalización', items: [
    { to: '/cuenta/creaciones', texto: 'Mis creaciones', Icono: Sparkles },
  ] },
];
const PROMO_CUENTA = { titulo: 'Perfil de regalos', texto: 'Completa la encuesta', monedas: 15, url: '/encuesta-suscripcion', icono: 'moneda' };

const META_ENVIO = 150;
const { destacados, nuevos, ofertas } = INICIO.productos;

/** Producto de la tienda → fila del carrito / pedido / favoritos. */
const fila = (p, extra = {}) => {
  const t = tarjetaDesdeProducto(p);
  return { id: p.id, imagen: t.imagen, nombre: p.name, precio: t.precio, precioAntes: t.precioAntes, cantidad: 1, ...extra };
};

const CARRITO_INICIAL = [
  fila(destacados[0], { variante: 'Talla M' }),
  fila(ofertas.find((p) => !p.isComboProduct) || ofertas[0]),
];

const FAVORITOS = [...nuevos.slice(0, 4), ...ofertas.slice(0, 3)].map((p) => ({ id: p.id, nombre: p.name, imagen: fila(p).imagen }));

const PEDIDOS = [
  { codigo: 'PD-20481', fecha: '10 oct', paso: 1, pagoPendiente: true, items: [fila(destacados[1], { variante: 'Talla L' }), fila(nuevos[1])] },
  { codigo: 'PD-20377', fecha: '7 oct', paso: 3, entregaEstimada: 'mañana, 14 oct', items: [fila(ofertas[0])] },
  { codigo: 'PD-19902', fecha: '28 sep', paso: 4, items: [fila(nuevos[2]), fila(destacados[2], { variante: 'Talla S' })] },
].map((p) => ({ ...p, total: p.items.reduce((a, it) => a + it.precio * it.cantidad, 0) }));

/** Nombre del componente que dibuja cada tipo de sección (para "Ver componentes"). */
const componenteDe = (tipo) => REGISTRO_SECCIONES[tipo]?.nombre || tipo;

/** Marca de una parte en "Ver componentes": número + componente. */
function Parte({ n, nombre, children, bloque = true }) {
  return (
    <div className={bloque ? s.parte : s.parteEnLinea} data-etiqueta={`${n} · ${nombre}`}>
      {children}
    </div>
  );
}

export default function DemoTienda({ marcas = [], usuario, tema, cambiarTema, notificaciones, onLeer, onMarcarLeidas, onVerTodas, onAgregar, toast }) {
  const [rol, setRol] = useState('visitante');
  const [pagina, setPagina] = useState('inicio');
  const [extras, setExtras] = useState([]);
  const [anatomia, setAnatomia] = useState(false);
  const [pildora, setPildora] = useState(true);
  const [carrito, setCarrito] = useState(CARRITO_INICIAL);
  const marcoRef = useRef(null);

  // Editor del builder (solo admin, sobre el inicio).
  const borrador = useBorrador(INICIO.secciones);
  const [editando, setEditando] = useState(false);
  const [seleccionada, setSeleccionada] = useState(null);
  const [resaltada, setResaltada] = useState(null);
  const [insertarEn, setInsertarEn] = useState(null);
  const [vistaEditor, setVistaEditor] = useState('escritorio');
  const [guardando, setGuardando] = useState(false);

  const conSesion = rol !== 'visitante';
  const esAdmin = rol === 'admin';
  const enEditor = esAdmin && editando && pagina === 'inicio';
  const ver = (x) => extras.includes(x);
  const alternar = (x) => setExtras((xs) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]));
  const avisar = useCallback((titulo, texto) => toast({ tipo: 'info', titulo, texto, duracion: 2200 }), [toast]);

  const irA = useCallback((id) => {
    setPagina(id);
    if (marcoRef.current) marcoRef.current.scrollTop = 0;
  }, []);

  // Los enlaces de la tienda de prueba navegan entre sus páginas; los demás
  // avisan adónde irían.
  const navegar = useRef(null);
  navegar.current = (to) => {
    const ruta = String(to || '').split('?')[0];
    if (PAGINA_DE_RUTA[ruta]) irA(PAGINA_DE_RUTA[ruta]);
    else avisar('En la tienda iría a', to);
  };
  const EnlaceTienda = useMemo(() => forwardRef(function EnlaceTienda({ to, onClick, children, ...rest }, ref) {
    return (
      <a
        ref={ref}
        href={to}
        {...rest}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          e.preventDefault();
          navegar.current(to);
        }}
      >
        {children}
      </a>
    );
  }), []);

  const publicar = useCallback(() => {
    setGuardando(true);
    window.setTimeout(() => {
      setGuardando(false);
      borrador.marcarGuardado();
      toast({ tipo: 'exito', titulo: 'Página publicada', texto: 'Así la verán tus clientes.' });
    }, 900);
  }, [borrador, toast]);

  const visibles = useMemo(() => marcas.filter((m) => m.active !== false && m.visible !== false), [marcas]);
  const enCarrito = carrito.reduce((a, it) => a + it.cantidad, 0);

  /* ── Marco: igual en todas las páginas ── */
  const cabecera = {
    enlaces: [
      { id: 'tienda', texto: 'Tienda', url: '/tienda', menu: 'tienda' },
      { id: 'crear', texto: 'Crear', url: '/personalizar' },
      { id: 'marcas', texto: 'Marcas', url: '/marcas', menu: 'marcas' },
      { id: 'minijuegos', texto: 'Minijuegos', url: '/minijuegos' },
    ],
    activo: null,
    menuTienda: {
      categorias: INICIO.categorias.slice(0, 10).map((c) => ({ id: c.categoryId, nombre: c.name, url: `/tienda?categoria=${c.categoryId}` })),
      marcas: visibles.map((m) => ({ id: m.id, nombre: m.name, url: `/${rutaDeMarca(m)}` })),
    },
    menuMarcas: { marcas: visibles.map((m) => ({ id: m.id, nombre: m.name, url: `/${rutaDeMarca(m)}`, logo: m.logoUrl })) },
    tema: tema === 'dark' ? 'noche' : 'claro',
    onTema: cambiarTema,
    usuario: conSesion ? usuario : null,
    gruposCuenta: GRUPOS_CUENTA,
    promoCuenta: pildora ? PROMO_CUENTA : undefined,
    onCerrarSesion: () => setRol('visitante'),
    monedas: 43,
    notificaciones,
    onLeer,
    onMarcarLeidas,
    onVerTodas,
    favoritos: conSesion ? FAVORITOS : [],
    carrito,
    onBuscar: (q) => avisar('En la tienda buscaría', `/buscar?q=${q}`),
  };

  const flotantes = {
    derecha: (
      <>
        <Parte n="M7" nombre="BotonWhatsApp" bloque={false}>
          <BotonWhatsApp numero={empresa.whatsapp} mensaje="¡Hola Walá! Tengo una consulta." />
        </Parte>
        {conSesion && (
          <Parte n="M8" nombre="KapiFlotante" bloque={false}>
            <KapiFlotante estado="hambre" aviso onAbrir={() => avisar('En la tienda se abre Kapi', 'Su ventana para alimentarlo')} />
          </Parte>
        )}
        {conSesion && (
          <Parte n="M9" nombre="BurbujaRegalos" bloque={false}>
            <BurbujaRegalos cantidad={2} onAbrir={() => avisar('Regalos pensados para ti', 'En la tienda se abre la lista')} />
          </Parte>
        )}
      </>
    ),
    izquierda: conSesion && pildora && (
      <Parte n="M10" nombre="PildoraRecompensa" bloque={false}>
        <PildoraRecompensa titulo="Gana 15 monedas" texto="Completa tu perfil de regalos" monedas={15} to="/encuesta-suscripcion" onCerrar={() => setPildora(false)} />
      </Parte>
    ),
  };

  const arriba = (ver('aviso') || ver('app') || esAdmin) && (
    <>
      {ver('aviso') && (
        <Parte n="M1" nombre="AvisoSistema">
          <AvisoSistema tipo="aviso" onCerrar={() => alternar('aviso')}>Por fiestas patrias, los pedidos de esta semana salen el lunes.</AvisoSistema>
        </Parte>
      )}
      {ver('app') && (
        <Parte n="M2" nombre="BannerApp">
          <BannerApp url="https://play.google.com/store" onCerrar={() => alternar('app')} />
        </Parte>
      )}
      {esAdmin && (
        <Parte n="M3" nombre="BarraAdmin">
          <BarraAdmin
            editando={enEditor}
            onEditor={() => {
              if (enEditor) { setEditando(false); setSeleccionada(null); setInsertarEn(null); return; }
              irA('inicio');
              setEditando(true);
            }}
          />
        </Parte>
      )}
    </>
  );

  const marco = {
    contenida: true,
    arriba,
    cabecera,
    pie: INICIO.pie,
    pieLegal: PIE_LEGAL,
    barraInferior: { activo: PESTANA_DE_PAGINA[pagina], usuario: conSesion ? usuario : null, carrito: enCarrito },
    // Editando, los flotantes (WhatsApp, Kapi…) se esconden: taparían el panel.
    flotantes: enEditor ? undefined : flotantes,
  };

  /* ── Inicio: secciones del builder (con editor y "Ver componentes") ── */
  const { secciones, cambiar } = borrador;
  const total = secciones.length;
  const envolver = (enEditor || anatomia) ? (sec, nodo, i) => {
    let n = nodo;
    if (enEditor) {
      n = (
        <>
          <InsertarAqui indice={i} onInsertar={setInsertarEn} activo={insertarEn === i} />
          <SeccionEditable
            id={sec.id}
            tipo={sec.type}
            activa={seleccionada === sec.id}
            resaltada={resaltada === sec.id}
            primera={i === 0}
            ultima={i === total - 1}
            onEditar={(id) => { setInsertarEn(null); setSeleccionada(id); }}
            onMover={(id, d) => cambiar(moverSeccion(secciones, id, d))}
            onDuplicar={(id) => cambiar(duplicarSeccion(secciones, id))}
          >
            {n}
          </SeccionEditable>
        </>
      );
    }
    return anatomia ? <Parte n={`S${i + 1}`} nombre={`${componenteDe(sec.type)} (${sec.type})`}>{n}</Parte> : n;
  } : undefined;

  const contenido = pagina === 'inicio' ? (
    <PaginaTienda
      {...marco}
      secciones={secciones}
      productos={INICIO.productos}
      categorias={INICIO.categorias}
      marcas={marcas}
      onAgregar={onAgregar}
      propsPara={(sec) => (sec.type === 'faq_accordion' ? { contacto: enlaceWhatsApp(empresa.whatsapp, '¡Hola Walá! Tengo una duda.') } : undefined)}
      envolver={envolver}
    />
  ) : (
    <MarcoTienda {...marco}>
      {pagina === 'carrito' ? (
        <Parte n="P1" nombre="PaginaCarrito">
          <PaginaCarrito
            items={carrito}
            onCantidad={(id, cantidad) => setCarrito((c) => c.map((it) => (it.id === id ? { ...it, cantidad } : it)))}
            onQuitar={(id) => setCarrito((c) => c.filter((it) => it.id !== id))}
            metaEnvio={META_ENVIO}
            recomendados={destacados.slice(3, 9)}
            onAgregar={onAgregar}
            onPagar={() => avisar('En la tienda iría al checkout', '/checkout')}
            onSeguirComprando={() => irA('inicio')}
            vacio={{ texto: 'Lo quitaste todo. Vuelve a llenarlo para seguir probando.', accion: <Boton icono={<RotateCcw aria-hidden="true" />} onClick={() => setCarrito(CARRITO_INICIAL)}>Restaurar carrito</Boton> }}
          />
        </Parte>
      ) : (
        <Parte n="P2" nombre="PaginaPedidos">
          <PaginaPedidos pedidos={PEDIDOS} onIrATienda={() => irA('inicio')} />
        </Parte>
      )}
    </MarcoTienda>
  );

  return (
    <>
      <div className={cs.controlesInicio}>
        <div>
          <span className={cs.controlesTitulo}>Página</span>
          <Pestanas opciones={PAGINAS} valor={pagina} onChange={irA} etiqueta="Página de la tienda" />
        </div>
        <div>
          <span className={cs.controlesTitulo}>Ver como</span>
          <Pestanas opciones={ROLES} valor={rol} onChange={(r) => { setRol(r); if (r !== 'admin') setEditando(false); }} etiqueta="Ver la página como" />
        </div>
        <div>
          <span className={cs.controlesTitulo}>Mostrar también</span>
          <div className={cs.controlesChips}>
            {EXTRAS.map(([id, texto]) => <Chip key={id} tamano="sm" activo={ver(id)} onClick={() => alternar(id)}>{texto}</Chip>)}
          </div>
        </div>
        <div className={s.interruptor}>
          <Interruptor etiqueta="Ver componentes" descripcion="Cada parte con su número y su componente (guía en kit/guia)." activo={anatomia} onChange={setAnatomia} />
        </div>
      </div>

      <div className={[s.estudio, !enEditor && s.sinPanel].filter(Boolean).join(' ')}>
        <div ref={marcoRef} className={[s.lienzo, anatomia && s.anatomia].filter(Boolean).join(' ')}>
          <div className={[s.pagina, enEditor && s.paginaEditor, enEditor && vistaEditor === 'movil' && s.paginaMovil].filter(Boolean).join(' ')}>
            <ProveedorEnlaces componente={EnlaceTienda}>
              {contenido}
            </ProveedorEnlaces>
            {enEditor && <InsertarAqui indice={total} onInsertar={setInsertarEn} activo={insertarEn === total} />}
          </div>
        </div>
        {enEditor && (
          <div className={s.lado}>
            <PanelEditor
              incrustado
              titulo="Inicio"
              secciones={secciones}
              onCambiar={cambiar}
              seleccionada={seleccionada}
              onSeleccionar={setSeleccionada}
              resaltada={resaltada}
              onResaltar={setResaltada}
              insertarEn={insertarEn}
              onInsertarEn={(i) => { setInsertarEn(i); if (i != null) setSeleccionada(null); }}
              fuentes={{
                marcas,
                categorias: INICIO.categorias.map((c) => ({ id: c.categoryId, name: c.name, imageUrl: c.imageUrl })),
                colecciones: [],
                subirArchivo: async (archivo) => ({ url: URL.createObjectURL(archivo) }),
              }}
              onGuardar={publicar}
              guardando={guardando}
              sinGuardar={borrador.sinGuardar}
              onDeshacer={borrador.deshacer}
              onRehacer={borrador.rehacer}
              puedeDeshacer={borrador.puedeDeshacer}
              puedeRehacer={borrador.puedeRehacer}
              vista={vistaEditor}
              onVista={setVistaEditor}
              onCerrar={() => setEditando(false)}
            />
          </div>
        )}
      </div>

      {ver('idioma') && (
        <div className={cs.avisoIdiomaDemo}>
          <AvisoIdioma
            idioma={{ codigo: 'EN', titulo: 'Looks like you speak English', texto: 'Do you want to see Walá in English?', cambiar: 'Switch to English' }}
            onCambiar={() => { alternar('idioma'); avisar('Idioma', 'En la tienda cambiaría a inglés'); }}
            onMantener={() => alternar('idioma')}
          />
        </div>
      )}

      {/* Como el popup de la tienda: solo la imagen, que es el botón. */}
      <VentanaCampana
        abierta={ver('campana')}
        onCerrar={() => alternar('campana')}
        formato="imagen"
        imagen="/images/popups/encuesta-conocerte-mejor.webp"
        titulo="Queremos conocerte mejor"
        onAccion={() => { alternar('campana'); avisar('En la tienda iría a', '/encuesta-suscripcion'); }}
      />
    </>
  );
}
