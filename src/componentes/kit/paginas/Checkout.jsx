import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CreditCard, MessageCircle, Globe2, MapPin, Plus, Heart, PartyPopper, Smile, CalendarHeart, ShoppingBag, Package, Gift } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Aviso, EstadoVacio } from '../Feedback';
import { Campo, Casilla, Interruptor } from '../Formulario';
import { Trazo } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { Texto, useTexto } from '../Traduccion';
import { soles } from '../TarjetaProducto';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { ListaEleccion } from '../piezas/Cuenta';
import { TarjetaDireccion } from '../piezas/TarjetaDireccion';
import { CamposDireccion, validarDireccion, cambiarDireccion, documentoDe } from '../piezas/Direccion';
import { PasosCompra, ResumenCompra, MetodoPago } from '../piezas/Checkout';
import { PagoTarjeta, PagoPaypal } from '../piezas/Pago';
import { TextoResaltado } from '../piezas/TextoResaltado';
import s from './Checkout.module.css';

/*
 * El checkout (/checkout): a dónde va (una dirección guardada o una nueva),
 * si es un regalo, y después cómo pagar (tarjeta, o Yape, Plin y
 * transferencia con un asesor por WhatsApp; fuera del Perú, PayPal). A la
 * derecha (arriba y plegado en el celular), el resumen con las monedas y el
 * cupón. Los cobros, el pedido y el cupón los hace la tienda por props.
 */

// Los valores son los que guarda el pedido (giftSticker) y lee "Abrir el regalo".
const STICKERS = [
  { valor: 'kapi-love', texto: 'Amor', icono: <Heart aria-hidden="true" /> },
  { valor: 'kapi-party', texto: 'Fiesta', icono: <PartyPopper aria-hidden="true" /> },
  { valor: 'kapi-smile', texto: 'Feliz', icono: <Smile aria-hidden="true" /> },
];

const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c || '').trim());

/** La nota de quien llega con un enlace de invitación (los textos de NotaInvitacion de la tienda). */
const textoInvitacion = ({ nombre, aceptada }) => {
  if (aceptada) {
    const quien = nombre || 'quien te invitó';
    return `Es tu primera compra con la invitación de ${quien}. Cuando la recibas, ${quien} gana monedas. A ti no te cuesta nada.`;
  }
  return nombre
    ? `Compras con la invitación de ${nombre}. Cuando recibas tu pedido, ${nombre} gana monedas. A ti no te cuesta nada.`
    : 'Compras con una invitación. Cuando recibas tu pedido, quien te invitó gana monedas. A ti no te cuesta nada.';
};

/**
 * La página.
 *  - items: los elegidos del carrito [{ id, imagen, nombre, variante, precio,
 *    cantidad }] · incompletos: nombres de los que no tienen color o talla
 *  - sesion · perfil: { nombre, tipoDocumento, documento, telefono, email, pais }
 *  - direcciones: las guardadas (direccionDesdeFirestore) · lugares · paises
 *    ([{ valor, texto, prefijo }]: con prefijo, el teléfono va con el del país)
 *  - reglas: 'cuenta' | 'checkout' (las de la tienda, más laxas; ver
 *    validarDireccion)
 *  - inicial: { direccion, correo, regalo } lo que ya estaba llenado (el
 *    borrador al volver de iniciar sesión, lo recordado en el equipo): con una
 *    dirección escrita, abre en el formulario · paisSugerido: el país
 *    detectado (se pone si el cliente no eligió otro)
 *  - envio: { costo, gratisDesde } (gratis en compras de MÁS de gratisDesde)
 *  - monedas: { saldo, cargando } (se usan hasta la mitad del subtotal)
 *  - onCupon(codigo, { subtotal, subtotalProductos, envio }): promesa →
 *    { codigo, texto, descuento, envioGratis, aviso } (subtotal: ya sin las
 *    monedas; el envío, sin el cupón)
 *  - onPreparar(datos): promesa → { numero } (prepara el pago; aún no hay pedido)
 *  - pago: { onTarjeta(total), onWhatsApp(marcaId?), onPaypal(totalUsd),
 *    marcas: [{ id, nombre, cantidad }] (más de una: un envío por marca),
 *    usd(total), local(total, pais) (el equivalente en la moneda del país, texto),
 *    botonesPaypal (los del SDK de PayPal), botonTarjeta (el botón de la
 *    tienda: la ventana de Culqi con PagoTarjeta), tarjetaFallo } — promesas;
 *    la de la tarjeta falla si no se cobró
 *  - listo: { metodo, numero } la tienda avisa que ya se pagó (la tarjeta, que
 *    cobra después de cerrar su ventana) · onListo(metodo): al mostrar "listo"
 *  - onPaso(n): al cambiar de paso (0 envío, 1 pago, 2 listo)
 *  - entrega: { fecha, ocasion, destinatario, aviso } (un regalo de una lista de deseos)
 *  - invitacion: { nombre, aceptada } (compra con un enlace de invitación)
 *  - Para pagar hace falta una cuenta: sin sesión se llena todo, pero el botón
 *    es "Inicia sesión para pagar" · onEntrar(ruta, datos): guardar lo llenado
 *    antes de ir a urlLogin o urlRegistro (al volver, llega en `inicial`)
 *  - urlCarrito, urlTienda, urlPedidos, urlLogin, urlRegistro · estado: 'cargando'
 *  - vacio: { titulo, texto, boton, url } sin nada que pagar (por defecto, el
 *    carrito vacío; la tienda avisa si hay productos pero ninguno elegido)
 */
