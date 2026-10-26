import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ImagePlus, Check, Save, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { getProduct } from '../../services/products';
import { getDesignById, saveDesign } from '../../services/designs';
import { guardarMiCombo } from '../../services/misCombos';
import { prepararImagenCliente, subirImagenCliente, subirVectorYoryo } from '../../services/crearArchivos';
import { itemDeCreacion } from '../../pages/Crear/creacionCarrito';
import { itemDeCombo, leerArmado, olvidarArmado } from '../../pages/Crear/comboCrear';
import { generarYoryo, fotosInlineYoryo, resolverVectorYoryo } from '../../pages/Crear/generarYoryo';
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
import { MarcoEstudio } from '../../componentes/kit/paginas/MarcoEstudio';
import { Texto } from '../../componentes/kit/Traduccion';
import { soles } from '../../componentes/kit/TarjetaProducto';
import s from './PersonalizadorYoryo.module.css';

const RecortarFoto = lazy(() => import('../../componentes/kit/piezas/RecortarFoto').then((m) => ({ default: m.RecortarFoto })));

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
  const idsGuardadosRef = useRef({});
  const miGuardadoRef = useRef('');
  const firmaCarritoRef = useRef(item ? JSON.stringify(item.customization) : '');
  const [datos, setDatos, historial] = useHistorialYoryo(() => {
    if (user && !originales.length) {
      try { const pendiente = JSON.parse(sessionStorage.getItem(`wala:yoryo:login:${main.id}`) || 'null'); if (Array.isArray(pendiente) && pendiente.length === productos.length) return pendiente; } catch {}
    }
    const guardado = nuevo ? null : leer(clave);
    if (Array.isArray(guardado) && guardado.length === productos.length) return guardado;
    return productos.map((_, i) => {
      const anterior = originales[i]?.datosYoryo;
      const inicial = { ...datosYoryoVacios(), ...(anterior || {}) };
      if (anterior && !anterior.distribucion) delete inicial.distribucion;
      return inicial;
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
  const [enGesto, setEnGesto] = useState(false);
  const inputFotos = useRef(null);
  const inputVector = useRef(null);
  const producto = productos[indice];
  const config = producto.personalizacionYoryo;
  const actual = datos[indice];
  const laser = config.tecnica === 'laser';
  const editable = esDistribucionEditable(actual);
  const seccionActual = seccionesYoryo(actual, config).some((e) => e.id === seccion) ? seccion : 'nombre';
  const completos = productos.map((p, i) => !validarDatosYoryo(datos[i], p.personalizacionYoryo.tecnica));
  const cambiar = (campo, valor) => { setDatos((prev) => prev.map((d, i) => i === indice ? { ...d, [campo]: valor } : d), ['nombre', 'frase', 'fecha'].includes(campo) ? `${indice}:${campo}` : ''); setError(''); };
  const cambiarParte = (id, cambio, grupo = '') => { setDatos((prev) => prev.map((d, i) => i === indice ? cambiarSeccion(d, id, cambio) : d), grupo ? `${indice}:${grupo}` : Object.keys(cambio).length === 1 && 'escala' in cambio ? `${indice}:tamano:${id}` : ''); setError(''); };
  const restaurarHistoria = (accion) => {
    const restaurados = historial[accion]();
    const cambiado = restaurados.findIndex((d, i) => JSON.stringify(d) !== JSON.stringify(datos[i]));
    if (cambiado >= 0) setIndice(cambiado);
    setError('');
  };
  const recomendar = () => { cambiar('distribucion', distribucionRecomendada()); setSeccion('nombre'); };
  const elegirEquipo = (equipo) => {
    const vector = laser && config.produccion?.vectoresPorEquipo?.[equipo];
    setDatos((prev) => prev.map((d, i) => {
      if (i !== indice) return d;
      const plantilla = vector ? 'escudo' : d.plantilla === 'escudo' ? 'nombre' : d.plantilla;
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
        const [fuentes, fotos, resueltos] = await Promise.all([cargarFuentesYoryo(actual, config), laser ? [] : fotosInlineYoryo(actual), resolverVectorYoryo(actual)]);
        const nueva = componerArteYoryo({ datos: { ...resueltos, nombre: actual.nombre || 'Tu nombre' }, config, fuentes, fotos });
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
      if (lista.length) cambiar('fotos', lista);
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
        if (normalizarFirmaYoryo(anterior?.firmaYoryo) === firma && (anterior?.archivosProduccion?.length || !alCarrito && anterior.estado === 'borrador')) { creaciones.push({ ...anterior, id: anterior.id || anterior.designId }); continue; }
        const incompleta = validarDatosYoryo(datos[i], p.personalizacionYoryo.tecnica);
        const nueva = incompleta ? { tipo: 'crear', estado: 'borrador', productId: p.id, productName: p.name, name: `${p.personalizacionYoryo.nombre} · En preparación`, datosYoryo: datosGuardar, firmaYoryo: firma, produccionYoryo: { tecnica: p.personalizacionYoryo.tecnica, lista: false }, archivosProduccion: [], archivosImpresion: [], vistasPrevias: [], layersByView: {} } : await generarYoryo({ uid: user.uid, producto: p, datos: datosGuardar });
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
      } else { originalesRef.current = creaciones; toast.success('Avance guardado en tu cuenta.'); }
      queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'] });
      queryClient.invalidateQueries({ queryKey: ['mis-borradores-crear'] });
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
  const campoNombre = <Campo etiqueta={laser ? 'Nombre para grabar' : 'Nombre o nombres'} value={actual.nombre} maxLength={60} disabled={subiendo} onChange={(e) => cambiar('nombre', e.target.value)} placeholder="Ej. Daniel" />;
  const campoEquipo = (laser && actual.plantilla !== 'iniciales' || actual.plantilla === 'equipo') && <Campo etiqueta="Equipo (opcional)" opciones={[{ valor: '', texto: 'Sin equipo' }, ...EQUIPOS.map((v) => ({ valor: v, texto: v }))]} value={actual.equipo} disabled={subiendo} onChange={(e) => elegirEquipo(e.target.value)} />;
  const campoFrase = <Campo etiqueta={laser ? 'Frase para grabar (opcional)' : 'Dedicatoria (opcional)'} value={actual.frase} maxLength={160} disabled={subiendo} multilinea onChange={(e) => cambiar('frase', e.target.value)} />;
  const campoFecha = !laser && ['aniversario', 'collage'].includes(actual.plantilla) && <Campo etiqueta="Fecha o años juntos (opcional)" value={actual.fecha} maxLength={40} disabled={subiendo} onChange={(e) => cambiar('fecha', e.target.value)} placeholder="Ej. 24.10.2021" />;
  const campoVector = laser && actual.plantilla === 'escudo' && <><input ref={inputVector} type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => { vector(e.target.files?.[0]); e.target.value = ''; }} /><Boton variante="contorno" icono={<ImagePlus />} cargando={ocupado === 'vector'} disabled={subiendo} onClick={() => inputVector.current?.click()}><Texto>{actual.vector ? 'Cambiar escudo SVG' : 'Subir escudo SVG'}</Texto></Boton>{!config.produccion?.vectoresPorEquipo?.[actual.equipo] && <p className={s.nota}><Texto>Para un escudo propio, sube un SVG con sus textos convertidos a trazos.</Texto></p>}</>;
  const campoFotos = !laser && <><input ref={inputFotos} type="file" accept="image/*" multiple={actual.plantilla === 'collage'} hidden onChange={(e) => { fotos(e.target.files); e.target.value = ''; }} /><Boton variante="contorno" icono={<ImagePlus />} cargando={ocupado === 'fotos'} disabled={subiendo} onClick={() => inputFotos.current?.click()}><Texto>{actual.plantilla === 'collage' ? 'Elegir tres fotos' : actual.fotos.length ? 'Cambiar foto o diseño' : 'Subir foto o diseño'}</Texto></Boton>{actual.fotos.length > 0 && <p className={s.nota}><Texto>{`${actual.fotos.length} ${actual.fotos.length === 1 ? 'foto cargada' : 'fotos cargadas'}. El encuadre se centra para llenar cada espacio.`}</Texto></p>}{actual.fotos.map((f, i) => <Boton key={`${i}:${f.url}`} variante="fantasma" tamano="sm" disabled={subiendo} onClick={() => setRecorte({ src: f.url, foto: i, pieza: indice })}><Texto>{`Recortar foto ${i + 1}`}</Texto></Boton>)}</>;
  return <MarcoEstudio
    nombre={esPack ? main.name : producto.name}
    color={{ nombre: laser ? 'Grabado láser' : 'Impresión', hex: '#7C3AED' }}
    precio={Number(main.salePrice) > 0 ? main.salePrice : main.price} sesion={Boolean(user)}
    urlVolver={item ? '/carrito' : `/producto/${main.id}`} etiquetaVolver={item ? 'Volver al carrito' : 'Volver al producto'}
    avisos={faltanMedidas && isAdmin ? <Aviso tipo="info" compacto>Vista previa habilitada. Confirma el área real de producción en la ficha de cada producto antes de habilitar el pago.</Aviso> : undefined}
    lienzo={<section className={s.escena} aria-label="Vista previa de la personalización">
      {esPack && <Pestanas etiqueta="Pieza del pack" opciones={productos.map((p, i) => ({ id: String(i), texto: p.personalizacionYoryo.nombre, cuenta: completos[i] ? '✓' : undefined }))} valor={String(indice)} onChange={(v) => { setIndice(Number(v)); setError(''); }} />}
      <Pestanas etiqueta="Vista del diseño" opciones={[{ id: 'producto', texto: 'En el producto' }, { id: 'plano', texto: 'Diseño plano' }]} valor={modoVista} onChange={setModoVista} />
      <LienzoYoryo key={`${producto.id}:${modoVista}`} producto={producto} datos={actual} svg={indiceArte === indice ? arte : ''} elementos={indiceArte === indice ? composicion.elementos : []} fondo={composicion.fondo} modo={modoVista} activa={seccionActual} onActiva={setSeccion} onMover={cambiarParte} onInteractuando={setEnGesto} onDeshacer={() => restaurarHistoria('deshacer')} onRehacer={() => restaurarHistoria('rehacer')} puedeDeshacer={historial.puedeDeshacer} puedeRehacer={historial.puedeRehacer} onGuardar={() => guardar(false)} disabled={subiendo} />
      <p className={s.nota}><Texto>{laser ? 'Vista del grabado. El acabado metálico depende del tomatodo.' : 'La vista previa muestra tu diseño; el marco y el borde no se imprimen.'}</Texto></p>
      {esPack && <div className={s.resumen}>{productos.map((p, i) => <button key={p.id} type="button" className={s.pieza} onClick={() => setIndice(i)} disabled={subiendo}>
        <img src={p.variants?.[0]?.imageUrl || p.mainImage || p.images?.[0]} alt="" /><span><strong>{p.personalizacionYoryo.nombre}</strong><small><Texto>{completos[i] ? 'Listo para guardar' : 'Sin personalizar'}</Texto></small></span>{completos[i] && <Check size={16} />}
      </button>)}</div>}
    </section>}
    panel={<div className={s.campos}>
      <ElegirUno etiqueta="Elige una plantilla" opciones={plantillas} valor={plantillas[claves.indexOf(actual.plantilla)] || plantillas[0]} onCambiar={(v) => { const plantilla = claves[plantillas.indexOf(v)] || 'nombre'; setDatos((prev) => prev.map((d, i) => i === indice ? { ...d, plantilla, ...(esDistribucionEditable(d) && plantilla !== d.plantilla && { distribucion: distribucionRecomendada() }) } : d)); setError(''); setSeccion(laser ? ['escudo', 'iniciales'].includes(plantilla) ? 'escudo' : 'nombre' : 'foto'); }} />
      {editable ? <SeccionesYoryo datos={actual} config={config} elementos={indiceArte === indice ? composicion.elementos : []} activa={seccionActual} onActiva={setSeccion} onCambiar={cambiarParte} onRestablecer={recomendar} disabled={bloqueado} contenidos={{ escudo: <>{campoEquipo}{campoVector}</>, nombre: campoNombre, frase: campoFrase, foto: campoFotos, fecha: actual.plantilla === 'equipo' ? campoEquipo : campoFecha }} /> : <>
        <Aviso tipo="info" compacto>Este diseño conserva sus proporciones anteriores. Puedes aplicar la distribución recomendada para ajustar cada sección.</Aviso>
        <Boton variante="contorno" onClick={recomendar} disabled={subiendo}><Texto>Usar distribución recomendada</Texto></Boton>
        {campoNombre}<Campo etiqueta="Estilo de letra" opciones={['Clásica', 'Fuerte', 'Manuscrita'].map((v) => ({ valor: v, texto: v }))} value={actual.tipografia || 'Clásica'} disabled={subiendo} onChange={(e) => cambiar('tipografia', e.target.value)} />
        {campoEquipo}{campoFrase}{campoFecha}{campoVector}{campoFotos}
      </>}
      {recorte && <Suspense fallback={null}><RecortarFoto abierta forma="libre" src={recorte.src} titulo="Recorta tu foto" onCancelar={() => setRecorte(null)} onListo={async (blob) => {
        if (!blob) { setRecorte(null); return; }
        const url = await subirImagenCliente(user.uid, blob);
        setDatos((prev) => prev.map((d, i) => i === recorte.pieza ? { ...d, fotos: d.fotos.map((f, k) => k === recorte.foto ? { url } : f) } : d));
        setRecorte(null);
      }} /></Suspense>}
      {(error || errorArte) && <Aviso tipo="error" compacto>{error || errorArte}</Aviso>}
    </div>}
    compra={<div className={s.compra}>
      <strong>{esPack ? 'Precio del pack' : 'Total'} · {soles(Number(main.salePrice) > 0 ? main.salePrice : main.price)}</strong>
      <Boton bloque icono={item ? <Save /> : <ShoppingBag />} cargando={ocupado === 'guardando'} disabled={subiendo || enGesto} onClick={() => guardar(true)}><Texto>{!user ? 'Iniciar sesión para guardar' : item ? 'Guardar cambios en el carrito' : esPack ? 'Agregar pack al carrito' : 'Agregar al carrito'}</Texto></Boton>
      {user && <Boton variante="contorno" tamano="sm" disabled={subiendo || enGesto} onClick={() => guardar(false)}><Texto>Guardar avance</Texto></Boton>}
      <Boton variante="fantasma" tamano="sm" icono={<Download />} disabled={!arte || subiendo || enGesto} onClick={descargar}><Texto>Descargar vista previa</Texto></Boton>
    </div>}
  />;
}
