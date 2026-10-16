import React, { useRef, useState } from 'react';
import { ShieldCheck, FileText, BookOpen, Send, ArrowRight, Package, Sparkles, MessageSquareWarning, Frown, RotateCcw, Store, CheckCircle2 } from 'lucide-react';
import Boton from '../Boton';
import { Aviso } from '../Feedback';
import { Campo, Casilla } from '../Formulario';
import { Enlace } from '../Enlace';
import { Trazo, Sello, Puntos, Destello } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { TarjetaAyuda } from '../piezas/TarjetaAyuda';
import { PasoEstudio } from '../piezas/Estudio';
import { ListaEleccion } from '../piezas/Cuenta';
import { CamposDatosPersonales, validarPerfil } from '../piezas/DatosPersonales';
import { CabezaLegal, IndiceLegal, SeccionLegal, DatosProveedor, CodigoCopiable, PasosAtencion, AvanceHoja } from '../piezas/Legales';
import s from './Legales.module.css';

/*
 * Las páginas legales: la política de privacidad (/politicas-privacidad),
 * los términos y condiciones (/terminos-y-condiciones) y el libro de
 * reclamaciones (/libro-de-reclamaciones, obligatorio en Perú).
 */

const ICONOS = { privacidad: <ShieldCheck aria-hidden="true" />, terminos: <FileText aria-hidden="true" /> };

/* ── Privacidad y términos ──────────────────────────────── */

/**
 * Un documento legal: la cabeza con la fecha, el índice (fijo al costado en
 * escritorio, plegado en el celular) y las secciones numeradas. La sección
 * de contacto termina con la tarjeta de ayuda (Kapi, el correo y WhatsApp).
 *  - tipo: 'privacidad' | 'terminos' (el ícono)
 *  - documento: { titulo, actualizado, secciones: [{ id, titulo, parrafos,
 *    lista: [{ etiqueta, texto }], destacado, contacto }] }
 *  - empresa: { email } · urlWhatsApp
 *  - otro: { pregunta, texto, url } el otro documento ("¿Buscabas cómo
 *    tratamos tus datos?")
 *  - estado: 'cargando'
 */
export function PaginaLegal({ tipo = 'privacidad', documento = {}, empresa = {}, urlWhatsApp, otro, estado }) {
  if (estado === 'cargando') return <EsqueletoPagina forma="legal" />;
  const secciones = documento.secciones || [];
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '2.5rem' }}>
      <div className={s.documento} data-componente="PaginaLegal">
        <CabezaLegal icono={ICONOS[tipo]} titulo={documento.titulo} detalle={documento.actualizado && `Última actualización: ${documento.actualizado}`} />
        <div className={s.cuerpo}>
          <aside className={s.lado}>
            <IndiceLegal secciones={secciones} />
          </aside>
          <article className={s.hoja}>
            {secciones.map((sec, k) => (
              <SeccionLegal key={sec.id} numero={k + 1} {...sec}>
                {sec.contacto && (
                  <div className={s.contacto}>
                    <TarjetaAyuda
                      titulo="¿Te quedó una duda?"
                      texto={empresa.email ? `Escríbenos a ${empresa.email} o por WhatsApp: te responde el equipo de Walá.` : 'Escríbenos por WhatsApp: te responde el equipo de Walá.'}
                      accion={urlWhatsApp ? { texto: 'Escribir por WhatsApp', url: urlWhatsApp } : undefined}
                    />
                  </div>
                )}
              </SeccionLegal>
            ))}
          </article>
        </div>
        {otro?.url && (
          <nav className={s.otro} aria-label="Otros documentos">
            <span>{otro.pregunta}</span>
            <Boton to={otro.url} variante="secundario" iconoFin={<ArrowRight aria-hidden="true" />}>{otro.texto}</Boton>
          </nav>
        )}
      </div>
    </BloqueSeccion>
  );
}

/* ── Libro de reclamaciones ─────────────────────────────── */

const VACIA = {
  nombre: '', tipoDocumento: 'DNI', documento: '', telefono: '', domicilio: '', email: '',
  esMenor: false, apoderado: '', tipoBien: 'producto', monto: '', descripcion: '',
  tipoReclamo: 'reclamo', detalle: '', pedido: '', acepta: false,
};

