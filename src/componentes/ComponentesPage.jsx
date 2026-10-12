import React, { useCallback, useState } from 'react';
import {
  ArrowRight, Heart, Mail, Moon, Phone, Plus, Search, ShoppingBag, Sparkles, Sun, Trash2, Wand2, User,
} from 'lucide-react';
import {
  Boton, Etiqueta, Chip, CostoMonedas, GananciaMonedas, SaldoMonedas,
  Campo, SelectorTalla, SelectorColor, Cantidad, Interruptor,
  TarjetaProducto, TarjetaProductoEsqueleto,
  Cabecera, BarraInferior, Pestanas, Logo,
  SeguimientoPedido, ItemCarrito, BarraEnvioGratis, ResumenPedido,
  Aviso, ProveedorToasts, useToast, EstadoVacio, HojaInferior, soles,
} from './kit';
import s from './ComponentesPage.module.css';

const FRENTE = '/prendas/hoodie-frente.webp';
const ESPALDA = '/prendas/hoodie-espalda.webp';

const SECCIONES = [
  ['base', 'Base'],
  ['botones', 'Botones'],
  ['etiquetas', 'Etiquetas'],
  ['formularios', 'Formularios'],
  ['productos', 'Productos'],
  ['navegacion', 'Navegación'],
  ['carrito', 'Carrito'],
  ['pedidos', 'Pedidos'],
  ['avisos', 'Avisos'],
];

const COLORES_PRENDA = [
  { nombre: 'Negro', hex: '#111827' },
  { nombre: 'Blanco', hex: '#f8fafc', claro: true },
  { nombre: 'Lila', hex: '#c4b5fd', claro: true },
  { nombre: 'Verde oliva', hex: '#4d5b3a' },
  { nombre: 'Rojo vino', hex: '#7f1d1d' },
];

function Seccion({ id, titulo, descripcion, mejoras, children }) {
  return (
    <section id={id} className={s.seccion} aria-labelledby={`${id}-t`}>
      <header className={s.seccionCabeza}>
        <h2 id={`${id}-t`}>{titulo}</h2>
        {descripcion && <p>{descripcion}</p>}
        {mejoras && (
          <ul className={s.mejoras} aria-label="Qué mejora">
            {mejoras.map((m) => (
              <li key={m}><Sparkles aria-hidden="true" />{m}</li>
            ))}
          </ul>
        )}
      </header>
      {children}
    </section>
  );
}

function Panel({ titulo, children, className }) {
  return (
    <div className={[s.panel, className].filter(Boolean).join(' ')}>
      {titulo && <p className={s.panelTitulo}>{titulo}</p>}
      {children}
    </div>
  );
}

function Muestra({ nombre, valor, variable, oscuro }) {
  return (
    <div className={s.muestra}>
      <span className={s.muestraColor} style={{ background: variable ? `var(${variable}, ${valor})` : valor, color: oscuro ? '#fff' : '#0f172a' }}>
        Aa
      </span>
      <span className={s.muestraNombre}>{nombre}</span>
      <code>{valor}</code>
    </div>
  );
}

