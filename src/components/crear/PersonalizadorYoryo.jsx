import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getProduct } from '../../services/products';
import { getDesignById, saveDesign } from '../../services/designs';
import { guardarMiCombo } from '../../services/misCombos';
import { prepararImagenCliente, subirImagenCliente, subirVectorYoryo } from '../../services/crearArchivos';
import { itemDeCreacion } from '../../pages/Crear/creacionCarrito';
import { itemDeCombo, leerArmado, olvidarArmado } from '../../pages/Crear/comboCrear';
import { generarYoryo, generarBorradorYoryo, fotosInlineYoryo, resolverVectorYoryo, cargarPlantillaYoryo } from '../../pages/Crear/generarYoryo';
import { cargarFuentesYoryo, componerArteYoryo, validarVectorSvg } from '../../pages/Crear/arteYoryo.mjs';
import { YORYO_PACK_ID, YORYO_PIEZAS, datosYoryoVacios, validarDatosYoryo, medidasConfirmadas } from '../../utils/yoryoPersonalizacion.mjs';
import { cambiarSeccion, distribucionRecomendada, esDistribucionEditable, fijarDistribucion, firmaDeDisenoYoryo, normalizarFirmaYoryo, seccionesYoryo } from '../../utils/distribucionYoryo.mjs';
import SeccionesYoryo from './SeccionesYoryo';
import LienzoYoryo from './LienzoYoryo';
import { useHistorialYoryo } from './useHistorialYoryo';
import Boton from '../../componentes/kit/Boton';
import { Campo } from '../../componentes/kit/Formulario';
import { Aviso, EstadoVacio } from '../../componentes/kit/Feedback';
import { ElegirUno } from '../../componentes/kit/piezas/Encuesta';
import { Pestanas } from '../../componentes/kit/Navegacion';
import { EsqueletoPagina } from '../../componentes/kit/Esqueletos';
import { MarcoEstudio, EscenaEstudio } from '../../componentes/kit/paginas/MarcoEstudio';
import { CompraEstudio } from '../../componentes/kit/piezas/CompraEstudio';
import { EstadoEdicion, PasoEstudio } from '../../componentes/kit/piezas/Estudio';
import { Texto } from '../../componentes/kit/Traduccion';
import { PLANTILLAS_IMPRESION_YORYO, adaptarPlantillaYoryo } from '../../utils/plantillasYoryo.mjs';
import { vectorLaserDeEquipo } from '../../utils/vectoresLaserYoryo.mjs';
import estudio from './EstudioDeTienda.module.css';
import s from './PersonalizadorYoryo.module.css';

const RecortarFoto = lazy(() => import('../../componentes/kit/piezas/RecortarFoto').then((m) => ({ default: m.RecortarFoto })));
const QuitarFondo = lazy(() => import('./QuitarFondoDeEstudio'));

const leer = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const EQUIPOS = ['Alianza Lima', 'Universitario', 'Sporting Cristal', 'Sport Boys', 'Barcelona', 'Real Madrid'];

