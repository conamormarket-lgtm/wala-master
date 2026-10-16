import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, Check, UserPlus, IdCard, Coins, Store, LogIn, Share2, Link2 } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio } from '../Feedback';
import { GananciaMonedas } from '../Etiquetas';
import { IconoWala } from '../IconosWala';
import { Trazo, LogoWala, Garabatos, Sello, Destello, Puntos } from '../Marca';
import { Enlace } from '../Enlace';
import { BloqueSeccion, TituloSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { FormaGanar } from '../piezas/Referidos';
import { Avatar } from '../piezas/Avatar';
import { RedesEnlaces, BotonEnlace } from '../piezas/Campanas';
import { PasosSellos } from '../piezas/PasosSellos';
import { construirFondoStyle, estiloBotonStyle } from '../../../services/linkThemes';
import s from './Campanas.module.css';

/*
 * Páginas de campaña: la suscripción de regalos (/suscripciones), la
 * invitación (/invitar/:código) y una página de enlaces (/l/:slug).
 * (Regalos con amor salió del kit el 2026-10-16; sigue en la tienda.)
 * La invitación HOY no tiene página en la tienda: InvitarPage lleva directo
 * al registro con <AvisoInvitacion> arriba. PaginaInvitacion es cómo debe
 * verse cuando la tenga (CAMPANAS.md).
 */

/* ── Suscripciones (/suscripciones) ─────────────────────── */

const PASOS_SUSCRIPCION = [
  ['reloj', '1. Programa tus fechas', 'Cuéntanos cuándo son los cumpleaños, aniversarios y días especiales de tus seres queridos.'],
  ['corazon', '2. Lo preparamos con cariño', 'Diseñamos y preparamos regalos personalizados según la ocasión y la persona.'],
  ['escudo', '3. Pagas en cuotas', 'El valor de tus regalos del año se divide en pequeñas cuotas mensuales.'],
  ['camion', '4. Llega a tiempo', 'Recibes cada Walá Box justo antes de la fecha especial, lista para sorprender.'],
];

/**
 * La suscripción de regalos: cómo funciona y la invitación a dejar las fechas
 * (la encuesta). Todavía sin pagos: los dos botones llevan a la encuesta.
 *  - urlEncuesta · pagosPronto (true: la nota de que el pago mensual llega pronto)
 */
export function PaginaSuscripciones({ urlEncuesta = '/encuesta-suscripcion', pagosPronto = true }) {
  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.75rem', paddingBottom: '1.5rem' }}>
        <div className={s.portada} data-componente="PaginaSuscripciones">
          <div className={s.portadaTexto}>
            <p className={s.antetitulo}>Nuevo en Walá</p>
            <h1 className={s.titulo}>Regalos perfectos, todo el año<Garabatos variante="titulo" className={s.garabatos} /><Trazo className={s.trazo} /></h1>
            <p className={s.bajada}>Olvídate de buscar regalos a última hora. Programa las fechas importantes de tus seres queridos y recibe cajas personalizadas justo a tiempo, pagando en cómodas cuotas mensuales.</p>
            <Boton to={urlEncuesta} tamano="lg" iconoFin={<ArrowRight aria-hidden="true" />}>Configurar mis fechas</Boton>
            {pagosPronto && <p className={s.nota}><ShieldCheck aria-hidden="true" /> Configura tus fechas hoy. El pago mensual llega muy pronto.</p>}
          </div>
          <div className={s.caja} aria-hidden="true">
            <span className={s.cajaTapa} />
            <IconoWala nombre="regalo" tamano={104} girar={-6} />
            <strong>Walá Box</strong>
            <small>Especial para mamá</small>
          </div>
        </div>
      </BloqueSeccion>
      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
        <TituloSeccion titulo="¿Cómo funciona?" subtitulo="Un proceso simple para que siempre quedes bien." alinear="center" subrayado />
        <ul className={s.pasos}>
          {PASOS_SUSCRIPCION.map(([icono, titulo, texto]) => <li key={titulo}><FormaGanar icono={icono} titulo={titulo}>{texto}</FormaGanar></li>)}
        </ul>
      </BloqueSeccion>
      <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '2.5rem' }}>
        <div className={s.llamado}>
          <h2 className={s.llamadoTitulo}>Adelántate a las fechas especiales</h2>
          <p>Estamos terminando los pagos para darte las comisiones más bajas y las mejores cuotas. <strong>Pero no tienes que esperar.</strong></p>
          <ul className={s.lista}>
            {['Planifica todo tu año hoy mismo', 'Acceso anticipado cuando lleguen los pagos', 'Diseños exclusivos para los primeros suscriptores'].map((t) => <li key={t}><Check aria-hidden="true" />{t}</li>)}
          </ul>
          <Boton to={urlEncuesta} tamano="lg" variante="contorno" style={{ '--b-fondo': '#fff', '--b-fondo-hover': '#fff', '--b-texto': '#4c1d95', '--b-borde': 'transparent' }} iconoFin={<ArrowRight aria-hidden="true" />}>Separar mis fechas ahora</Boton>
        </div>
      </BloqueSeccion>
    </>
  );
}

