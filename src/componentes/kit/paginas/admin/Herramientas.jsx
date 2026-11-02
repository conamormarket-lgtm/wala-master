import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso } from '../../Feedback';
import { Campo, Casilla, Interruptor } from '../../Formulario';
import { InsigniaEstado } from '../../piezas/admin/Datos';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { GrupoCampos, CampoDinero } from '../../piezas/admin/Formularios';
import { ElegirVarios } from '../../piezas/admin/Producto';
import { PasoAdmin } from '../../piezas/admin/Pasos';
import { areaVacia, mismoNombre } from '../../adaptadoresAdmin';
import { PaginaListaAdmin } from './Lista';
import { porNombre, porOrden } from './celdas';
import l from './Lista.module.css';
import s from './Herramientas.module.css';

/*
 * D2d: Blueprints (las plantillas de impresión bajo demanda) y la página de
 * una sola vez de los productos de Yoryo y Daida ("Plantillas de cuadros").
 */

const METODOS = ['DTG', 'DTF', 'Sublimación', 'Bordado', 'Serigrafía', 'Vinilo'];
const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

/* Las áreas de impresión: nombre, ancho y alto en cm y dpi; siempre queda una. */
function AreasImpresion({ areas, onCambiar, error }) {
  const cambiar = (i, campo, valor) => onCambiar(areas.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)));
  return (
    <div className={s.areas}>
      {error && <p className={s.error}>{error}</p>}
      {areas.map((a, i) => (
        <div key={i} className={s.area}>
          <label className={s.chico}><span>Nombre</span><input className={s.texto} value={a.nombre} placeholder="Ej. Frente" onChange={(e) => cambiar(i, 'nombre', e.target.value)} /></label>
          <label className={s.chico}><span>Ancho cm</span><input className={s.numero} type="number" min="0" value={a.ancho} onChange={(e) => cambiar(i, 'ancho', e.target.value)} /></label>
          <label className={s.chico}><span>Alto cm</span><input className={s.numero} type="number" min="0" value={a.alto} onChange={(e) => cambiar(i, 'alto', e.target.value)} /></label>
          <label className={s.chico}><span>DPI</span><input className={s.numero} type="number" min="72" value={a.dpi} onChange={(e) => cambiar(i, 'dpi', e.target.value)} /></label>
          {areas.length > 1 && <Boton soloIcono tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} aria-label={`Quitar el área ${a.nombre || i + 1}`} onClick={() => onCambiar(areas.filter((_, j) => j !== i))} />}
        </div>
      ))}
      <Boton tamano="sm" variante="secundario" icono={<Plus aria-hidden="true" />} onClick={() => onCambiar([...areas, areaVacia()])}>Agregar área</Boton>
    </div>
  );
}

/**
 * Blueprints (/admin/blueprints): la prenda base, lo que cuesta imprimirla,
 * cómo se decora y sus áreas de impresión.
 *  - blueprints: [blueprintDesdeFirestore] · cargando · error · onReintentar · onGuardar(datos, id?) · onEliminar(id)
 */
