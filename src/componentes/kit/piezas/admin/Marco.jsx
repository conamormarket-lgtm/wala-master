import React, { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight, ExternalLink, Lock, LogOut, Menu, Search, X } from 'lucide-react';
import Boton from '../../Boton';
import { Enlace } from '../../Enlace';
import { EstadoVacio, HojaInferior } from '../../Feedback';
import { IsoWala, Sello } from '../../Marca';
import { RESORTE } from '../../Efectos';
import { Avatar } from '../Avatar';
import { normalizarBusqueda, opcionActiva } from '../../adaptadoresAdmin';
import { iconoAdmin } from './iconosAdmin';
import barra from '../../BarraInferior.module.css';
import s from './Marco.module.css';

/*
 * El marco del panel administrativo (guía: guia/ADMIN.md, D0). Los datos
 * entran por props: el menú llega ya filtrado por permiso (en el admin,
 * menuAdminPara(adminPermissions)), la ruta actual y quién es. Nada aquí lee
 * AuthContext ni el router.
 *  - Ancho (el marco mide 960 px o más; container query): menú lateral fijo
 *    con buscador y grupos plegables.
 *  - Angosto (celular, tablet): arriba, el título de la sección y el botón
 *    del menú; abajo, la barra con los accesos y "Más". El menú abre en una
 *    hoja (el atrás de Android la cierra). La acción principal de la página
 *    (CabezaAdmin `principal`) baja a un botón sobre la barra.
 */

const MarcoCtx = createContext(null);

/** El marco, para las piezas que lo necesitan (AccionesLote esconde el botón de la página). null fuera de él. */
export const useMarcoAdmin = () => useContext(MarcoCtx);

/**
 * El marco de toda página de /admin.
 *  - grupos: [{ id, titulo, icono, tono, suelto, items: [{ to, texto, icono, exacto, cuenta, fuera }] }]
 *    (`suelto`: sus opciones van sin el título del grupo, como Inicio)
 *  - activo: la ruta actual ('/admin/categorias')
 *  - accesos: los de la barra inferior (accesosAdminPara(permisos))
 *  - usuario: { nombre, email, avatar, rol } · onCerrarSesion · urlTienda
 *  - onNavegar(to): después de tocar una opción (la hoja se cierra sola)
 */
export function MarcoAdmin({ grupos = [], activo = '', accesos = [], usuario, onCerrarSesion, urlTienda = '/', onNavegar, children }) {
  const [menu, setMenu] = useState(false);
  const [principal, setPrincipal] = useState(null);
  const [conLote, setConLote] = useState(false);
  const actual = useMemo(() => opcionActiva(grupos, activo), [grupos, activo]);
  const ctx = useMemo(() => ({ setPrincipal, setConLote }), []);
  const navegar = (to) => { setMenu(false); onNavegar?.(to); };
  const Icono = actual ? iconoAdmin(actual.item.icono, actual.grupo.icono) : null;

  return (
    <MarcoCtx.Provider value={ctx}>
      <div className={s.marco} data-componente="MarcoAdmin">
        <div className={s.rejilla}>
          <aside className={s.lateral} aria-label="Menú del panel">
            <MenuAdmin grupos={grupos} actual={actual} usuario={usuario} onCerrarSesion={onCerrarSesion} urlTienda={urlTienda} onNavegar={navegar} />
          </aside>
          <div className={s.columna}>
            <header className={s.cabeceraMovil}>
              {Icono ? <Sello tamano={32} tono={actual.grupo.tono}><Icono /></Sello> : <IsoWala tamano={30} />}
              <div className={s.cabeceraTextos}>
                <span className={s.cabeceraGrupo}>{actual && !actual.grupo.suelto ? actual.grupo.titulo : 'Panel Walá'}</span>
                <strong className={s.cabeceraTitulo}>{actual ? actual.item.texto : 'Panel'}</strong>
              </div>
              <button type="button" className={s.botonMenu} onClick={() => setMenu(true)} aria-label="Abrir el menú" aria-expanded={menu}>
                <Menu aria-hidden="true" />
              </button>
            </header>
            <main className={s.contenido}>{children}</main>
            <div className={s.abajo}>
              {principal && !conLote && (
                <Boton
                  className={s.flotante}
                  to={principal.to}
                  icono={principal.Icono ? <principal.Icono aria-hidden="true" /> : undefined}
                  cargando={principal.cargando}
                  disabled={principal.disabled}
                  onClick={principal.onClick}
                >
                  {principal.texto}
                </Boton>
              )}
              <BarraInferiorAdmin items={accesos} activo={activo} onMas={() => setMenu(true)} masActivo={menu} onNavegar={navegar} />
            </div>
          </div>
        </div>
        <HojaInferior abierta={menu} onCerrar={() => setMenu(false)} titulo="Menú del panel">
          <MenuAdmin enHoja grupos={grupos} actual={actual} usuario={usuario} onCerrarSesion={onCerrarSesion} urlTienda={urlTienda} onNavegar={navegar} />
        </HojaInferior>
      </div>
    </MarcoCtx.Provider>
  );
}