/* ── La invitación (/invitar/:código) ───────────────────── */

/**
 * La invitación de una cuenta (el link permanente de Mis referidos): quién
 * te invitó, lo que ganas y cómo, antes de crear la cuenta. Quien invita gana
 * cuando haces tu primera compra; a ti no te cuesta nada.
 *  - nombre: el primer nombre de quien invita (sin él, "Te invitaron")
 *  - estado: 'nueva' (sin cuenta) | 'conCuenta' (ya tiene cuenta: la
 *    invitación no aplica, el link vale como uno de compra) | 'aceptada' (ya
 *    recibió el bono) | 'invalida' (el código no existe) | 'cargando'
 *  - bono (10 monedas para quien llega) · diasPrimeraCompra (30) · horasCompra (36)
 *  - urlRegistro · urlLogin · urlTienda
 */
export function PaginaInvitacion({
  nombre, estado = 'nueva', bono = 10, diasPrimeraCompra = 30, horasCompra = 36,
  urlRegistro = '/registro', urlLogin = '/login', urlTienda = '/tienda',
}) {
  if (estado === 'cargando') return <EsqueletoPagina forma="invitacion" />;
  if (estado === 'invalida') {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <EstadoVacio imagen={CARAS_KAPI.triste} titulo="Este link de invitación no es válido" texto="Revisa que esté completo o pide a quien te invitó que te lo vuelva a enviar.">
          <Boton to={urlTienda} icono={<Store aria-hidden="true" />}>Ir a la tienda</Boton>
        </EstadoVacio>
      </BloqueSeccion>
    );
  }
  const quien = nombre || 'Quien te invitó';
  const aceptada = estado === 'aceptada';
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.75rem', paddingBottom: '2.5rem' }}>
      <section className={s.invitar} data-componente="PaginaInvitacion">
        <span className={s.invitarAdornos} aria-hidden="true">
          <Puntos className={s.invitarPuntos} />
          <Destello className={s.invitarDestello1} />
          <Destello className={s.invitarDestello2} />
        </span>
        <Sello tamano={76} girar={-8} tono={aceptada ? 'menta' : 'degradado'}>
          {aceptada ? <Check aria-hidden="true" className={s.invitarSelloIcono} /> : <IconoWala nombre="regalo" tamano={46} />}
        </Sello>
        <h1 className={s.invitarTitulo}>
          {aceptada
            ? <>¡Ya tienes tus {bono} monedas!<Trazo className={s.trazo} /></>
            : nombre
              ? <><span className={s.invitarNombre}>{nombre}</span> te invitó a Walá<Trazo className={s.trazo} /></>
              : <>Te invitaron a Walá<Trazo className={s.trazo} /></>}
        </h1>
        <p className={s.invitarBajada}>
          {aceptada
            ? 'Úsalas en tu primera compra: se descuentan en el checkout.'
            : 'Prendas, tazas y regalos personalizados con tu diseño, hechos con amor en Perú.'}
        </p>

        {estado === 'nueva' && (
          <>
            <div className={s.invitarPremio}>
              <GananciaMonedas monto={bono} />
              <span>de bienvenida al crear tu cuenta</span>
            </div>
            <PasosSellos
              etiqueta="Cómo recibes tus monedas"
              className={s.invitarPasos}
              pasos={[
                { icono: <UserPlus aria-hidden="true" />, titulo: 'Crea tu cuenta', texto: 'Con tu correo o con Google.' },
                { icono: <IdCard aria-hidden="true" />, titulo: 'Completa tu DNI y celular', texto: 'Así sabemos que tu cuenta es nueva.' },
                { icono: <Coins aria-hidden="true" />, titulo: `Recibes ${bono} monedas`, texto: 'Para usarlas en tu primera compra.' },
              ]}
            />
            <div className={s.invitarBotones}>
              <Boton to={urlRegistro} tamano="lg" icono={<UserPlus aria-hidden="true" />}>Crear mi cuenta</Boton>
              <Boton to={urlLogin} tamano="lg" variante="fantasma" icono={<LogIn aria-hidden="true" />}>Ya tengo cuenta</Boton>
            </div>
            <p className={s.invitarNota}>
              {quien} gana monedas cuando haces tu primera compra (en los {diasPrimeraCompra} días siguientes). A ti no te cuesta nada.
              Es solo para cuentas nuevas: el DNI y el celular no deben estar en otra cuenta ni en compras anteriores.
            </p>
          </>
        )}

        {estado === 'conCuenta' && (
          <>
            <div className={s.invitarAviso}>
              <Aviso tipo="info" titulo="La invitación es para cuentas nuevas">
                Ya tienes una cuenta en Walá, así que no aplica el bono de bienvenida. Igual, si compras en las próximas {horasCompra} h, {nombre || 'quien te invitó'} gana monedas con tu pedido.
              </Aviso>
            </div>
            <div className={s.invitarBotones}>
              <Boton to={urlTienda} tamano="lg" icono={<Store aria-hidden="true" />}>Ir a la tienda</Boton>
            </div>
          </>
        )}

        {aceptada && (
          <div className={s.invitarBotones}>
            <Boton to={urlTienda} tamano="lg" iconoFin={<ArrowRight aria-hidden="true" />}>Ir a la tienda</Boton>
          </div>
        )}
      </section>
    </BloqueSeccion>
  );
}

