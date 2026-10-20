import React, { useState } from 'react';
import { Star, Sparkles, ArrowRight, Repeat, Receipt, Gift } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio, HojaInferior } from '../Feedback';
import { Campo, Casilla } from '../Formulario';
import { Chip, Etiqueta } from '../Etiquetas';
import { Pestanas } from '../Navegacion';
import { Enlace } from '../Enlace';
import { Sello, Trazo } from '../Marca';
import { BloqueSeccion, TituloSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { TarjetaCuenta, Estadistica, ListaDatos } from '../piezas/Cuenta';
import { PagoTarjeta, PagoPaypal } from '../piezas/Pago';
import { BotonGoogle, SeparadorAcceso } from '../piezas/Acceso';
import { FotoProducto } from '../piezas/FotoProducto';
import { ListaGanadores, TarjetaPlan, TarjetaAliado } from '../piezas/Sorteos';
import { TextoResaltado } from '../piezas/TextoResaltado';
import { Texto, useTexto } from '../Traduccion';
import s from './Sorteos.module.css';

/*
 * Los sorteos: el sorteo del momento (/sorteos y /sorteos/:slug, gratis o
 * con tickets) y la campaña por suscripción (/suscrito-sorteo, cobro
 * automático). Participar y pagar lo hace el servidor; la página solo pide
 * los datos y muestra cómo va.
 */

const soles = (n, moneda = 'PEN') => `${moneda === 'USD' ? 'US$' : 'S/'} ${Number(n || 0).toFixed(2)}`;

/* ── El sorteo (/sorteos) ─────────────────────────────── */

// El sorteo vive en su archivo (Sorteo.jsx): /sorteos no baja la campaña por
// suscripción.
export { PaginaSorteo } from './Sorteo';

/* ── Sorteo por suscripción (/suscrito-sorteo) ──────────── */

const ESTADOS_SUSCRIPCION = {
  activo: { texto: 'Activa', tono: 'exito' },
  pendiente_pago: { texto: 'Pendiente de pago', tono: 'aviso' },
  vencido: { texto: 'Vencida', tono: 'peligro' },
  cancelado: { texto: 'Cancelada', tono: 'neutro' },
};

const PESTANAS_CUENTA = [
  { id: 'suscripcion', texto: 'Mi suscripción' },
  { id: 'chances', texto: 'Mis chances' },
  { id: 'recibos', texto: 'Mis recibos' },
];

/**
 * La campaña del sorteo por suscripción: planes con cobro automático, los
 * premios, quienes ya ganaron, los descuentos de marcas aliadas y, con
 * sesión, tu cuenta (suscripción, chances y recibos). Suscribirse va en una
 * hoja: entrar con Google, los datos y la autorización del cobro, y pagar.
 *  - campana: { titulo, descripcion, suscriptores, planes: [{ id, nombre,
 *    intervalo, meses, precio, precioUsd, chances, beneficios, destacado }],
 *    premios: [{ nombre, imagen }], ganadores: [{ id, nombre, premio, fecha, foto }],
 *    aliados: [{ id, marca, titulo, descuento, ubicacion, categoria, imagen, url }] }
 *  - suscripcion: { estado, plan, metodo, vigente, proximo, chances } (null: no tiene)
 *  - recibos: [{ id, fecha, monto }] · sesion · usuario: { nombre, email }
 *  - onGoogle(): promesa · onPagarTarjeta({ plan, datos }), onPagarPaypal({ plan, datos }):
 *    promesas → { pendiente } · onCancelar(): promesa
 *  - estado: 'cargando' | 'noDisponible'
 * Los textos pasan por la traducción; los nombres de planes y premios, tal cual.
 */
export function PaginaSuscripcionSorteo({
  campana = {}, suscripcion, recibos = [], sesion = false, usuario, onGoogle, onPagarTarjeta, onPagarPaypal, onCancelar, estado,
}) {
  const [plan, setPlan] = useState(null);
  const [paso, setPaso] = useState('datos');
  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [autoriza, setAutoriza] = useState(false);
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [categoria, setCategoria] = useState('todas');
  const [pestana, setPestana] = useState('suscripcion');
  const [cancelar, setCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const meses = (m) => (m === 1 ? 'cada mes' : `cada ${m} meses`);
  const t = {
    secciones: useTexto('Secciones'),
    cobro: useTexto(plan ? `${soles(plan.precio)} ${meses(plan.meses || 1)}` : undefined),
  };

  if (estado === 'cargando') return <EsqueletoPagina forma="suscripcionSorteo" />;
  if (estado === 'noDisponible') {
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <EstadoVacio imagen={CARAS_KAPI.triste} titulo="No disponible" texto="Este sorteo por suscripción no está disponible por ahora. ¡Vuelve pronto!">
          <Boton to="/tienda" variante="secundario">Ver la tienda</Boton>
        </EstadoVacio>
      </BloqueSeccion>
    );
  }

  const planes = campana.planes || [];
  const aliados = campana.aliados || [];
  const categorias = [...new Set(aliados.map((a) => a.categoria).filter(Boolean))];
  const vistos = categoria === 'todas' ? aliados : aliados.filter((a) => a.categoria === categoria);
  const elegir = (p) => { setPlan(p); setPaso(sesion ? 'datos' : 'cuenta'); setError(''); setAutoriza(false); };
  const cerrar = () => setPlan(null);
  const continuar = () => {
    if (!nombre.trim()) { setError('Escribe al menos tus nombres.'); return; }
    if (!autoriza) { setError('Autoriza el cobro automático para continuar.'); return; }
    setError('');
    setPaso('pago');
  };
  const pagar = (fn) => async () => {
    const r = await fn?.({ plan, datos: { nombre, email: usuario?.email } });
    if (r?.pendiente) setPaso('pendiente');
    else cerrar();
  };
  const enlaces = [['#planes', 'Planes'], campana.premios?.length && ['#premios', 'Premios'], ['#ganadores', 'Ganadores'], aliados.length && ['#beneficios', 'Beneficios'], sesion && ['#mi-cuenta', 'Mi cuenta']].filter(Boolean);
  const est = ESTADOS_SUSCRIPCION[suscripcion?.estado];

  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.5rem', paddingBottom: '1rem' }}>
        <div className={s.campana} data-componente="PaginaSuscripcionSorteo">
          <header className={s.portada}>
            <Sello tamano={56} girar={-10}><Repeat aria-hidden="true" /></Sello>
            <h1 className={s.portadaTitulo}><Texto>{campana.titulo}</Texto><Trazo className={s.trazoClaro} /></h1>
            {campana.descripcion && <p className={s.portadaTexto}><Texto>{campana.descripcion}</Texto></p>}
            {campana.suscriptores != null && <p className={s.portadaCuenta}><TextoResaltado resaltar={[Number(campana.suscriptores).toLocaleString('es-PE')]}>{`${Number(campana.suscriptores).toLocaleString('es-PE')} suscriptores participando`}</TextoResaltado></p>}
            <Boton to="#planes" tamano="lg" variante="contorno" iconoFin={<ArrowRight aria-hidden="true" />} style={{ '--b-fondo': '#fff', '--b-fondo-hover': '#fff', '--b-texto': '#4c1d95', '--b-borde': 'transparent' }}>Quiero suscribirme</Boton>
          </header>
          <nav className={s.anclas} aria-label={t.secciones}>
            {enlaces.map(([url, texto]) => <Enlace key={url} to={url} className={s.ancla}><Texto>{texto}</Texto></Enlace>)}
          </nav>
        </div>
      </BloqueSeccion>

      <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '1.5rem', anchorId: 'planes' }}>
        <TituloSeccion titulo="Elige tu plan" subtitulo="Cobro automático y participas en cada sorteo. Mientras más tiempo suscrito, más chances de ganar." subrayado />
        {planes.length ? (
          <ul className={s.planes}>
            {planes.map((p) => (
              <li key={p.id}>
                <TarjetaPlan
                  nombre={p.nombre}
                  intervalo={p.intervalo}
                  precio={soles(p.precio)}
                  precioUsd={p.precioUsd ? `$ ${Number(p.precioUsd).toFixed(2)}` : undefined}
                  alMes={p.meses > 1 ? soles(p.precio / p.meses) : undefined}
                  chances={p.chances}
                  beneficios={p.beneficios}
                  destacado={p.destacado}
                  onElegir={() => elegir(p)}
                />
              </li>
            ))}
          </ul>
        ) : <p className={s.nota}><Texto>Todavía no hay planes.</Texto></p>}
      </BloqueSeccion>

      {campana.premios?.length > 0 && (
        <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '1.5rem', anchorId: 'premios' }}>
          <TituloSeccion titulo="Premios" subtitulo="Esto es lo que puedes ganar siendo suscriptor." />
          <ul className={s.premios}>
            {campana.premios.map((p) => (
              <li key={p.nombre}>
                <FotoProducto src={p.imagen} relleno="8%" className={s.premioFoto} respaldo={<Gift aria-hidden="true" />} />
                <strong>{p.nombre}</strong>
              </li>
            ))}
          </ul>
        </BloqueSeccion>
      )}

      <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '1.5rem', anchorId: 'ganadores' }}>
        <TituloSeccion titulo="Ganadores" subtitulo="Ya ganaron. La próxima puede ser tu vez." />
        {campana.ganadores?.length ? <ListaGanadores ganadores={campana.ganadores} /> : <p className={s.nota}><Texto>Pronto anunciaremos a quienes ganen primero.</Texto></p>}
      </BloqueSeccion>

      {aliados.length > 0 && (
        <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '1.5rem', anchorId: 'beneficios' }}>
          <TituloSeccion titulo="Beneficios para suscriptores" subtitulo="Descuentos exclusivos en marcas aliadas." />
          {categorias.length > 1 && (
            <div className={s.filtros}>
              {['todas', ...categorias].map((c) => <Chip key={c} activo={categoria === c} onClick={() => setCategoria(c)}><Texto>{c === 'todas' ? 'Todas' : c}</Texto></Chip>)}
            </div>
          )}
          <ul className={s.aliados}>{vistos.map((a) => <li key={a.id}><TarjetaAliado {...a} /></li>)}</ul>
        </BloqueSeccion>
      )}

      {sesion && (
        <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '2.5rem', anchorId: 'mi-cuenta' }}>
          <TarjetaCuenta icono={<Receipt aria-hidden="true" />} titulo="Mi cuenta">
            <Pestanas opciones={PESTANAS_CUENTA} valor={pestana} onChange={setPestana} etiqueta="Mi cuenta" />
            {pestana === 'suscripcion' && (!suscripcion ? (
              <div className={s.sinSuscripcion}>
                <p><Texto>Aún no tienes una suscripción en esta campaña.</Texto></p>
                <Boton to="#planes" variante="secundario">Ver los planes</Boton>
              </div>
            ) : (
              <div className={s.miSuscripcion}>
                <ListaDatos datos={[
                  { etiqueta: 'Estado', valor: est && <Etiqueta tono={est.tono}><Texto>{est.texto}</Texto></Etiqueta> },
                  { etiqueta: 'Plan', valor: suscripcion.plan },
                  { etiqueta: 'Método de pago', valor: suscripcion.metodo },
                  { etiqueta: 'Vigente hasta', valor: suscripcion.vigente },
                  { etiqueta: 'Próximo cobro', valor: suscripcion.proximo },
                ]}
                />
                {['activo', 'pendiente_pago'].includes(suscripcion.estado) && (cancelar ? (
                  <Aviso
                    tipo="aviso"
                    titulo="¿Cancelar el cobro automático?"
                    accion={(
                      <div className={s.botones}>
                        <Boton variante="secundario" tamano="sm" onClick={() => setCancelar(false)}>No, mantener</Boton>
                        <Boton variante="peligro" tamano="sm" cargando={cancelando} onClick={async () => { setCancelando(true); try { await onCancelar?.(); setCancelar(false); } finally { setCancelando(false); } }}>Sí, cancelar</Boton>
                      </div>
                    )}
                  >
                    No se harán más cobros. Sigues participando hasta el fin del periodo ya pagado.
                  </Aviso>
                ) : <Boton variante="fantasma" tamano="sm" onClick={() => setCancelar(true)}>Cancelar suscripción</Boton>)}
              </div>
            ))}
            {pestana === 'chances' && (
              <Estadistica grande icono={<Star aria-hidden="true" />} tono="oro" etiqueta="Chances acumuladas" valor={suscripcion?.chances ?? 0} nota="Cada ciclo pagado te suma chances según tu plan. Solo quienes tienen la suscripción vigente pueden ganar." />
            )}
            {pestana === 'recibos' && (recibos.length
              ? <ListaDatos datos={recibos.map((r) => ({ etiqueta: r.fecha, valor: r.monto }))} />
              : <p className={s.nota}><Texto>Aún no tienes recibos de cobro.</Texto></p>)}
          </TarjetaCuenta>
        </BloqueSeccion>
      )}

      <HojaInferior abierta={Boolean(plan)} onCerrar={cerrar} titulo={paso === 'pendiente' ? 'Casi listo' : `Suscribirme: ${plan?.nombre || ''}`}>
        {plan && (
          <div className={s.formulario}>
            {paso !== 'pendiente' && (
              <p className={s.pagoResumen}><strong>{plan.nombre}</strong> · {t.cobro}</p>
            )}
            {paso === 'cuenta' && (
              <>
                <p><Texto>Inicia sesión para suscribirte y participar. Es rápido con Google.</Texto></p>
                <BotonGoogle cargando={entrando} onClick={async () => { setEntrando(true); try { await onGoogle?.(); setPaso('datos'); } finally { setEntrando(false); } }} />
              </>
            )}
            {paso === 'datos' && (
              <>
                <Campo etiqueta="Nombres" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" />
                <Campo etiqueta="Correo" value={usuario?.email || ''} readOnly ayuda="El de tu cuenta: ahí llegan los recibos." />
                <Casilla
                  activo={autoriza}
                  onChange={setAutoriza}
                  etiqueta={<TextoResaltado resaltar={[soles(plan.precio)]}>{`Autorizo el cobro automático de ${soles(plan.precio)} ${meses(plan.meses || 1)} hasta que cancele mi suscripción.`}</TextoResaltado>}
                />
                {error && <Aviso tipo="error" compacto>{error}</Aviso>}
                <Boton bloque onClick={continuar}>Continuar al pago</Boton>
              </>
            )}
            {paso === 'pago' && (
              <>
                <PagoTarjeta monto={plan.precio} texto={`Suscribirme (${soles(plan.precio)})`} onPagar={pagar(onPagarTarjeta)} />
                <SeparadorAcceso>o paga desde el extranjero</SeparadorAcceso>
                <PagoPaypal montoUsd={plan.precioUsd || plan.precio / 3.75} onPagar={pagar(onPagarPaypal)} />
              </>
            )}
            {paso === 'pendiente' && (
              <div className={s.pendiente}>
                <Sello tamano={56} tono="oro"><Sparkles aria-hidden="true" /></Sello>
                <p><strong><Texto>Tu suscripción se está activando.</Texto></strong> <Texto>Se activa sola cuando se confirme tu primer cobro; te avisamos por correo. ¡Gracias por suscribirte!</Texto></p>
                <Boton bloque onClick={cerrar}>Entendido</Boton>
              </div>
            )}
          </div>
        )}
      </HojaInferior>
    </>
  );
}