const BIENES = [
  { valor: 'producto', texto: 'Producto', detalle: 'Algo que compraste', icono: <Package aria-hidden="true" /> },
  { valor: 'servicio', texto: 'Servicio', detalle: 'Diseño, envío, atención', icono: <Sparkles aria-hidden="true" /> },
];

const TIPOS_RECLAMO = [
  { valor: 'reclamo', texto: 'Reclamo', detalle: 'Disconformidad con el producto o servicio recibido.', icono: <MessageSquareWarning aria-hidden="true" /> },
  { valor: 'queja', texto: 'Queja', detalle: 'Malestar respecto a la atención al cliente.', icono: <Frown aria-hidden="true" /> },
];

/** El orden de los campos en la hoja: el primero con error recibe el foco. */
const ORDEN = ['nombre', 'documento', 'telefono', 'domicilio', 'email', 'apoderado', 'descripcion', 'detalle', 'pedido', 'acepta'];

/** Los campos de cada paso: el paso queda hecho (sello menta) cuando ninguno tiene error. */
const CAMPOS_DE_PASO = [
  ['nombre', 'documento', 'telefono', 'domicilio', 'email', 'apoderado'],
  ['monto', 'descripcion'],
  ['detalle', 'pedido'],
];
const TITULOS_DE_PASO = ['Tus datos', 'Lo que compraste', 'Tu reclamo'];

/**
 * Las reglas de la hoja. Los datos de la persona son los de Mi perfil
 * (validarPerfil: DNI de 8, celular de 9 que empieza con 9…); el resto, los
 * de la tienda. Devuelve { campo: mensaje } (vacío si todo está bien).
 */
export function validarReclamacion(d = {}) {
  const e = validarPerfil({ ...d, pais: 'PE' });
  if (!String(d.domicilio || '').trim()) e.domicilio = 'Escribe tu domicilio.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email || '').trim())) e.email = 'Escribe un correo válido: ahí te respondemos.';
  if (d.esMenor && !String(d.apoderado || '').trim()) e.apoderado = 'Escribe el nombre del padre, madre o apoderado.';
  if (d.monto !== '' && d.monto != null && !(Number(d.monto) >= 0)) e.monto = 'Escribe el monto en soles (por ejemplo, 89.90).';
  if (!String(d.descripcion || '').trim()) e.descripcion = 'Cuéntanos qué compraste o qué servicio recibiste.';
  if (!String(d.detalle || '').trim()) e.detalle = 'Cuéntanos qué pasó.';
  if (!String(d.pedido || '').trim()) e.pedido = 'Dinos qué solución esperas.';
  if (!d.acepta) e.acepta = 'Marca la casilla para enviar la reclamación.';
  return e;
}

/**
 * La hoja de reclamación virtual (Código de Protección y Defensa del
 * Consumidor, Ley N° 29571). Pública: no pide cuenta. Con sesión llega con
 * los datos de la persona ya puestos (`inicial`).
 *  - empresa: { razonSocial, ruc, domicilioFiscal, plazoRespuestaDiasHabiles }
 *  - inicial: { nombre, tipoDocumento, documento, telefono, email, domicilio }
 *  - onEnviar(datos): promesa → { codigo, fecha } (la hoja ya guardada); si
 *    falla, lanza un Error con el mensaje
 *  - hoy: la fecha en palabras ("15 de octubre de 2026")
 *  - urlPrivacidad, urlTienda
 */
