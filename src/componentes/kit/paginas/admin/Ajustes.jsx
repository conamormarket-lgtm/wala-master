import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, CreditCard, Download, ExternalLink, MessageCircle, Phone, RefreshCw, RotateCcw, ShoppingBag, Store } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, EstadoVacio, useToast } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { Pestanas } from '../../Navegacion';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { InsigniaEstado } from '../../piezas/admin/Datos';
import { GrupoCampos, BarraGuardar } from '../../piezas/admin/Formularios';
import { PaginaListaAdmin } from './Lista';
import { numeroWhatsApp, haceCuanto } from '../../adaptadores';
import {
  telefonoEscrito, erroresDeWhatsApp, mensajePedidoDeEjemplo, resumenWhatsApp, dosNumerosWhatsApp, NOTA_SIN_ELEGIR, WHATSAPP_PEDIDOS_FABRICA,
  paginasDelHistorial, textoCambioStock, textoStock, csvInventario,
} from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Ajustes.module.css';
import { EsqueletoFormulario, EsqueletoTarjeta } from '../../Esqueletos';

/*
 * D8b · WhatsApp (/admin/whatsapp) y el historial (/admin/backups): a qué
 * número escribe el cliente según dónde esté (y a cuál llegan los pedidos),
 * y las copias del diseño de cada página (para volver a una) y los cambios
 * de stock (para descargarlos).
 */

const errorDe = (err) => err?.message || 'Vuelve a intentar.';
const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// El año solo si no es el de ahora.
const fechaHora = (ms) => {
  if (!ms) return '—';
  const otroAno = new Date(ms).getFullYear() !== new Date().getFullYear();
  return new Date(ms).toLocaleString('es-PE', { day: 'numeric', month: 'short', ...(otroAno && { year: 'numeric' }), hour: '2-digit', minute: '2-digit' });
};
/** +51987654321 → +51 987 654 321 (un celular peruano); los demás, tal cual. */
const legible = (n) => String(numeroWhatsApp(n) || '').replace(/^\+51(\d{3})(\d{3})(\d{3})$/, '+51 $1 $2 $3');
const enlaceDe = (numero) => {
  const n = numeroWhatsApp(numero);
  return n ? `https://wa.me/${n.replace(/\D/g, '')}` : '';
};

/* «Escriben a +51 … · Probar»: el número que queda, con su prueba. */
function Destino({ texto = 'Escriben a', numero, nota }) {
  if (!numero) return null;
  return (
    <p className={s.enlace}>
      <span>{texto} <strong>{legible(numero)}</strong>{nota ? ` (${nota})` : ''}</span>
      <Boton tamano="sm" variante="fantasma" iconoFin={<ExternalLink aria-hidden="true" />} to={enlaceDe(numero)}>Probar</Boton>
    </p>
  );
}

const OTROS_NUMEROS = [
  { clave: 'crear', etiqueta: 'Crear tiene su propio número', donde: 'Personalizar y el editor de diseños.' },
  { clave: 'cuenta', etiqueta: 'Mi cuenta tiene su propio número', donde: 'Mi cuenta, mis pedidos, el carrito y «¿Problemas para pagar?».' },
];

// WhatsApp pone en negrita lo que va entre asteriscos: la muestra también.
const conNegritas = (texto) => String(texto).split(/\*([^*\n]+)\*/g).map((parte, i) => (i % 2 ? <b key={i}>{parte}</b> : parte));

/**
 * WhatsApp (/admin/whatsapp): todos los números en un solo lugar (2026-11-05).
 *  - cargando · error · onReintentar
 *  - config: whatsappDesdeMensajes + asesores [{ id, nombre, numero }] (sin
 *    asesores, la lista de marcas no se edita aquí) · onGuardar(config) (el
 *    conector guarda los mensajes y los asesores que cambiaron)
 *  - marcas: [{ nombre, numero }] (solo si no llegan asesores) · urlMarcas
 *  - fabrica: el que recibe los pedidos si no se eligió otro
 *  - contactoPorDefecto: el teléfono del pie si no se pone otro
 */
