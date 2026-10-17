import React, { useMemo, useState } from 'react';
import { Gift, Ticket, Trophy, Users, Sparkles, Flame, MousePointerClick, ShoppingBag, Coins, Receipt, Link2, RotateCcw, ArrowRight, Send } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Aviso, EstadoVacio } from '../Feedback';
import { Moneda } from '../Etiquetas';
import { IconoWala } from '../IconosWala';
import { CabezaCuenta, TarjetaCuenta, Estadistica } from '../piezas/Cuenta';
import { TarjetaRecompensa, TarjetaCupon, TarjetaMision, NivelCuenta, NIVELES } from '../piezas/Recompensas';
import { FormaGanar, EnlaceInvitacion, FilaReferido, DetallePedidoReferido, RankingReferidos } from '../piezas/Referidos';
import { FotoProducto } from '../piezas/FotoProducto';
import { EsqueletoProducto, EsqueletoFila, EsqueletoTarjeta } from '../Esqueletos';
import { Texto } from '../Traduccion';
import s from './CuentaRecompensas.module.css';

/*
 * Páginas del grupo Recompensas de la cuenta: catálogo, cupones, misiones y
 * referidos. Van dentro de MarcoCuenta. Lo que va al servidor (canjear,
 * completar, reclamar) entra como promesas; si falla, su mensaje se muestra
 * en la página. Los estados vacíos llevan un sello, no la cara de Kapi (en la
 * tienda ya está el flotante: un solo Kapi a la vista).
 */

const miles = (n) => Number(n || 0).toLocaleString('es-PE');
/** Mensaje para la persona: los de Firebase ("internal", "permission-denied") no se muestran tal cual. */
const mensajeDe = (err, porDefecto) => {
  const m = String(err?.message || '').trim();
  return m && m.length > 12 && !/^[a-z-]+$/.test(m) ? m : porDefecto;
};

/** Esqueletos con la forma de lo que viene: 'producto', 'fila' o una tarjeta de ese alto. */
function Esqueletos({ n = 3, alto = 220, forma = 'tarjeta' }) {
  return Array.from({ length: n }, (_, k) => (
    <li key={k}>
      {forma === 'producto' ? <EsqueletoProducto /> : forma === 'fila' ? <EsqueletoFila /> : <EsqueletoTarjeta lineas={3} alto={alto} />}
    </li>
  ));
}

/* ── Catálogo de recompensas (/cuenta/catalogo) ─────────── */

/**
 * Catálogo de recompensas: canjear monedas por cupones.
 *  - recompensas: [{ id, titulo, descripcion, imagen, beneficio, costo }]
 *    (recompensaDesdeFirestore) · saldo
 *  - cargando · error · onReintentar
 *  - onCanjear(id): promesa → { codigo } (redeemRewardSecure)
 *  - urlCupones
 * Una sola confirmación abierta a la vez (abrir otra cierra la anterior).
 */