export default function PersonalizadorYoryo() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const { items } = useCart();
  const esPack = id === YORYO_PACK_ID;
  const cartId = params.get('carrito') || '';
  const item = cartId ? items.find((i) => i.id === cartId && i.productId === id) : null;
  const ids = esPack ? [id, ...YORYO_PIEZAS.map((p) => p.id)] : [id];
  const queries = useQueries({ queries: ids.map((pid) => ({ queryKey: ['product', pid], queryFn: async () => { const r = await getProduct(pid); if (r.error || !r.data) throw new Error('No pudimos cargar el producto.'); return r.data; } })) });
  const designId = params.get('designId');
  const diseno = useQuery({ queryKey: ['creacion', designId, user?.uid], enabled: Boolean(designId && user), queryFn: async () => { const r = await getDesignById(designId); return r.data ? { ...r.data, id: designId } : null; } });
  const mio = esPack ? params.get('mio') || '' : '';
  const miCombo = useQuery({ queryKey: ['creacion', mio, user?.uid], enabled: Boolean(mio && user && !cartId), queryFn: async () => { const r = await getDesignById(mio); return r.data ? { ...r.data, id: mio } : null; } });
  const cuentaValida = Boolean(miCombo.data && miCombo.data.userId === user?.uid && miCombo.data.tipo === 'comboCrear' && miCombo.data.comboId === id);
  const anteriores = useQueries({ queries: cuentaValida ? (miCombo.data.piezas || []).map((p) => ({ queryKey: ['creacion', p.designId, user?.uid], queryFn: async () => { const r = await getDesignById(p.designId); return r.data ? { ...r.data, id: p.designId } : null; } })) : [] });
  const armado = esPack && !mio && !cartId && !params.has('nuevo') ? leerArmado(id, YORYO_PIEZAS.length) : [];
  const traslado = useQuery({ queryKey: ['yoryo-armado', id, user?.uid, armado.map((p) => p.designId).join('|')], enabled: Boolean(user && armado.some((p) => p.designId)), queryFn: async () => Promise.all(armado.map(async (p, i) => {
    if (!p.designId) return null;
    const r = await getDesignById(p.designId);
    return r.data?.userId === user.uid && r.data.productId === YORYO_PIEZAS[i].id ? { ...r.data, id: p.designId } : null;
  })) });
  if (loading || queries.some((q) => q.isLoading) || diseno.isLoading && designId && user || miCombo.isLoading && mio && user || anteriores.some((q) => q.isLoading) || traslado.isLoading && user && armado.some((p) => p.designId)) return <EsqueletoPagina forma="estudio" />;
  if (queries.some((q) => q.isError || q.data?.deleted || q.data?.visible === false)) return <EstadoVacio titulo="No pudimos abrir este producto" texto="Vuelve a la tienda e inténtalo de nuevo." />;
  if (cartId && !item) return <EstadoVacio titulo="Este artículo ya no está en tu carrito" texto="Regresa al carrito para elegir el producto que quieres editar." />;
  if (designId && (!user || !diseno.data || diseno.data.userId !== user.uid || diseno.data.productId !== id)) return <EstadoVacio titulo="No pudimos abrir este diseño" texto="Inicia sesión con la cuenta que lo creó." />;
  if (mio && !cartId && (!cuentaValida || anteriores.length !== YORYO_PIEZAS.length || anteriores.some((q, i) => !q.data || q.data.userId !== user.uid || q.data.productId !== YORYO_PIEZAS[i].id))) return <EstadoVacio titulo="No pudimos abrir este pack" texto="Inicia sesión con la cuenta que lo creó." />;
  const main = queries[0].data;
  const productos = esPack ? queries.slice(1).map((q) => q.data) : [main];
  const piezaInicial = Number(params.get('pieza'));
  return <FormularioYoryo key={`${id}:${user?.uid || 'invitado'}:${cartId}:${designId || mio}`} main={main} productos={productos} item={item} creacion={diseno.data} creacionesCuenta={cuentaValida ? anteriores.map((q) => q.data) : traslado.data || []} mio={mio} nuevo={params.has('nuevo')} esPack={esPack} indiceInicial={Number.isInteger(piezaInicial) && piezaInicial >= 0 && piezaInicial < productos.length ? piezaInicial : 0} />;
}

