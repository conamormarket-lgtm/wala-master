import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Crown, Crop, Plus, Sparkles, Trash2 } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, EstadoVacio, useToast } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { Pestanas } from '../../Navegacion';
import { Hueso } from '../../Esqueletos';
import { FotoProducto } from '../../piezas/FotoProducto';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { ListaOrdenable, SelectorProductos } from '../../piezas/admin/Datos';
import { GrupoCampos, CampoImagen, CampoDinero, CampoColor, ElegirUno } from '../../piezas/admin/Formularios';
import { EncuadreFoto, FotoEncuadrada, GaleriaFotos, CampoTallas, ElegirVarios, ElegirMarca } from '../../piezas/admin/Producto';
import { DisenoPrenda, ColoresPrenda, PlantillasPrenda } from '../../piezas/admin/Crear';
import { CUMPLIMIENTOS, erroresDeFicha } from '../../adaptadoresAdmin';
import { PUBLICOS, EDADES } from './Productos';
import l from './Lista.module.css';
import s from './Ficha.module.css';

/*
 * La ficha de un producto (/admin/productos/:id y /nuevo, D2b): lo de
 * AdminProductoFormV2 para un producto de la tienda o un combo. Los
 * personalizables de Crear tienen su ficha en D2c. Los datos llegan con
 * fichaDesdeProducto y salen por onGuardar (el admin los pasa por
 * fichaAProducto). Nada se escribe hasta "Guardar".
 */

const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nuevoId = () => `var_${Date.now()}`;
const deMarca = (marcaId, estricto) => (x) => (!marcaId ? true : (x.marcas || []).length === 0 ? !estricto : x.marcas.includes(marcaId));

/* Una tarjeta de la ficha: un bloque de campos con su borde. */
function Bloque({ children, hidden = false }) {
  return <section className={s.bloque} hidden={hidden}>{children}</section>;
}

/**
 * La ficha.
 *  - inicial: los datos (fichaDesdeProducto) · nuevo · cargando · error · onReintentar
 *  - marcas: [{ id, nombre, logo, whatsapp }] · categorias, colecciones, tipos,
 *    personajes, etiquetas: [{ id, nombre, marcas }] (sin marcas = de todas)
 *  - onCrear(lista, { nombre, marcaId }) → promesa con { id, nombre }
 *  - equipos: los nombres que ya usan otros productos (el Equipo se elige o se escribe uno nuevo)
 *    (lista: 'categoria' | 'coleccion' | 'tipo' | 'personaje' | 'etiqueta')
 *  - productos (productoAdminDesde, para las piezas de un combo) · coloresDe(productoId) → [{ nombre, foto }]
 *  - destinosCrear: [{ valor, texto }] (dónde se personaliza: /crear/:id, /combo/:id)
 *  - subirImagen(blob, { alAvanzar, carpeta }) → promesa con la url
 *  - onGuardar(datos) → promesa · onVolver() · onPasarACrear() (volverlo personalizable)
 *  - onBorrador(datos): mientras se escribe uno nuevo (el admin lo guarda en el aparato)
 *  - descripcion(valor, onCambiar) → nodo: el editor de texto con formato (sin él, un texto largo)
 *  - extraGaleria(variante, agregar(url)) → nodo: algo más bajo la galería (frente y espalda)
 *  - pestanaInicial ('general' | 'colores' | 'diseno' | 'plantillas' | 'donde') · onPestana (en el admin, ?pestana=)
 * Un personalizable de Crear (datos.esPrenda, D2c) suma Diseño (vistas y
 * zonas) y Plantillas, y sus colores llevan fotos para diseñar y de tienda:
 *  - fotoConPlantilla(color, plantilla, { vistas, laser }) → promesa con la url
 *  - plantillas: las de ahora (se guardan al momento: llegan de afuera) ·
 *    accionesPlantillas: { onRenombrar, onGrupo, onQuitar, onTraer, otras, urlNueva, urlEditar }
 */