function Contenido({ tema, cambiarTema }) {
  const toast = useToast();
  const [talla, setTalla] = useState('M');
  const [color, setColor] = useState('Negro');
  const [cantidad, setCantidad] = useState(1);
  const [filtros, setFiltros] = useState(['Polos']);
  const [notif, setNotif] = useState(true);
  const [ofertas, setOfertas] = useState(false);
  const [pestana, setPestana] = useState('activos');
  const [hoja, setHoja] = useState(false);
  const [hojaMovil, setHojaMovil] = useState(false);
  const [cargando, setCargando] = useState(false);
  const cerrarHoja = useCallback(() => setHoja(false), []);
  const cerrarHojaMovil = useCallback(() => setHojaMovil(false), []);

  const avisarAgregado = (nombre, imagen = FRENTE) => () =>
    toast({ titulo: 'Agregado al carrito', texto: nombre, imagen, accion: 'Ver' });

  const alternarFiltro = (f) =>
    setFiltros((xs) => (xs.includes(f) ? xs.filter((x) => x !== f) : [...xs, f]));

  const simularCarga = () => {
    setCargando(true);
    window.setTimeout(() => {
      setCargando(false);
      toast({ titulo: 'Agregado al carrito', texto: 'Polera Walá Essentials · M · Negro', imagen: FRENTE, accion: 'Ver' });
    }, 1200);
  };

  return (
    <div className={s.pagina}>
      {/* ── Barra superior de la página ── */}
      <div className={s.barraTop}>
        <div className={s.barraTopDentro}>
          <a href="#base" className={s.marca}>
            <Logo alto={32} />
            <span className={s.marcaTexto}>Componentes</span>
          </a>
          <nav className={s.indice} aria-label="Secciones">
            {SECCIONES.map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}
          </nav>
          <button
            type="button"
            className={s.tema}
            onClick={cambiarTema}
            aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo noche'}
          >
            {tema === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
        </div>
      </div>

      <main className={s.main}>
        <div className={s.hero}>
          <Etiqueta icono={<Sparkles aria-hidden="true" />}>Kit de interfaz · v1</Etiqueta>
          <h1>Componentes de Walá</h1>
          <p>
            Los mismos colores, tipografía y modo noche de la tienda, con estados más claros,
            áreas táctiles de 44&nbsp;px y botones violeta lisos. Todo es interactivo: prueba a
            tocar, escribir y cambiar el tema arriba a la derecha.
          </p>
        </div>

        {/* ── BASE ── */}
        <Seccion
          id="base"
          titulo="Base"
          descripcion="Los tokens que ya usa la app (variables.css y tokens.css). El kit no inventa colores nuevos."
        >
          <div className={s.grid2}>
            <Panel titulo="Violeta de marca">
              <div className={s.muestras}>
                <Muestra nombre="Violeta 100" valor="#EDE9FE" variable="--violet-100" />
                <Muestra nombre="Violeta 300" valor="#C4B5FD" variable="--violet-300" />
                <Muestra nombre="Violeta 500" valor="#8B5CF6" variable="--violet-500" oscuro />
                <Muestra nombre="Violeta 700" valor="#6D28D9" variable="--violet-700" oscuro />
                <Muestra nombre="Violeta 900" valor="#4C1D95" variable="--violet-900" oscuro />
              </div>
            </Panel>
            <Panel titulo="Estados y fidelización">
              <div className={s.muestras}>
                <Muestra nombre="Éxito" valor="#10B981" variable="--verde-exito" oscuro />
                <Muestra nombre="Aviso" valor="#F59E0B" variable="--warning" />
                <Muestra nombre="Error" valor="#EF4444" variable="--danger" oscuro />
                <Muestra nombre="Oro" valor="#D97706" variable="--gold-600" oscuro />
                <Muestra nombre="Texto" valor="#0F172A" oscuro />
              </div>
            </Panel>
          </div>
          <Panel titulo="Tipografía · Poppins">
            <div className={s.tipos}>
              <p className={s.t1}>Regalos que hablan por ti</p>
              <p className={s.t2}>Diseña tu polera en 2 minutos</p>
              <p className={s.t3}>Título de sección</p>
              <p className={s.t4}>Texto de cuerpo para descripciones de producto, ayudas y mensajes. Se lee cómodo en móvil.</p>
              <p className={s.t5}>TEXTO PEQUEÑO · CATEGORÍAS · ETIQUETAS</p>
            </div>
          </Panel>
        </Seccion>

        {/* ── BOTONES ── */}
        <Seccion
          id="botones"
          titulo="Botones"
          descripcion="Una acción principal por pantalla; el resto en secundario, contorno o fantasma."
          mejoras={['Violeta liso en lugar del degradado', 'Estado de carga que no cambia el ancho', 'Anillo de foco visible para teclado']}
        >
          <Panel titulo="Variantes">
            <div className={s.fila}>
              <Boton icono={<ShoppingBag aria-hidden="true" />}>Agregar al carrito</Boton>
              <Boton variante="secundario" icono={<Wand2 aria-hidden="true" />}>Personalizar</Boton>
              <Boton variante="contorno">Ver detalles</Boton>
              <Boton variante="fantasma" iconoFin={<ArrowRight aria-hidden="true" />}>Ver todo</Boton>
              <Boton variante="peligro" icono={<Trash2 aria-hidden="true" />}>Eliminar</Boton>
            </div>
          </Panel>
          <div className={s.grid2}>
            <Panel titulo="Tamaños">
              <div className={s.fila}>
                <Boton tamano="sm">Pequeño</Boton>
                <Boton>Mediano</Boton>
                <Boton tamano="lg">Grande</Boton>
              </div>
            </Panel>
            <Panel titulo="Estados">
              <div className={s.fila}>
                <Boton cargando={cargando} onClick={simularCarga}>{cargando ? 'Agregando…' : 'Pruébame'}</Boton>
                <Boton disabled>Sin stock</Boton>
                <Boton soloIcono variante="contorno" aria-label="Me gusta"><Heart aria-hidden="true" /></Boton>
                <Boton soloIcono variante="secundario" aria-label="Agregar"><Plus aria-hidden="true" /></Boton>
              </div>
            </Panel>
          </div>
          <Panel titulo="Ancho completo (móvil, checkout)" className={s.angosto}>
            <Boton tamano="lg" bloque>Pagar {soles(129.8)}</Boton>
          </Panel>
        </Seccion>

        {/* ── ETIQUETAS ── */}
        <Seccion
          id="etiquetas"
          titulo="Etiquetas, chips y monedas"
          mejoras={['Lo que cuesta dice "CUESTA"; lo que ganas lleva + en verde', 'Chips de filtro con check y aria-pressed']}
        >
          <div className={s.grid2}>
            <Panel titulo="Etiquetas">
              <div className={s.fila}>
                <Etiqueta tono="peligro" solida>-30%</Etiqueta>
                <Etiqueta solida>Nuevo</Etiqueta>
                <Etiqueta>Personalizable</Etiqueta>
                <Etiqueta tono="oscuro">Combo</Etiqueta>
                <Etiqueta tono="exito">Envío gratis</Etiqueta>
                <Etiqueta tono="aviso">Últimas 3</Etiqueta>
                <Etiqueta tono="neutro">Agotado</Etiqueta>
              </div>
            </Panel>
            <Panel titulo="Monedas">
              <div className={s.fila}>
                <SaldoMonedas saldo={1250} />
                <CostoMonedas monto={300} />
                <GananciaMonedas monto={45} />
              </div>
            </Panel>
          </div>
          <Panel titulo="Chips de filtro">
            <div className={s.fila}>
              {['Polos', 'Poleras', 'Tazas', 'Gorras', 'Para parejas', 'Cumpleaños'].map((f) => (
                <Chip key={f} activo={filtros.includes(f)} onClick={() => alternarFiltro(f)}>{f}</Chip>
              ))}
            </div>
          </Panel>
        </Seccion>

        {/* ── FORMULARIOS ── */}
        <Seccion
          id="formularios"
          titulo="Formularios y selección"
          mejoras={['Errores con icono y texto, no solo borde rojo', 'Tallas agotadas tachadas y no seleccionables', 'Inputs a 16 px: iOS no hace zoom']}
        >
          <div className={s.grid2}>
            <Panel titulo="Campos">
              <div className={s.columna}>
                <Campo etiqueta="Nombre completo" placeholder="Ej. María Pérez" icono={<User />} />
                <Campo etiqueta="Correo" type="email" defaultValue="maria@correo" icono={<Mail />} error="Falta el dominio, por ejemplo @gmail.com" />
                <Campo etiqueta="Celular" type="tel" placeholder="999 999 999" icono={<Phone />} ayuda="Te escribimos por WhatsApp cuando salga tu pedido." />
                <Campo etiqueta="Texto para tu taza" placeholder="Feliz día, mamá" sufijo="0/24" />
              </div>
            </Panel>
            <Panel titulo="Variantes de producto">
              <div className={s.columna}>
                <SelectorTalla tallas={['XS', 'S', 'M', 'L', 'XL', 'XXL']} agotadas={['XS', 'XXL']} valor={talla} onChange={setTalla} guia={() => {}} />
                <SelectorColor colores={COLORES_PRENDA} valor={color} onChange={setColor} />
                <div className={s.filaEntre}>
                  <span className={s.etq}>Cantidad</span>
                  <Cantidad valor={cantidad} onChange={setCantidad} max={10} />
                </div>
                <div className={s.separador} />
                <Interruptor etiqueta="Avisos de mi pedido" descripcion="Push y WhatsApp" activo={notif} onChange={setNotif} />
                <Interruptor etiqueta="Ofertas y cupones" activo={ofertas} onChange={setOfertas} />
              </div>
            </Panel>
          </div>
        </Seccion>

        {/* ── PRODUCTOS ── */}
        <Seccion
          id="productos"
          titulo="Tarjeta de producto"
          descripcion="Pasa el ratón para ver la espalda y el botón Agregar. En el celular el botón se ve siempre."
          mejoras={['Deseos y agregar sin entrar al producto', 'Precio de oferta en rojo con el anterior tachado', 'Puntuación y colores disponibles', 'Esqueleto con la misma forma']}
        >
          <div className={s.gridProductos}>
            <TarjetaProducto
              imagen={FRENTE} imagenHover={ESPALDA}
              categoria="Poleras" nombre="Polera Walá Essentials con capucha"
              precio={89.9} precioAntes={129.9} puntuacion={4.8} resenas={124} vendidos="1,2 mil"
              colores={['#111827', '#f8fafc', '#c4b5fd', '#4d5b3a', '#7f1d1d', '#1e3a8a']}
              onAgregar={avisarAgregado('Polera Walá Essentials con capucha')}
            />
            <TarjetaProducto
              imagen={ESPALDA} imagenHover={FRENTE}
              categoria="Personalizable" nombre="Polera con tu diseño en la espalda"
              precio={99.9} puntuacion={4.9} resenas={58} personalizable
              colores={['#111827', '#f8fafc', '#c4b5fd']}
              onAgregar={avisarAgregado('Polera con tu diseño en la espalda', ESPALDA)}
            />
            <TarjetaProducto
              imagen={FRENTE}
              categoria="Parejas" nombre="Combo polera x2 · Él y Ella"
              precio={169.9} nuevo puntuacion={5} resenas={12}
              colores={['#111827', '#7f1d1d']}
              onAgregar={avisarAgregado('Combo polera x2 · Él y Ella')}
            />
            <TarjetaProducto
              imagen={ESPALDA}
              categoria="Poleras" nombre="Polera oversize edición limitada"
              precio={119.9} agotado puntuacion={4.7} resenas={33}
            />
            <TarjetaProductoEsqueleto />
          </div>
        </Seccion>

        {/* ── NAVEGACIÓN ── */}
        <Seccion
          id="navegacion"
          titulo="Navegación"
          mejoras={['Buscador visible en la cabecera', 'Monedas y carrito con contador a la vista', 'Barra inferior con píldora en el activo y "Crear" destacado']}
        >
          <Panel titulo="Cabecera de escritorio" className={s.panelFondo}>
            <Cabecera enCarrito={3} monedas={1250} notificaciones={2} />
          </Panel>
          <div className={s.gridNav}>
            <Panel titulo="Pestañas (Mis pedidos)">
              <Pestanas
                etiqueta="Filtrar pedidos"
                valor={pestana}
                onChange={setPestana}
                opciones={[
                  { id: 'activos', texto: 'Activos', cuenta: 2 },
                  { id: 'pago', texto: 'Por pagar', cuenta: 1 },
                  { id: 'entregados', texto: 'Entregados' },
                ]}
              />
              <p className={s.nota}>Seleccionado: <strong>{pestana}</strong></p>
              <div className={s.separador} />
              <p className={s.panelTitulo}>Hoja inferior / modal</p>
              <p className={s.nota}>En móvil sube desde abajo; en escritorio es un modal centrado. Se cierra con Esc o tocando fuera.</p>
              <div className={s.fila}>
                <Boton variante="secundario" onClick={() => setHoja(true)}>Abrir modal</Boton>
                <Boton variante="contorno" onClick={() => setHojaMovil(true)}>Abrir en el teléfono</Boton>
              </div>
            </Panel>
            <div className={s.telefono}>
              <div className={s.telefonoPantalla}>
                <div className={s.telefonoTop}>
                  <Logo alto={28} />
                  <Search aria-hidden="true" />
                </div>
                <div className={s.telefonoContenido}>
                  <BarraEnvioGratis actual={89.9} meta={150} />
                  <div className={s.telefonoGrid}>
                    <TarjetaProducto imagen={FRENTE} nombre="Polera Essentials" precio={89.9} precioAntes={129.9} />
                    <TarjetaProducto imagen={ESPALDA} nombre="Con tu diseño" precio={99.9} personalizable />
                  </div>
                </div>
                <BarraInferior carrito={3} />
                <HojaInferior
                  contenida
                  abierta={hojaMovil}
                  onCerrar={cerrarHojaMovil}
                  titulo="Elige tu talla"
                  pie={<Boton bloque onClick={cerrarHojaMovil}>Agregar · {soles(89.9)}</Boton>}
                >
                  <SelectorTalla tallas={['S', 'M', 'L', 'XL']} agotadas={['XL']} valor={talla} onChange={setTalla} />
                </HojaInferior>
              </div>
            </div>
          </div>
        </Seccion>

        {/* ── CARRITO ── */}
        <Seccion
          id="carrito"
          titulo="Carrito y resumen"
          mejoras={['Progreso hacia el envío gratis', 'Cupón en línea y monedas que ganas', 'Total grande y un solo botón para pagar']}
        >
          <div className={s.gridCarrito}>
            <Panel>
              <BarraEnvioGratis actual={129.8} meta={150} />
              <div>
                <ItemCarrito imagen={FRENTE} nombre="Polera Walá Essentials con capucha" variante="Negro · M" precio={89.9} precioAntes={129.9} />
                <ItemCarrito imagen={ESPALDA} nombre="Polera con tu diseño en la espalda" variante="Lila · L" precio={39.9} personalizado />
              </div>
              <BarraEnvioGratis actual={160} meta={150} />
            </Panel>
            <ResumenPedido subtotal={169.8} descuento={40} envio={0} monedas={130} />
          </div>
        </Seccion>

        {/* ── PEDIDOS ── */}
        <Seccion
          id="pedidos"
          titulo="Mis pedidos"
          descripcion="Una sola tarjeta con resumen, seguimiento y la acción que toca."
          mejoras={['Si falta pagar, el pago manda y el paso se ve en ámbar', 'Número de pedido copiable', 'Productos plegables para no alargar la lista']}
        >
          <div className={s.gridPedidos}>
            <SeguimientoPedido
              codigo="WL-20481" fecha="10 oct" paso={1} total={129.8} pagoPendiente
              items={[
                { imagen: FRENTE, nombre: 'Polera Essentials', variante: 'Negro · M', cantidad: 1, precio: 89.9 },
                { imagen: ESPALDA, nombre: 'Polera con tu diseño', variante: 'Lila · L', cantidad: 1, precio: 39.9 },
              ]}
            />
            <SeguimientoPedido
              codigo="WL-20377" fecha="7 oct" paso={3} total={169.9} entregaEstimada="mañana, 14 oct"
              items={[
                { imagen: FRENTE, nombre: 'Combo Él y Ella', variante: 'Negro / Rojo vino', cantidad: 1, precio: 169.9 },
              ]}
            />
            <SeguimientoPedido
              codigo="WL-19902" fecha="28 sep" paso={4} total={359.6}
              items={[
                { imagen: ESPALDA, nombre: 'Polera oversize', variante: 'Negro · L', cantidad: 2, precio: 99.9 },
                { imagen: FRENTE, nombre: 'Polera Essentials', variante: 'Blanco · S', cantidad: 1, precio: 59.9 },
                { imagen: ESPALDA, nombre: 'Polera con tu diseño', variante: 'Lila · M', cantidad: 1, precio: 99.9 },
                { imagen: FRENTE, nombre: 'Regalo sorpresa', variante: 'Única', cantidad: 1, precio: 0 },
              ]}
            />
          </div>
        </Seccion>

        {/* ── AVISOS ── */}
        <Seccion
          id="avisos"
          titulo="Avisos y estados"
          mejoras={['Toasts abajo al centro, con foto y acción', 'Estados vacíos con Kapi y una salida clara']}
        >
          <div className={s.grid2}>
            <Panel titulo="Avisos en página">
              <div className={s.columna}>
                <Aviso tipo="exito" titulo="¡Pago recibido!">Tu pedido #WL-20377 ya pasó a producción.</Aviso>
                <Aviso tipo="info" titulo="Tu diseño se guardó">Puedes seguir editándolo desde Mis creaciones.</Aviso>
                <Aviso tipo="aviso" titulo="Quedan 3 en tu talla" onCerrar={() => {}} />
                <Aviso tipo="error" titulo="No pudimos procesar la tarjeta" accion={<Boton tamano="sm" variante="contorno">Probar con Yape</Boton>}>
                  El banco la rechazó. No se te cobró nada.
                </Aviso>
              </div>
            </Panel>
            <Panel titulo="Toasts">
              <div className={s.columna}>
                <p className={s.nota}>Aparecen abajo al centro y se van solos a los 3,5 s.</p>
                <div className={s.fila}>
                  <Boton variante="secundario" onClick={() => toast({ titulo: 'Agregado al carrito', texto: 'Polera Essentials · M', imagen: FRENTE, accion: 'Ver' })}>Producto</Boton>
                  <Boton variante="secundario" onClick={() => toast({ tipo: 'exito', titulo: 'Cupón aplicado', texto: 'Ahorras S/ 15.00' })}>Éxito</Boton>
                  <Boton variante="secundario" onClick={() => toast({ tipo: 'info', titulo: 'Guardado en deseos' })}>Info</Boton>
                  <Boton variante="secundario" onClick={() => toast({ tipo: 'error', titulo: 'Sin conexión', texto: 'Revisa tu internet' })}>Error</Boton>
                </div>
              </div>
            </Panel>
          </div>
          <div className={s.grid2}>
            <Panel>
              <EstadoVacio titulo="Tu carrito está vacío" texto="Guarda lo que te guste y vuelve cuando quieras.">
                <Boton>Ir a la tienda</Boton>
              </EstadoVacio>
            </Panel>
            <Panel>
              <EstadoVacio imagen="/assets/kapi/kapi-happy.webp" titulo="Aún no tienes pedidos" texto="Diseña algo único: Kapi te ayuda paso a paso.">
                <Boton variante="secundario" icono={<Wand2 aria-hidden="true" />}>Crear mi diseño</Boton>
              </EstadoVacio>
            </Panel>
          </div>
        </Seccion>

        <footer className={s.pie}>
          Página local de componentes · <code>src/componentes/kit</code>
        </footer>
      </main>

      <HojaInferior
        abierta={hoja}
        onCerrar={cerrarHoja}
        titulo="Personaliza tu polera"
        pie={(
          <>
            <Boton variante="contorno" onClick={cerrarHoja}>Cancelar</Boton>
            <Boton bloque onClick={() => { cerrarHoja(); toast({ titulo: 'Agregado al carrito', texto: `Polera · ${talla} · ${color}`, imagen: FRENTE }); }}>
              Agregar · {soles(89.9 * cantidad)}
            </Boton>
          </>
        )}
      >
        <div className={s.columna}>
          <SelectorColor colores={COLORES_PRENDA} valor={color} onChange={setColor} />
          <SelectorTalla tallas={['XS', 'S', 'M', 'L', 'XL', 'XXL']} agotadas={['XS', 'XXL']} valor={talla} onChange={setTalla} />
          <div className={s.filaEntre}>
            <span className={s.etq}>Cantidad</span>
            <Cantidad valor={cantidad} onChange={setCantidad} max={10} />
          </div>
        </div>
      </HojaInferior>
    </div>
  );
}

export default function ComponentesPage() {
  const [tema, setTema] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');

  const cambiarTema = () => {
    const nuevo = tema === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nuevo);
    try { localStorage.setItem('wala-componentes-tema', nuevo); } catch (e) { /* sin storage: solo esta visita */ }
    setTema(nuevo);
  };

  return (
    <ProveedorToasts>
      <Contenido tema={tema} cambiarTema={cambiarTema} />
    </ProveedorToasts>
  );
}