export function PaginaCheckout({
  items = [], incompletos = [], sesion = false, perfil = {}, direcciones = [], lugares = {}, paises, reglas = 'cuenta',
  inicial = {}, paisSugerido,
  envio: reglaEnvio = { costo: 15, gratisDesde: 200 }, monedas = {}, onCupon, onPreparar, pago = {},
  listo, onListo, onPaso,
  entrega, invitacion, urlCarrito = '/carrito', urlTienda = '/tienda', urlPedidos = '/cuenta/pedidos', urlLogin = '/login', urlRegistro = '/registro', onEntrar,
  estado, vacio,
}) {
  const principal = direcciones.find((d) => d.principal) || direcciones[0];
  const nueva = () => ({
    nombre: perfil.nombre || '', tipoDocumento: perfil.tipoDocumento || 'DNI', documento: perfil.documento || '',
    telefono: perfil.telefono || '', pais: perfil.pais || 'PE', ciudad: 'Lima', departamento: '', provincia: '', distrito: '', direccion: '',
  });
  // Una dirección ya escrita (el borrador) gana sobre la guardada: se abre en el formulario.
  const conInicial = Boolean(inicial.direccion?.direccion || inicial.direccion?.distrito);
  const [modo, setModo] = useState(principal && !conInicial ? 'tarjeta' : 'formulario');
  const [elegida, setElegida] = useState(principal?.id);
  const [form, setForm] = useState(() => ({ ...nueva(), ...(inicial.direccion || {}) }));
  const lleno = (d) => Boolean(String(d.nombre || '').trim() && String(d.documento || '').trim() && String(d.telefono || '').trim());
  const [verDestinatario, setVerDestinatario] = useState(() => !(sesion && lleno({ ...nueva(), ...(inicial.direccion || {}) })));
  const [correo, setCorreo] = useState(inicial.correo ?? perfil.email ?? '');
  // Con cuenta se guarda la dirección; sin cuenta, recordar los datos es opt-in (puede ser un equipo ajeno).
  const [guardar, setGuardar] = useState(sesion);
  const [regalo, setRegalo] = useState(() => ({
    activo: inicial.regalo?.activo ?? Boolean(entrega),
    destinatario: inicial.regalo?.destinatario || entrega?.destinatario || '',
    mensaje: inicial.regalo?.mensaje || '',
    sticker: inicial.regalo?.sticker || 'kapi-love',
  }));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [usarMonedas, setUsarMonedas] = useState(false);
  const [cupon, setCupon] = useState(null);
  const [paso, setPaso] = useState(0);
  const [pedido, setPedido] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [tarjetaFallo, setTarjetaFallo] = useState(false);
  const [enviadas, setEnviadas] = useState([]);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const raiz = useRef(null);
  const paisTocado = useRef(false);
  const modoAntesDeLista = useRef('tarjeta');
  const reducir = useReducedMotion();
  const t = {
    direcciones: useTexto('Tus direcciones'), sticker: useTexto('Sticker de Kapi'), editar: useTexto('Editar'),
  };

  const cuentas = useMemo(() => {
    const subtotal = items.reduce((tot, it) => tot + it.precio * it.cantidad, 0);
    const maximo = Math.floor(subtotal / 2);
    const descuentoMonedas = usarMonedas ? Math.min(monedas.saldo || 0, maximo) : 0;
    const descuentoCupon = cupon?.envioGratis ? 0 : cupon?.descuento || 0;
    const envioBase = subtotal > reglaEnvio.gratisDesde ? 0 : reglaEnvio.costo;
    const envio = cupon?.envioGratis ? 0 : envioBase;
    return { subtotal, maximo, descuentoMonedas, envioBase, envio, total: Math.max(0, subtotal - descuentoMonedas - descuentoCupon) + envio };
  }, [items, usarMonedas, monedas.saldo, cupon, reglaEnvio]);

  // El país detectado, si el cliente no eligió otro ni venía uno escrito.
  useEffect(() => {
    if (!paisSugerido || paisTocado.current || inicial.direccion?.pais) return;
    setForm((f) => (f.pais === paisSugerido ? f : cambiarDireccion(f, 'pais', paisSugerido)));
  }, [paisSugerido]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Listo" lo puede poner la tienda (la tarjeta cobra después de cerrar su ventana).
  const enListo = paso === 2 || Boolean(listo);
  const pasoVisible = enListo ? 2 : paso;
  const onListoRef = useRef(onListo);
  onListoRef.current = onListo;
  const onPasoRef = useRef(onPaso);
  onPasoRef.current = onPaso;
  useEffect(() => {
    onPasoRef.current?.(pasoVisible);
    if (pasoVisible === 2) onListoRef.current?.(listo?.metodo || pedido?.metodo);
    // Al cambiar de paso, la vista vuelve al principio (las opciones de pago quedaban abajo).
    if (pasoVisible > 0) raiz.current?.scrollIntoView?.({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
  }, [pasoVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (estado === 'cargando') return <EsqueletoPagina forma="checkout" sesion={sesion} />;
  if (!items.length && !enListo) {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.estado}>
          <EstadoVacio imagen={CARAS_KAPI.hambre} titulo={<Texto>{vacio?.titulo || 'Tu carrito está vacío'}</Texto>} texto={<Texto>{vacio?.texto || 'Agrega lo que te guste y vuelve para pagar.'}</Texto>}>
            <Boton to={vacio?.url || urlTienda} icono={<ShoppingBag aria-hidden="true" />}><Texto>{vacio?.boton || 'Ir a la tienda'}</Texto></Boton>
          </EstadoVacio>
        </div>
      </BloqueSeccion>
    );
  }

  const direccion = modo === 'formulario' ? form : direcciones.find((d) => d.id === elegida) || principal;
  const fuera = direccion?.pais && direccion.pais !== 'PE';
  const pedirCorreo = !sesion || !perfil.email;

  const cambiar = (campo, v) => {
    if (campo === 'pais') paisTocado.current = true;
    setForm((f) => cambiarDireccion(f, campo, v));
    setErrores((x) => ({ ...x, [campo]: undefined }));
  };
  const cambiarRegalo = (campo) => (e) => {
    const v = typeof e === 'string' ? e : e.target.value;
    setRegalo((r) => ({ ...r, [campo]: v }));
    setErrores((x) => ({ ...x, [`regalo_${campo}`]: undefined }));
  };
  const abrirFormulario = (d) => {
    setForm(d);
    setGuardar(true);
    setVerDestinatario(!(sesion && lleno(d)));
    setModo('formulario');
  };
  const abrirLista = () => { modoAntesDeLista.current = modo; setModo('lista'); };
  const cancelarLista = () => setModo(modoAntesDeLista.current === 'formulario' || !principal ? 'formulario' : 'tarjeta');

  const continuar = async (e) => {
    e.preventDefault();
    if (!sesion) return;
    const encontrados = modo === 'formulario' ? validarDireccion(form, { reglas }) : {};
    if (pedirCorreo && !correoValido(correo)) encontrados.correo = correo ? 'Escribe un correo válido.' : 'Escribe tu correo para enviarte el pedido.';
    if (regalo.activo && !regalo.destinatario.trim()) encontrados.regalo_destinatario = 'Escribe para quién es.';
    if (regalo.activo && !regalo.mensaje.trim()) encontrados.regalo_mensaje = 'Escribe un mensaje.';
    setErrores(encontrados);
    if (Object.keys(encontrados).length) {
      if (encontrados.nombre || encontrados.documento || encontrados.telefono) setVerDestinatario(true);
      setError('Revisa los campos marcados en rojo para continuar.');
      return;
    }
    if (incompletos.length) { setError(`Falta elegir color o talla en: ${incompletos.join(', ')}. Ábrelo desde el carrito y elígelos.`); return; }
    setError('');
    setOcupado('preparar');
    try {
      const r = await onPreparar?.({
        direccion, correo: pedirCorreo ? correo.trim() : perfil.email, guardar: modo === 'formulario' && guardar,
        regalo: regalo.activo ? regalo : null, monedas: cuentas.descuentoMonedas, cupon: cupon?.codigo, total: cuentas.total,
      });
      setPedido({ numero: r?.numero });
      setTarjetaFallo(false);
      setPaso(1);
    } catch (err) {
      setError(err?.message || 'No pudimos preparar el pago. Intenta nuevamente.');
    } finally {
      setOcupado(null);
    }
  };

  const pagar = async (metodo, fn, ...args) => {
    setOcupado(metodo);
    try {
      await fn?.(...args);
      setPedido((p) => ({ ...p, metodo }));
      setPaso(2);
    } catch (err) {
      if (metodo === 'tarjeta') setTarjetaFallo(true);
      setError(err?.message || (metodo === 'whatsapp' ? 'No pudimos crear tu pedido. No se abrió WhatsApp; inténtalo nuevamente.' : 'El pago no pudo completarse.'));
    } finally {
      setOcupado(null);
    }
  };

  /* ── Listo ── */
  if (enListo) {
    const metodo = listo?.metodo || pedido?.metodo;
    const porWhatsApp = metodo === 'whatsapp' || metodo === 'marcas';
    const numero = listo?.numero || pedido?.numero;
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div ref={raiz} className={s.listo} data-componente="PaginaCheckout">
          <img src={CARAS_KAPI.feliz} alt="" width="120" height="120" />
          <h1 className={s.listoTitulo}><Texto>{porWhatsApp ? '¡Tu pedido está creado!' : '¡Pago aprobado!'}</Texto><Trazo className={s.trazo} /></h1>
          {numero && <p className={s.numero}><TextoResaltado resaltar={[numero]}>{`Pedido ${numero}`}</TextoResaltado></p>}
          <p className={s.listoTexto}>
            <Texto>
              {porWhatsApp
                ? 'Termina el pago con el asesor en WhatsApp. Cuando lo confirme, tu pedido pasa a producción.'
                : 'Ya estamos preparando tu pedido. Te avisaremos en cada paso, hasta que llegue a tu puerta.'}
            </Texto>
          </p>
          <div className={s.listoBotones}>
            <Boton to={urlPedidos} icono={<Package aria-hidden="true" />}><Texto>Ver mi pedido</Texto></Boton>
            <Boton to={urlTienda} variante="contorno"><Texto>Seguir comprando</Texto></Boton>
          </div>
        </div>
      </BloqueSeccion>
    );
  }

  const usd = pago.usd ? pago.usd(cuentas.total) : null;
  const local = fuera && pago.local ? pago.local(cuentas.total, direccion?.pais) : null;
  const variasMarcas = (pago.marcas || []).length > 1;
  const fallo = tarjetaFallo || Boolean(pago.tarjetaFallo);
  const editando = modo === 'formulario' && form.id;

  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
      <div ref={raiz} className={s.pagina} data-componente="PaginaCheckout">
        <header className={s.cabeza}>
          <h1 className={s.titulo}><Texto>Finalizar compra</Texto></h1>
          <PasosCompra pasos={['Envío', 'Pago']} actual={paso} />
        </header>

        <div className={s.cuerpo}>
          <aside className={s.lado}>
            <ResumenCompra
              items={items}
              subtotal={cuentas.subtotal}
              descuentoMonedas={cuentas.descuentoMonedas}
              cupon={cupon}
              envio={cuentas.envio}
              gratisDesde={reglaEnvio.gratisDesde}
              total={cuentas.total}
              abierto={resumenAbierto}
              onAlternar={() => setResumenAbierto((a) => !a)}
              monedas={{ saldo: monedas.saldo || 0, maximo: cuentas.maximo, usar: usarMonedas, onUsar: setUsarMonedas, cargando: monedas.cargando, sesion, urlLogin, bloqueado: Boolean(ocupado) || paso > 0 }}
              /* Ya en el pago, las monedas y el cupón quedan como se prepararon (para cambiarlos, "Cambiar el envío"). */
              cupones={onCupon && (paso === 0 || cupon) ? {
                aplicado: cupon,
                onAplicar: async (c) => setCupon(await onCupon(c, { subtotal: cuentas.subtotal - cuentas.descuentoMonedas, subtotalProductos: cuentas.subtotal, envio: cuentas.envioBase })),
                onQuitar: paso === 0 ? () => setCupon(null) : undefined,
              } : undefined}
              pie={(
                <>
                  {invitacion && <p className={s.invitacion}><Gift aria-hidden="true" /> <Texto>{textoInvitacion(invitacion)}</Texto></p>}
                  {fuera && local && <p className={s.nota}><TextoResaltado resaltar={[local]}>{`Equivalente aprox.: ${local}`}</TextoResaltado></p>}
                  {fuera && usd != null && <p className={s.nota}><TextoResaltado resaltar={[`US$ ${usd.toFixed(2)}`]}>{`Pagarás por PayPal: US$ ${usd.toFixed(2)}. El cobro internacional es en dólares.`}</TextoResaltado></p>}
                </>
              )}
            />
          </aside>

          <div className={s.principal}>
            {paso === 0 ? (
              <form className={s.tarjeta} onSubmit={continuar} noValidate>
                <h2 className={s.subtitulo}>
                  <Texto>{modo === 'tarjeta' || modo === 'lista' ? 'Enviar a' : editando ? 'Editar dirección' : direcciones.length ? 'Nueva dirección' : 'Datos de envío'}</Texto>
                </h2>

                {modo === 'tarjeta' && direccion && (
                  <div className={s.elegida}>
                    <TarjetaDireccion
                      nombre={direccion.nombre}
                      direccion={direccion.direccion}
                      lugar={lugares.legible?.(direccion)}
                      documento={direccion.documento ? documentoDe(direccion) : ''}
                      telefono={direccion.telefono}
                      principal={direccion.principal}
                    />
                    <Boton variante="contorno" tamano="sm" onClick={abrirLista}><Texto>Cambiar</Texto></Boton>
                  </div>
                )}

                {modo === 'lista' && (
                  <>
                    <ListaEleccion
                      etiqueta={t.direcciones}
                      valor={elegida}
                      onElegir={(id) => { setElegida(id); setModo('tarjeta'); }}
                      opciones={direcciones.map((d) => ({
                        valor: d.id,
                        texto: d.principal ? <>{d.nombre} · <Texto>Principal</Texto></> : d.nombre,
                        detalle: `${d.direccion}, ${d.distrito} · ${d.telefono}`,
                        icono: <MapPin aria-hidden="true" />,
                        // Editarla desde aquí (los cambios se guardan en «Mis direcciones»).
                        accion: { texto: t.editar, etiqueta: `${t.editar} · ${d.nombre}`, onClick: () => abrirFormulario({ ...d }) },
                      }))}
                    />
                    <div className={s.filaBotones}>
                      <Boton variante="fantasma" tamano="sm" icono={<Plus aria-hidden="true" />} onClick={() => abrirFormulario(nueva())}><Texto>Agregar una dirección nueva</Texto></Boton>
                      <Boton variante="fantasma" tamano="sm" onClick={cancelarLista}><Texto>Cancelar</Texto></Boton>
                    </div>
                  </>
                )}

                {modo === 'formulario' && (
                  <>
                    {direcciones.length > 0 && (
                      <button type="button" className={s.volverLista} onClick={abrirLista}><ArrowLeft aria-hidden="true" /> <Texto>Usar una dirección guardada</Texto></button>
                    )}
                    <CamposDireccion
                      valor={form}
                      onCambiar={cambiar}
                      errores={errores}
                      lugares={lugares}
                      paises={paises}
                      verDestinatario={verDestinatario}
                      onVerDestinatario={() => setVerDestinatario(true)}
                    />
                    <Casilla
                      activo={guardar}
                      onChange={setGuardar}
                      etiqueta={!sesion ? 'Recordar mis datos en este dispositivo' : editando ? 'Guardar los cambios en esta dirección' : 'Guardar esta dirección en mi cuenta'}
                      descripcion={!sesion ? 'No lo marques si la computadora o el celular no es tuyo.' : editando ? 'Se actualiza en «Mis direcciones».' : 'La verás la próxima vez y en «Mis direcciones».'}
                    />
                  </>
                )}

                {pedirCorreo && (
                  <Campo
                    etiqueta="Correo"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={correo}
                    onChange={(e) => { setCorreo(e.target.value); setErrores((x) => ({ ...x, correo: undefined })); }}
                    error={errores.correo}
                    ayuda={errores.correo ? undefined : 'Te enviamos ahí el detalle de tu pedido.'}
                    autoComplete="email"
                  />
                )}

                {/* Es un regalo: una experiencia digital para quien lo recibe. */}
                <div className={[s.regalo, regalo.activo && s.regaloActivo].filter(Boolean).join(' ')}>
                  <Interruptor
                    activo={regalo.activo}
                    onChange={(v) => setRegalo((r) => ({ ...r, activo: v }))}
                    etiqueta={<Texto>Es un regalo (gratis)</Texto>}
                    descripcion={<Texto>Quien lo recibe abre un mensaje tuyo con Kapi en su celular.</Texto>}
                  />
                  {entrega && (
                    <Aviso tipo="info" compacto icono={<CalendarHeart aria-hidden="true" />}>
                      {`Entrega programada para el ${entrega.fecha}${entrega.ocasion ? ` · ${entrega.ocasion}` : ''}.${entrega.aviso ? ` ${entrega.aviso}` : ''}`}
                    </Aviso>
                  )}
                  {regalo.activo && (
                    <div className={s.regaloCampos}>
                      <Campo etiqueta="Para" placeholder="Ej.: María" value={regalo.destinatario} onChange={cambiarRegalo('destinatario')} error={errores.regalo_destinatario} />
                      {/* Crece solo con lo escrito y cuenta las letras (Campo multilinea). */}
                      <Campo
                        etiqueta="Tu mensaje"
                        error={errores.regalo_mensaje}
                        multilinea={3}
                        maxLength={200}
                        placeholder="Escribe algo especial…"
                        value={regalo.mensaje}
                        onChange={cambiarRegalo('mensaje')}
                      />
                      <div className={s.grupo}>
                        <span className={s.rotulo}><Texto>Cómo te acompaña Kapi</Texto></span>
                        <ListaEleccion etiqueta={t.sticker} opciones={STICKERS.map((x) => ({ ...x, texto: <Texto>{x.texto}</Texto> }))} valor={regalo.sticker} onElegir={cambiarRegalo('sticker')} />
                      </div>
                    </div>
                  )}
                </div>

                {error && <Aviso tipo="error" compacto>{error}</Aviso>}

                {!sesion && (
                  <p className={s.entrar} role="note">
                    <strong><Texto>Para pagar necesitas tu cuenta.</Texto></strong> <Texto>Así tu pedido queda en «Mis pedidos» y puedes usar tus monedas. Lo que ya llenaste se guarda.</Texto>{' '}
                    <Enlace to={urlRegistro} onClick={() => onEntrar?.(urlRegistro, { direccion: form, correo, regalo })}><Texto>¿No tienes cuenta? Créala aquí</Texto></Enlace>
                  </p>
                )}
                <div className={s.botones}>
                  <Boton to={urlCarrito} variante="fantasma" icono={<ArrowLeft aria-hidden="true" />}><Texto>Volver al carrito</Texto></Boton>
                  {sesion ? (
                    <Boton type="submit" tamano="lg" cargando={ocupado === 'preparar'} iconoFin={<ArrowRight aria-hidden="true" />}>
                      <Texto>{ocupado === 'preparar' ? 'Preparando tu pago…' : 'Continuar al pago'}</Texto>
                    </Boton>
                  ) : (
                    <Boton to={urlLogin} tamano="lg" iconoFin={<ArrowRight aria-hidden="true" />} onClick={() => onEntrar?.(urlLogin, { direccion: form, correo, regalo })}><Texto>Inicia sesión para pagar</Texto></Boton>
                  )}
                </div>
              </form>
            ) : (
              <div className={s.tarjeta}>
                <div className={s.pagoCabeza}>
                  <span>
                    <small><Texto>Elige cómo pagar</Texto></small>
                    <strong className={s.monto}>{fuera && usd != null ? `US$ ${usd.toFixed(2)}` : soles(cuentas.total)}</strong>
                    <span className={s.pedido}><Texto>{`Pedido ${pedido?.numero || ''} · a nombre de ${direccion?.nombre || ''}`}</Texto></span>
                  </span>
                  <button type="button" className={s.volverLista} onClick={() => { setPaso(0); setError(''); }}><ArrowLeft aria-hidden="true" /> <Texto>Cambiar el envío</Texto></button>
                </div>

                {fuera ? (
                  <>
                    <Aviso tipo="info" compacto icono={<Globe2 aria-hidden="true" />}>Envíos internacionales: la entrega demora de 7 a 30 días hábiles.</Aviso>
                    <MetodoPago destacado icono={<Globe2 aria-hidden="true" />} titulo="PayPal" texto="Con tu cuenta de PayPal o con tarjeta, en dólares.">
                      <PagoPaypal montoUsd={usd || 0} equivalente={local ? `≈ ${local}` : `≈ ${soles(cuentas.total)}`} botones={pago.botonesPaypal} procesando={pago.paypal?.procesando} error={pago.paypal?.error} onPagar={() => pagar('paypal', pago.onPaypal, usd)} />
                    </MetodoPago>
                  </>
                ) : (
                  <MetodoPago destacado icono={<CreditCard aria-hidden="true" />} titulo="Tarjeta de crédito o débito" texto="Visa, Mastercard, American Express o Diners. Tu pedido queda confirmado al instante.">
                    {fallo && (
                      <Aviso tipo="aviso" compacto titulo="No se completó el pago con tarjeta">Puedes intentarlo otra vez o pagar con Yape, Plin o transferencia por WhatsApp.</Aviso>
                    )}
                    {pago.botonTarjeta || <PagoTarjeta monto={cuentas.total} onPagar={() => { setError(''); return pagar('tarjeta', pago.onTarjeta, cuentas.total); }} />}
                  </MetodoPago>
                )}

                <p className={s.separador}><span><Texto>o</Texto></span></p>

                <MetodoPago
                  icono={<MessageCircle aria-hidden="true" />}
                  titulo={fuera ? 'Coordinar por WhatsApp' : 'Yape, Plin o transferencia'}
                  texto={fuera ? 'Un asesor recibe tu pedido y te indica cómo pagar desde tu país.' : 'Te atendemos por WhatsApp: un asesor recibe tu pedido y te indica cómo pagar.'}
                >
                  {variasMarcas ? (
                    <>
                      <p className={s.nota}><Texto>Tu pedido tiene productos de varias marcas. Envía cada parte a su asesor:</Texto></p>
                      <div className={s.marcas}>
                        {pago.marcas.map((m) => (
                          <Boton
                            key={m.id}
                            variante={enviadas.includes(m.id) ? 'fantasma' : 'contorno'}
                            icono={<MessageCircle aria-hidden="true" />}
                            cargando={ocupado === `marca-${m.id}`}
                            onClick={async () => { setOcupado(`marca-${m.id}`); try { await pago.onWhatsApp?.(m.id); setEnviadas((x) => [...x, m.id]); } catch (err) { setError(err?.message || 'No pudimos crear tu pedido.'); } finally { setOcupado(null); } }}
                          >
                            {`${enviadas.includes(m.id) ? 'Enviado a' : 'Enviar a'} ${m.nombre} (${m.cantidad})`}
                          </Boton>
                        ))}
                      </div>
                      <Boton bloque disabled={!enviadas.length} onClick={() => { setPedido((p) => ({ ...p, metodo: 'marcas' })); setPaso(2); }}><Texto>Listo, ya envié mis pedidos</Texto></Boton>
                    </>
                  ) : (
                    <Boton bloque variante="secundario" tamano="lg" icono={<MessageCircle aria-hidden="true" />} cargando={ocupado === 'whatsapp'} onClick={() => pagar('whatsapp', pago.onWhatsApp)}>
                      <Texto>{ocupado === 'whatsapp' ? 'Creando tu pedido…' : 'Continuar por WhatsApp'}</Texto>
                    </Boton>
                  )}
                </MetodoPago>

                {error && <Aviso tipo="error" compacto>{error}</Aviso>}
                <p className={s.pie}><Texto>Tu pedido se registra solo cuando el pago se aprueba o cuando lo envías por WhatsApp.</Texto></p>
              </div>
            )}
          </div>
        </div>
      </div>

    </BloqueSeccion>
  );
}
