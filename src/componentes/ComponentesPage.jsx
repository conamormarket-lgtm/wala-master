import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useScroll, useSpring } from 'framer-motion';
import {
  ArrowRight, CheckCircle2, Heart, Mail, Moon, Phone, Plus, RotateCcw, Search, ShoppingBag, Sparkles, Sun, Trash2, Wand2, User,
} from 'lucide-react';
import {
  Boton, Etiqueta, Chip, CostoMonedas, GananciaMonedas, SaldoMonedas,
  Campo, SelectorTalla, SelectorColor, Cantidad, Interruptor,
  TarjetaProducto, TarjetaProductoEsqueleto,
  Cabecera, BarraInferior, Pestanas, Logo,
  SeguimientoPedido, ItemCarrito, BarraEnvioGratis, ResumenPedido,
  Aviso, ProveedorToasts, useToast, EstadoVacio, HojaInferior, soles,
  EASE, RESORTE, Revelar, seguirPuntero,
} from './kit';
import s from './ComponentesPage.module.css';

const FRENTE = '/prendas/hoodie-frente.webp';
const ESPALDA = '/prendas/hoodie-espalda.webp';
const MONEDA = '/assets/monedas/moneda-160.webp';
const META_ENVIO = 150;

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

const CARRITO_INICIAL = [
  { id: 'essentials', imagen: FRENTE, nombre: 'Polera Walá Essentials con capucha', variante: 'Negro · M', precio: 89.9, precioAntes: 129.9, cantidad: 1 },
  { id: 'diseno', imagen: ESPALDA, nombre: 'Polera con tu diseño en la espalda', variante: 'Lila · L', precio: 39.9, cantidad: 1, personalizado: true },
];

/* ── Piezas de la página ───────────────────────────────── */

function Seccion({ id, numero, titulo, descripcion, mejoras, children }) {
  return (
    <section id={id} className={s.seccion} aria-labelledby={`${id}-t`}>
      <Revelar as="header" className={s.seccionCabeza}>
        <span className={s.numero}>{numero}</span>
        <h2 id={`${id}-t`}>{titulo}</h2>
        {descripcion && <p>{descripcion}</p>}
        {mejoras && (
          <ul className={s.mejoras} aria-label="Qué mejora">
            {mejoras.map((m, i) => (
              <motion.li
                key={m}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: EASE }}
              >
                <Sparkles aria-hidden="true" />{m}
              </motion.li>
            ))}
          </ul>
        )}
      </Revelar>
      {children}
    </section>
  );
}

/** Panel de cristal: aparece al hacer scroll y una luz sigue al ratón. */
function Panel({ titulo, children, className, retraso = 0 }) {
  return (
    <Revelar
      retraso={retraso}
      className={[s.panel, className].filter(Boolean).join(' ')}
      onPointerMove={seguirPuntero}
    >
      {titulo && <p className={s.panelTitulo}>{titulo}</p>}
      {children}
    </Revelar>
  );
}

function Muestra({ nombre, valor, variable, oscuro }) {
  return (
    <div className={s.muestra}>
      <span
        className={s.muestraColor}
        style={{ background: variable ? `var(${variable}, ${valor})` : valor, color: oscuro ? '#fff' : '#0f172a' }}
      >
        Aa
      </span>
      <span className={s.muestraNombre}>{nombre}</span>
      <code>{valor}</code>
    </div>
  );
}

