// Entrada de desarrollo: usa la misma ficha que la tienda, sin montar Firebase.
// No forma parte de las entradas de build de la aplicación ni del kit.
import React, { createContext, forwardRef, useContext, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { ProveedorConfirmar, ProveedorToasts, useToast } from './kit/Feedback';
import { ProveedorEnlaces } from './kit/Enlace';
import { MarcoTienda } from './kit/paginas/Paginas';
import { ProductoDemo } from './DemoProducto';
import FICHAS from './demo/producto.json';
import MARCAS from './demo/marcas.json';
import ProductSalesEditor from '../pages/Tienda/admin/ProductSalesEditor';
import { initialDetailComposition } from '../utils/productDetails.mjs';
import { useLocalProductDetails } from './demo/useLocalProductDetails';
import '../styles/variables.css';
import '../theme/tokens.css';
import '../styles/globals.css';
import './producto-preview.css';

const Navegar = createContext(null);
const EnlaceLocal = forwardRef(function EnlaceLocal({ to, onClick, children, state: _state, ...props }, ref) {
  const navegar = useContext(Navegar);
  return <a {...props} ref={ref} href={to} onClick={(e) => { onClick?.(e); if (!e.defaultPrevented) { e.preventDefault(); navegar(to); } }}>{children}</a>;
});

function FormularioLocal({ producto, detalles, onCerrar }) {
  const [form, setForm] = useState(() => ({ ...producto, detailComposition: detalles.composicion || producto.detailComposition || initialDetailComposition() }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form className="preview-producto-formulario" style={{ padding: '1rem' }} onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); try { await detalles.editor.guardar(form.detailComposition); onCerrar(); } catch (err) { setError(err.message); } finally { setBusy(false); } }}>
    <h1>Ficha de venta · {producto.name}</h1><p>Prueba local del editor que se utiliza al crear o editar un producto. Guarda solo en este navegador.</p>
    {error && <p role="alert">{error}</p>}
    <ProductSalesEditor form={form} productId={producto.id} local onSubir={detalles.editor.subir} resolverMedia={detalles.editor.resolverMedia} onBusyChange={setBusy} onChange={detailComposition => setForm(f => ({ ...f, detailComposition }))} />
    <button type="submit" disabled={busy}>Guardar ficha local del formulario</button><button type="button" disabled={busy} onClick={onCerrar}>Volver a la vista previa</button>
  </form>;
}

function VistaLocal() {
  const [id, setId] = useState(() => new URLSearchParams(window.location.search).get('producto') || FICHAS.productos[0].id);
  const [estado, setEstado] = useState('normal');
  const [carrito, setCarrito] = useState([]);
  const [formulario, setFormulario] = useState(false);
  const [tema, setTema] = useState('light');
  const detallesLocales = useLocalProductDetails(id);
  const toast = useToast();
  const elegir = (nuevo) => { setId(nuevo); history.replaceState(null, '', `?producto=${encodeURIComponent(nuevo)}`); window.scrollTo(0, 0); };
  const navegar = (ruta) => {
    const producto = ruta.match(/^\/producto\/([^?]+)/)?.[1];
    if (producto) { elegir(producto); return; }
    toast({ tipo: 'info', titulo: 'Vista local', texto: `En la tienda continúa en ${ruta}. Aquí no se generan pedidos ni pagos.` });
  };
  const cambiarTema = () => { const nuevo = tema === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = nuevo; setTema(nuevo); };
  return (
    <Navegar.Provider value={navegar}><ProveedorEnlaces componente={EnlaceLocal}>
      <div className="preview-producto-controles">
        <span><strong>Vista local</strong> · Datos de ejemplo · Carrito de prueba: <output>{carrito.reduce((n, p) => n + p.cantidad, 0)}</output></span>
        <label>Producto <select aria-label="Producto" value={id} onChange={(e) => elegir(e.target.value)}>{FICHAS.productos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <button type="button" disabled={!detallesLocales.editor} onClick={() => setFormulario(f => !f)}>{formulario ? 'Ver producto' : 'Probar formulario de producto'}</button>
        <label>Estado <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="normal">Disponible</option><option value="agotado">Agotado</option><option value="cargando">Cargando</option><option value="error">Error</option></select></label>
      </div>
      {detallesLocales.error && <p role="alert">{detallesLocales.error}</p>}
      {formulario && detallesLocales.editor ? <FormularioLocal key={id} producto={FICHAS.productos.find(p => p.id === id) || FICHAS.productos[0]} detalles={detallesLocales} onCerrar={() => setFormulario(false)} /> : <MarcoTienda cabecera={{ carrito, tema: tema === 'dark' ? 'noche' : 'claro', onTema: cambiarTema, enlaces: [{ id: 'tienda', texto: 'Tienda', url: '/tienda' }, { id: 'crear', texto: 'Personalizar', url: '/personalizar' }], activo: 'tienda' }} barraInferior={{ activo: 'tienda' }} pie={{}} kapiEnPie={false}>
        <ProductoDemo key={id} ruta={`/producto/${id}`} marcas={MARCAS} detallesLocales={detallesLocales} estados={['sinOpiniones', ...(estado === 'normal' ? [] : [estado])]} carrito={carrito.reduce((n, p) => n + p.cantidad, 0)} onCarrito={(p) => setCarrito((lista) => [...lista, p])} onIrA={navegar} toast={toast} />
      </MarcoTienda>}
    </ProveedorEnlaces></Navegar.Provider>
  );
}

if (import.meta.env.DEV) {
  const root = import.meta.hot?.data.root || createRoot(document.getElementById('root'));
  if (import.meta.hot) import.meta.hot.data.root = root;
  root.render(<React.StrictMode><MotionConfig reducedMotion="user"><ProveedorToasts><ProveedorConfirmar><VistaLocal /></ProveedorConfirmar></ProveedorToasts></MotionConfig></React.StrictMode>);
}