export function PaginaBlueprints({ blueprints = [], cargando, error, onReintentar, onGuardar, onEliminar }) {
  const metodos = useMemo(() => [...new Set([...METODOS, ...blueprints.flatMap((b) => b.metodos)])].map((m) => ({ valor: m, texto: m })), [blueprints]);
  return (
    <PaginaListaAdmin
      cabeza={{ icono: 'blueprints', titulo: 'Blueprints', subtitulo: 'Las plantillas de impresión bajo demanda: la prenda base, su costo y sus áreas.' }}
      registros={blueprints}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      unidad={['blueprint', 'blueprints']}
      buscarEn={(b) => `${b.nombre} ${b.prenda}`}
      placeholder="Buscar un blueprint"
      filtros={[{ id: 'estado', etiqueta: 'Estado', todos: 'Activos e inactivos', opciones: [{ valor: 'si', texto: 'Solo activos' }, { valor: 'no', texto: 'Solo inactivos' }], filtrar: (b, v) => (v === 'si' ? b.activo : !b.activo) }]}
      columnas={[
        { id: 'nombre', titulo: 'Blueprint', ordenable: true, tarjeta: 'titulo', celda: (b) => <>{b.nombre}{b.prenda && <span className={l.sub}>{b.prenda}</span>}</> },
        { id: 'costo', titulo: 'Costo de impresión', ancho: 150, alinear: 'fin', tarjeta: 'detalle', celda: (b) => <span className={l.numero}>{soles(b.costo)}</span> },
        { id: 'areas', titulo: 'Áreas', tarjeta: 'detalle', celda: (b) => b.areas.filter((a) => a.nombre).map((a) => `${a.nombre} ${a.ancho}×${a.alto} cm`).join(' · ') || <span className={l.sub}>Sin áreas</span> },
        { id: 'metodos', titulo: 'Métodos', tarjeta: 'detalle', celda: (b) => b.metodos.join(', ') || <span className={l.sub}>—</span> },
        { id: 'estado', titulo: 'Estado', ancho: 110, tarjeta: 'estado', celda: (b) => <InsigniaEstado estado={b.activo ? 'activo' : 'oculto'}>{b.activo ? 'Activo' : 'Inactivo'}</InsigniaEstado> },
      ]}
      ordenes={{ nombre: porNombre, orden: porOrden }}
      ordenInicial={{ por: 'orden', dir: 'asc' }}
      vacio={{ texto: 'Crea el primero con su prenda base y sus áreas de impresión.' }}
      textos={{ creado: 'Blueprint creado', guardado: 'Blueprint guardado', eliminado: 'Blueprint eliminado' }}
      eliminar={{ texto: () => 'Se borra del todo (no se archiva). No se puede deshacer.' }}
      onGuardar={onGuardar}
      onEliminar={onEliminar}
      formulario={{
        nuevo: 'Nuevo blueprint',
        titulos: { nuevo: 'Nuevo blueprint', editar: 'Editar blueprint' },
        textoGuardar: { nuevo: 'Crear blueprint' },
        vacio: ({ registros }) => ({ nombre: '', prenda: '', costo: 0, orden: registros.reduce((m, b) => Math.max(m, b.orden + 1), 0), activo: true, metodos: ['DTG'], areas: [areaVacia()] }),
        desde: (b) => ({ nombre: b.nombre, prenda: b.prenda, costo: b.costo, orden: b.orden, activo: b.activo, metodos: [...b.metodos], areas: b.areas.map((a) => ({ ...a })) }),
        validar: (d, { id, registros }) => {
          const otro = registros.find((b) => b.id !== id && mismoNombre(b.nombre, d.nombre));
          return {
            nombre: !d.nombre.trim() ? 'Escribe el nombre del blueprint.' : otro ? `Ya hay un blueprint «${otro.nombre}».` : undefined,
            areas: !d.areas.some((a) => String(a.nombre).trim()) ? 'Ponle nombre al menos a un área (las que no tienen nombre no se guardan).' : undefined,
          };
        },
        campos: ({ datos, cambiar, errores, idDe }) => (
          <>
            <GrupoCampos titulo="El blueprint">
              <Campo id={idDe('nombre')} etiqueta="Nombre" placeholder="Ej. Polo unisex algodón" value={datos.nombre} error={errores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
              <Campo id={idDe('prenda')} etiqueta="Prenda base" placeholder="Ej. polo, taza, hoodie, totebag" value={datos.prenda} onChange={(e) => cambiar('prenda', e.target.value)} />
            </GrupoCampos>
            <GrupoCampos titulo="Costo y orden" columnas={2}>
              <CampoDinero id={idDe('costo')} etiqueta="Costo base de impresión" value={datos.costo} onChange={(e) => cambiar('costo', e.target.value)} />
              <Campo id={idDe('orden')} etiqueta="Orden" type="number" inputMode="numeric" min={0} value={datos.orden} onChange={(e) => cambiar('orden', e.target.value)} />
            </GrupoCampos>
            <GrupoCampos titulo="Cómo se decora">
              <ElegirVarios id={idDe('metodos')} etiqueta="Métodos" opciones={metodos} valor={datos.metodos} onCambiar={(v) => cambiar('metodos', v)} onCrear={async (n) => ({ valor: n, texto: n })} placeholder="Elegir o escribir uno" />
            </GrupoCampos>
            <GrupoCampos titulo="Áreas de impresión" ayuda="En cm y a qué resolución se imprime (300 dpi es lo de imprenta).">
              <span id={idDe('areas')} tabIndex={-1} />
              <AreasImpresion areas={datos.areas} onCambiar={(v) => cambiar('areas', v)} error={errores.areas} />
            </GrupoCampos>
            <GrupoCampos titulo="Estado">
              <Interruptor etiqueta="Activo" descripcion="Apagado no se ofrece (no se borra)." activo={datos.activo} onChange={(v) => cambiar('activo', v)} />
            </GrupoCampos>
          </>
        ),
      }}
    />
  );
}

/* ── Plantillas de cuadros (Yoryo y Daida) ─────────────── */

/**
 * La página de una sola vez de /admin/plantillas-yoryo: siete pasos, cada uno
 * con su botón y lo que va pasando. Lo que hace cada paso no cambia (son los
 * scripts de pages/admin/plantillasYoryo); el kit solo pone cómo se ve.
 *  - productos: [{ id: 'cuadro', nombre: 'Cuadro' }…] · prendas: [{ id, nombre, borrador }] (destinos posibles)
 *  - destinosIniciales: { cuadro: prendaId } (los que ya existen) · plantillas: { cuadro: [{ id, grupo, nombre }] }
 *  - cargando · sinSesion (los pasos piden la sesión del admin); un paso a la vez
 *  - onCrearProductos(avisar) · onGuardarPlantillas({ destinos, elegidas }, marcar(id, texto)) ·
 *    onQuitarCopias(avisar) · onPasarATienda(avisar) · onAjustarTomatodo(avisar) ·
 *    onCrearGrabados(avisar) · onCrearComodas(avisar): promesas (el texto que devuelven queda como resultado)
 */
export function PaginaPlantillasYoryo({
  productos = [], prendas = [], destinosIniciales = {}, plantillas = {}, cargando, sinSesion = false,
  onCrearProductos, onGuardarPlantillas, onQuitarCopias, onPasarATienda, onAjustarTomatodo, onCrearGrabados, onCrearComodas,
}) {
  const [destinos, setDestinos] = useState({});
  const [elegidas, setElegidas] = useState(() => new Set(Object.values(plantillas).flat().map((p) => p.id)));
  const [estado, setEstado] = useState({});
  const destinoDe = (id) => destinos[id] ?? destinosIniciales[id] ?? '';
  const hayDestino = productos.some((p) => destinoDe(p.id));
  const marcar = (id, texto) => setEstado((m) => ({ ...m, [id]: texto }));
  // Un paso a la vez (como antes): mientras uno corre, los demás esperan.
  const [trabajando, setTrabajando] = useState(false);
  const uno = (fn) => fn && (async (...args) => {
    setTrabajando(true);
    try { return await fn(...args); } finally { setTrabajando(false); }
  });
  const bloqueado = sinSesion || trabajando;
  const sinSesionTexto = sinSesion ? 'Entra con tu cuenta de admin.' : trabajando ? 'Espera a que termine el otro paso.' : undefined;

  return (
    <div className={s.pasos} data-componente="PaginaPlantillasYoryo">
      <CabezaAdmin icono="plantillas" titulo="Plantillas de cuadros" subtitulo="Una sola vez: los productos de Yoryo y Daida en Crear con sus plantillas. Después se cambian en Productos › Personalizables." />
      <Aviso tipo="info" compacto>Cada paso se puede repetir: lo que ya existe no se duplica (volver a guardar plantillas reemplaza las mismas).</Aviso>

      <PasoAdmin numero={1} titulo="Los productos en Crear" boton={{ texto: 'Crear productos y pack' }} onEjecutar={uno(onCrearProductos)} deshabilitado={bloqueado} motivo={sinSesionTexto}>
        Crea el cuadro (31 × 25 cm), el mousepad (23.5 × 19.5 cm) y el tomatodo grabado como productos de Crear, con la foto de la tienda sin fondo, y el Pack de oficina como combo. También hace que «Personalizar» de esos productos de la tienda lleve a ellos.
      </PasoAdmin>

      <PasoAdmin
        numero={2}
        titulo="Sus plantillas"
        boton={{ texto: 'Guardar las plantillas', variante: 'primario' }}
        onEjecutar={uno(() => onGuardarPlantillas?.({ destinos: Object.fromEntries(productos.map((p) => [p.id, destinoDe(p.id)])), elegidas: [...elegidas] }, marcar))}
        deshabilitado={bloqueado || cargando || !hayDestino}
        motivo={bloqueado ? sinSesionTexto : !hayDestino ? 'Elige al menos un producto de destino.' : undefined}
        contenido={(
          <>
            <div className={s.destinos}>
              {productos.map((p) => (
                <Campo
                  key={p.id}
                  etiqueta={`${p.nombre} de Crear`}
                  opciones={[{ valor: '', texto: 'No importar' }, ...prendas.map((x) => ({ valor: x.id, texto: `${x.nombre}${x.borrador ? ' (borrador)' : ''}` }))]}
                  value={destinoDe(p.id)}
                  onChange={(e) => setDestinos((d) => ({ ...d, [p.id]: e.target.value }))}
                />
              ))}
            </div>
            {productos.filter((p) => destinoDe(p.id)).map((p) => (
              <div key={p.id} className={s.plantillas}>
                <strong>{p.nombre}</strong>
                {(plantillas[p.id] || []).map((x) => (
                  <div key={x.id} className={s.plantilla}>
                    <Casilla
                      etiqueta={`${x.grupo} · ${x.nombre}`}
                      activo={elegidas.has(x.id)}
                      onChange={(si) => setElegidas((prev) => { const n = new Set(prev); if (si) n.add(x.id); else n.delete(x.id); return n; })}
                    />
                    {estado[x.id] && <span className={/^Error/.test(estado[x.id]) ? s.malo : s.bueno}>{estado[x.id]}</span>}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      >
        En cada producto, sus plantillas (6 de equipos y 3 de parejas; en el tomatodo, los 6 escudos para grabar). El cliente las ve en el estudio, en «Empieza con un diseño». No van a la comunidad ni a Mis creaciones.
      </PasoAdmin>

      <PasoAdmin numero={3} titulo="Quitar las copias de la comunidad" boton={{ texto: 'Quitar copias' }} onEjecutar={uno(onQuitarCopias)} deshabilitado={bloqueado} motivo={sinSesionTexto}>
        La versión anterior de esta página publicó las plantillas en la comunidad y las guardó en tus creaciones: esto las retira y las borra de Mis creaciones. Las plantillas de los productos no se tocan.
      </PasoAdmin>

      <PasoAdmin
        numero={4}
        titulo="Pasarlos a la tienda"
        boton={{ texto: 'Pasar a la tienda' }}
        onEjecutar={uno(onPasarATienda)}
        deshabilitado={bloqueado}
        motivo={sinSesionTexto}
        confirmar={{ titulo: '¿Pasar el cuadro, el mousepad, el tomatodo y el Pack de oficina a la tienda?', texto: 'Sus productos de la tienda de antes se ocultan; sus enlaces llevan a los nuevos.', confirmar: 'Pasarlos' }}
      >
        Cada uno queda como un solo producto: el de Crear sale también en la tienda y en la página de Yoryo, con las fotos, la descripción, la categoría y las etiquetas del de la tienda, y su botón es «Personalízalo». Hazlo después de los pasos 1 y 2.
      </PasoAdmin>

      <PasoAdmin numero={5} titulo="Ajustar el tomatodo a su foto nueva" boton={{ texto: 'Ajustar el tomatodo' }} onEjecutar={uno(onAjustarTomatodo)} deshabilitado={bloqueado} motivo={sinSesionTexto}>
        Rehace la zona, la medida de referencia y las miniaturas de sus plantillas sobre la foto nueva del tomatodo.
      </PasoAdmin>

      <PasoAdmin numero={6} titulo="Billetera, esclava y packs" boton={{ texto: 'Crear los grabados' }} onEjecutar={uno(onCrearGrabados)} deshabilitado={bloqueado} motivo={sinSesionTexto}>
        La billetera y la esclava como una sola ficha que se vende tal cual y grabada (las de antes quedan reemplazadas), y los packs con el reloj tal cual.
      </PasoAdmin>

      <PasoAdmin numero={7} titulo="Cómodas de Daida Hogar" boton={{ texto: 'Crear las cómodas' }} onEjecutar={uno(onCrearComodas)} deshabilitado={bloqueado} motivo={sinSesionTexto}>
        Las tres cómodas (las de 8 cajones con el ancho en el nombre), su categoría y su tipo de producto.
      </PasoAdmin>
    </div>
  );
}