export function PaginaCatalogo({ recompensas = [], saldo = 0, cargando = false, error = false, onReintentar, onCanjear, urlCupones = '/cuenta/cupones' }) {
  const [aviso, setAviso] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  const canjear = (r) => async () => {
    setAviso(null);
    try {
      const res = await onCanjear?.(r.id);
      setAviso({ tipo: 'exito', titulo: r.titulo, codigo: res?.codigo });
    } catch (err) {
      setAviso({ tipo: 'error', titulo: 'No pudimos canjearla', texto: mensajeDe(err, 'Inténtalo de nuevo en unos minutos. Tus monedas no se gastaron.') });
    }
  };
  return (
    <>
      <CabezaCuenta
        icono={<Gift />}
        tono="oro"
        titulo={<Texto>Catálogo de recompensas</Texto>}
        subtitulo={<Texto>Canjea tus monedas por descuentos y premios.</Texto>}
        accion={<p className={s.saldo}><Moneda tamano={22} /><strong>{miles(saldo)}</strong> <Texto>monedas</Texto></p>}
      />
      {aviso && (
        <Aviso
          tipo={aviso.tipo}
          titulo={aviso.tipo === 'exito' ? <><Texto>¡Canjeaste</Texto> «<Texto>{aviso.titulo}</Texto>»!</> : aviso.titulo}
          onCerrar={() => setAviso(null)}
          accion={aviso.tipo === 'exito' && <Boton to={urlCupones} tamano="sm" iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Ver mis cupones</Texto></Boton>}
        >
          {aviso.tipo === 'exito'
            ? (aviso.codigo ? <><Texto>Tu código es</Texto> <strong>{aviso.codigo}</strong>. <Texto>Lo tienes en Mis cupones.</Texto></> : 'Ya está en Mis cupones.')
            : aviso.texto}
        </Aviso>
      )}
      {error ? (
        <Aviso tipo="error" titulo="No pudimos cargar el catálogo" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}><Texto>Reintentar</Texto></Boton>}>
          Intenta de nuevo en unos minutos.
        </Aviso>
      ) : cargando ? (
        <ul className={s.rejilla} aria-busy="true"><Esqueletos n={3} forma="producto" /></ul>
      ) : recompensas.length === 0 ? (
        <EstadoVacio imagen={null} icono={<Gift />} titulo={<Texto>No hay recompensas por ahora</Texto>} texto={<Texto>Vuelve pronto: se agregan seguido.</Texto>} />
      ) : (
        <ul className={s.rejilla}>
          {recompensas.map((r) => (
            <li key={r.id}>
              <TarjetaRecompensa
                {...r}
                saldo={saldo}
                onCanjear={onCanjear && canjear(r)}
                confirmando={confirmando === r.id}
                onConfirmar={(abierta) => setConfirmando(abierta ? r.id : null)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ── Mis cupones (/cuenta/cupones) ──────────────────────── */

/**
 * Mis cupones: los disponibles primero; el código se copia con un toque.
 *  - cupones: [{ id, texto, codigo, origen, estado, vence, conAsesor }]
 *    (cuponDesdeFirestore)
 *  - cargando · error · onReintentar · onCopiar(codigo): promesa
 *  - urlRuleta, urlCatalogo: salidas del estado vacío
 */
export function PaginaCupones({ cupones = [], cargando = false, error = false, onReintentar, onCopiar, urlRuleta = '/ruleta', urlCatalogo = '/cuenta/catalogo' }) {
  const ordenados = useMemo(() => [...cupones].sort((a, b) => Number(b.estado === 'activo') - Number(a.estado === 'activo')), [cupones]);
  const disponibles = cupones.filter((c) => c.estado === 'activo').length;
  return (
    <>
      <CabezaCuenta
        icono={<Ticket />}
        tono="oro"
        titulo={<Texto>Mis cupones</Texto>}
        subtitulo={<Texto>Escribe el código en el carrito, en el paso de pago, para aplicar el descuento.</Texto>}
      />
      {cupones.length > 0 && !cargando && (
        <p className={s.cuenta}><strong>{disponibles}</strong> <Texto>{disponibles === 1 ? 'disponible' : 'disponibles'}</Texto> <Texto>de</Texto> {cupones.length}</p>
      )}
      {error ? (
        <Aviso tipo="error" titulo="No pudimos cargar tus cupones" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}><Texto>Reintentar</Texto></Boton>}>
          Revisa tu conexión e inténtalo de nuevo.
        </Aviso>
      ) : cargando ? (
        <ul className={s.cupones} aria-busy="true"><Esqueletos n={2} alto={150} /></ul>
      ) : ordenados.length === 0 ? (
        <EstadoVacio imagen={null} icono={<Ticket />} titulo={<Texto>Todavía no tienes cupones</Texto>} texto={<Texto>Los ganas en la Ruleta semanal o canjeando tus monedas en el catálogo.</Texto>}>
          <Boton to={urlRuleta}><Texto>Ir a la ruleta</Texto></Boton>
          <Boton to={urlCatalogo} variante="contorno"><Texto>Ver el catálogo</Texto></Boton>
        </EstadoVacio>
      ) : (
        <ul className={s.cupones}>
          {ordenados.map((c) => <li key={c.id}><TarjetaCupon {...c} onCopiar={onCopiar} /></li>)}
        </ul>
      )}
    </>
  );
}

/* ── Misiones (/cuenta/misiones) ────────────────────────── */

/**
 * Misiones diarias: monedas, experiencia y racha; el nivel; y las misiones
 * de hoy.
 *  - monedas · xp · niveles (NIVELES)
 *  - racha: { dias, hoy: true si ya hizo check-in hoy, ganado: monedas de hoy }
 *  - misiones: [{ id, titulo, descripcion, recompensa, completada, accion }]
 *    (misionDesdeServidor) · fecha: "14 de octubre"
 *  - cargando · error · onReintentar
 *  - onCompletar(id): promesa → { recompensa } (completeMission); si falla,
 *    se muestra el mensaje del servidor (los de Firebase en crudo no)
 *  - urlCatalogo
 */
export function PaginaMisiones({
  monedas = 0, xp = 0, niveles = NIVELES, racha = {}, misiones = [], fecha, cargando = false, error = false, onReintentar, onCompletar, urlCatalogo = '/cuenta/catalogo',
}) {
  const [aviso, setAviso] = useState(null);
  const hechas = misiones.filter((m) => m.completada).length;
  const completar = (m) => async () => {
    setAviso(null);
    try {
      const res = await onCompletar?.(m.id);
      const n = res?.recompensa ?? m.recompensa;
      setAviso({ tipo: 'exito', texto: n ? `¡Misión completada! +${n} monedas.` : '¡Misión completada!' });
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDe(err, 'No pudimos completar la misión. Intenta de nuevo.') });
    }
  };
  const dias = racha.dias || 0;
  return (
    <>
      <CabezaCuenta
        icono={<Trophy />}
        tono="oro"
        titulo={<Texto>Misiones diarias</Texto>}
        subtitulo={<Texto>Completa tus misiones cada día y cuida tu racha para ganar monedas y experiencia.</Texto>}
      />
      <div className={s.cifras}>
        <Estadistica
          icono={<Moneda tamano={38} />}
          sello={false}
          etiqueta={<Texto>Monedas</Texto>}
          valor={miles(monedas)}
          nota={<Enlace to={urlCatalogo} className={s.enlaceNota}><Texto>Canjéalas en el catálogo</Texto> <ArrowRight aria-hidden="true" /></Enlace>}
        />
        <Estadistica icono={<Sparkles />} etiqueta={<Texto>Experiencia</Texto>} valor={miles(xp)} unidad="XP" nota={<Texto>La XP sube tu nivel; no se gasta.</Texto>} />
        <Estadistica
          icono={<Flame />}
          tono="rosa"
          etiqueta={<Texto>Racha</Texto>}
          valor={dias}
          unidad={<Texto>{dias === 1 ? 'día' : 'días'}</Texto>}
          nota={<Texto>{racha.hoy ? `Entraste hoy${racha.ganado ? `: +${racha.ganado} ${racha.ganado === 1 ? 'moneda' : 'monedas'}` : ''}.` : 'Entra cada día para no perderla.'}</Texto>}
        />
      </div>
      <NivelCuenta xp={xp} niveles={niveles} />
      {aviso && <Aviso tipo={aviso.tipo} onCerrar={() => setAviso(null)}>{aviso.texto}</Aviso>}
      <CabezaCuenta
        nivel={2}
        titulo={<Texto>Misiones de hoy</Texto>}
        subtitulo={misiones.length ? <><Texto>{`${hechas} de ${misiones.length} completadas`}</Texto>{fecha ? ` · ${fecha}` : ''}</> : fecha}
      />
      {error ? (
        <Aviso tipo="error" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RotateCcw aria-hidden="true" />} onClick={onReintentar}><Texto>Reintentar</Texto></Boton>}>
          No pudimos cargar tus misiones. Intenta de nuevo en unos minutos.
        </Aviso>
      ) : cargando ? (
        <ul className={s.misiones} aria-busy="true"><Esqueletos n={3} forma="fila" /></ul>
      ) : misiones.length === 0 ? (
        <EstadoVacio imagen={null} icono={<Trophy />} titulo={<Texto>Todavía no hay misiones activas</Texto>} texto={<Texto>Vuelve pronto: se agregan seguido.</Texto>} />
      ) : (
        <ul className={s.misiones}>
          {misiones.map((m) => (
            <li key={m.id}>
              <TarjetaMision {...m} onCompletar={onCompletar && !m.accion ? completar(m) : undefined} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ── Mis referidos (/cuenta/referidos) ──────────────────── */

const VISIBLES = 5;
const FIGURA_GRUPO = { invitacion: 'regalo', tienda: 'ubicacion', anteriores: 'cambio', producto: 'polera' };

function GrupoReferidos({ grupo, onReclamar, onVerPedido }) {
  const [todas, setTodas] = useState(false);
  const [abiertos, setAbiertos] = useState([]);
  const [reclamando, setReclamando] = useState(null);
  const personas = grupo.personas || [];
  const visibles = todas ? personas : personas.slice(0, VISIBLES);
  const cuentas = {
    entraron: personas.length,
    nuevas: personas.filter((p) => p.cuentaNueva).length,
    compraron: personas.filter((p) => p.compro).length,
  };
  const meta = [
    `${cuentas.entraron} ${cuentas.entraron === 1 ? 'entró' : 'entraron'}`,
    cuentas.nuevas ? `${cuentas.nuevas} ${cuentas.nuevas === 1 ? 'cuenta nueva' : 'cuentas nuevas'}` : null,
    `${cuentas.compraron} ${cuentas.compraron === 1 ? 'compró' : 'compraron'}`,
  ].filter(Boolean).join(' · ');
  const alternar = (id) => {
    setAbiertos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
    if (!abiertos.includes(id)) onVerPedido?.(id);
  };
  const reclamar = (p) => async () => {
    setReclamando(p.id);
    try { await onReclamar?.(p.id); } catch { setAbiertos((a) => (a.includes(p.id) ? a : [...a, p.id])); } finally { setReclamando(null); }
  };
  const figura = grupo.imagen
    ? <FotoProducto className={s.grupoFoto} src={grupo.imagen} />
    : <IconoWala nombre={FIGURA_GRUPO[grupo.tipo] || 'regalo'} tamano={44} girar={-6} />;
  return (
    <TarjetaCuenta figura={figura} antetitulo={grupo.antetitulo} titulo={grupo.titulo} subtitulo={meta}>
      {grupo.descripcion && <p className={s.grupoTexto}>{grupo.descripcion}</p>}
      {personas.length === 0 ? (
        <p className={s.grupoTexto}>Todavía nadie entró por este link.</p>
      ) : (
        <ul className={s.personas}>
          {visibles.map((p) => (
            <FilaReferido
              key={p.id}
              nombre={p.nombre}
              chips={p.chips}
              detalle={p.detalle}
              ganancia={p.ganancia}
              confirmada={p.confirmada}
              acciones={(p.pedido || p.reclamo) && (
                <>
                  {p.pedido && (
                    <Boton variante="fantasma" tamano="sm" icono={<Receipt aria-hidden="true" />} onClick={() => alternar(p.id)} aria-expanded={abiertos.includes(p.id)}>
                      {abiertos.includes(p.id) ? 'Ocultar pedido' : 'Ver pedido'}
                    </Boton>
                  )}
                  {p.reclamo === 'listo' && (
                    <Boton tamano="sm" icono={<Coins aria-hidden="true" />} cargando={reclamando === p.id} onClick={reclamar(p)}>Reclamar monedas</Boton>
                  )}
                  {p.reclamo === 'revisando' && <Boton tamano="sm" variante="contorno" disabled>Revisando pedido…</Boton>}
                  {p.reclamo === 'alEntregarse' && <Boton tamano="sm" variante="contorno" disabled title="Se activa cuando el pedido se entrega">Reclamar al entregarse</Boton>}
                </>
              )}
            >
              {abiertos.includes(p.id) && p.pedido && <DetallePedidoReferido {...p.pedido} />}
            </FilaReferido>
          ))}
        </ul>
      )}
      {personas.length > VISIBLES && (
        <button type="button" className={s.verTodas} onClick={() => setTodas((v) => !v)}>
          {todas ? 'Ver menos' : `Ver las ${personas.length} personas`}
        </button>
      )}
      {grupo.sinAbrir > 0 && (
        <p className={s.grupoNota}>{grupo.sinAbrir} {grupo.sinAbrir === 1 ? 'link generado sigue sin abrir' : 'links generados siguen sin abrir'}.</p>
      )}
    </TarjetaCuenta>
  );
}

/**
 * Mis referidos: cómo se gana, el link de invitación, las cifras y quién
 * entró por cada link (agrupado: tu invitación, cada producto compartido,
 * links a la tienda, links anteriores).
 *  - url (linkInvitacion), codigo · monedas: saldo actual
 *  - resumen: { entraron, cuentasNuevas, compras, porReclamar, ganadas }
 *  - grupos: [{ id, tipo, antetitulo, titulo, imagen, descripcion, sinAbrir,
 *    personas: [{ id, nombre, chips, detalle, ganancia, confirmada,
 *    cuentaNueva, compro, reclamo: 'listo' | 'revisando' | 'alEntregarse',
 *    pedido: props de DetallePedidoReferido }] }] (el de la invitación primero)
 *  - cargando · bono (10), premio (15): los números de la invitación
 *  - onCompartir() · onCopiar(url) · onReclamar(id): promesas
 *  - onVerPedido(id): para pedir el detalle al abrirlo · urlTienda
 *  - ranking: { items, cargando } los que más regalaron este mes
 */
export function PaginaReferidos({
  url, codigo, monedas = 0, resumen = {}, grupos = [], cargando = false, bono = 10, premio = 15,
  onCompartir, onCopiar, onReclamar, onVerPedido, urlTienda = '/tienda', ranking,
}) {
  const { entraron = 0, cuentasNuevas = 0, compras = 0, porReclamar = 0, ganadas = 0 } = resumen;
  const otros = grupos.filter((g) => g.tipo !== 'invitacion');
  return (
    <>
      <CabezaCuenta
        icono={<Users />}
        tono="oro"
        titulo="Invita y gana monedas"
        subtitulo="Cada moneda vale S/ 1 de descuento, y la ganas cuando el pedido se entrega."
      />
      <div className={s.formas}>
        <FormaGanar icono="regalo" titulo="Invita a alguien nuevo">
          Con tu link crea su cuenta y recibe <strong>{bono} monedas</strong>. Con su primera compra (tiene 30 días) tú ganas <strong>{premio} monedas</strong>, o el 5 % / 10 % si es más.
        </FormaGanar>
        <FormaGanar icono="polera" titulo="Comparte un producto">
          Quien compre dentro de las 36 h desde que abre tu link te suma el <strong>5 %</strong> de su compra, o el <strong>10 %</strong> si pasa de S/ 200.
        </FormaGanar>
      </div>

      <TarjetaCuenta icono={<Link2 />} titulo="Tu link de invitación" subtitulo="No caduca y es siempre el mismo.">
        <EnlaceInvitacion url={url} onCompartir={onCompartir} onCopiar={onCopiar} />
        <p className={s.grupoNota}>
          Para un producto: ábrelo en la <Enlace to={urlTienda} className={s.enlaceNota}>tienda</Enlace> y toca compartir.
          {codigo && <> Tu código es <strong>{codigo}</strong>.</>}
        </p>
      </TarjetaCuenta>

      <div className={s.cifras}>
        <Estadistica icono={<MousePointerClick />} etiqueta="Entraron" valor={miles(entraron)} unidad={entraron === 1 ? 'persona' : 'personas'}
          nota={cuentasNuevas ? `${cuentasNuevas} ${cuentasNuevas === 1 ? 'creó su cuenta' : 'crearon su cuenta'} con tu invitación` : 'Por cualquiera de tus links.'} />
        <Estadistica icono={<ShoppingBag />} tono="rosa" etiqueta="Compras" valor={miles(compras)}
          nota={porReclamar ? `${porReclamar} por reclamar` : 'Hechas con tus links.'} />
        <Estadistica icono={<Coins />} tono="oro" etiqueta="Ganadas" valor={miles(ganadas)} unidad="monedas" nota={`Saldo actual: ${miles(monedas)}`} />
      </div>

      <CabezaCuenta nivel={2} titulo="Quiénes entraron a tus links" subtitulo={cargando ? undefined : `${entraron} ${entraron === 1 ? 'persona' : 'personas'}`} />
      {cargando ? (
        <ul className={s.misiones} aria-busy="true"><Esqueletos n={2} alto={180} /></ul>
      ) : (
        <div className={s.grupos}>
          {grupos.filter((g) => g.tipo === 'invitacion').map((g) => (
            <GrupoReferidos key={g.id} grupo={g} onReclamar={onReclamar} onVerPedido={onVerPedido} />
          ))}
          {otros.length === 0 ? (
            <TarjetaCuenta icono={<Send />} tono="suave" titulo="Todavía no compartiste productos" subtitulo="Abre un producto en la tienda y toca compartir: aquí verás quién entró y quién compró." />
          ) : otros.map((g) => (
            <GrupoReferidos key={g.id} grupo={g} onReclamar={onReclamar} onVerPedido={onVerPedido} />
          ))}
        </div>
      )}
      {ranking && <RankingReferidos {...ranking} tuCodigo={codigo} />}
    </>
  );
}