function FormularioYoryo({ main, productos, item, creacion, creacionesCuenta = [], mio, nuevo = false, esPack, indiceInicial = 0 }) {
  const { user, isAdmin } = useAuth();
  const { addToCart, actualizarPersonalizacion, items } = useCart();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const clave = `wala:yoryo:${user?.uid || 'invitado'}:${main.id}:${item?.id || mio || creacion?.id || 'nuevo'}`;
  const originales = item ? (esPack ? item.customization?.piezas || [] : [item.customization]) : creacionesCuenta.length ? creacionesCuenta : creacion ? [creacion] : [];
  const originalesRef = useRef(originales);
  const idsGuardadosRef = useRef(Object.fromEntries(originales.flatMap((d, i) => !item && d.estado === 'borrador' && d.id ? [[i, d.id]] : [])));
  const miGuardadoRef = useRef(!item && originales.some((d) => d.estado === 'borrador') ? mio : '');
  const firmaCarritoRef = useRef(item ? JSON.stringify(item.customization) : '');
  const [datos, setDatos, historial] = useHistorialYoryo(() => {
    const adaptar = (lista) => lista.map((d, i) => adaptarPlantillaYoryo(d, productos[i].personalizacionYoryo));
    if (user && !originales.length) {
      try { const pendiente = JSON.parse(sessionStorage.getItem(`wala:yoryo:login:${main.id}`) || 'null'); if (Array.isArray(pendiente) && pendiente.length === productos.length) return adaptar(pendiente); } catch {}
    }
    const guardado = nuevo ? null : leer(clave);
    if (Array.isArray(guardado) && guardado.length === productos.length) return adaptar(guardado);
    return productos.map((_, i) => {
      const anterior = originales[i]?.datosYoryo;
      const inicial = { ...datosYoryoVacios(), ...(!anterior && productos[i].personalizacionYoryo.tecnica === 'impresion' ? { plantillaVisual: 'dorado', formatoPlantilla: 2 } : {}), ...(anterior || {}) };
      if (anterior && !anterior.distribucion) delete inicial.distribucion;
      return adaptarPlantillaYoryo(inicial, productos[i].personalizacionYoryo);
    });
  });
  const datosRef = useRef(datos);
  datosRef.current = datos;
  const borradorDescartado = useRef(false);
  const [indice, setIndice] = useState(indiceInicial);
  const [modoVista, setModoVista] = useState('producto');
  const [composicion, setComposicion] = useState({ svg: '', elementos: [] });
  const arte = composicion.svg;
  const [seccion, setSeccion] = useState('nombre');
  const [indiceArte, setIndiceArte] = useState(-1);
  const [error, setError] = useState('');
  const [errorArte, setErrorArte] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [recorte, setRecorte] = useState(null);
  const [quitandoFondo, setQuitandoFondo] = useState(null);
  const [enGesto, setEnGesto] = useState(false);
  const [firmaGuardada, setFirmaGuardada] = useState(() => !item && originales.length ? firmaDeDisenoYoryo(originales.map((d) => ({ ...datosYoryoVacios(), ...d.datosYoryo })), {}) : null);
  const [guardadoComoBorrador, setGuardadoComoBorrador] = useState(creacion?.estado === 'borrador' || creacionesCuenta.some((d) => d.estado === 'borrador'));
  const panelRef = useRef(null);
  const inputFotos = useRef(null);
  const inputVector = useRef(null);
  const producto = productos[indice];
  const config = producto.personalizacionYoryo;
  const actual = datos[indice];
  const laser = config.tecnica === 'laser';
  const editable = esDistribucionEditable(actual);
  const seccionActual = seccionesYoryo(actual, config).some((e) => e.id === seccion) ? seccion : 'nombre';
  const completos = productos.map((p, i) => !validarDatosYoryo(datos[i], p.personalizacionYoryo.tecnica));
  const cambiar = (campo, valor) => { setDatos((prev) => prev.map((d, i) => i === indice ? { ...d, [campo]: valor } : d), ['nombre', 'frase', 'fecha', 'titulo', 'dedicatoria', 'acento'].includes(campo) ? `${indice}:${campo}` : ''); setError(''); };
  const cambiarParte = (id, cambio, grupo = '') => { setDatos((prev) => prev.map((d, i) => i === indice ? cambiarSeccion(d, id, cambio) : d), grupo ? `${indice}:${grupo}` : Object.keys(cambio).length === 1 && 'escala' in cambio ? `${indice}:tamano:${id}` : ''); setError(''); };
  const restaurarHistoria = (accion) => {
    const restaurados = historial[accion]();
    const cambiado = restaurados.findIndex((d, i) => JSON.stringify(d) !== JSON.stringify(datos[i]));
    if (cambiado >= 0) setIndice(cambiado);
    setError('');
  };
  const recomendar = () => { cambiar('distribucion', distribucionRecomendada()); setSeccion('nombre'); };
  const elegirEquipo = (equipo) => {
    const vector = vectorLaserDeEquipo(equipo, config);
    setDatos((prev) => prev.map((d, i) => {
      if (i !== indice) return d;
      const plantilla = vector ? 'escudo' : d.plantilla;
      return { ...d, equipo, vector: vector || null, plantilla, ...(plantilla !== d.plantilla && esDistribucionEditable(d) && { distribucion: distribucionRecomendada() }) };
    }));
    setError('');
  };
  useEffect(() => {
    const timer = setTimeout(() => { if (!borradorDescartado.current) try { localStorage.setItem(clave, JSON.stringify(datos)); } catch {} }, 250);
    return () => clearTimeout(timer);
  }, [clave, datos]);
  useEffect(() => {
    const escribir = () => { if (!borradorDescartado.current) try { localStorage.setItem(clave, JSON.stringify(datosRef.current)); } catch {} };
    window.addEventListener('pagehide', escribir);
    return () => { window.removeEventListener('pagehide', escribir); escribir(); };
  }, [clave]);
  useEffect(() => {
    let vigente = true;
    const timer = setTimeout(async () => {
      try {
        const [fuentes, fotos, resueltos, plantilla] = await Promise.all([cargarFuentesYoryo(actual, config), laser ? [] : fotosInlineYoryo(actual), resolverVectorYoryo(actual), laser ? {} : cargarPlantillaYoryo(actual)]);
        const nueva = componerArteYoryo({ datos: { ...resueltos, nombre: actual.nombre || 'Tu nombre' }, config, fuentes, fotos, plantilla });
        if (vigente) { setComposicion(nueva); setIndiceArte(indice); setErrorArte(''); }
      } catch (e) { if (vigente) { setComposicion({ svg: '', elementos: [] }); setErrorArte(e.message); } }
    }, 16);
    return () => { vigente = false; clearTimeout(timer); };
  }, [actual, config, laser, indice]);

  const iniciarSesion = () => {
    // El borrador se recupera después del login sin mezclar cuentas.
    try { sessionStorage.setItem(`wala:yoryo:login:${main.id}`, JSON.stringify(datos)); } catch {}
    navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
  };
  useEffect(() => {
    if (user) try { sessionStorage.removeItem(`wala:yoryo:login:${main.id}`); } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fotos = async (files) => {
    if (!user) { iniciarSesion(); return; }
    setOcupado('fotos'); setError('');
    try {
      const lista = [];
      const cantidad = actual.plantilla === 'collage' ? 3 : 1;
      for (const file of Array.from(files || []).slice(0, cantidad)) {
        const preparada = await prepararImagenCliente(file);
        try { lista.push({ url: await subirImagenCliente(user.uid, preparada.blob) }); }
        finally { URL.revokeObjectURL(preparada.urlLocal); }
      }
      if (lista.length) {
        if (actual.plantillaVisual && actual.plantilla === 'collage' && lista.length === 1) { const posicion = seccion === 'foto2' ? 1 : seccion === 'foto3' ? 2 : 0; const fotos = Array.from({ length: 3 }, (_, i) => actual.fotos[i] || {}); fotos[posicion] = lista[0]; cambiar('fotos', fotos); }
        else cambiar('fotos', lista);
      }
    } catch (e) { setError(e.message); } finally { setOcupado(''); }
  };
  const vector = async (file) => {
    if (!file) return;
    if (!user) { iniciarSesion(); return; }
    setOcupado('vector'); setError('');
    try {
      if (file.size > 1024 * 1024) throw new Error('El SVG debe pesar menos de 1 MB.');
      const limpio = validarVectorSvg(await file.text());
      cambiar('vector', { url: await subirVectorYoryo(user.uid, limpio.svg), viewBox: limpio.viewBox });
    } catch (e) { setError(e.message); } finally { setOcupado(''); }
  };

  const guardar = async (alCarrito) => {
    if (!user) { iniciarSesion(); return; }
    if (item && !items.some((i) => i.id === item.id)) { setError('Este artículo ya no está en el carrito.'); return; }
    if (item && JSON.stringify(items.find((i) => i.id === item.id)?.customization) !== firmaCarritoRef.current) { setError('La personalización cambió en otra ventana. Vuelve al carrito para abrir la versión actual.'); return; }
    const falta = productos.findIndex((p, i) => validarDatosYoryo(datos[i], p.personalizacionYoryo.tecnica));
    if (alCarrito && falta >= 0) { setIndice(falta); setError(validarDatosYoryo(datos[falta], productos[falta].personalizacionYoryo.tecnica)); return; }
    setOcupado('guardando'); setError('');
    try {
      const creaciones = [];
      for (let i = 0; i < productos.length; i++) {
        const p = productos[i];
        const datosGuardar = fijarDistribucion(datos[i], p.personalizacionYoryo);
        const firma = firmaDeDisenoYoryo(datosGuardar, p.personalizacionYoryo.produccion || {});
        const anterior = originalesRef.current[i];
        if (normalizarFirmaYoryo(anterior?.firmaYoryo) === firma && (alCarrito ? anterior?.archivosProduccion?.length && anterior.estado !== 'borrador' : anterior?.estado === 'borrador')) { creaciones.push({ ...anterior, id: anterior.id || anterior.designId }); continue; }
        const nueva = await (alCarrito ? generarYoryo : generarBorradorYoryo)({ uid: user.uid, producto: p, datos: datosGuardar });
        const r = await saveDesign(user.uid, { ...nueva, ...(idsGuardadosRef.current[i] && { designId: idsGuardadosRef.current[i] }), ...(esPack && { combo: { id: main.id, nombre: main.name, pieza: i } }) });
        if (r.error || !r.id) throw new Error(r.error || 'No pudimos guardar el diseño.');
        idsGuardadosRef.current[i] = r.id;
        creaciones.push({ ...nueva, id: r.id });
      }
      let args;
      if (esPack) {
        const combo = { ...main, piezas: productos.map((p) => ({ prendaId: p.id })) };
        const r = await guardarMiCombo(user.uid, { ...(miGuardadoRef.current && { id: miGuardadoRef.current }), combo, piezas: creaciones.map((c) => ({ designId: c.id, talla: '' })), creaciones });
        if (r.error) throw new Error(r.error);
        miGuardadoRef.current = r.id;
        args = itemDeCombo({ combo: main, piezas: productos.map((p, i) => ({ prenda: p, creacion: creaciones[i], talla: '' })), miComboId: r.id });
      } else args = itemDeCreacion({ prenda: main, creacion: creaciones[0], talla: '' });
      if (alCarrito) {
        if (item) {
          if (!actualizarPersonalizacion(item.id, main.id, args[2], firmaCarritoRef.current)) throw new Error('El carrito cambió mientras guardabas. Vuelve a abrir su personalización.');
        } else addToCart(...args);
        if (esPack && !item) olvidarArmado(main.id);
        borradorDescartado.current = true;
        localStorage.removeItem(clave);
        navigate('/carrito');
      } else { originalesRef.current = creaciones; setFirmaGuardada(firmaDeDisenoYoryo(datos, {})); setGuardadoComoBorrador(true); toast.success('Borrador guardado en tu cuenta.'); }
      queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'] });
      queryClient.invalidateQueries({ queryKey: ['mis-borradores-crear'] });
      queryClient.invalidateQueries({ queryKey: ['mis-creaciones-cuenta'] });
    } catch (e) { setError(e.message || 'No pudimos guardar la personalización.'); }
    finally { setOcupado(''); }
  };

  const descargar = () => {
    if (!arte) return;
    const url = URL.createObjectURL(new Blob([arte], { type: 'image/svg+xml' }));
    const a = document.createElement('a'); a.href = url; a.download = `${config.nombre.toLowerCase()}-vista-previa.svg`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const plantillas = laser ? ['Nombre y frase', 'Iniciales', 'Escudo y nombre'] : config.nombre === 'Mousepad' ? ['Foto y texto', 'Equipo'] : ['Foto y texto', 'Equipo', 'Aniversario', 'Collage'];
  const claves = laser ? ['nombre', 'iniciales', 'escudo'] : config.nombre === 'Mousepad' ? ['nombre', 'equipo'] : ['nombre', 'equipo', 'aniversario', 'collage'];
  const subiendo = Boolean(ocupado);
  const bloqueado = subiendo || enGesto;
  const faltanMedidas = productos.some((p) => !medidasConfirmadas(p.personalizacionYoryo.produccion));
  const campoNombre = <Campo etiqueta={laser ? 'Nombre para grabar' : 'Nombre o nombres'} value={actual.nombre} maxLength={60} disabled={bloqueado} onChange={(e) => cambiar('nombre', e.target.value)} placeholder="Ej. Daniel" />;
  const campoEquipo = (laser && actual.plantilla !== 'iniciales' || actual.plantilla === 'equipo') && <Campo etiqueta="Equipo (opcional)" opciones={[{ valor: '', texto: 'Sin equipo' }, ...EQUIPOS.map((v) => ({ valor: v, texto: v }))]} value={actual.equipo} disabled={bloqueado} onChange={(e) => elegirEquipo(e.target.value)} />;
  const campoFrase = <Campo etiqueta={laser ? 'Frase para grabar (opcional)' : 'Dedicatoria (opcional)'} value={actual.frase} maxLength={160} disabled={bloqueado} multilinea onChange={(e) => cambiar('frase', e.target.value)} />;
  const campoFecha = !laser && ['aniversario', 'collage'].includes(actual.plantilla) && <Campo etiqueta="Fecha o años juntos (opcional)" value={actual.fecha} maxLength={40} disabled={bloqueado} onChange={(e) => cambiar('fecha', e.target.value)} placeholder="Ej. 24.10.2021" />;
  const campoVector = laser && actual.plantilla === 'escudo' && <><input ref={inputVector} type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => { vector(e.target.files?.[0]); e.target.value = ''; }} /><Boton variante="contorno" icono={<ImagePlus />} cargando={ocupado === 'vector'} disabled={bloqueado} onClick={() => inputVector.current?.click()}><Texto>{actual.vector ? 'Cambiar escudo SVG' : 'Subir escudo SVG'}</Texto></Boton>{<p className={s.nota}><Texto>{actual.vector?.url && actual.vector.url === vectorLaserDeEquipo(actual.equipo, config)?.url ? `Escudo de ${actual.equipo} listo para grabar. Puedes subir tu propio SVG si prefieres otro diseño.` : 'Para un escudo propio, sube un SVG con sus textos convertidos a trazos.'}</Texto></p>}</>;
  const campoFotos = !laser && <>
    <input ref={inputFotos} type="file" accept="image/*" multiple={actual.plantilla === 'collage'} hidden onChange={(e) => { fotos(e.target.files); e.target.value = ''; }} />
    <Boton variante="contorno" icono={<ImagePlus />} cargando={ocupado === 'fotos'} disabled={bloqueado} onClick={() => inputFotos.current?.click()}><Texto>{actual.plantilla === 'collage' ? 'Elegir fotos' : actual.fotos.some((f) => f?.url) ? 'Cambiar foto o diseño' : 'Subir foto o diseño'}</Texto></Boton>
    {actual.fotos.some((f) => f?.url) && <p className={s.nota}><Texto>{`${actual.fotos.filter((f) => f?.url).length} foto${actual.fotos.filter((f) => f?.url).length === 1 ? '' : 's'} cargada${actual.fotos.filter((f) => f?.url).length === 1 ? '' : 's'}. Puedes recortar o quitar el fondo como en tus prendas.`}</Texto></p>}
    {actual.fotos.map((f, i) => f?.url && <React.Fragment key={`${i}:${f.url}`}>
      <div className={s.accionesSeccion}>
        <Boton variante="contorno" tamano="sm" disabled={bloqueado} onClick={() => setRecorte({ src: f.url, foto: i, pieza: indice })}><Texto>{`Recortar foto ${i + 1}`}</Texto></Boton>
        <Boton variante="contorno" tamano="sm" disabled={bloqueado} onClick={() => setQuitandoFondo({ src: f.url, foto: i, pieza: indice })}><Texto>{`Quitar fondo de foto ${i + 1}`}</Texto></Boton>
      </div>
      <Campo etiqueta={`Encuadre de foto ${i + 1}`} opciones={[{ valor: 'llenar', texto: 'Llenar el espacio' }, { valor: 'completa', texto: 'Ver la imagen completa' }]} value={f.encaje || 'llenar'} disabled={bloqueado} onChange={(e) => cambiar('fotos', actual.fotos.map((foto, k) => k === i ? { ...foto, encaje: e.target.value } : foto))} />
    </React.Fragment>)}
  </>;

  const elegirPlantilla = (visual) => {
    const plantilla = PLANTILLAS_IMPRESION_YORYO.find((p) => p.id === visual);
    setDatos((prev) => prev.map((d, i) => i === indice ? { ...d, plantillaVisual: visual, formatoPlantilla: 2, plantilla: plantilla?.tipo || 'nombre',
      ...(visual === 'floral' && !d.titulo ? { titulo: 'Mi lugar favorito es', acento: 'Contigo.' } : {}),
      ...(visual === 'deportivo' && !d.equipo ? { equipo: 'Alianza Lima' } : {}), distribucion: distribucionRecomendada() } : d));
    setSeccion('nombre'); setError('');
  };
  const precio = Number(main.salePrice) > 0 ? main.salePrice : main.price;
  const hayCambios = firmaGuardada !== firmaDeDisenoYoryo(datos, {});
  return <MarcoEstudio
    nombre={esPack ? main.name : producto.name} color={{ nombre: laser ? 'Grabado láser' : 'Impresión', hex: '#7C3AED' }}
    precio={precio} sesion={Boolean(user)} panelRef={panelRef}
    className={`${estudio.studio} ${s.studioYoryo}`} claseCuerpo={`${estudio.cuerpo} ${s.cuerpoYoryo}`} clasePanel={`${estudio.panel} ${s.panelYoryo}`} clasePanelContenido={estudio.panelContenido}
    urlVolver={item ? '/carrito' : `/producto/${main.id}`} etiquetaVolver={item ? 'Volver al carrito' : 'Volver al producto'}
    avisos={<>
      {guardadoComoBorrador && !hayCambios ? <EstadoEdicion esBorrador nombre={actual.nombre} /> : <Aviso tipo="info" compacto>Tu borrador se conserva en este dispositivo. Usa Guardar borrador para continuarlo desde tu cuenta.</Aviso>}
      {faltanMedidas && isAdmin && <Aviso tipo="info" compacto>Vista previa habilitada. Confirma el área real de producción en la ficha de cada producto antes de habilitar el pago.</Aviso>}
    </>}
    lienzo={<EscenaEstudio className={`${estudio.escena} ${s.escena}`}>
      {esPack && <Pestanas etiqueta="Pieza del pack" opciones={productos.map((p, i) => ({ id: String(i), texto: p.personalizacionYoryo.nombre, cuenta: completos[i] ? '✓' : undefined }))} valor={String(indice)} onChange={(v) => { setIndice(Number(v)); setError(''); }} />}
      <Pestanas etiqueta="Vista del diseño" opciones={[{ id: 'producto', texto: 'En el producto' }, { id: 'plano', texto: 'Diseño plano' }]} valor={modoVista} onChange={setModoVista} />
      <LienzoYoryo key={`${producto.id}:${modoVista}`} {...composicion} producto={producto} datos={actual} svg={indiceArte === indice ? arte : ''} elementos={indiceArte === indice ? composicion.elementos : []}
        modo={modoVista} activa={seccionActual} onActiva={setSeccion} onMover={cambiarParte} onInteractuando={setEnGesto}
        onDeshacer={() => restaurarHistoria('deshacer')} onRehacer={() => restaurarHistoria('rehacer')} puedeDeshacer={historial.puedeDeshacer} puedeRehacer={historial.puedeRehacer}
        onGuardar={() => guardar(false)} disabled={subiendo} onImagen={!laser || actual.plantilla === 'escudo' ? () => { setSeccion(laser ? 'escudo' : 'foto'); requestAnimationFrame(() => (laser ? inputVector : inputFotos).current?.click()); } : undefined} />
      <p className={s.nota}><Texto>{laser ? 'Vista del grabado. El acabado metálico depende del tomatodo.' : 'La vista previa muestra tu diseño; el marco y el borde no se imprimen.'}</Texto></p>
    </EscenaEstudio>}
    panel={<div className={s.campos}>
      <PasoEstudio numero={1} titulo="Elige tu diseño" hecho={Boolean(actual.nombre)}>
        {!laser ? <Campo etiqueta={`Plantilla para el ${config.nombre.toLowerCase()}`} disabled={bloqueado} value={actual.plantillaVisual || ''} opciones={[{ valor: '', texto: 'Diseño libre' }, ...PLANTILLAS_IMPRESION_YORYO.map((p) => ({ valor: p.id, texto: p.nombre }))]} onChange={(e) => elegirPlantilla(e.target.value)} />
          : <ElegirUno etiqueta="Elige una plantilla" opciones={plantillas} valor={plantillas[claves.indexOf(actual.plantilla)] || plantillas[0]} onCambiar={(v) => {
            if (bloqueado) return; const plantilla = claves[plantillas.indexOf(v)] || 'nombre';
            setDatos((prev) => prev.map((d, i) => i === indice ? { ...d, plantilla, ...(!laser ? { plantillaVisual: plantilla === 'equipo' ? 'deportivo' : '' } : {}), ...(esDistribucionEditable(d) && plantilla !== d.plantilla && { distribucion: distribucionRecomendada() }) } : d)); setError(''); setSeccion(laser ? ['escudo', 'iniciales'].includes(plantilla) ? 'escudo' : 'nombre' : 'foto');
          }} />}
        {!laser && campoEquipo}
      </PasoEstudio>
      {editable ? <SeccionesYoryo datos={actual} config={config} elementos={indiceArte === indice ? composicion.elementos : []} activa={seccionActual} onActiva={setSeccion} onCambiar={cambiarParte} onRestablecer={recomendar} disabled={bloqueado}
        contenidos={{ escudo: <>{campoEquipo}{campoVector}</>, nombre: campoNombre, frase: campoFrase, foto: campoFotos, foto2: campoFotos, foto3: campoFotos, fecha: actual.plantilla === 'equipo' ? campoEquipo : campoFecha,
          titulo: <Campo etiqueta="Título" value={actual.titulo || ''} maxLength={100} multilinea disabled={bloqueado} onChange={(e) => cambiar('titulo', e.target.value)} />,
          acento: <Campo etiqueta="Texto destacado" value={actual.acento || ''} maxLength={60} disabled={bloqueado} onChange={(e) => cambiar('acento', e.target.value)} />,
          dedicatoria: <Campo etiqueta="Dedicatoria" value={actual.dedicatoria || ''} maxLength={160} multilinea disabled={bloqueado} onChange={(e) => cambiar('dedicatoria', e.target.value)} /> }} /> : <>
        <Aviso tipo="info" compacto>Este diseño conserva sus proporciones anteriores. Puedes aplicar la distribución recomendada para ajustar cada sección.</Aviso>
        <Boton variante="contorno" onClick={recomendar} disabled={bloqueado}><Texto>Usar distribución recomendada</Texto></Boton>
        {campoNombre}<Campo etiqueta="Estilo de letra" opciones={['Clásica', 'Fuerte', 'Manuscrita'].map((v) => ({ valor: v, texto: v }))} value={actual.tipografia || 'Clásica'} disabled={bloqueado} onChange={(e) => cambiar('tipografia', e.target.value)} />
        {campoEquipo}{campoFrase}{campoFecha}{campoVector}{campoFotos}
      </>}
      {recorte && <Suspense fallback={null}><RecortarFoto abierta forma="libre" src={recorte.src} titulo="Recorta tu foto" onCancelar={() => setRecorte(null)} onListo={async (blob) => {
        if (!blob) { setRecorte(null); return; }
        const url = await subirImagenCliente(user.uid, blob);
        setDatos((prev) => prev.map((d, i) => i === recorte.pieza ? { ...d, fotos: d.fotos.map((f, k) => k === recorte.foto ? { url } : f) } : d));
        setRecorte(null);
      }} /></Suspense>}
      {(error || errorArte) && <Aviso tipo="error" compacto>{error || errorArte}</Aviso>}
      {quitandoFondo && <Suspense fallback={null}><QuitarFondo abierta src={quitandoFondo.src} onCancelar={() => setQuitandoFondo(null)} onAplicar={async (resultado) => {
        if (!resultado?.blob) { setQuitandoFondo(null); return; }
        const { foto, pieza } = quitandoFondo; setOcupado('fotos');
        try { const url = await subirImagenCliente(user.uid, resultado.blob); setDatos((prev) => prev.map((d, i) => i === pieza ? { ...d, fotos: d.fotos.map((f, k) => k === foto ? { url, encaje: 'completa' } : f) } : d)); setQuitandoFondo(null); }
        catch (e) { setError(e.message); } finally { setOcupado(''); }
      }} /></Suspense>}
    </div>}
    compra={<CompraEstudio precio={precio} vacio={false} ocupado={enGesto ? 'moviendo' : ocupado ? ocupado === 'guardando' ? 'guardando' : ocupado : null}
      hayCambios={hayCambios} yaGuardada={firmaGuardada !== null} permitirBorradorVacio etiquetaGuardar="Guardar borrador"
      etiquetaAgregar={!user ? 'Iniciar sesión para guardar' : item ? 'Guardar cambios en el carrito' : esPack ? 'Agregar pack al carrito' : 'Agregar al carrito'}
      onGuardar={() => guardar(false)} onAgregar={() => guardar(true)} onDescargar={descargar} className={estudio.acciones} />}
  />;
}