/* ── Una página de enlaces (/l/:slug) ───────────────────── */

/**
 * Una página de enlaces (estilo Linktree): la foto, el título, las redes y
 * los botones, con el diseño que eligió el admin (fondo, estilo de botón,
 * colores, redondez, letra). Al pie, "Creado con Walá". Va sola, sin la
 * cabecera ni el pie de la tienda: es la página que se pone en la bio de
 * Instagram o TikTok. Arriba a la derecha, "Compartir" (el menú del teléfono
 * o, si no hay, copia el link).
 *  - pagina: { titulo, descripcion, avatar, redes: [{ id, tipo, nombre, url, icono }],
 *    botones: [{ id, titulo, url, imagen }], diseno } (link_pages)
 *  - onClic(item): cuenta el clic (registrarClicEnlace)
 *  - urlCompartir: el link de la página (si no, el de la barra)
 *  - estado: 'cargando' | 'noDisponible'
 */
export function PaginaEnlaces({ pagina = {}, onClic, urlCompartir, estado }) {
  const [copiado, setCopiado] = useState(false);
  if (estado === 'cargando') return <EsqueletoPagina forma="enlaces" />;
  if (estado === 'noDisponible') {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <EstadoVacio imagen={CARAS_KAPI.triste} titulo="Página no disponible" texto="El enlace que seguiste no existe o aún no está publicado.">
          <Boton to="/">Ir al inicio</Boton>
        </EstadoVacio>
      </BloqueSeccion>
    );
  }
  const d = pagina.diseno || {};
  const estilo = estiloBotonStyle(d);
  const compartir = async () => {
    const url = urlCompartir || (typeof window !== 'undefined' ? window.location.href : '');
    try {
      if (navigator.share) { await navigator.share({ title: pagina.titulo, url }); return; }
      await navigator.clipboard?.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch { /* cerró el menú de compartir: nada */ }
  };
  return (
    <div
      className={s.enlaces}
      style={{ ...construirFondoStyle(d.background), '--enl-titulo': d.titleColor || '#fff', '--enl-texto': d.textColor || 'rgba(255,255,255,0.86)', fontFamily: d.fontFamily || undefined, textAlign: d.textAlign || 'center' }}
      data-componente="PaginaEnlaces"
    >
      <button type="button" className={s.enlacesCompartir} onClick={compartir} aria-label={copiado ? 'Link copiado' : 'Compartir esta página'}>
        {copiado ? <Link2 aria-hidden="true" /> : <Share2 aria-hidden="true" />}
        <span>{copiado ? 'Copiado' : 'Compartir'}</span>
      </button>
      <div className={s.enlacesColumna}>
        {pagina.avatar ? <img src={pagina.avatar} alt="" className={s.enlacesAvatar} /> : <Avatar nombre={pagina.titulo} className={s.enlacesAvatar} />}
        {pagina.titulo && <h1 className={s.enlacesTitulo}>{pagina.titulo}</h1>}
        {pagina.descripcion && <p className={s.enlacesTexto}>{pagina.descripcion}</p>}
        <RedesEnlaces redes={pagina.redes} onClic={onClic} />
        <div className={s.enlacesBotones}>
          {(pagina.botones || []).map((b) => <BotonEnlace key={b.id} titulo={b.titulo} url={b.url} imagen={b.imagen} estilo={estilo} onClic={() => onClic?.(b)} />)}
          {!(pagina.botones || []).length && <p className={s.enlacesTexto}>Pronto habrá enlaces aquí.</p>}
        </div>
        <Enlace to="/" className={s.creado}>Creado con <LogoWala tamano={18} /></Enlace>
      </div>
    </div>
  );
}
