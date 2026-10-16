import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CreditCard, MessageCircle, Globe2, MapPin, Plus, Heart, PartyPopper, Smile, CalendarHeart, ShoppingBag, Package, Gift } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Aviso, EstadoVacio } from '../Feedback';
import { Campo, Casilla, Interruptor } from '../Formulario';
import { Trazo } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { soles } from '../TarjetaProducto';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { ListaEleccion } from '../piezas/Cuenta';
import { TarjetaDireccion } from '../piezas/TarjetaDireccion';
import { CamposDireccion, validarDireccion, cambiarDireccion, documentoDe } from '../piezas/Direccion';
import { PasosCompra, ResumenCompra, MetodoPago } from '../piezas/Checkout';
import { PagoTarjeta, PagoPaypal } from '../piezas/Pago';
import s from './Checkout.module.css';

/*
 * El checkout (/checkout): a dónde va (una dirección guardada o una nueva),
 * si es un regalo, y después cómo pagar (tarjeta, o Yape, Plin y
 * transferencia con un asesor por WhatsApp; fuera del Perú, PayPal). A la
 * derecha (arriba y plegado en el celular), el resumen con las monedas y el
 * cupón. Los cobros, el pedido y el cupón los hace la tienda por props.
 */

const STICKERS = [
  { valor: 'kapi-love', texto: 'Amor', icono: <Heart aria-hidden="true" /> },
  { valor: 'kapi-party', texto: 'Fiesta', icono: <PartyPopper aria-hidden="true" /> },
  { valor: 'kapi-happy', texto: 'Feliz', icono: <Smile aria-hidden="true" /> },
];

const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c || '').trim());

/**
 * La página.
 *  - items: los elegidos del carrito [{ id, imagen, nombre, variante, precio,
 *    cantidad }] · incompletos: nombres de los que no tienen color o talla
 *  - sesion · perfil: { nombre, tipoDocumento, documento, telefono, email, pais }
 *  - direcciones: las guardadas (direccionDesdeFirestore) · lugares · paises
 *  - envio: { costo, gratisDesde } (gratis en compras de MÁS de gratisDesde)
 *  - monedas: { saldo, cargando } (se usan hasta la mitad del subtotal)
 *  - onCupon(codigo): promesa → { codigo, texto, descuento, envioGratis }
 *  - onPreparar(datos): promesa → { numero } (prepara el pago; aún no hay pedido)
 *  - pago: { onTarjeta(total), onWhatsApp(marcaId?), onPaypal(totalUsd),
 *    marcas: [{ id, nombre, cantidad }] (más de una: un envío por marca),
 *    usd(total), botonesPaypal (los del SDK de PayPal) } — promesas; la de
 *    la tarjeta falla si no se cobró
 *  - entrega: { fecha, ocasion, destinatario, aviso } (un regalo de una lista de deseos)
 *  - invitacion: { nombre } (primera compra con un link de invitación)
 *  - Para pagar hace falta una cuenta: sin sesión se llena todo, pero el botón
 *    es "Inicia sesión para pagar" · onEntrar(ruta, datos): guardar lo llenado
 *    antes de ir a urlLogin o urlRegistro (al volver, llega en `perfil`/`direcciones`)
 *  - urlCarrito, urlTienda, urlPedidos, urlLogin, urlRegistro · estado: 'cargando'
 */