/* El menú: buscador, opciones sueltas, grupos plegables y quién eres. */
function MenuAdmin({ grupos, actual, usuario, onCerrarSesion, urlTienda, onNavegar, enHoja = false }) {
  const [buscar, setBuscar] = useState('');
  const grupoActual = actual?.grupo.id;
  const [abiertos, setAbiertos] = useState(() => new Set(grupoActual ? [grupoActual] : []));
  // Al cambiar de sección, su grupo se abre (los que abriste siguen abiertos).
  useEffect(() => {
    if (grupoActual) setAbiertos((a) => (a.has(grupoActual) ? a : new Set([...a, grupoActual])));
  }, [grupoActual]);
  const alternar = (id) => setAbiertos((a) => {
    const n = new Set(a);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const q = normalizarBusqueda(buscar);
  const encontrados = q
    ? grupos.flatMap((g) => g.items.filter((it) => normalizarBusqueda(`${it.texto} ${g.titulo}`).includes(q)).map((it) => ({ grupo: g, item: it })))
    : null;
  const esActual = (it) => actual?.item === it;

  return (
    <nav className={[s.menu, enHoja && s.menuHoja].filter(Boolean).join(' ')}>
      {!enHoja && (
        <Enlace to="/admin" className={s.marca} onClick={() => onNavegar('/admin')}>
          <IsoWala tamano={34} />
          <span className={s.marcaTextos}>
            <strong>Walá</strong>
            <span>Panel</span>
          </span>
        </Enlace>
      )}
      <label className={s.buscar}>
        <Search aria-hidden="true" />
        <input
          type="search"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar una sección"
          aria-label="Buscar una sección"
        />
        {buscar && (
          <button type="button" onClick={() => setBuscar('')} aria-label="Borrar lo escrito"><X aria-hidden="true" /></button>
        )}
      </label>

      <div className={s.opciones}>
        {encontrados ? (
          encontrados.length ? (
            <ul className={s.lista}>
              {encontrados.map(({ grupo, item }) => (
                <li key={item.to}>
                  <OpcionMenu item={item} grupo={grupo} actual={esActual(item)} onNavegar={onNavegar} detalle={grupo.suelto ? null : grupo.titulo} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.sinResultados}>Ninguna sección se llama así.</p>
          )
        ) : (
          grupos.map((g) => {
            if (g.suelto) {
              return g.items.map((it) => <OpcionMenu key={it.to} item={it} grupo={g} actual={esActual(it)} onNavegar={onNavegar} suelta />);
            }
            const abierto = abiertos.has(g.id);
            const IconoGrupo = iconoAdmin(g.icono);
            const tieneActual = grupoActual === g.id;
            return (
              <div key={g.id} className={s.grupo}>
                <button
                  type="button"
                  className={[s.grupoTitulo, tieneActual && s.grupoConActual].filter(Boolean).join(' ')}
                  onClick={() => alternar(g.id)}
                  aria-expanded={abierto}
                >
                  <Sello tamano={28} tono={g.tono}><IconoGrupo /></Sello>
                  <span className={s.grupoNombre}>{g.titulo}</span>
                  {!abierto && <Cuenta valor={g.items.reduce((t, it) => t + (Number(it.cuenta) || 0), 0)} />}
                  <ChevronDown className={[s.chevron, abierto && s.chevronAbierto].filter(Boolean).join(' ')} aria-hidden="true" />
                </button>
                {abierto && (
                  <ul className={s.lista}>
                    {g.items.map((it) => (
                      <li key={it.to}><OpcionMenu item={it} grupo={g} actual={esActual(it)} onNavegar={onNavegar} /></li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      {usuario && (
        <div className={s.pieMenu}>
          <div className={s.quien}>
            <Avatar className={s.avatar} nombre={usuario.nombre} imagen={usuario.avatar} />
            <span className={s.quienTextos}>
              <strong>{usuario.nombre}</strong>
              <span>{usuario.rol || usuario.email}</span>
            </span>
          </div>
          <div className={s.pieAcciones}>
            <Enlace to={urlTienda} className={s.pieAccion}><ExternalLink aria-hidden="true" /> Ver la tienda</Enlace>
            {onCerrarSesion && (
              <button type="button" className={s.pieAccion} onClick={onCerrarSesion}><LogOut aria-hidden="true" /> Salir</button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

function OpcionMenu({ item, grupo, actual, onNavegar, detalle, suelta = false }) {
  const Icono = iconoAdmin(item.icono, grupo.icono);
  return (
    <Enlace
      to={item.to}
      className={[s.opcion, suelta && s.opcionSuelta, actual && s.opcionActual].filter(Boolean).join(' ')}
      aria-current={actual ? 'page' : undefined}
      onClick={() => onNavegar(item.to)}
    >
      {suelta ? <Sello tamano={28} tono={grupo.tono}><Icono /></Sello> : <Icono className={s.opcionIcono} aria-hidden="true" />}
      <span className={s.opcionTextos}>
        <span className={s.opcionTexto} data-texto={item.texto}>{item.texto}</span>
        {detalle && <small>{detalle}</small>}
      </span>
      <Cuenta valor={item.cuenta} />
    </Enlace>
  );
}

/* Lo que espera en una sección (reclamos sin responder…): solo si hay. */
function Cuenta({ valor }) {
  const n = Number(valor) || 0;
  if (n <= 0) return null;
  return <span className={s.cuenta} aria-label={`${n} por revisar`}>{n > 99 ? '99+' : n}</span>;
}

/**
 * La barra inferior del admin en el celular: hasta cuatro accesos y "Más"
 * (el menú). Mismo dibujo que la barra de la tienda.
 *  - items: [{ id, to, texto, icono, exacto, cuenta }] · activo: la ruta actual
 *  - onMas · masActivo (el menú abierto) · onNavegar(to)
 */
export function BarraInferiorAdmin({ items = [], activo = '', onMas, masActivo = false, onNavegar }) {
  const uid = useId();
  const elegido = masActivo ? 'mas' : items.reduce((m, it) => {
    const coincide = it.exacto ? activo === it.to : activo === it.to || activo.startsWith(`${it.to}/`);
    return coincide && (!m || it.to.length > m.to.length) ? it : m;
  }, null)?.id;
  const pildora = <motion.span layoutId={`${uid}-tab`} className={barra.tabPildora} transition={RESORTE} />;
  return (
    <nav className={`${barra.barra} ${s.barra}`} aria-label="Accesos del panel">
      {items.map((it) => {
        const Icono = iconoAdmin(it.icono);
        const esActivo = elegido === it.id;
        return (
          <Enlace
            key={it.id}
            to={it.to}
            className={[barra.tab, esActivo && barra.tabActivo].filter(Boolean).join(' ')}
            aria-current={esActivo ? 'page' : undefined}
            onClick={() => onNavegar?.(it.to)}
          >
            <span className={barra.tabIcono}>
              {esActivo && pildora}
              <Icono key={esActivo ? 'on' : 'off'} className={esActivo ? barra.rebota : undefined} aria-hidden="true" />
              {Number(it.cuenta) > 0 && <span className={`${s.cuenta} ${s.cuentaBarra}`}>{it.cuenta > 99 ? '99+' : it.cuenta}</span>}
            </span>
            <span className={barra.tabTexto}>{it.texto}</span>
          </Enlace>
        );
      })}
      <button type="button" className={[barra.tab, s.tabBoton, elegido === 'mas' && barra.tabActivo].filter(Boolean).join(' ')} onClick={onMas} aria-expanded={masActivo}>
        <span className={barra.tabIcono}>
          {elegido === 'mas' && pildora}
          <Menu aria-hidden="true" />
        </span>
        <span className={barra.tabTexto}>Más</span>
      </button>
    </nav>
  );
}

/**
 * La cabecera de una página del admin: migas, sello, título con la letra
 * del logo, una línea de ayuda y las acciones.
 *  - icono: el nombre de ICONOS_ADMIN ('categorias') o un nodo · tono (del Sello)
 *  - titulo, subtitulo · migas: [{ texto, to }] (la última es la página: sin to)
 *  - acciones: nodos (botones secundarios) · principal: { texto, Icono, onClick, to, cargando, disabled }
 *    la acción de la página ("Nueva categoría"); dentro de MarcoAdmin, en el
 *    celular baja a un botón sobre la barra inferior
 */
export function CabezaAdmin({ icono, tono = 'degradado', titulo, subtitulo, migas, acciones, principal }) {
  const ctx = useContext(MarcoCtx);
  const datos = useRef(principal);
  datos.current = principal;
  const clave = principal ? [principal.texto, principal.to, principal.cargando, principal.disabled].join('|') : null;
  useEffect(() => {
    if (!ctx || !datos.current) return undefined;
    const p = datos.current;
    ctx.setPrincipal({ ...p, onClick: (...a) => datos.current?.onClick?.(...a) });
    return () => ctx.setPrincipal(null);
    // El ícono no cambia mientras la página vive; el resto, por `clave`.
  }, [ctx, clave]);

  const Icono = typeof icono === 'string' ? iconoAdmin(icono) : null;
  return (
    <header className={s.cabeza} data-componente="CabezaAdmin">
      {migas?.length > 0 && (
        <nav className={s.migas} aria-label="Estás en">
          {migas.map((m, i) => (
            <React.Fragment key={`${m.texto}-${i}`}>
              {i > 0 && <ChevronRight aria-hidden="true" />}
              {m.to ? <Enlace to={m.to}>{m.texto}</Enlace> : <span aria-current="page">{m.texto}</span>}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className={s.cabezaFila}>
        {icono && <Sello tamano={42} tono={tono} className={ctx ? s.selloCabeza : undefined}>{Icono ? <Icono /> : icono}</Sello>}
        <div className={s.cabezaTextos}>
          <h1 className={s.cabezaTitulo}>{titulo}</h1>
          {subtitulo && <p className={s.cabezaSub}>{subtitulo}</p>}
        </div>
        {(acciones || principal) && (
          <div className={s.cabezaAcciones}>
            {acciones}
            {principal && (
              <Boton
                className={ctx ? s.principalCabeza : undefined}
                to={principal.to}
                icono={principal.Icono ? <principal.Icono aria-hidden="true" /> : undefined}
                cargando={principal.cargando}
                disabled={principal.disabled}
                onClick={principal.onClick}
              >
                {principal.texto}
              </Boton>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * Lo que ve un admin sin el permiso de esa sección.
 *  - permiso: el nombre del permiso que falta ("Catálogo de productos")
 *  - urlInicio
 */
export function SinPermiso({ permiso, urlInicio = '/admin' }) {
  return (
    <div className={s.sinPermiso} data-componente="SinPermiso">
      <EstadoVacio
        imagen={null}
        icono={<Lock aria-hidden="true" />}
        titulo="Esta sección no está abierta para tu cuenta"
        texto={permiso ? `Pide a un Super Admin el permiso «${permiso}» en Ajustes › Administradores.` : 'Pide a un Super Admin que te dé el permiso en Ajustes › Administradores.'}
      >
        <Boton to={urlInicio} variante="secundario">Volver al inicio</Boton>
      </EstadoVacio>
    </div>
  );
}
