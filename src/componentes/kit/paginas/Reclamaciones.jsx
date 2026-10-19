import React, { useRef, useState } from 'react';
import { BookOpen, Send, Package, Sparkles, MessageSquareWarning, Frown, RotateCcw, Store, CheckCircle2 } from 'lucide-react';
import Boton from '../Boton';
import { Aviso } from '../Feedback';
import { Campo, Casilla } from '../Formulario';
import { Enlace } from '../Enlace';
import { Trazo, Sello, Puntos, Destello } from '../Marca';
import { Texto, useTexto } from '../Traduccion';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { PasoEstudio } from '../piezas/Estudio';
import { ListaEleccion } from '../piezas/Cuenta';
import { CamposDatosPersonales, validarPerfil } from '../piezas/DatosPersonales';
import { CabezaLegal, DatosProveedor, CodigoCopiable, PasosAtencion, AvanceHoja } from '../piezas/Legales';
import s from './Legales.module.css';

/*
 * El libro de reclamaciones (/libro-de-reclamaciones), aparte de la política
 * de privacidad y los términos (Legales.jsx): solo esta página baja el
 * formulario. Comparte el diseño de Legales.module.css.
 */

/* ── Libro de reclamaciones ─────────────────────────────── */

const VACIA = {
  nombre: '', pais: 'PE', tipoDocumento: 'DNI', documento: '', telefono: '', domicilio: '', email: '',
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

/** Los textos de la hoja, traducidos (los campos muestran lo que reciben). */
function useTextosHoja(esQueja) {
  const bien = [useTexto(BIENES[0].texto), useTexto(BIENES[0].detalle), useTexto(BIENES[1].texto), useTexto(BIENES[1].detalle)];
  const tipo = [useTexto(TIPOS_RECLAMO[0].texto), useTexto(TIPOS_RECLAMO[0].detalle), useTexto(TIPOS_RECLAMO[1].texto), useTexto(TIPOS_RECLAMO[1].detalle)];
  return {
    domicilio: useTexto('Domicilio'),
    domicilioEj: useTexto('Calle, número, distrito y ciudad'),
    correo: useTexto('Correo electrónico'),
    correoAyuda: useTexto('Aquí te llega la respuesta.'),
    apoderado: useTexto('Nombre del padre, madre o apoderado'),
    monto: useTexto('Monto reclamado (opcional)'),
    compraste: useTexto('¿Qué compraste?'),
    comprasteEj: useTexto('Ej. Polo personalizado talla M, pedido PD-20481'),
    detalle: useTexto(esQueja ? '¿Cómo te atendimos?' : '¿Qué pasó?'),
    detalleEj: useTexto(esQueja ? 'Cuéntanos qué pasó en la atención: cuándo, por qué canal (WhatsApp, correo…) y qué te molestó.' : 'Cuéntalo con el mayor detalle que puedas: qué pasó, cuándo y con qué pedido.'),
    pedido: useTexto('¿Qué solución esperas?'),
    pedidoEj: useTexto(esQueja ? 'Una disculpa, que lo revisen, que te contacten…' : 'Un cambio, un reembolso, que lo vuelvan a hacer…'),
    pasos: [useTexto(TITULOS_DE_PASO[0]), useTexto(TITULOS_DE_PASO[1]), useTexto(TITULOS_DE_PASO[2])],
    bienes: BIENES.map((x, k) => ({ ...x, texto: bien[k * 2], detalle: bien[k * 2 + 1] })),
    tipos: TIPOS_RECLAMO.map((x, k) => ({ ...x, texto: tipo[k * 2], detalle: tipo[k * 2 + 1] })),
    tipoBien: useTexto('Tipo de bien contratado'),
    reclamoOQueja: useTexto('Reclamo o queja'),
  };
}

/**
 * Las reglas de la hoja. Los datos de la persona son los de Mi perfil
 * (validarPerfil: DNI de 8, celular de 9 que empieza con 9…); el resto, los
 * de la tienda. Devuelve { campo: mensaje } (vacío si todo está bien).
 */
export function validarReclamacion(d = {}) {
  // Las reglas de Mi perfil con el país elegido: fuera del Perú, documento y teléfono libres.
  const e = validarPerfil({ ...d, pais: d.pais || 'PE' });
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
 * los datos de la persona ya puestos (`inicial`). Con `paises`, se elige el
 * país: fuera del Perú el documento y el teléfono son libres (nadie se queda
 * sin poder reclamar). Los textos pasan por la traducción.
 *  - empresa: { razonSocial, ruc, domicilioFiscal, plazoRespuestaDiasHabiles }
 *  - inicial: { nombre, pais, tipoDocumento, documento, telefono, email, domicilio }
 *  - paises: [{ valor, texto, prefijo }] (con uno solo, no se pregunta)
 *  - onEnviar(datos): promesa → { codigo, fecha } (la hoja ya guardada); si
 *    falla, lanza un Error con el mensaje
 *  - hoy: la fecha en palabras ("15 de octubre de 2026")
 *  - urlPrivacidad, urlTienda
 */
export function PaginaReclamaciones({
  empresa = {}, inicial = {}, onEnviar, hoy, urlPrivacidad = '/politicas-privacidad', urlTienda = '/', estado,
  paises = [{ valor: 'PE', texto: 'Perú', prefijo: '+51' }],
}) {
  const [datos, setDatos] = useState(() => ({ ...VACIA, ...inicial }));
  const t = useTextosHoja(datos.tipoReclamo === 'queja');
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
  const bien = t.bienes.find((b) => b.valor === datos.tipoBien);
  const tipo = t.tipos.find((x) => x.valor === datos.tipoReclamo);

  const cambiar = (campo, valor) => {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((x) => (x[campo] ? { ...x, [campo]: undefined } : x));
  };
  const campo = (nombre) => ({
    id: `reclamo-${nombre}`,
    value: datos[nombre],
    error: errores[nombre] && <Texto>{errores[nombre]}</Texto>,
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
          <h1 className={s.listoTitulo}><Texto>¡Reclamación registrada!</Texto><Trazo className={s.listoTrazo} /></h1>
          <p><Texto>Tu hoja de reclamación quedó guardada. Guarda este código para cualquier consulta.</Texto></p>
          <CodigoCopiable codigo={registrada.codigo} rotulo="Tu código de seguimiento" fecha={`Registrada el ${registrada.fecha || hoy}`} />
          <p>
            <Texto>Te responderemos al correo</Texto> <strong>{registrada.email}</strong> <Texto>en un plazo máximo de</Texto> <strong><Texto>{`${plazo} días hábiles`}</Texto></strong>,{' '}
            <Texto>conforme al Código de Protección y Defensa del Consumidor.</Texto>
          </p>
          <div className={s.listoBotones}>
            <Boton variante="secundario" icono={<RotateCcw aria-hidden="true" />} onClick={() => { setDatos({ ...VACIA, ...inicial }); setRegistrada(null); }}><Texto>Registrar otra reclamación</Texto></Boton>
            <Boton to={urlTienda} variante="fantasma" icono={<Store aria-hidden="true" />}><Texto>Volver a la tienda</Texto></Boton>
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
          <Texto>Si algo no salió como esperabas, déjalo por escrito aquí. Lo revisa una persona del equipo de Walá.</Texto>
        </p>
        <PasosAtencion plazo={plazo} />
        <DatosProveedor empresa={empresa} fecha={hoy} />

        <div className={s.pasos}>
          <PasoEstudio numero={1} titulo={t.pasos[0]} hecho={hechos[0]}>
            <div className={s.rejilla}>
              <div className={s.ancho}>
                <CamposDatosPersonales
                  datos={datos}
                  paises={paises}
                  onCambiar={cambiar}
                  errores={errores}
                  cumpleanos={false}
                  disabled={enviando}
                  ids={{ nombre: 'reclamo-nombre', documento: 'reclamo-documento', telefono: 'reclamo-telefono' }}
                />
              </div>
              <div className={s.ancho}><Campo etiqueta={t.domicilio} autoComplete="street-address" placeholder={t.domicilioEj} {...campo('domicilio')} /></div>
              <div className={s.ancho}><Campo etiqueta={t.correo} type="email" autoComplete="email" inputMode="email" placeholder="tu@correo.com" ayuda={t.correoAyuda} {...campo('email')} /></div>
              <div className={s.ancho}>
                <Casilla activo={datos.esMenor} onChange={(v) => cambiar('esMenor', v)} disabled={enviando} etiqueta="La persona que reclama es menor de edad" />
              </div>
              {datos.esMenor && (
                <div className={s.ancho}><Campo etiqueta={t.apoderado} autoComplete="name" {...campo('apoderado')} /></div>
              )}
            </div>
          </PasoEstudio>

          <PasoEstudio numero={2} titulo={t.pasos[1]} detalle={hechos[1] ? bien?.texto : undefined} hecho={hechos[1]}>
            <div className={s.eleccion}>
              <ListaEleccion opciones={t.bienes} valor={datos.tipoBien} onElegir={(v) => cambiar('tipoBien', v)} etiqueta={t.tipoBien} />
            </div>
            <div className={s.rejilla}>
              <Campo
                etiqueta={t.monto}
                icono={<span className={s.soles}>S/</span>}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                {...campo('monto')}
              />
              <div className={s.ancho}>
                <Campo etiqueta={t.compraste} multilinea maxLength={600} placeholder={t.comprasteEj} {...campo('descripcion')} />
              </div>
            </div>
          </PasoEstudio>

          <PasoEstudio numero={3} titulo={t.pasos[2]} detalle={hechos[2] ? tipo?.texto : undefined} hecho={hechos[2]}>
            <div className={s.eleccion}>
              <ListaEleccion opciones={t.tipos} valor={datos.tipoReclamo} onElegir={(v) => cambiar('tipoReclamo', v)} etiqueta={t.reclamoOQueja} />
            </div>
            {/* Lo que se pregunta cambia con lo elegido: una queja es sobre la atención. */}
            <Campo
              etiqueta={t.detalle}
              multilinea={4}
              maxLength={2000}
              placeholder={t.detalleEj}
              {...campo('detalle')}
            />
            <Campo etiqueta={t.pedido} multilinea maxLength={1000} placeholder={t.pedidoEj} {...campo('pedido')} />
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
                <Texto>Declaro que la información es verídica y autorizo el uso de mis datos para atender esta reclamación, según la</Texto>{' '}
                <Enlace to={urlPrivacidad} target="_blank" rel="noopener noreferrer" className={s.enlace}><Texto>Política de Privacidad</Texto></Enlace>.
              </>
            )}
          />
          {errores.acepta && <p id="reclamo-acepta" tabIndex={-1} className={s.errorSuelto} role="alert"><Texto>{errores.acepta}</Texto></p>}
        </div>

        {errorEnvio && <Aviso tipo="error" titulo="No se pudo registrar tu reclamación">{errorEnvio}</Aviso>}
        <Boton type="submit" bloque tamano="lg" cargando={enviando} icono={<Send aria-hidden="true" />}>
          <Texto>{enviando ? 'Registrando…' : 'Enviar reclamación'}</Texto>
        </Boton>
        <p className={s.nota}>
          <Texto>La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para presentar una denuncia ante INDECOPI.</Texto>
        </p>
      </form>
    </BloqueSeccion>
  );
}