export function PaginaWhatsAppAdmin({
  cargando = false, error, onReintentar, config, onGuardar,
  marcas = [], urlMarcas = '/admin/marcas', fabrica = WHATSAPP_PEDIDOS_FABRICA, contactoPorDefecto = '',
}) {
  const toast = useToast();
  const [c, setC] = useState(config);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  // Crear y Mi cuenta: con su número o con el de la tienda (vacío).
  const [propios, setPropios] = useState({});
  useEffect(() => {
    setC(config);
    setErrores({});
    setPropios({ crear: Boolean(config?.crear), cuenta: Boolean(config?.cuenta) });
  }, [config]);
  const cambiar = (campo, valor) => {
    setC((x) => ({ ...x, [campo]: valor }));
    setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };
  const guardar = async () => {
    const nuevos = erroresDeWhatsApp(c);
    const primero = Object.keys(nuevos).find((k) => nuevos[k]);
    if (primero) {
      setErrores(nuevos);
      document.getElementById(`wa-${primero}`)?.focus();
      return;
    }
    setGuardando(true);
    try {
      await onGuardar?.(c);
      toast({ tipo: 'exito', titulo: 'WhatsApp guardado', texto: 'Los pedidos y el botón usan estos números desde ahora.' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: errorDe(err) });
    } finally {
      setGuardando(false);
    }
  };
  const cabeza = { icono: 'whatsapp', tono: 'menta', titulo: 'WhatsApp y teléfonos', subtitulo: 'Todos los números en un solo lugar: los pedidos, el botón verde, los pagos, los asesores de cada marca y el teléfono de contacto.' };

  let cuerpo;
  if (error) {
    cuerpo = <Aviso tipo="error" titulo="No pudimos leer los números" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RefreshCw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}>{error}</Aviso>;
  } else if (cargando || !c) {
    cuerpo = <EsqueletoFormulario campos={5} />;
  } else {
    const conId = c.mensajePedido.includes('{id}');
    const asesores = Array.isArray(c.asesores) ? c.asesores : null;
    const marcasConNumero = asesores ? asesores.filter((a) => String(a.numero || '').trim()) : marcas;
    const resumen = resumenWhatsApp(c, marcasConNumero, fabrica, contactoPorDefecto);
    const cambiarAsesor = (id, numero) => {
      setC((x) => ({ ...x, asesores: x.asesores.map((a) => (a.id === id ? { ...a, numero } : a)) }));
      setErrores((e) => (e[`asesor-${id}`] ? { ...e, [`asesor-${id}`]: undefined } : e));
    };
    const muestraPagos = String(c.mensajePagos || '').replaceAll('{id}', 'WALA-01820').replaceAll('{monto}', '45.00');
    const nombresMarcas = resumen.marcas.map((m) => m.nombre).join(' y ');
    const dos = dosNumerosWhatsApp(c.pedidos, c.tienda, fabrica);
    cuerpo = (
      <div className={s.whatsapp}>
        <div className={s.columna}>
          {dos && (
            <div className={s.avisoVivo}>
            <Aviso tipo="info" titulo="Usas dos números de WhatsApp">
              {`Los pedidos llegan al ${legible(dos.pedidos)}${dos.sinElegir ? ' (el que viene puesto: aún no elegiste uno)' : ''} y el botón verde de la tienda lleva al ${legible(dos.boton)}. Si quieres uno solo, escribe el mismo número en «Número que recibe los pedidos» y en «Número del botón».`}
            </Aviso>
            </div>
          )}
          <GrupoCampos icono={<ShoppingBag />} titulo="Los pedidos" ayuda="Al terminar de comprar, el cliente te manda por WhatsApp el mensaje de abajo para confirmar su pedido.">
            <Campo
              id="wa-pedidos"
              etiqueta="Número que recibe los pedidos"
              inputMode="tel"
              autoComplete="off"
              placeholder={legible(fabrica)}
              ayuda={`Vacío: ${legible(fabrica)}, el que viene puesto. Sin +, se le pone el +51 del Perú.`}
              value={c.pedidos}
              error={errores.pedidos}
              onChange={(e) => cambiar('pedidos', telefonoEscrito(e.target.value))}
            />
            <Destino texto="Llegan a" numero={c.pedidos || fabrica} nota={c.pedidos ? '' : NOTA_SIN_ELEGIR} />
            <Interruptor
              etiqueta="Cada marca a su asesor"
              descripcion={c.multimarca
                ? `Los productos de ${nombresMarcas || 'las marcas con asesor'} van al WhatsApp de su marca; lo demás, a este número.`
                : 'Apagado: todo llega a este número, también lo de las marcas con asesor.'}
              activo={c.multimarca}
              onChange={(v) => cambiar('multimarca', v)}
            />
            <div className={s.otro}>
              <Campo
                etiqueta="Mensaje al confirmar un pedido"
                multilinea={4}
                ayuda="{id} se cambia por el código del pedido."
                value={c.mensajePedido}
                onChange={(e) => cambiar('mensajePedido', e.target.value)}
              />
              <div className={s.burbuja} aria-label="Así llega el mensaje">
                <span className={s.etiqueta}>Así te llega</span>
                <p>{mensajePedidoDeEjemplo(c.mensajePedido)}</p>
              </div>
              {!conId && <Aviso tipo="aviso" compacto titulo="Sin {id}, el mensaje no dice qué pedido es." />}
            </div>
          </GrupoCampos>

          <GrupoCampos icono={<MessageCircle />} tono="menta" titulo="El botón de WhatsApp" ayuda="El botón verde de la esquina, para que te pregunten antes de comprar.">
            <Campo
              id="wa-tienda"
              etiqueta="Número del botón"
              inputMode="tel"
              autoComplete="off"
              placeholder="+51 987 654 321"
              ayuda="La tienda, las fichas y todo lo que no tenga otro. Sin +, se le pone el +51."
              value={c.tienda}
              error={errores.tienda}
              onChange={(e) => cambiar('tienda', telefonoEscrito(e.target.value))}
            />
            <Destino numero={c.tienda} />
            {OTROS_NUMEROS.map((x) => (
              <div key={x.clave} className={s.otro}>
                <Interruptor
                  etiqueta={x.etiqueta}
                  descripcion={propios[x.clave] ? x.donde : `${x.donde} Apagado: usa el del botón.`}
                  activo={Boolean(propios[x.clave])}
                  onChange={(v) => {
                    setPropios((p) => ({ ...p, [x.clave]: v }));
                    if (!v) cambiar(x.clave, '');
                    else setTimeout(() => document.getElementById(`wa-${x.clave}`)?.focus(), 0);
                  }}
                />
                {propios[x.clave] && (
                  <>
                    <Campo
                      id={`wa-${x.clave}`}
                      etiqueta="Número"
                      inputMode="tel"
                      autoComplete="off"
                      placeholder="+51 987 654 321"
                      ayuda="Vacío: usa el del botón."
                      value={c[x.clave]}
                      error={errores[x.clave]}
                      onChange={(e) => cambiar(x.clave, telefonoEscrito(e.target.value))}
                    />
                    <Destino numero={c[x.clave]} />
                  </>
                )}
              </div>
            ))}
            <div className={s.otro}>
              <Interruptor
                etiqueta="Mostrarlo al iniciar sesión y en el registro"
                descripcion={c.enAcceso ? 'Sale en iniciar sesión, registro y recuperar contraseña.' : 'Esas pantallas van sin el botón, para no distraer de entrar.'}
                activo={c.enAcceso}
                onChange={(v) => cambiar('enAcceso', v)}
              />
            </div>
          </GrupoCampos>

          <GrupoCampos icono={<CreditCard />} tono="oro" titulo="Los pagos" ayuda="Lo que ve quien paga el saldo de un pedido (y quien abre un enlace de pago que ya venció).">
            <Campo
              id="wa-pagos"
              etiqueta="WhatsApp de pagos"
              inputMode="tel"
              autoComplete="off"
              placeholder={c.cuenta || c.tienda ? `Vacío: ${legible(c.cuenta || c.tienda)}` : '+51 987 654 321'}
              ayuda="«Enviar comprobante», «¿Problemas para pagar?» y un enlace de pago vencido. Vacío: el de Mi cuenta."
              value={c.pagos}
              error={errores.pagos}
              onChange={(e) => cambiar('pagos', telefonoEscrito(e.target.value))}
            />
            <Destino numero={c.pagos || c.cuenta || c.tienda} nota={c.pagos ? '' : 'el de Mi cuenta'} />
            <div className={s.otro}>
              <Campo
                etiqueta="Mensaje al mandar el comprobante"
                multilinea={3}
                ayuda="{id} es el pedido y {monto}, el saldo."
                value={c.mensajePagos}
                onChange={(e) => cambiar('mensajePagos', e.target.value)}
              />
              {muestraPagos && (
                <div className={s.burbuja} aria-label="Así llega el mensaje">
                  <span className={s.etiqueta}>Así te llega</span>
                  <p>{conNegritas(muestraPagos)}</p>
                </div>
              )}
            </div>
            <div className={s.otro}>
              <div className={s.dosCampos}>
                <Campo id="wa-yapeNumero" etiqueta="Yape: número" inputMode="tel" autoComplete="off" placeholder="Ej. 987 654 321" value={c.yapeNumero} error={errores.yapeNumero} onChange={(e) => cambiar('yapeNumero', telefonoEscrito(e.target.value))} />
                <Campo etiqueta="Yape: titular" placeholder="Ej. Juan Pérez" ayuda="Recomendado: el cliente lo ve al pagar." value={c.yapeTitular} onChange={(e) => cambiar('yapeTitular', e.target.value)} />
                <Campo id="wa-plinNumero" etiqueta="Plin: número" inputMode="tel" autoComplete="off" placeholder="Vacío si no usas Plin" value={c.plinNumero} error={errores.plinNumero} onChange={(e) => cambiar('plinNumero', telefonoEscrito(e.target.value))} />
                <Campo etiqueta="Plin: titular" placeholder="Ej. Juan Pérez" value={c.plinTitular} onChange={(e) => cambiar('plinTitular', e.target.value)} />
              </div>
              <p className={s.nota}>Con al menos un número, la hoja de pagar el saldo muestra «Yape o Plin a mano» con «Copiar». Ese pago lo revisa cobranza (no se registra solo).</p>
            </div>
          </GrupoCampos>

          {asesores && (
            <GrupoCampos icono={<Store />} tono="rosa" titulo="Los asesores de cada marca" ayuda="El botón en la página y las fichas de esa marca, «Consultar a la marca» en Mis pedidos y, con «Cada marca a su asesor», sus pedidos. Vacío: los números de arriba.">
              {asesores.length ? (
                <div className={s.dosCampos}>
                  {asesores.map((a) => (
                    <Campo
                      key={a.id}
                      id={`wa-asesor-${a.id}`}
                      etiqueta={a.nombre}
                      inputMode="tel"
                      autoComplete="off"
                      placeholder="Vacío: el general"
                      value={a.numero}
                      error={errores[`asesor-${a.id}`]}
                      onChange={(e) => cambiarAsesor(a.id, telefonoEscrito(e.target.value))}
                    />
                  ))}
                </div>
              ) : <p className={s.nota}>Todavía no hay marcas.</p>}
              <p className={s.nota}>También se cambia en <Boton tamano="sm" variante="fantasma" to={urlMarcas}>Marcas</Boton></p>
            </GrupoCampos>
          )}

          <GrupoCampos icono={<Phone />} tono="plata" titulo="El teléfono de contacto" ayuda="El «Tel.» del pie de la tienda, junto al correo y la dirección.">
            <Campo
              id="wa-contacto"
              etiqueta="Teléfono"
              inputMode="tel"
              autoComplete="off"
              placeholder={contactoPorDefecto ? `Vacío: ${contactoPorDefecto}` : '+51 987 654 321'}
              ayuda={contactoPorDefecto ? `Vacío: ${contactoPorDefecto}, el que viene puesto.` : 'Vacío: sin teléfono.'}
              value={c.contacto}
              error={errores.contacto}
              onChange={(e) => cambiar('contacto', telefonoEscrito(e.target.value))}
            />
          </GrupoCampos>
        </div>

        <aside className={s.resumen} aria-label="Así queda">
          <h2 className={s.resumenTitulo}>Así queda</h2>
          {[
            { id: 'pedidos', titulo: 'Pedidos', filas: resumen.filas.filter((f) => f.id === 'pedidos') },
            { id: 'boton', titulo: 'Botón verde', filas: resumen.filas.filter((f) => f.id !== 'pedidos') },
            { id: 'pagos', titulo: 'Pagos', filas: resumen.pagos },
            { id: 'contacto', titulo: 'Contacto', filas: [resumen.contacto] },
          ].map((parte) => (
            <div key={parte.id} className={s.resumenParte}>
              <span className={s.resumenSubtitulo}>{parte.titulo}</span>
              <ul className={s.resumenLista}>
                {parte.filas.map((f) => (
                  <li key={f.id}>
                    <span className={s.resumenDonde}>{f.donde}</span>
                    <span className={f.numero ? s.resumenNumero : s.resumenSin}>{f.numero ? legible(f.numero) : parte.id === 'boton' ? 'Sin botón' : 'No se muestra'}</span>
                    {f.numero && f.nota && <span className={s.resumenNota}>{f.nota}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {resumen.marcas.length > 0 && (
            <div className={s.resumenParte}>
              <span className={s.resumenSubtitulo}>Marcas con su número</span>
              <ul className={s.resumenLista}>
                {resumen.marcas.map((m) => (
                  <li key={m.nombre}>
                    <span className={s.resumenDonde}>{m.nombre}</span>
                    <span className={s.resumenNumero}>{legible(m.numero)}</span>
                  </li>
                ))}
              </ul>
              <p className={s.nota}>
                En su página y sus fichas, el botón usa el de la marca{c.multimarca ? '; sus pedidos también' : ''}.
                {!asesores && <>{' '}Se cambia en <Boton tamano="sm" variante="fantasma" to={urlMarcas}>Marcas</Boton></>}
              </p>
            </div>
          )}
          <p className={s.nota}>Un producto con su propio número (en su ficha) manda sobre todos.</p>
        </aside>

        <BarraGuardar
          visible={!mismo(c, config)}
          texto="Cambiaste el WhatsApp."
          onDescartar={() => { setC(config); setErrores({}); setPropios({ crear: Boolean(config.crear), cuenta: Boolean(config.cuenta) }); }}
          onGuardar={guardar}
          guardando={guardando}
        />
      </div>
    );
  }

  return (
    <div className={s.pagina} data-componente="PaginaWhatsAppAdmin">
      <CabezaAdmin {...cabeza} />
      {cuerpo}
    </div>
  );
}

const PESTANAS_HISTORIAL = [{ id: 'diseno', texto: 'Diseño de la tienda' }, { id: 'inventario', texto: 'Inventario' }];
const ESTADOS_VERSION = { actual: { texto: 'Puesta ahora', tono: 'exito' } };
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Baja un texto como archivo (con BOM: Excel lee bien las tildes). */
function descargar(texto, nombre) {
  const url = URL.createObjectURL(new Blob([`﻿${texto}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Una copia: cuándo, si se guardó o se restauró, quién (si se anotó) y volver a ella. */
function FilaCopia({ copia, puesta = false, onRestaurar }) {
  return (
    <li className={s.copia}>
      <span className={s.copiaTexto}>
        <strong>{fechaHora(copia.cuando)}</strong>
        <span className={l.sub}>
          {haceCuanto(copia.cuando, copia.restaurada ? 'Restaurada' : 'Guardada', { fino: true })}
          {copia.quien ? ` · ${copia.quien}` : ''}
        </span>
      </span>
      {puesta
        ? <InsigniaEstado estado="actual" estados={ESTADOS_VERSION} />
        : <Boton tamano="sm" variante="secundario" icono={<RotateCcw aria-hidden="true" />} disabled={!copia.config} onClick={() => onRestaurar(copia)}>Volver a esta</Boton>}
    </li>
  );
}

/* Una página con su copia puesta y las anteriores (plegadas). */
function TarjetaPaginaGuardada({ grupo, origen, onRestaurar }) {
  const [abierta, setAbierta] = useState(false);
  const n = grupo.anteriores.length;
  return (
    <article className={s.paginaGuardada}>
      <header className={s.paginaCabeza}>
        <span className={s.paginaNombre}>
          <h3>{grupo.nombre}</h3>
          <span className={l.sub}>{grupo.ruta || 'En todas las páginas'}</span>
        </span>
        {grupo.ruta && <Boton tamano="sm" variante="fantasma" iconoFin={<ExternalLink aria-hidden="true" />} to={`${origen}${grupo.ruta}`}>Ver la página</Boton>}
      </header>
      <ol className={s.copias}>
        <FilaCopia copia={grupo.puesta} puesta />
        {abierta && grupo.anteriores.map((x) => <FilaCopia key={x.id} copia={x} onRestaurar={onRestaurar} />)}
      </ol>
      {n > 0 ? (
        <Boton
          tamano="sm"
          variante="fantasma"
          className={s.verAnteriores}
          iconoFin={<ChevronDown aria-hidden="true" className={abierta ? s.girado : undefined} />}
          aria-expanded={abierta}
          onClick={() => setAbierta((a) => !a)}
        >
          {abierta ? 'Ocultar las anteriores' : `Ver ${plural(n, 'copia anterior', 'copias anteriores')}`}
        </Boton>
      ) : (
        <p className={s.nota}>Sin copias anteriores todavía: la próxima vez que se guarde, esta queda aquí para volver.</p>
      )}
    </article>
  );
}

/**
 * Historial: el del diseño (/admin/backups, en Páginas de la tienda) y el de
 * stock (/admin/historial-stock, desde Productos). Con `conPestanas` (la demo)
 * van juntos con sus pestañas; sin ellas, cada uno con su título.
 *  - pestana + onPestana · conPestanas
 *  - cambios: conVersionActual([cambioDisenoDesde]) · nombresPaginas: { id: nombre } (marcas y landings)
 *    · cargando · error · onReintentar · onRestaurar(cambio)
 *  - movimientos: [movimientoInventarioDesde] · cargandoMovimientos · errorMovimientos · onReintentarMovimientos
 */
export function PaginaHistorialAdmin({
  pestana: pestanaFuera, onPestana, conPestanas = true,
  cambios = [], nombresPaginas = {}, cargando = false, error, onReintentar, onRestaurar,
  movimientos = [], cargandoMovimientos = false, errorMovimientos, onReintentarMovimientos,
}) {
  const toast = useToast();
  const [pestanaDentro, setPestanaDentro] = useState('diseno');
  const pestana = pestanaFuera || pestanaDentro;
  const ir = (p) => (onPestana ? onPestana(p) : setPestanaDentro(p));
  const [restaurar, setRestaurar] = useState(null);
  const cabeza = !conPestanas && pestana === 'inventario'
    ? { icono: 'historial', tono: 'plata', titulo: 'Historial de stock', subtitulo: 'Los cambios de stock, para revisarlos o descargarlos.' }
    : !conPestanas
      ? { icono: 'historial', tono: 'plata', titulo: 'Historial del diseño', subtitulo: 'Vuelve a una versión anterior de una página.' }
      : { icono: 'historial', tono: 'plata', titulo: 'Historial', subtitulo: 'Vuelve a una versión anterior de una página o revisa los cambios de stock.' };
  const secciones = conPestanas ? <div className={s.pestanas}><Pestanas etiqueta="Partes del historial" opciones={PESTANAS_HISTORIAL} valor={pestana} onChange={ir} /></div> : null;
  const grupos = useMemo(() => paginasDelHistorial(cambios, nombresPaginas), [cambios, nombresPaginas]);
  const nombreDe = (pagina) => grupos.find((g) => g.pagina === pagina)?.nombre || pagina;
  const origen = typeof window !== 'undefined' ? window.location.origin : '';

  const confirmarRestaurar = async () => {
    const x = restaurar;
    try {
      await onRestaurar?.(x);
      toast({ tipo: 'exito', titulo: 'Versión restaurada', texto: `${nombreDe(x.pagina)} tiene puesta la copia del ${fechaHora(x.cuando)}` });
      setRestaurar(null);
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo restaurar', texto: errorDe(err) });
    }
  };

  if (pestana === 'inventario') {
    return (
      <PaginaListaAdmin
        cabeza={cabeza}
        antes={(
          <>
            {secciones}
            <div className={s.fila}>
              <p className={s.nota}>Cada cambio de stock hecho en Productos (en la lista o en la ficha), con quién lo hizo.</p>
              <Boton tamano="sm" variante="secundario" icono={<Download aria-hidden="true" />} disabled={!movimientos.length} onClick={() => descargar(csvInventario(movimientos), `inventario_${new Date().toISOString().slice(0, 10)}.csv`)}>Descargar CSV</Boton>
            </div>
          </>
        )}
        registros={movimientos}
        cargando={cargandoMovimientos}
        error={errorMovimientos}
        onReintentar={onReintentarMovimientos}
        nombreDe={(m) => m.producto}
        unidad={['cambio', 'cambios']}
        buscarEn={(m) => `${m.producto} ${m.quien}`}
        placeholder="Buscar por producto o persona"
        filtros={[{ id: 'tipo', etiqueta: 'Cambio', todos: 'Subió o bajó', opciones: [{ valor: 'sube', texto: 'Subió' }, { valor: 'baja', texto: 'Bajó' }], filtrar: (m, v) => (v === 'sube' ? m.cambio > 0 : m.cambio < 0) }]}
        columnas={[
          { id: 'producto', titulo: 'Producto', tarjeta: 'titulo', celda: (m) => <>{m.producto}<span className={l.sub}>{m.quien}</span></> },
          { id: 'cuando', titulo: 'Cuándo', ancho: 190, tarjeta: 'detalle', ordenable: true, celda: (m) => fechaHora(m.cuando) },
          { id: 'stock', titulo: 'Stock', ancho: 110, alinear: 'fin', tarjeta: 'detalle', celda: (m) => <span className={l.numero}>{textoStock(m.antes)} → {textoStock(m.despues)}</span> },
          { id: 'cambio', titulo: 'Cambio', ancho: 120, tarjeta: 'estado', celda: (m) => (
            m.antes === null || m.despues === null
              ? <span className={s.igual}>{m.antes === null ? 'Le puso límite' : 'Le quitó el límite'}</span>
              : <span className={m.cambio > 0 ? s.sube : m.cambio < 0 ? s.baja : s.igual}>{m.cambio > 0 ? 'Subió' : m.cambio < 0 ? 'Bajó' : 'Igual'} {textoCambioStock(m.cambio)}</span>
          ) },
        ]}
        ordenes={{ cuando: (a, b) => a.cuando - b.cuando }}
        ordenInicial={{ por: 'cuando', dir: 'desc' }}
        vacio={{ titulo: 'Todavía no hay cambios de stock', texto: 'Aparecen aquí cuando alguien cambia el stock en Productos.' }}
      />
    );
  }

  let cuerpo;
  if (error) {
    cuerpo = <Aviso tipo="error" titulo="No pudimos leer las copias" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RefreshCw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}>{error}</Aviso>;
  } else if (cargando) {
    cuerpo = <div className={s.paginasGuardadas}>{[0, 1, 2, 3].map((i) => <EsqueletoTarjeta key={i} lineas={2} />)}</div>;
  } else if (!grupos.length) {
    cuerpo = <EstadoVacio titulo="Todavía no hay copias" texto="Aparecen aquí cuando alguien guarda una página en el editor de la tienda." />;
  } else {
    cuerpo = (
      <div className={s.paginasGuardadas}>
        {grupos.map((g) => <TarjetaPaginaGuardada key={g.id} grupo={g} origen={origen} onRestaurar={setRestaurar} />)}
      </div>
    );
  }

  return (
    <div className={s.pagina} data-componente="PaginaHistorialAdmin">
      <CabezaAdmin {...cabeza} />
      {secciones}
      <p className={s.nota}>
        Cada vez que alguien guarda una página en el editor, queda una copia. Si algo salió mal, vuelve a una anterior:
        la de ahora no se pierde, queda en la lista. Se guardan las 50 copias más nuevas de toda la tienda
        {grupos.length ? ` (${plural(grupos.length, 'página', 'páginas')})` : ''}.
      </p>
      {cuerpo}
      <Confirmar
        abierta={Boolean(restaurar)}
        titulo={restaurar ? `¿Volver a la copia de «${nombreDe(restaurar.pagina)}» del ${fechaHora(restaurar.cuando)}?` : ''}
        texto="Se pone esa copia en lugar de la de ahora. La de ahora queda en el historial: puedes volver a ella. También vuelven el menú, la ventana de la cuenta y el buscador de esa copia (son de toda la tienda)."
        confirmar="Volver a esta"
        onConfirmar={confirmarRestaurar}
        onCancelar={() => setRestaurar(null)}
      />
    </div>
  );
}
