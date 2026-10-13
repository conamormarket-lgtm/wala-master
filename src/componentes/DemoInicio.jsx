import React, { useMemo, useState } from 'react';
import {
  PaginaTienda, Pestanas, Chip, BarraAdmin, AvisoSistema, BannerApp, BotonWhatsApp, KapiFlotante,
  BurbujaRegalos, PildoraRecompensa, VentanaCampana, AvisoIdioma, rutaDeMarca,
} from './kit';
import { empresa } from '../config/empresa';
import INICIO from './demo/inicio.json';
import s from './ComponentesPage.module.css';

/*
 * La página de inicio de wala.pe armada solo con el kit, con una copia de
 * sus datos reales (demo/inicio.json: pages/home, pages/footer y una muestra
 * de productos_wala y tienda_brands). "Ver como" muestra qué cambia según
 * quién entra.
 */

const ROLES = [
  { id: 'visitante', texto: 'Visitante' },
  { id: 'sesion', texto: 'Con sesión' },
  { id: 'admin', texto: 'Admin' },
];

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

export default function DemoInicio({ marcas = [], usuario, tema, cambiarTema, notificaciones, onLeer, onMarcarLeidas, onVerTodas, carrito, enCarrito, favoritos, onAgregar, toast }) {
  const [rol, setRol] = useState('visitante');
  const [extras, setExtras] = useState([]);
  const [editando, setEditando] = useState(false);
  const [pildora, setPildora] = useState(true);
  const conSesion = rol !== 'visitante';
  const ver = (x) => extras.includes(x);
  const alternar = (x) => setExtras((xs) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]));
  const avisar = (titulo, texto) => toast({ tipo: 'info', titulo, texto, duracion: 2200 });

  const visibles = useMemo(() => marcas.filter((m) => m.active !== false && m.visible !== false), [marcas]);
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
    monedas: 43,
    notificaciones,
    onLeer,
    onMarcarLeidas,
    onVerTodas,
    favoritos: conSesion ? favoritos : [],
    carrito,
    onBuscar: (q) => avisar('En la tienda buscaría', `/buscar?q=${q}`),
  };

  const flotantes = {
    derecha: (
      <>
        <BotonWhatsApp numero={empresa.whatsapp} mensaje="¡Hola Walá! Tengo una consulta." />
        {conSesion && <KapiFlotante estado="hambre" aviso onAbrir={() => avisar('En la tienda se abre Kapi', 'Su ventana para alimentarlo')} />}
        {conSesion && <BurbujaRegalos cantidad={2} onAbrir={() => avisar('Regalos pensados para ti', 'En la tienda se abre la lista')} />}
      </>
    ),
    izquierda: conSesion && pildora && (
      <PildoraRecompensa
        titulo="Gana 15 monedas"
        texto="Completa tu perfil de regalos"
        monedas={15}
        to="/encuesta-suscripcion"
        onCerrar={() => setPildora(false)}
      />
    ),
  };

  const arriba = (ver('aviso') || ver('app') || rol === 'admin') && (
    <>
      {ver('aviso') && <AvisoSistema tipo="aviso" onCerrar={() => alternar('aviso')}>Por fiestas patrias, los pedidos de esta semana salen el lunes.</AvisoSistema>}
      {ver('app') && <BannerApp url="https://play.google.com/store" onCerrar={() => alternar('app')} />}
      {rol === 'admin' && (
        <BarraAdmin
          editando={editando}
          onEditor={() => { setEditando((e) => !e); avisar(editando ? 'Cambios guardados' : 'En la tienda se abre el editor', editando ? '' : 'El mismo de la vista Editor'); }}
        />
      )}
    </>
  );

  return (
    <>
      <div className={s.controlesInicio}>
        <div>
          <span className={s.controlesTitulo}>Ver como</span>
          <Pestanas opciones={ROLES} valor={rol} onChange={setRol} etiqueta="Ver la página como" />
        </div>
        <div>
          <span className={s.controlesTitulo}>Mostrar también</span>
          <div className={s.controlesChips}>
            {EXTRAS.map(([id, texto]) => <Chip key={id} tamano="sm" activo={ver(id)} onClick={() => alternar(id)}>{texto}</Chip>)}
          </div>
        </div>
      </div>

      <div className={s.marcoPagina}>
        <PaginaTienda
          contenida
          arriba={arriba}
          cabecera={cabecera}
          pie={INICIO.pie}
          pieLegal={PIE_LEGAL}
          barraInferior={{ activo: 'inicio', usuario: conSesion ? usuario : null, admin: rol === 'admin', carrito: enCarrito }}
          flotantes={flotantes}
          secciones={INICIO.secciones}
          productos={INICIO.productos}
          categorias={INICIO.categorias}
          marcas={marcas}
          onAgregar={onAgregar}
        />
      </div>

      {ver('idioma') && (
        <div className={s.avisoIdiomaDemo}>
          <AvisoIdioma
            idioma={{ codigo: 'EN', titulo: 'Looks like you speak English', texto: 'Do you want to see Walá in English?', cambiar: 'Switch to English' }}
            onCambiar={() => { alternar('idioma'); avisar('Idioma', 'En la tienda cambiaría a inglés'); }}
            onMantener={() => alternar('idioma')}
          />
        </div>
      )}

      <VentanaCampana
        abierta={ver('campana')}
        onCerrar={() => alternar('campana')}
        imagen="/images/popups/encuesta-conocerte-mejor.webp"
        antetitulo="Gana 15 monedas"
        titulo="Queremos conocerte mejor"
        texto="Responde 5 preguntas y te recomendamos regalos que sí van contigo."
        accion="Responder la encuesta"
        onAccion={() => { alternar('campana'); avisar('En la tienda iría a', '/encuesta-suscripcion'); }}
      />
    </>
  );
}