export function PaginaCheckout({
  items = [], incompletos = [], sesion = false, perfil = {}, direcciones = [], lugares = {}, paises,
  envio: reglaEnvio = { costo: 15, gratisDesde: 100 }, monedas = {}, onCupon, onPreparar, pago = {},
  entrega, invitacion, urlCarrito = '/carrito', urlTienda = '/tienda', urlPedidos = '/cuenta/pedidos', urlLogin = '/login', urlRegistro = '/registro', onEntrar,
  estado,
}) {
  const principal = direcciones.find((d) => d.principal) || direcciones[0];
  const nueva = () => ({
    nombre: perfil.nombre || '', tipoDocumento: perfil.tipoDocumento || 'DNI', documento: perfil.documento || '',
    telefono: perfil.telefono || '', pais: perfil.pais || 'PE', ciudad: 'Lima', departamento: '', provincia: '', distrito: '', direccion: '',
  });
  const [modo, setModo] = useState(principal ? 'tarjeta' : 'formulario');
  const [elegida, setElegida] = useState(principal?.id);
  const [form, setForm] = useState(nueva);
  const [verDestinatario, setVerDestinatario] = useState(!(sesion && perfil.nombre && perfil.documento && perfil.telefono));
  const [correo, setCorreo] = useState(perfil.email || '');
  // Con cuenta se guarda la dirección; sin cuenta, recordar los datos es opt-in (puede ser un equipo ajeno).
  const [guardar, setGuardar] = useState(sesion);
  const [regalo, setRegalo] = useState({ activo: Boolean(entrega), destinatario: entrega?.destinatario || '', mensaje: '', sticker: 'kapi-love' });
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

  const cuentas = useMemo(() => {
    const subtotal = items.reduce((t, it) => t + it.precio * it.cantidad, 0);
    const maximo = Math.floor(subtotal / 2);
    const descuentoMonedas = usarMonedas ? Math.min(monedas.saldo || 0, maximo) : 0;
    const descuentoCupon = cupon?.envioGratis ? 0 : cupon?.descuento || 0;
    const envio = subtotal > reglaEnvio.gratisDesde || cupon?.envioGratis ? 0 : reglaEnvio.costo;
    return { subtotal, maximo, descuentoMonedas, envio, total: Math.max(0, subtotal - descuentoMonedas - descuentoCupon) + envio };
  }, [items, usarMonedas, monedas.saldo, cupon, reglaEnvio]);

  if (estado === 'cargando') return <EsqueletoPagina forma="checkout" sesion={sesion} />;
  if (!items.length && paso < 2) {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.estado}>
          <EstadoVacio imagen={CARAS_KAPI.hambre} titulo="Tu carrito está vacío" texto="Agrega lo que te guste y vuelve para pagar.">
            <Boton to={urlTienda} icono={<ShoppingBag aria-hidden="true" />}>Ir a la tienda</Boton>
          </EstadoVacio>
        </div>
      </BloqueSeccion>
    );
  }

  const direccion = modo === 'formulario' ? form : direcciones.find((d) => d.id === elegida) || principal;
  const fuera = direccion?.pais && direccion.pais !== 'PE';
  const pedirCorreo = !sesion || !perfil.email;

  const cambiar = (campo, v) => {
    setForm((f) => cambiarDireccion(f, campo, v));
    setErrores((x) => ({ ...x, [campo]: undefined }));
  };
  const cambiarRegalo = (campo) => (e) => {
    const v = typeof e === 'string' ? e : e.target.value;
    setRegalo((r) => ({ ...r, [campo]: v }));
    setErrores((x) => ({ ...x, [`regalo_${campo}`]: undefined }));
  };

  const continuar = async (e) => {
    e.preventDefault();
    if (!sesion) return;
    const encontrados = modo === 'formulario' ? validarDireccion(form) : {};
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
  if (paso === 2) {
    const porWhatsApp = pedido?.metodo === 'whatsapp' || pedido?.metodo === 'marcas';
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div className={s.listo} data-componente="PaginaCheckout">
          <img src={CARAS_KAPI.feliz} alt="" width="120" height="120" />
          <h1 className={s.listoTitulo}>{porWhatsApp ? '¡Tu pedido está creado!' : '¡Pago aprobado!'}<Trazo className={s.trazo} /></h1>
          {pedido?.numero && <p className={s.numero}>Pedido <strong>{pedido.numero}</strong></p>}
          <p className={s.listoTexto}>
            {porWhatsApp
              ? 'Termina el pago con el asesor en WhatsApp. Cuando lo confirme, tu pedido pasa a producción.'
              : 'Ya estamos preparando tu pedido. Te avisaremos en cada paso, hasta que llegue a tu puerta.'}
          </p>
          <div className={s.listoBotones}>
            <Boton to={urlPedidos} icono={<Package aria-hidden="true" />}>Ver mi pedido</Boton>
            <Boton to={urlTienda} variante="contorno">Seguir comprando</Boton>
          </div>
        </div>
      </BloqueSeccion>
    );
  }

  const usd = pago.usd ? pago.usd(cuentas.total) : null;
  const variasMarcas = (pago.marcas || []).length > 1;

  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
      <div className={s.pagina} data-componente="PaginaCheckout">
        <header className={s.cabeza}>
          <h1 className={s.titulo}>Finalizar compra</h1>
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
              cupones={onCupon && (paso === 0 || cupon) ? { aplicado: cupon, onAplicar: async (c) => setCupon(await onCupon(c)), onQuitar: paso === 0 ? () => setCupon(null) : undefined } : undefined}
              pie={(
                <>
                  {invitacion && <p className={s.invitacion}><Gift aria-hidden="true" /> Es tu primera compra con la invitación de {invitacion.nombre}: al recibirla, los dos ganan monedas.</p>}
                  {fuera && usd != null && <p className={s.nota}>Pagarás por PayPal: <strong>US$ {usd.toFixed(2)}</strong>. El cobro internacional es en dólares.</p>}
                </>
              )}
            />
          </aside>

          <div className={s.principal}>
            {paso === 0 ? (
              <form className={s.tarjeta} onSubmit={continuar} noValidate>
                <h2 className={s.subtitulo}>
                  {modo === 'tarjeta' || modo === 'lista' ? 'Enviar a' : form.id ? 'Editar dirección' : direcciones.length ? 'Nueva dirección' : 'Datos de envío'}
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
                    <Boton variante="contorno" tamano="sm" onClick={() => setModo('lista')}>Cambiar</Boton>
                  </div>
                )}

                {modo === 'lista' && (
                  <>
                    <ListaEleccion
                      etiqueta="Tus direcciones"
                      valor={elegida}
                      onElegir={(id) => { setElegida(id); setModo('tarjeta'); }}
                      opciones={direcciones.map((d) => ({
                        valor: d.id,
                        texto: `${d.nombre}${d.principal ? ' · Principal' : ''}`,
                        detalle: `${d.direccion}, ${d.distrito} · ${d.telefono}`,
                        icono: <MapPin aria-hidden="true" />,
                      }))}
                    />
                    <div className={s.filaBotones}>
                      <Boton variante="fantasma" tamano="sm" icono={<Plus aria-hidden="true" />} onClick={() => { setForm(nueva()); setModo('formulario'); }}>Agregar una dirección nueva</Boton>
                      <Boton variante="fantasma" tamano="sm" onClick={() => setModo('tarjeta')}>Cancelar</Boton>
                    </div>
                  </>
                )}

                {modo === 'formulario' && (
                  <>
                    {direcciones.length > 0 && (
                      <button type="button" className={s.volverLista} onClick={() => setModo('lista')}><ArrowLeft aria-hidden="true" /> Usar una dirección guardada</button>
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
                      etiqueta={sesion ? 'Guardar esta dirección en mi cuenta' : 'Recordar mis datos en este dispositivo'}
                      descripcion={sesion ? 'La verás la próxima vez y en «Mis direcciones».' : 'No lo marques si la computadora o el celular no es tuyo.'}
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
                    etiqueta="Es un regalo (gratis)"
                    descripcion="Quien lo recibe abre un mensaje tuyo con Kapi en su celular."
                  />
                  {entrega && (
                    <Aviso tipo="info" compacto icono={<CalendarHeart aria-hidden="true" />}>
                      Entrega programada para el {entrega.fecha}{entrega.ocasion ? ` · ${entrega.ocasion}` : ''}.{entrega.aviso ? ` ${entrega.aviso}` : ''}
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
                        <span className={s.rotulo}>Cómo te acompaña Kapi</span>
                        <ListaEleccion etiqueta="Sticker de Kapi" opciones={STICKERS} valor={regalo.sticker} onElegir={cambiarRegalo('sticker')} />
                      </div>
                    </div>
                  )}
                </div>

                {error && <Aviso tipo="error" compacto>{error}</Aviso>}

                {!sesion && (
                  <p className={s.entrar} role="note">
                    <strong>Para pagar necesitas tu cuenta.</strong> Así tu pedido queda en «Mis pedidos» y puedes usar tus monedas. Lo que ya llenaste se guarda.{' '}
                    <Enlace to={urlRegistro} onClick={() => onEntrar?.(urlRegistro, { direccion: form, correo, regalo })}>¿No tienes cuenta? Créala aquí</Enlace>
                  </p>
                )}
                <div className={s.botones}>
                  <Boton to={urlCarrito} variante="fantasma" icono={<ArrowLeft aria-hidden="true" />}>Volver al carrito</Boton>
                  {sesion ? (
                    <Boton type="submit" tamano="lg" cargando={ocupado === 'preparar'} iconoFin={<ArrowRight aria-hidden="true" />}>
                      {ocupado === 'preparar' ? 'Preparando tu pago…' : 'Continuar al pago'}
                    </Boton>
                  ) : (
                    <Boton to={urlLogin} tamano="lg" iconoFin={<ArrowRight aria-hidden="true" />} onClick={() => onEntrar?.(urlLogin, { direccion: form, correo, regalo })}>Inicia sesión para pagar</Boton>
                  )}
                </div>
              </form>
            ) : (
              <div className={s.tarjeta}>
                <div className={s.pagoCabeza}>
                  <span>
                    <small>Elige cómo pagar</small>
                    <strong className={s.monto}>{fuera && usd != null ? `US$ ${usd.toFixed(2)}` : soles(cuentas.total)}</strong>
                    <span className={s.pedido}>Pedido {pedido?.numero} · a nombre de {direccion?.nombre}</span>
                  </span>
                  <button type="button" className={s.volverLista} onClick={() => { setPaso(0); setError(''); }}><ArrowLeft aria-hidden="true" /> Cambiar el envío</button>
                </div>

                {fuera ? (
                  <>
                    <Aviso tipo="info" compacto icono={<Globe2 aria-hidden="true" />}>Envíos internacionales: la entrega demora de 7 a 30 días hábiles.</Aviso>
                    <MetodoPago destacado icono={<Globe2 aria-hidden="true" />} titulo="PayPal" texto="Con tu cuenta de PayPal o con tarjeta, en dólares.">
                      <PagoPaypal montoUsd={usd || 0} equivalente={`≈ ${soles(cuentas.total)}`} botones={pago.botonesPaypal} onPagar={() => pagar('paypal', pago.onPaypal, usd)} />
                    </MetodoPago>
                  </>
                ) : (
                  <MetodoPago destacado icono={<CreditCard aria-hidden="true" />} titulo="Tarjeta de crédito o débito" texto="Visa, Mastercard, American Express o Diners. Tu pedido queda confirmado al instante.">
                    {tarjetaFallo && (
                      <Aviso tipo="aviso" compacto titulo="No se completó el pago con tarjeta">Puedes intentarlo otra vez o pagar con Yape, Plin o transferencia por WhatsApp.</Aviso>
                    )}
                    <PagoTarjeta monto={cuentas.total} onPagar={() => { setError(''); return pagar('tarjeta', pago.onTarjeta, cuentas.total); }} />
                  </MetodoPago>
                )}

                <p className={s.separador}><span>o</span></p>

                <MetodoPago
                  icono={<MessageCircle aria-hidden="true" />}
                  titulo={fuera ? 'Coordinar por WhatsApp' : 'Yape, Plin o transferencia'}
                  texto={fuera ? 'Un asesor recibe tu pedido y te indica cómo pagar desde tu país.' : 'Te atendemos por WhatsApp: un asesor recibe tu pedido y te indica cómo pagar.'}
                >
                  {variasMarcas ? (
                    <>
                      <p className={s.nota}>Tu pedido tiene productos de varias marcas. Envía cada parte a su asesor:</p>
                      <div className={s.marcas}>
                        {pago.marcas.map((m) => (
                          <Boton
                            key={m.id}
                            variante={enviadas.includes(m.id) ? 'fantasma' : 'contorno'}
                            icono={<MessageCircle aria-hidden="true" />}
                            cargando={ocupado === `marca-${m.id}`}
                            onClick={async () => { setOcupado(`marca-${m.id}`); try { await pago.onWhatsApp?.(m.id); setEnviadas((x) => [...x, m.id]); } catch (err) { setError(err?.message || 'No pudimos crear tu pedido.'); } finally { setOcupado(null); } }}
                          >
                            {enviadas.includes(m.id) ? 'Enviado' : 'Enviar'} a {m.nombre} ({m.cantidad})
                          </Boton>
                        ))}
                      </div>
                      <Boton bloque disabled={!enviadas.length} onClick={() => { setPedido((p) => ({ ...p, metodo: 'marcas' })); setPaso(2); }}>Listo, ya envié mis pedidos</Boton>
                    </>
                  ) : (
                    <Boton bloque variante="secundario" tamano="lg" icono={<MessageCircle aria-hidden="true" />} cargando={ocupado === 'whatsapp'} onClick={() => pagar('whatsapp', pago.onWhatsApp)}>
                      {ocupado === 'whatsapp' ? 'Creando tu pedido…' : 'Continuar por WhatsApp'}
                    </Boton>
                  )}
                </MetodoPago>

                {error && <Aviso tipo="error" compacto>{error}</Aviso>}
                <p className={s.pie}>Tu pedido se registra solo cuando el pago se aprueba o cuando lo envías por WhatsApp.</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </BloqueSeccion>
  );
}