export function PaginaFichaProducto({
  inicial, nuevo = false, cargando, error, onReintentar,
  marcas = [], categorias = [], colecciones = [], tipos = [], personajes = [], etiquetas = [], onCrear, equipos = [],
  productos = [], coloresDe = () => [], destinosCrear = [], subirImagen,
  onGuardar, onVolver, onPasarACrear, onBorrador, descripcion, extraGaleria,
  pestanaInicial = 'general', onPestana, fotoConPlantilla, plantillas: plantillasVivas, accionesPlantillas = {},
}) {
  const toast = useToast();
  const [datos, setDatos] = useState(inicial);
  const [base, setBase] = useState(inicial);
  const [pestana, setPestanaEstado] = useState(pestanaInicial);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [falla, setFalla] = useState('');
  const [salir, setSalir] = useState(false);
  const [pasar, setPasar] = useState(false);
  const [activa, setActiva] = useState(inicial?.principal);
  const [quitarColor, setQuitarColor] = useState(null);
  const [encuadrando, setEncuadrando] = useState(false);

  // Llega el producto (o se recarga): se empieza de ahí.
  useEffect(() => { if (inicial) { setDatos(inicial); setBase(inicial); setActiva(inicial.principal); setErrores({}); } }, [inicial]);
  // Las plantillas se guardan al momento: lo que llega de afuera entra sin marcar cambios.
  useEffect(() => {
    if (!plantillasVivas) return;
    const poner = (d) => (d ? { ...d, prenda: { ...(d.prenda || {}), plantillas: plantillasVivas } } : d);
    setDatos(poner);
    setBase(poner);
  }, [plantillasVivas]);

  const sucio = Boolean(datos && base) && !mismo(datos, base);
  // Uno nuevo se va guardando en el aparato mientras se escribe.
  const borrador = useRef(onBorrador);
  borrador.current = onBorrador;
  useEffect(() => {
    if (!nuevo || !sucio || !borrador.current) return undefined;
    const t = window.setTimeout(() => borrador.current(datos), 800);
    return () => window.clearTimeout(t);
  }, [datos, nuevo, sucio]);

  if (cargando || !datos) {
    return (
      <div className={s.cargando} aria-busy="true">
        <Hueso alto={32} ancho="40%" />
        <Hueso alto={14} ancho="60%" />
        <Hueso alto={220} />
        <Hueso alto={160} />
      </div>
    );
  }
  if (error) {
    return <Aviso tipo="error" titulo="No pudimos abrir el producto" accion={onReintentar && <Boton tamano="sm" variante="contorno" onClick={onReintentar}>Reintentar</Boton>}>{error}</Aviso>;
  }

  const setPestana = (p) => { setPestanaEstado(p); onPestana?.(p); };
  const cambiar = (campo, valor) => {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };
  const cambiarCombo = (campo, valor) => setDatos((d) => ({ ...d, combo: { ...d.combo, [campo]: valor } }));
  const cambiarPrenda = (c) => setDatos((d) => {
    const prev = d.prenda || {};
    return { ...d, prenda: { ...prev, ...(typeof c === 'function' ? c(prev) : c) } };
  });
  const agregarVariantes = (lista) => setDatos((d) => ({
    ...d,
    variantes: [...d.variantes, ...lista.map((v) => ({ id: v.id, nombre: v.nombre, color: v.color, foto: '', encuadre: null, galeria: [], encuadres: {}, etiquetaTalla: 'Talla', tallas: v.tallas || [] }))],
  }));
  const fotoTienda = (id, url) => setDatos((d) => ({ ...d, variantes: d.variantes.map((v) => (v.id === id ? { ...v, foto: url } : v)) }));
  const esPrenda = datos.esPrenda === true && !datos.esCombo;
  const vistasPrenda = datos.prenda?.vistas || [];
  const fotoPrincipal = (datos.variantes.find((v) => v.id === datos.principal) || datos.variantes[0])?.foto;
  const sinFotoTienda = esPrenda && (!fotoPrincipal || vistasPrenda.some((v) => v.imagen === fotoPrincipal));
  const numPlantillas = (plantillasVivas || datos.prenda?.plantillas || []).length;
  const variante = datos.variantes.find((v) => v.id === activa) || datos.variantes[0];
  const cambiarVariante = (campo, valor) => setDatos((d) => ({ ...d, variantes: d.variantes.map((v) => (v.id === variante.id ? { ...v, [campo]: valor } : v)) }));

  const marca = marcas.find((m) => m.id === datos.marcaId);
  const opciones = (lista, estricto) => lista.filter(deMarca(datos.marcaId, estricto)).map((x) => ({ valor: x.id, texto: x.nombre }));
  const crear = (lista) => (onCrear ? async (nombre) => { const r = await onCrear(lista, { nombre, marcaId: datos.marcaId }); return { valor: r.id, texto: r.nombre }; } : undefined);
  const idCampo = (c) => `ficha-${c}`;

  const guardar = async () => {
    const e = erroresDeFicha(datos);
    const primero = Object.keys(e)[0];
    if (primero) {
      setErrores(Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v.texto])));
      setPestana(e[primero].pestana);
      window.setTimeout(() => document.getElementById(idCampo(primero))?.focus(), 60);
      toast({ tipo: 'aviso', titulo: 'Falta algo para guardar', texto: e[primero].texto });
      return;
    }
    setGuardando(true);
    setFalla('');
    try {
      await onGuardar?.(datos);
      setBase(datos);
      toast({ tipo: 'exito', titulo: nuevo ? 'Producto creado' : 'Cambios guardados', texto: datos.nombre.trim() });
    } catch (err) {
      setFalla(err?.message || 'No se pudo guardar. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setGuardando(false);
    }
  };
  const volver = () => { if (sucio) setSalir(true); else onVolver?.(); };

  const agregarColor = () => {
    const id = nuevoId();
    setDatos((d) => ({ ...d, variantes: [...d.variantes, { id, nombre: 'Nuevo color', color: '#cccccc', foto: '', encuadre: null, galeria: [], encuadres: {}, etiquetaTalla: 'Talla', tallas: [] }] }));
    setActiva(id);
  };
  const quitar = () => {
    const id = quitarColor;
    setDatos((d) => {
      const variantes = d.variantes.filter((v) => v.id !== id);
      return { ...d, variantes, principal: d.principal === id ? variantes[0]?.id || '' : d.principal };
    });
    setActiva((a) => (a === id ? datos.variantes.find((v) => v.id !== id)?.id : a));
    setQuitarColor(null);
  };

  const conError = (p) => Object.entries(erroresDeFicha(datos)).some(([k, v]) => errores[k] && v.pestana === p);
  const PESTANAS = (esPrenda ? [
    { id: 'general', texto: 'General' },
    { id: 'colores', texto: `Colores y fotos · ${datos.variantes.length}` },
    { id: 'diseno', texto: `Diseño · ${vistasPrenda.length} vistas` },
    { id: 'plantillas', texto: `Plantillas · ${numPlantillas}` },
    { id: 'donde', texto: 'Dónde se ve' },
  ] : [
    { id: 'general', texto: 'General' },
    { id: 'colores', texto: datos.esCombo ? 'Piezas del combo' : `Colores y tallas · ${datos.variantes.length}` },
    { id: 'donde', texto: 'Dónde se ve' },
  ]).map((p) => ({ ...p, texto: conError(p.id) ? `${p.texto} •` : p.texto }));

  const subirEn = (carpeta) => subirImagen && ((b, o) => subirImagen(b, { ...o, carpeta }));

  return (
    <div className={s.ficha} data-componente="PaginaFichaProducto">
      <CabezaAdmin
        icono="productos"
        titulo={nuevo ? (esPrenda ? 'Nuevo personalizable' : 'Nuevo producto') : datos.nombre || 'Producto'}
        subtitulo={nuevo ? 'Se guarda en este aparato mientras escribes; se publica al tocar "Crear".'
          : esPrenda ? `${datos.visible ? 'Publicado en Crear' : 'Borrador en Crear'}${datos.enTienda ? ' · también en la tienda' : ''}.`
            : (datos.visible ? 'Se ve en la tienda.' : 'Oculto en la tienda.')}
        acciones={<Boton variante="secundario" icono={<ArrowLeft aria-hidden="true" />} onClick={volver}>Productos</Boton>}
      />

      <div className={`${s.pestanas} ${l.desliza}`}>
        <Pestanas opciones={PESTANAS} valor={pestana} onChange={setPestana} etiqueta="Partes de la ficha" />
      </div>

      {falla && <div className={s.aviso}><Aviso tipo="error" titulo="No se guardó">{falla}</Aviso></div>}

      {/* ── General ── */}
      <div hidden={pestana !== 'general'} className={s.pestana}>
        <Bloque hidden={esPrenda}>
          <GrupoCampos titulo="Cómo se vende">
            <ElegirUno
              etiqueta="Cómo se vende"
              opciones={[{ valor: 'no', texto: 'Producto individual' }, { valor: 'si', texto: 'Combo o paquete' }]}
              valor={datos.esCombo ? 'si' : 'no'}
              onElegir={(v) => v && cambiar('esCombo', v === 'si')}
            />
            {datos.esCombo && <p className={l.sub}>Un combo junta productos de la tienda: sus piezas se eligen en «Piezas del combo».</p>}
          </GrupoCampos>
        </Bloque>

        <Bloque>
          <GrupoCampos titulo="Lo básico">
            <Campo id={idCampo('nombre')} etiqueta="Nombre" value={datos.nombre} error={errores.nombre} maxLength={120} placeholder="Ej. Polo Kapi oversize" onChange={(e) => cambiar('nombre', e.target.value)} />
            <div className={s.dos}>
              <CampoDinero id={idCampo('precio')} etiqueta="Precio" value={datos.precio} error={errores.precio} onChange={(e) => cambiar('precio', e.target.value)} />
              <CampoDinero
                id={idCampo('oferta')}
                etiqueta="Precio de oferta"
                value={datos.oferta}
                error={errores.oferta}
                ayuda={Number(datos.oferta) > 0 && Number(datos.oferta) < Number(datos.precio) ? `${Math.round(100 - (Number(datos.oferta) * 100) / Number(datos.precio))} % menos` : 'Opcional: más bajo que el precio.'}
                onChange={(e) => cambiar('oferta', e.target.value)}
              />
              <Campo id={idCampo('sku')} etiqueta="SKU" value={datos.sku} placeholder="Opcional" onChange={(e) => cambiar('sku', e.target.value)} />
              <Campo id={idCampo('stock')} etiqueta="Stock" type="number" inputMode="numeric" min={0} value={datos.stock} error={errores.stock} placeholder={esPrenda ? 'Sin límite' : undefined} ayuda={esPrenda ? 'Vacío: sin límite (se hace al pedirlo).' : 'También se cambia desde la lista de Productos.'} onChange={(e) => cambiar('stock', e.target.value)} />
            </div>
            {descripcion ? (
              <div className={s.descripcion}>
                <span className={s.etiqueta}>Descripción</span>
                {descripcion(datos.descripcion, (v) => cambiar('descripcion', v))}
              </div>
            ) : (
              <Campo id={idCampo('descripcion')} etiqueta="Descripción" multilinea={5} value={datos.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} />
            )}
          </GrupoCampos>
        </Bloque>

        <Bloque>
          <GrupoCampos titulo="Marca y catálogo" ayuda="Las listas muestran lo de la marca elegida (las que no tienen marca, en todas).">
            <ElegirMarca marcas={marcas} valor={datos.marcaId} onCambiar={(v) => cambiar('marcaId', v)} ayuda="Sin marca, el producto no sale en ninguna página de marca. Las marcas se crean en Marcas." />
            <div className={s.dos}>
              <Campo
                id={idCampo('categoria')}
                etiqueta="Categoría"
                opciones={[{ valor: '', texto: 'Sin categoría' }, ...opciones(categorias, true)]}
                creable={Boolean(onCrear)}
                buscable
                value={datos.categoria}
                onChange={async (e) => {
                  const v = e.target.value;
                  if (!v || categorias.some((c) => c.id === v)) { cambiar('categoria', v); return; }
                  try { const r = await onCrear('categoria', { nombre: v, marcaId: datos.marcaId }); cambiar('categoria', r.id); toast({ tipo: 'exito', titulo: `Categoría creada: ${r.nombre}` }); } catch (err) { toast({ tipo: 'error', titulo: 'No se creó la categoría', texto: err?.message }); }
                }}
              />
              <Campo
                id={idCampo('tipo')}
                etiqueta="Tipo de producto"
                opciones={[{ valor: '', texto: 'Sin tipo' }, ...tipos.map((x) => ({ valor: x.id, texto: x.nombre }))]}
                creable={Boolean(onCrear)}
                value={datos.tipo}
                ayuda="El filtro «Tipo de producto» de la tienda."
                onChange={async (e) => {
                  const v = e.target.value;
                  if (!v || tipos.some((x) => x.id === v)) { cambiar('tipo', v); return; }
                  try { const r = await onCrear('tipo', { nombre: v }); cambiar('tipo', r.id); } catch (err) { toast({ tipo: 'error', titulo: 'No se creó el tipo', texto: err?.message }); }
                }}
              />
            </div>
            <ElegirVarios id={idCampo('colecciones')} etiqueta="Colecciones" opciones={opciones(colecciones, true)} valor={datos.colecciones} onCambiar={(v) => cambiar('colecciones', v)} onCrear={crear('coleccion')} />
            <ElegirVarios id={idCampo('personajes')} etiqueta="Personajes" opciones={opciones(personajes, false)} valor={datos.personajes} onCambiar={(v) => cambiar('personajes', v)} onCrear={crear('personaje')} />
            <ElegirVarios id={idCampo('etiquetas')} etiqueta="Etiquetas" opciones={opciones(etiquetas, false)} valor={datos.etiquetas} onCambiar={(v) => cambiar('etiquetas', v)} onCrear={crear('etiqueta')} />
            <Campo id={idCampo('cumplimiento')} etiqueta="Cómo se prepara" opciones={CUMPLIMIENTOS} value={datos.cumplimiento} ayuda="Automático: lo decide la tienda según el producto." onChange={(e) => cambiar('cumplimiento', e.target.value)} />
          </GrupoCampos>
        </Bloque>

        <Bloque>
          <GrupoCampos titulo="Para recomendarlo de regalo">
            <div className={s.fila}><span className={s.etiqueta}>Para quién</span><ElegirUno etiqueta="Para quién es" opciones={PUBLICOS} valor={datos.publico} onElegir={(v) => cambiar('publico', v || '')} /></div>
            <div className={s.fila}><span className={s.etiqueta}>Edad</span><ElegirUno etiqueta="Edad" opciones={EDADES} valor={datos.edadMinima} onElegir={(v) => cambiar('edadMinima', v)} /></div>
            {/* La misma lista que Datos para recomendar: los equipos que ya hay, o uno nuevo. */}
            <Campo
              id={idCampo('equipo')}
              etiqueta="Equipo"
              opciones={[{ valor: '', texto: 'Ninguno' }, ...[...new Set([...equipos, ...(datos.equipo ? [datos.equipo] : [])])].sort((a, b) => a.localeCompare(b, 'es')).map((e) => ({ valor: e, texto: e }))]}
              buscable
              creable
              placeholder="Ninguno"
              value={datos.equipo || ''}
              ayuda="Para las ideas de regalo de un equipo. Si no está, escríbelo."
              onChange={(e) => cambiar('equipo', String(e.target.value || '').trim())}
            />
          </GrupoCampos>
        </Bloque>

        <Bloque>
          <GrupoCampos titulo="WhatsApp">
            <Interruptor etiqueta="Botón de WhatsApp en su página" descripcion="Para que pregunten por este producto." activo={datos.whatsappActivo} onChange={(v) => cambiar('whatsappActivo', v)} />
            {datos.whatsappActivo && (
              <>
                <Campo
                  id={idCampo('whatsappNumero')}
                  etiqueta="Número propio (opcional)"
                  inputMode="tel"
                  placeholder={marca?.whatsapp || 'El de la marca o el general'}
                  value={datos.whatsappNumero}
                  ayuda="Vacío: el del asesor de la marca y, si no tiene, el general."
                  onChange={(e) => cambiar('whatsappNumero', e.target.value.replace(/[^\d\s\-()+]/g, ''))}
                />
                <Campo id={idCampo('whatsappMensaje')} etiqueta="Mensaje al abrir el chat (opcional)" multilinea={2} value={datos.whatsappMensaje} ayuda="{url} se cambia por el link del producto." onChange={(e) => cambiar('whatsappMensaje', e.target.value)} />
              </>
            )}
          </GrupoCampos>
        </Bloque>

        <Bloque>
          <Interruptor etiqueta="Destacado" descripcion="Sale entre los destacados de la portada (su orden, en Destacados)." activo={datos.destacado} onChange={(v) => cambiar('destacado', v)} />
        </Bloque>
      </div>

      {/* ── Colores y tallas ── */}
      <div hidden={pestana !== 'colores' || datos.esCombo} className={s.pestana}>
        {errores.variantes && <Aviso tipo="error" titulo={errores.variantes} />}
        <div className={`${s.colores} ${l.desliza}`} role="tablist" aria-label="Colores">
          {datos.variantes.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={v.id === variante?.id}
              className={[s.color, v.id === variante?.id && s.colorActivo].filter(Boolean).join(' ')}
              onClick={() => setActiva(v.id)}
            >
              <span className={s.colorPunto} style={{ background: v.color }} />
              {v.nombre || 'Sin nombre'}
              {v.id === datos.principal && <Crown className={s.corona} aria-label="Principal" />}
            </button>
          ))}
          <button type="button" className={s.colorAgregar} onClick={agregarColor}><Plus aria-hidden="true" /> Color</button>
        </div>

        {variante && (
          <>
            <Bloque>
              <GrupoCampos titulo="El color">
                <div className={s.dos}>
                  <Campo id={idCampo('colorNombre')} etiqueta="Nombre" value={variante.nombre} placeholder="Ej. Negro" onChange={(e) => cambiarVariante('nombre', e.target.value)} />
                  <CampoColor id={idCampo('colorHex')} etiqueta="Color" valor={variante.color} onCambiar={(v) => cambiarVariante('color', v)} />
                </div>
                <div className={s.acciones}>
                  {variante.id === datos.principal
                    ? <span className={s.principal}><Crown aria-hidden="true" /> Es el principal: su foto es la de la tienda</span>
                    : <Boton tamano="sm" variante="secundario" icono={<Crown aria-hidden="true" />} onClick={() => cambiar('principal', variante.id)}>Hacerlo el principal</Boton>}
                  {datos.variantes.length > 1 && <Boton tamano="sm" variante="fantasma" className={l.eliminar} icono={<Trash2 aria-hidden="true" />} onClick={() => setQuitarColor(variante.id)}>Quitar este color</Boton>}
                </div>
              </GrupoCampos>
            </Bloque>

            <Bloque>
              <GrupoCampos titulo="La foto de la tarjeta" ayuda="Fondo blanco, como el resto de la tienda. El encuadre elige qué parte se ve (3:4) sin cortarla.">
                <div className={s.portada}>
                  <CampoImagen etiqueta="Foto principal" valor={variante.foto} onCambiar={(url) => setDatos((d) => ({ ...d, variantes: d.variantes.map((v) => (v.id === variante.id ? { ...v, foto: url, encuadre: url ? v.encuadre : null } : v)) }))} subir={subirEn('principal')} conEnlace contener />
                  {variante.foto && (
                    <div className={s.tarjetaVista}>
                      <span className={s.etiqueta}>Así en la tarjeta</span>
                      <FotoEncuadrada src={variante.foto} encuadre={variante.encuadre} className={s.tarjetaFoto} />
                      <Boton tamano="sm" variante="secundario" icono={<Crop aria-hidden="true" />} onClick={() => setEncuadrando(true)}>{variante.encuadre ? 'Cambiar encuadre' : 'Encuadrar'}</Boton>
                    </div>
                  )}
                </div>
              </GrupoCampos>
            </Bloque>

            <Bloque>
              <GrupoCampos titulo="Tallas">
                <div className={s.dos}>
                  <Campo id={idCampo('etiquetaTalla')} etiqueta="Cómo se llama" placeholder="Talla" value={variante.etiquetaTalla} ayuda="Talla, Medida, Número…" onChange={(e) => cambiarVariante('etiquetaTalla', e.target.value)} />
                </div>
                <CampoTallas id={idCampo('tallas')} tallas={variante.tallas} onCambiar={(v) => cambiarVariante('tallas', v)} />
              </GrupoCampos>
            </Bloque>

            <Bloque>
              <GrupoCampos titulo="Galería" ayuda="Las otras fotos de este color, en este orden.">
                <GaleriaFotos
                  fotos={variante.galeria}
                  onCambiar={(v) => cambiarVariante('galeria', v)}
                  encuadres={variante.encuadres}
                  onEncuadres={(v) => cambiarVariante('encuadres', v)}
                  subir={subirEn('galeria')}
                />
                {extraGaleria && extraGaleria(variante, (url) => cambiarVariante('galeria', [...variante.galeria, url]))}
              </GrupoCampos>
            </Bloque>
          </>
        )}
        {esPrenda && (
          <ColoresPrenda prenda={datos.prenda} onPrenda={cambiarPrenda} variantes={datos.variantes} onAgregarVariantes={agregarVariantes} onFotoTienda={fotoTienda} subirImagen={subirImagen} fotoConPlantilla={fotoConPlantilla} />
        )}
      </div>

      {/* ── Diseño y plantillas de un personalizable ── */}
      <div hidden={pestana !== 'diseno' || !esPrenda} className={s.pestana}>
        {errores.vistas && <span id={idCampo('vistas')} tabIndex={-1}><Aviso tipo="error" titulo={errores.vistas} /></span>}
        {esPrenda && <DisenoPrenda prenda={datos.prenda} onPrenda={cambiarPrenda} variantes={datos.variantes} principal={datos.principal} subirImagen={subirImagen} />}
      </div>
      <div hidden={pestana !== 'plantillas' || !esPrenda} className={s.pestana}>
        {esPrenda && (
          <PlantillasPrenda
            guardado={!nuevo}
            plantillas={(plantillasVivas || datos.prenda?.plantillas || []).filter((p) => p && p.id)}
            {...accionesPlantillas}
          />
        )}
      </div>

      {/* ── Piezas del combo ── */}
      <div hidden={pestana !== 'colores' || !datos.esCombo} className={s.pestana}>
        <Bloque>
          <GrupoCampos titulo="Tallas del combo">
            <ElegirUno
              etiqueta="Tallas del combo"
              opciones={[{ valor: 'porPrenda', texto: 'Cada prenda con su talla' }, { valor: 'una', texto: 'Una talla para todo' }]}
              valor={datos.combo.tallas}
              onElegir={(v) => v && cambiarCombo('tallas', v)}
            />
          </GrupoCampos>
        </Bloque>
        <Bloque>
          <GrupoCampos titulo={`Piezas · ${datos.combo.piezas.length}`} ayuda="Productos de la tienda, en este orden. El color elegido es el que se ve en el combo.">
            {errores.piezas && <span id={idCampo('piezas')} tabIndex={-1}><Aviso tipo="error" titulo={errores.piezas} /></span>}
            {datos.combo.piezas.length ? (
              <ListaOrdenable
                items={datos.combo.piezas}
                idDe={(p) => p.uid}
                nombreDe={(p) => p.nombre}
                onCambiar={(v) => cambiarCombo('piezas', v)}
                etiqueta="Piezas del combo"
                render={(pz) => {
                  const colores = coloresDe(pz.productoId);
                  const editar = (campo, valor) => cambiarCombo('piezas', datos.combo.piezas.map((x) => (x.uid === pz.uid ? { ...x, [campo]: valor } : x)));
                  const huerfano = pz.color && colores.length > 0 && !colores.some((c) => c.nombre === pz.color);
                  return (
                    <div className={s.pieza}>
                      <FotoProducto src={pz.foto} className={s.piezaFoto} />
                      <div className={s.piezaCampos}>
                        <input className={s.piezaNombre} value={pz.nombre} aria-label="Nombre en el combo" onChange={(e) => editar('nombre', e.target.value)} />
                        {colores.length > 0 && (
                          <select
                            className={s.piezaColor}
                            value={pz.color}
                            aria-label={`Color de ${pz.nombre}`}
                            onChange={(e) => {
                              const c = colores.find((x) => x.nombre === e.target.value);
                              cambiarCombo('piezas', datos.combo.piezas.map((x) => (x.uid === pz.uid ? { ...x, color: e.target.value, foto: c?.foto || x.foto } : x)));
                            }}
                          >
                            {huerfano && <option value={pz.color}>{pz.color} (ya no existe)</option>}
                            {colores.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                          </select>
                        )}
                      </div>
                      <Boton soloIcono tamano="sm" variante="fantasma" icono={<Trash2 aria-hidden="true" />} aria-label={`Quitar ${pz.nombre}`} onClick={() => cambiarCombo('piezas', datos.combo.piezas.filter((x) => x.uid !== pz.uid))} />
                    </div>
                  );
                }}
              />
            ) : (
              <EstadoVacio imagen={null} icono={<Plus aria-hidden="true" />} titulo="El combo todavía no tiene piezas" texto="Búscalas abajo." />
            )}
            <SelectorProductos
              productos={productos.filter((p) => !p.esCombo && !p.pack && !p.personalizable)}
              yaEstan={datos.combo.piezas.map((p) => p.productoId)}
              accion="Agregar"
              accionHecha="En el combo"
              onElegir={(p) => {
                const colores = coloresDe(p.id);
                cambiarCombo('piezas', [...datos.combo.piezas, { uid: `${p.id}-${Date.now()}`, productoId: p.id, nombre: p.nombre, foto: colores[0]?.foto || p.imagen, color: colores[0]?.nombre || '' }]);
              }}
            />
          </GrupoCampos>
        </Bloque>
        <Bloque>
          <GrupoCampos titulo="Portada del combo" ayuda="La foto de la tarjeta y la primera de su ficha. Sin ella, se ven sus piezas juntas.">
            <CampoImagen etiqueta="Portada" valor={datos.combo.portada} onCambiar={(url) => cambiarCombo('portada', url)} subir={subirEn('combo')} contener />
          </GrupoCampos>
        </Bloque>
      </div>

      {/* ── Dónde se ve ── */}
      <div hidden={pestana !== 'donde'} className={s.pestana}>
        {esPrenda ? (
          <Bloque>
            <GrupoCampos titulo="Dónde se ve">
              <Interruptor etiqueta="Publicado en Crear" descripcion="Apagado: es un borrador; solo lo ve el admin." activo={datos.visible} onChange={(v) => cambiar('visible', v)} />
              <Interruptor etiqueta="También en la tienda" descripcion="Sale entre los productos, con «Personalizar»." activo={datos.enTienda} onChange={(v) => cambiar('enTienda', v)} />
              {datos.enTienda && <Interruptor etiqueta="También se vende sin personalizar" descripcion="Se puede comprar tal cual, además de diseñarlo." activo={datos.talCual} onChange={(v) => cambiar('talCual', v)} />}
              {datos.enTienda && sinFotoTienda && <Aviso tipo="aviso" titulo="Su color principal no tiene foto de tienda">En la tienda se verá la foto para diseñar (el producto en blanco). Súbela en «Colores y fotos».</Aviso>}
            </GrupoCampos>
          </Bloque>
        ) : (
        <Bloque>
          <Interruptor etiqueta="Se ve en la tienda" descripcion="Apagado: queda oculto (no se borra). También se cambia desde la lista." activo={datos.visible} onChange={(v) => cambiar('visible', v)} />
        </Bloque>
        )}
        <Bloque hidden={esPrenda}>
          <GrupoCampos titulo="¿Se personaliza?" ayuda="El botón «Personalizar» de su página lleva a una prenda o un pack de Crear.">
            <Campo
              id={idCampo('personalizarEn')}
              etiqueta="Se personaliza en"
              opciones={[{ valor: '', texto: 'No se personaliza' }, ...destinosCrear, ...(datos.personalizarEn && !destinosCrear.some((d) => d.valor === datos.personalizarEn) ? [{ valor: datos.personalizarEn, texto: `${datos.personalizarEn} (ya no existe)` }] : [])]}
              buscable
              value={datos.personalizarEn}
              onChange={(e) => cambiar('personalizarEn', e.target.value)}
            />
          </GrupoCampos>
        </Bloque>
        {onPasarACrear && !datos.esCombo && !nuevo && !esPrenda && (
          <Bloque>
            <div className={s.crear}>
              <Sparkles aria-hidden="true" />
              <div>
                <strong>¿Es una prenda que se diseña en Crear?</strong>
                <p>Pasa a los personalizables: allí se le ponen sus vistas, sus zonas y sus plantillas.</p>
              </div>
              <Boton tamano="sm" variante="secundario" onClick={() => setPasar(true)}>Pasarla a Crear</Boton>
            </div>
          </Bloque>
        )}
      </div>

      {/* Guardar: siempre a mano, pegado abajo */}
      <div className={s.guardar}>
        <span className={s.guardarEstado} aria-live="polite">{guardando ? 'Guardando…' : sucio ? 'Cambios sin guardar' : nuevo ? '' : 'Todo guardado'}</span>
        <Boton variante="fantasma" onClick={volver} disabled={guardando}>Salir</Boton>
        <Boton onClick={guardar} cargando={guardando} disabled={!sucio && !nuevo}>{nuevo ? (esPrenda ? 'Crear personalizable' : 'Crear producto') : 'Guardar'}</Boton>
      </div>

      <EncuadreFoto
        abierta={encuadrando}
        src={variante?.foto}
        valor={variante?.encuadre}
        onCancelar={() => setEncuadrando(false)}
        onListo={(v) => { cambiarVariante('encuadre', v); setEncuadrando(false); }}
      />
      <Confirmar
        abierta={Boolean(quitarColor)}
        titulo={`¿Quitar «${datos.variantes.find((v) => v.id === quitarColor)?.nombre || 'este color'}»?`}
        texto="Se quitan también sus fotos y tallas de la ficha (las fotos no se borran: los pedidos que las usan siguen igual). Se aplica al guardar."
        confirmar="Quitar"
        peligro
        onConfirmar={quitar}
        onCancelar={() => setQuitarColor(null)}
      />
      <Confirmar
        abierta={salir}
        titulo="¿Salir sin guardar?"
        texto="Los cambios que hiciste se pierden."
        confirmar="Salir sin guardar"
        cancelar="Seguir editando"
        peligro
        onConfirmar={() => { setSalir(false); onVolver?.(); }}
        onCancelar={() => setSalir(false)}
      />
      <Confirmar
        abierta={pasar}
        titulo="¿Pasarla a los personalizables de Crear?"
        texto={sucio ? 'Primero guarda los cambios: después se abre su ficha de Crear.' : 'Se abre su ficha de Crear para ponerle vistas y zonas. Mientras no se publique en Crear, la tienda sigue igual.'}
        confirmar={sucio ? 'Entendido' : 'Pasarla'}
        onConfirmar={() => { setPasar(false); if (!sucio) onPasarACrear?.(); }}
        onCancelar={() => setPasar(false)}
      />
    </div>
  );
}