export function PaginaReclamaciones({ empresa = {}, inicial = {}, onEnviar, hoy, urlPrivacidad = '/politicas-privacidad', urlTienda = '/', estado }) {
  const [datos, setDatos] = useState(() => ({ ...VACIA, ...inicial }));
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');
  const [registrada, setRegistrada] = useState(null);
  const cabeza = useRef(null);
  const plazo = empresa.plazoRespuestaDiasHabiles || 15;

  if (estado === 'cargando') return <EsqueletoPagina forma="reclamaciones" />;

  // Cada paso se marca solo al completarse (la misma regla que al enviar, sin mostrar errores).
  const pendientes = validarReclamacion(datos);
  const hechos = CAMPOS_DE_PASO.map((campos) => campos.every((c) => !pendientes[c]));
  const bien = BIENES.find((b) => b.valor === datos.tipoBien);
  const tipo = TIPOS_RECLAMO.find((t) => t.valor === datos.tipoReclamo);
  const esQueja = datos.tipoReclamo === 'queja';

  const cambiar = (campo, valor) => {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((x) => (x[campo] ? { ...x, [campo]: undefined } : x));
  };
  const campo = (nombre) => ({
    id: `reclamo-${nombre}`,
    value: datos[nombre],
    error: errores[nombre],
    onChange: (e) => cambiar(nombre, e.target.value),
    disabled: enviando,
  });

  const enviar = async (e) => {
    e.preventDefault();
    const encontrados = validarReclamacion(datos);
    setErrores(encontrados);
    const primero = ORDEN.find((c) => encontrados[c]);
    if (primero) {
      document.getElementById(`reclamo-${primero}`)?.focus();
      return;
    }
    setEnviando(true);
    setErrorEnvio('');
    try {
      const r = await onEnviar?.({ ...datos, email: datos.email.trim().toLowerCase(), monto: datos.monto === '' ? null : Number(datos.monto) });
      setRegistrada({ ...r, email: datos.email.trim().toLowerCase() });
      cabeza.current?.scrollIntoView({ block: 'start' });
    } catch (err) {
      setErrorEnvio(err?.message || 'No pudimos registrar tu reclamación. Inténtalo otra vez.');
    } finally {
      setEnviando(false);
    }
  };

  if (registrada) {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <div ref={cabeza} className={s.listo} data-componente="ReclamacionRegistrada">
          {/* Un sello y no Kapi: Kapi ya asoma por el pie de la página. */}
          <Sello tamano={72} girar={-8}><CheckCircle2 aria-hidden="true" className={s.listoIcono} /></Sello>
          <h1 className={s.listoTitulo}>¡Reclamación registrada!<Trazo className={s.listoTrazo} /></h1>
          <p>Tu hoja de reclamación quedó guardada. Guarda este código para cualquier consulta.</p>
          <CodigoCopiable codigo={registrada.codigo} rotulo="Tu código de seguimiento" fecha={`Registrada el ${registrada.fecha || hoy}`} />
          <p>
            Te responderemos al correo <strong>{registrada.email}</strong> en un plazo máximo de <strong>{plazo} días hábiles</strong>,
            conforme al Código de Protección y Defensa del Consumidor.
          </p>
          <div className={s.listoBotones}>
            <Boton variante="secundario" icono={<RotateCcw aria-hidden="true" />} onClick={() => { setDatos({ ...VACIA, ...inicial }); setRegistrada(null); }}>Registrar otra reclamación</Boton>
            <Boton to={urlTienda} variante="fantasma" icono={<Store aria-hidden="true" />}>Volver a la tienda</Boton>
          </div>
        </div>
      </BloqueSeccion>
    );
  }

  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '2.5rem' }}>
      <form ref={cabeza} className={s.libro} onSubmit={enviar} noValidate data-componente="PaginaReclamaciones">
        <span className={s.adornos} aria-hidden="true">
          <Puntos className={s.puntos} />
          <Destello className={s.destello1} />
          <Destello className={s.destello2} />
        </span>
        <CabezaLegal icono={<BookOpen aria-hidden="true" />} titulo="Libro de Reclamaciones" detalle="Conforme al Código de Protección y Defensa del Consumidor (Ley N° 29571) – INDECOPI" />
        <p className={s.intro}>
          Si algo no salió como esperabas, déjalo por escrito aquí. Lo revisa una persona del equipo de Walá.
        </p>
        <PasosAtencion plazo={plazo} />
        <DatosProveedor empresa={empresa} fecha={hoy} />

        <div className={s.pasos}>
          <PasoEstudio numero={1} titulo={TITULOS_DE_PASO[0]} hecho={hechos[0]}>
            <div className={s.rejilla}>
              <div className={s.ancho}>
                <CamposDatosPersonales
                  datos={{ ...datos, pais: 'PE' }}
                  onCambiar={cambiar}
                  errores={errores}
                  cumpleanos={false}
                  disabled={enviando}
                  ids={{ nombre: 'reclamo-nombre', documento: 'reclamo-documento', telefono: 'reclamo-telefono' }}
                />
              </div>
              <div className={s.ancho}><Campo etiqueta="Domicilio" autoComplete="street-address" placeholder="Calle, número, distrito y ciudad" {...campo('domicilio')} /></div>
              <div className={s.ancho}><Campo etiqueta="Correo electrónico" type="email" autoComplete="email" inputMode="email" placeholder="tu@correo.com" ayuda="Aquí te llega la respuesta." {...campo('email')} /></div>
              <div className={s.ancho}>
                <Casilla activo={datos.esMenor} onChange={(v) => cambiar('esMenor', v)} disabled={enviando} etiqueta="La persona que reclama es menor de edad" />
              </div>
              {datos.esMenor && (
                <div className={s.ancho}><Campo etiqueta="Nombre del padre, madre o apoderado" autoComplete="name" {...campo('apoderado')} /></div>
              )}
            </div>
          </PasoEstudio>

          <PasoEstudio numero={2} titulo={TITULOS_DE_PASO[1]} detalle={hechos[1] ? bien?.texto : undefined} hecho={hechos[1]}>
            <div className={s.eleccion}>
              <ListaEleccion opciones={BIENES} valor={datos.tipoBien} onElegir={(v) => cambiar('tipoBien', v)} etiqueta="Tipo de bien contratado" />
            </div>
            <div className={s.rejilla}>
              <Campo
                etiqueta="Monto reclamado (opcional)"
                icono={<span className={s.soles}>S/</span>}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                {...campo('monto')}
              />
              <div className={s.ancho}>
                <Campo etiqueta="¿Qué compraste?" multilinea maxLength={600} placeholder="Ej. Polo personalizado talla M, pedido PD-20481" {...campo('descripcion')} />
              </div>
            </div>
          </PasoEstudio>

          <PasoEstudio numero={3} titulo={TITULOS_DE_PASO[2]} detalle={hechos[2] ? tipo?.texto : undefined} hecho={hechos[2]}>
            <div className={s.eleccion}>
              <ListaEleccion opciones={TIPOS_RECLAMO} valor={datos.tipoReclamo} onElegir={(v) => cambiar('tipoReclamo', v)} etiqueta="Reclamo o queja" />
            </div>
            {/* Lo que se pregunta cambia con lo elegido: una queja es sobre la atención. */}
            <Campo
              etiqueta={esQueja ? '¿Cómo te atendimos?' : '¿Qué pasó?'}
              multilinea={4}
              maxLength={2000}
              placeholder={esQueja ? 'Cuéntanos qué pasó en la atención: cuándo, por qué canal (WhatsApp, correo…) y qué te molestó.' : 'Cuéntalo con el mayor detalle que puedas: qué pasó, cuándo y con qué pedido.'}
              {...campo('detalle')}
            />
            <Campo etiqueta="¿Qué solución esperas?" multilinea maxLength={1000} placeholder={esQueja ? 'Una disculpa, que lo revisen, que te contacten…' : 'Un cambio, un reembolso, que lo vuelvan a hacer…'} {...campo('pedido')} />
          </PasoEstudio>
        </div>

        <AvanceHoja pasos={TITULOS_DE_PASO.map((titulo, k) => ({ titulo: titulo.toLowerCase(), hecho: hechos[k] }))} listo={datos.acepta ? 'Todo listo: revisa y envía.' : 'Todo listo: marca la casilla de abajo y envía.'} />
        <div className={s.acepta}>
          <Casilla
            activo={datos.acepta}
            onChange={(v) => cambiar('acepta', v)}
            disabled={enviando}
            etiqueta={(
              <>
                Declaro que la información es verídica y autorizo el uso de mis datos para atender esta reclamación, según
                la <Enlace to={urlPrivacidad} target="_blank" rel="noopener noreferrer" className={s.enlace}>Política de Privacidad</Enlace>.
              </>
            )}
          />
          {errores.acepta && <p id="reclamo-acepta" tabIndex={-1} className={s.errorSuelto} role="alert">{errores.acepta}</p>}
        </div>

        {errorEnvio && <Aviso tipo="error" titulo="No se pudo registrar tu reclamación">{errorEnvio}</Aviso>}
        <Boton type="submit" bloque tamano="lg" cargando={enviando} icono={<Send aria-hidden="true" />}>
          {enviando ? 'Registrando…' : 'Enviar reclamación'}
        </Boton>
        <p className={s.nota}>
          La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para presentar una denuncia ante INDECOPI.
        </p>
      </form>
    </BloqueSeccion>
  );
}