/** Índice fijo: píldora que se desliza a la sección visible + barra de progreso. */
function BarraSuperior({ tema, cambiarTema }) {
  const [activa, setActiva] = useState('base');
  const navRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const progreso = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => entradas.forEach((e) => { if (e.isIntersecting) setActiva(e.target.id); }),
      { rootMargin: '-40% 0px -55% 0px' },
    );
    SECCIONES.forEach(([id]) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  // En móvil el índice se desplaza solo para que el activo quede a la vista.
  useEffect(() => {
    const nav = navRef.current;
    const a = nav?.querySelector(`[data-id="${activa}"]`);
    if (!nav || !a || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
  }, [activa]);

  return (
    <div className={s.barraTop}>
      <div className={s.barraTopDentro}>
        <a href="#inicio" className={s.marca}>
          <Logo alto={32} />
          <span className={s.marcaTexto}>Componentes</span>
        </a>
        <nav ref={navRef} className={s.indice} aria-label="Secciones">
          {SECCIONES.map(([id, t]) => (
            <a key={id} href={`#${id}`} data-id={id} className={activa === id ? s.indiceActivo : undefined}>
              {activa === id && <motion.span layoutId="indice-activo" className={s.indicePildora} transition={RESORTE} />}
              <span>{t}</span>
            </a>
          ))}
        </nav>
        <button
          type="button"
          className={s.tema}
          onClick={cambiarTema}
          aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo noche'}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={tema}
              initial={{ rotate: -90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              style={{ display: 'inline-flex' }}
            >
              {tema === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      <motion.div className={s.progreso} style={{ scaleX: progreso }} />
    </div>
  );
}

/** Portada: texto a la izquierda y una escena flotante a la derecha. */
function Portada({ tema, cambiarTema, avisarAgregado }) {
  const aparecer = (i) => ({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: EASE, delay: 0.1 + i * 0.1 },
  });
  return (
    <section id="inicio" className={s.hero}>
      <div className={s.heroTexto}>
        <motion.div {...aparecer(0)}>
          <Etiqueta icono={<Sparkles aria-hidden="true" />}>Kit de interfaz · v2</Etiqueta>
        </motion.div>
        <motion.h1 {...aparecer(1)}>
          Componentes que <span className={s.degradado}>brillan</span> en Walá
        </motion.h1>
        <motion.p {...aparecer(2)}>
          Los colores, la tipografía y el modo noche de la tienda, ahora con luz, profundidad y
          movimiento. Pasa el ratón, toca y arrastra: todo responde, también en el celular.
        </motion.p>
        <motion.div className={s.heroAcciones} {...aparecer(3)}>
          <Boton tamano="lg" brillo iconoFin={<ArrowRight aria-hidden="true" />} onClick={() => document.getElementById('productos')?.scrollIntoView()}>
            Ver componentes
          </Boton>
          <Boton tamano="lg" variante="contorno" icono={tema === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />} onClick={cambiarTema}>
            {tema === 'dark' ? 'Modo claro' : 'Modo noche'}
          </Boton>
        </motion.div>
        <motion.ul className={s.datosHero} {...aparecer(4)}>
          <li><strong>30+</strong> componentes</li>
          <li><strong>2</strong> temas</li>
          <li><strong>100%</strong> táctil</li>
        </motion.ul>
      </div>

      <motion.div
        className={s.escena}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: EASE, delay: 0.2 }}
      >
        <span className={s.orbe} aria-hidden="true" />
        <span className={s.anillo} aria-hidden="true" />
        <div className={s.escenaTarjeta}>
          <TarjetaProducto
            imagen={FRENTE} imagenHover={ESPALDA}
            categoria="Más vendido" nombre="Polera Walá Essentials con capucha"
            precio={89.9} precioAntes={129.9} puntuacion={4.8} resenas={124}
            colores={['#111827', '#f8fafc', '#c4b5fd', '#4d5b3a']}
            onAgregar={avisarAgregado('Polera Walá Essentials con capucha')}
          />
        </div>
        <img src={MONEDA} alt="" className={`${s.moneda} ${s.moneda1}`} aria-hidden="true" />
        <img src={MONEDA} alt="" className={`${s.moneda} ${s.moneda2}`} aria-hidden="true" />
        <div className={s.flotaSaldo} aria-hidden="true"><GananciaMonedas monto={90} /></div>
        <div className={s.flotaToast} aria-hidden="true">
          <CheckCircle2 />
          <span><strong>¡Pedido en camino!</strong><small>Llega mañana</small></span>
        </div>
        <img src="/assets/kapi/kapi-happy.webp" alt="" className={s.kapi} aria-hidden="true" />
        <Sparkles className={`${s.chispa} ${s.chispa1}`} aria-hidden="true" />
        <Sparkles className={`${s.chispa} ${s.chispa2}`} aria-hidden="true" />
        <Sparkles className={`${s.chispa} ${s.chispa3}`} aria-hidden="true" />
      </motion.div>
    </section>
  );
}

/* ── Contenido ─────────────────────────────────────────── */

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
  const [carrito, setCarrito] = useState(CARRITO_INICIAL);
  const [saldo, setSaldo] = useState(1250);
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

  const cuentas = useMemo(() => {
    const bruto = carrito.reduce((a, it) => a + (it.precioAntes ?? it.precio) * it.cantidad, 0);
    const neto = carrito.reduce((a, it) => a + it.precio * it.cantidad, 0);
    return { bruto, neto, descuento: bruto - neto, envio: neto >= META_ENVIO || neto === 0 ? 0 : 12 };
  }, [carrito]);
  const enCarrito = carrito.reduce((a, it) => a + it.cantidad, 0);

  const cambiarCantidad = (id) => (n) => setCarrito((c) => c.map((it) => (it.id === id ? { ...it, cantidad: n } : it)));
  const quitar = (id) => () => setCarrito((c) => c.filter((it) => it.id !== id));

  return (
    <div className={s.pagina}>
      <div className={s.aurora} aria-hidden="true">
        <span className={s.b1} />
        <span className={s.b2} />
        <span className={s.b3} />
      </div>

      <BarraSuperior tema={tema} cambiarTema={cambiarTema} />

      <main className={s.main}>
        <Portada tema={tema} cambiarTema={cambiarTema} avisarAgregado={avisarAgregado} />

        {/* ── BASE ── */}
        <Seccion
          id="base" numero="01" titulo="Base"
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
            <Panel titulo="Estados y fidelización" retraso={0.08}>
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
              <p className={s.t1}>Regalos que <span className={s.degradado}>hablan</span> por ti</p>
              <p className={s.t2}>Diseña tu polera en 2 minutos</p>
              <p className={s.t3}>Título de sección</p>
              <p className={s.t4}>Texto de cuerpo para descripciones de producto, ayudas y mensajes. Se lee cómodo en móvil.</p>
              <p className={s.t5}>TEXTO PEQUEÑO · CATEGORÍAS · ETIQUETAS</p>
            </div>
          </Panel>
        </Seccion>

        {/* ── BOTONES ── */}
        <Seccion
          id="botones" numero="02" titulo="Botones"
          descripcion="Pasa el ratón para ver el destello y el halo; tócalos para ver la onda (también en el celular)."
          mejoras={['Destello que cruza al pasar el ratón', 'Onda desde donde tocas', 'Halo violeta al levantarse', 'Brillo automático para CTAs']}
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
            <Panel titulo="Estados" retraso={0.08}>
              <div className={s.fila}>
                <Boton cargando={cargando} onClick={simularCarga}>{cargando ? 'Agregando…' : 'Pruébame'}</Boton>
                <Boton disabled>Sin stock</Boton>
                <Boton soloIcono variante="contorno" aria-label="Me gusta"><Heart aria-hidden="true" /></Boton>
                <Boton soloIcono variante="secundario" aria-label="Agregar"><Plus aria-hidden="true" /></Boton>
              </div>
            </Panel>
          </div>
          <Panel titulo="CTA con brillo automático (checkout, pagar)" className={s.angosto}>
            <Boton tamano="lg" bloque brillo>Pagar {soles(129.8)}</Boton>
          </Panel>
        </Seccion>

        {/* ── ETIQUETAS ── */}
        <Seccion
          id="etiquetas" numero="03" titulo="Etiquetas, chips y monedas"
          mejoras={['Ofertas con destello periódico', 'Lo que cuesta dice "CUESTA"; lo que ganas lleva +', 'La moneda gira y el saldo corre']}
        >
          <div className={s.grid2}>
            <Panel titulo="Etiquetas">
              <div className={s.fila}>
                <Etiqueta tono="peligro" solida>-30%</Etiqueta>
                <Etiqueta solida>Nuevo</Etiqueta>
                <Etiqueta tono="exito" solida>Envío gratis</Etiqueta>
                <Etiqueta>Personalizable</Etiqueta>
                <Etiqueta tono="oscuro">Combo</Etiqueta>
                <Etiqueta tono="aviso">Últimas 3</Etiqueta>
                <Etiqueta tono="neutro">Agotado</Etiqueta>
              </div>
            </Panel>
            <Panel titulo="Monedas" retraso={0.08}>
              <div className={s.fila}>
                <SaldoMonedas saldo={saldo} onClick={() => setSaldo((v) => v + 45)} />
                <CostoMonedas monto={300} />
                <GananciaMonedas monto={45} />
              </div>
              <p className={s.nota}>Toca el saldo: suma 45 y el número corre.</p>
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
          id="formularios" numero="04" titulo="Formularios y selección"
          mejoras={['Línea de luz al enfocar', 'La talla elegida se desliza', 'La cantidad rueda', 'El error entra con una sacudida']}
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
            <Panel titulo="Variantes de producto" retraso={0.08}>
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
          id="productos" numero="05" titulo="Tarjeta de producto"
          descripcion="Mueve el ratón encima: la tarjeta se inclina, la luz te sigue y aparece la espalda. Dale al corazón."
          mejoras={['Inclinación 3D y reflejo', 'Borde de luz que sigue al puntero', 'Corazón que estalla', '"+1" al agregar']}
        >
          <div className={s.gridProductos}>
            {[
              <TarjetaProducto
                key="a"
                imagen={FRENTE} imagenHover={ESPALDA}
                categoria="Poleras" nombre="Polera Walá Essentials con capucha"
                precio={89.9} precioAntes={129.9} puntuacion={4.8} resenas={124} vendidos="1,2 mil"
                colores={['#111827', '#f8fafc', '#c4b5fd', '#4d5b3a', '#7f1d1d', '#1e3a8a']}
                onAgregar={avisarAgregado('Polera Walá Essentials con capucha')}
              />,
              <TarjetaProducto
                key="b"
                imagen={ESPALDA} imagenHover={FRENTE}
                categoria="Personalizable" nombre="Polera con tu diseño en la espalda"
                precio={99.9} puntuacion={4.9} resenas={58} personalizable
                colores={['#111827', '#f8fafc', '#c4b5fd']}
                onAgregar={avisarAgregado('Polera con tu diseño en la espalda', ESPALDA)}
              />,
              <TarjetaProducto
                key="c"
                imagen={FRENTE}
                categoria="Parejas" nombre="Combo polera x2 · Él y Ella"
                precio={169.9} nuevo puntuacion={5} resenas={12}
                colores={['#111827', '#7f1d1d']}
                onAgregar={avisarAgregado('Combo polera x2 · Él y Ella')}
              />,
              <TarjetaProducto
                key="d"
                imagen={ESPALDA}
                categoria="Poleras" nombre="Polera oversize edición limitada"
                precio={119.9} agotado puntuacion={4.7} resenas={33}
              />,
              <TarjetaProductoEsqueleto key="e" />,
            ].map((el, i) => (
              <Revelar key={el.key} retraso={i * 0.08}>{el}</Revelar>
            ))}
          </div>
        </Seccion>

        {/* ── NAVEGACIÓN ── */}
        <Seccion
          id="navegacion" numero="06" titulo="Navegación"
          mejoras={['Línea de luz de marca en la cabecera', 'Píldora que sigue al ratón', 'Logo con destello y avatar con anillo', 'Barra móvil con indicador deslizante']}
        >
          <Panel titulo="Cabecera" className={s.panelFondo}>
            <Cabecera enCarrito={enCarrito} monedas={saldo} notificaciones={2} />
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
              <div className={s.separador} />
              <p className={s.panelTitulo}>Hoja inferior / modal</p>
              <p className={s.nota}>
                En el celular sube desde abajo y se cierra arrastrándola hacia abajo; en escritorio es un modal
                centrado. También se cierra con Esc o tocando fuera.
              </p>
              <div className={s.fila}>
                <Boton variante="secundario" onClick={() => setHoja(true)}>Abrir modal</Boton>
                <Boton variante="contorno" onClick={() => setHojaMovil(true)}>Abrir en el teléfono</Boton>
              </div>
            </Panel>
            <Revelar retraso={0.1} className={s.telefono}>
              <div className={s.telefonoPantalla}>
                <span className={s.isla} aria-hidden="true" />
                <div className={s.telefonoTop}>
                  <Logo alto={28} />
                  <Search aria-hidden="true" />
                </div>
                <div className={s.telefonoContenido}>
                  <BarraEnvioGratis actual={cuentas.neto} meta={META_ENVIO} />
                  <div className={s.telefonoGrid}>
                    <TarjetaProducto imagen={FRENTE} nombre="Polera Essentials" precio={89.9} precioAntes={129.9} inclinar={false} onAgregar={avisarAgregado('Polera Essentials')} />
                    <TarjetaProducto imagen={ESPALDA} nombre="Con tu diseño" precio={99.9} personalizable inclinar={false} onAgregar={avisarAgregado('Polera con tu diseño', ESPALDA)} />
                  </div>
                </div>
                <BarraInferior carrito={enCarrito} />
                <HojaInferior
                  contenida
                  abierta={hojaMovil}
                  onCerrar={cerrarHojaMovil}
                  titulo="Elige tu talla"
                  pie={<Boton bloque brillo onClick={cerrarHojaMovil}>Agregar · {soles(89.9)}</Boton>}
                >
                  <SelectorTalla tallas={['S', 'M', 'L', 'XL']} agotadas={['XL']} valor={talla} onChange={setTalla} />
                </HojaInferior>
              </div>
            </Revelar>
          </div>
        </Seccion>

        {/* ── CARRITO ── */}
        <Seccion
          id="carrito" numero="07" titulo="Carrito y resumen"
          descripcion="Funciona de verdad: sube la cantidad hasta pasar S/ 150 y mira qué pasa. Prueba el cupón WALA10."
          mejoras={['Camión que avanza hacia el envío gratis', 'Confeti al llegar a la meta', 'Totales que corren', 'Quitar con animación']}
        >
          <div className={s.gridCarrito}>
            <Panel>
              <BarraEnvioGratis actual={cuentas.neto} meta={META_ENVIO} />
              <div>
                <AnimatePresence initial={false}>
                  {carrito.map((it) => (
                    <motion.div
                      key={it.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0, x: -40 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      style={{ overflow: 'hidden' }}
                    >
                      <ItemCarrito
                        {...it}
                        cantidad={it.cantidad}
                        onCantidad={cambiarCantidad(it.id)}
                        onQuitar={quitar(it.id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {carrito.length === 0 && (
                  <EstadoVacio titulo="Tu carrito está vacío" texto="Lo quitaste todo. Vuelve a llenarlo para seguir probando.">
                    <Boton icono={<RotateCcw aria-hidden="true" />} onClick={() => setCarrito(CARRITO_INICIAL)}>Restaurar carrito</Boton>
                  </EstadoVacio>
                )}
              </div>
            </Panel>
            <Revelar retraso={0.1}>
              <ResumenPedido
                subtotal={cuentas.bruto}
                descuento={cuentas.descuento}
                envio={cuentas.envio}
                monedas={Math.round(cuentas.neto)}
              />
            </Revelar>
          </div>
        </Seccion>

        {/* ── PEDIDOS ── */}
        <Seccion
          id="pedidos" numero="08" titulo="Mis pedidos"
          descripcion="Una sola tarjeta con resumen, seguimiento y la acción que toca."
          mejoras={['La línea se dibuja al aparecer', 'El paso actual late', 'Si falta pagar, el borde respira en ámbar', 'Copiar con burbuja']}
        >
          <div className={s.gridPedidos}>
            <Revelar>
              <SeguimientoPedido
                codigo="WL-20481" fecha="10 oct" paso={1} total={129.8} pagoPendiente
                items={[
                  { imagen: FRENTE, nombre: 'Polera Essentials', variante: 'Negro · M', cantidad: 1, precio: 89.9 },
                  { imagen: ESPALDA, nombre: 'Polera con tu diseño', variante: 'Lila · L', cantidad: 1, precio: 39.9 },
                ]}
              />
            </Revelar>
            <Revelar retraso={0.08}>
              <SeguimientoPedido
                codigo="WL-20377" fecha="7 oct" paso={3} total={169.9} entregaEstimada="mañana, 14 oct"
                items={[{ imagen: FRENTE, nombre: 'Combo Él y Ella', variante: 'Negro / Rojo vino', cantidad: 1, precio: 169.9 }]}
              />
            </Revelar>
            <Revelar retraso={0.16}>
              <SeguimientoPedido
                codigo="WL-19902" fecha="28 sep" paso={4} total={359.6}
                items={[
                  { imagen: ESPALDA, nombre: 'Polera oversize', variante: 'Negro · L', cantidad: 2, precio: 99.9 },
                  { imagen: FRENTE, nombre: 'Polera Essentials', variante: 'Blanco · S', cantidad: 1, precio: 59.9 },
                  { imagen: ESPALDA, nombre: 'Polera con tu diseño', variante: 'Lila · M', cantidad: 1, precio: 99.9 },
                  { imagen: FRENTE, nombre: 'Regalo sorpresa', variante: 'Única', cantidad: 1, precio: 0 },
                ]}
              />
            </Revelar>
          </div>
        </Seccion>

        {/* ── AVISOS ── */}
        <Seccion
          id="avisos" numero="09" titulo="Avisos y estados"
          mejoras={['Toasts con resorte y barra de tiempo', 'Deslízalos a un lado para descartarlos', 'Kapi flota en los estados vacíos']}
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
            <Panel titulo="Toasts" retraso={0.08}>
              <div className={s.columna}>
                <p className={s.nota}>Aparecen abajo al centro, se van solos a los 3,5 s y se pueden deslizar para cerrarlos.</p>
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
              <EstadoVacio titulo="Aún no tienes deseos" texto="Toca el corazón de lo que te guste y lo guardamos aquí.">
                <Boton>Ir a la tienda</Boton>
              </EstadoVacio>
            </Panel>
            <Panel retraso={0.08}>
              <EstadoVacio imagen="/assets/kapi/kapi-happy.webp" titulo="Aún no tienes pedidos" texto="Diseña algo único: Kapi te ayuda paso a paso.">
                <Boton variante="secundario" icono={<Wand2 aria-hidden="true" />}>Crear mi diseño</Boton>
              </EstadoVacio>
            </Panel>
          </div>
        </Seccion>

        <footer className={s.pie}>
          <Logo alto={26} />
          <span>Página local de componentes · <code>src/componentes/kit</code></span>
        </footer>
      </main>

      <HojaInferior
        abierta={hoja}
        onCerrar={cerrarHoja}
        titulo="Personaliza tu polera"
        pie={(
          <>
            <Boton variante="contorno" onClick={cerrarHoja}>Cancelar</Boton>
            <Boton bloque brillo onClick={() => { cerrarHoja(); toast({ titulo: 'Agregado al carrito', texto: `Polera · ${talla} · ${color}`, imagen: FRENTE }); }}>
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
    const raiz = document.documentElement;
    // Transición suave de colores solo durante el cambio de tema.
    raiz.classList.add('cambiando-tema');
    raiz.setAttribute('data-theme', nuevo);
    window.setTimeout(() => raiz.classList.remove('cambiando-tema'), 450);
    try { localStorage.setItem('wala-componentes-tema', nuevo); } catch (e) { /* sin storage: solo esta visita */ }
    setTema(nuevo);
  };

  return (
    <MotionConfig reducedMotion="user">
      <ProveedorToasts>
        <Contenido tema={tema} cambiarTema={cambiarTema} />
      </ProveedorToasts>
    </MotionConfig>
  );
}
