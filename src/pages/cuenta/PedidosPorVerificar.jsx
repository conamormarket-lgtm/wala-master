import React, { useState } from 'react';
import { ShieldCheck, MailCheck } from 'lucide-react';
import { enviarVerificacionCorreo, refrescarVerificacionCorreo } from '../../services/firebase/auth';
import { vincularPedido } from '../../services/misPedidos';
import { getAuthErrorMessage } from '../../utils/authErrorMessages';
import { T } from '../../i18n/useTranslatedText';
import styles from './PedidosPorVerificar.module.css';

const ETIQUETA_FASE = {
  pagado: 'Pagado',
  produccion: 'En producción',
  enviado: 'En camino',
  entregado: 'Entregado',
  recibido: 'Recibido',
};

const formatoFecha = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
const fechaCorta = (ms) => (ms ? formatoFecha.format(new Date(ms)) : 'Fecha no disponible');

/** Formulario para vincular UN pedido con número de pedido + teléfono. */
function FormVincular({ refPedido, onVinculado }) {
  const [numeroPedido, setNumeroPedido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const idBase = `vinc-${refPedido.replace(/\W/g, '')}`;

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setError(null);
    setEnviando(true);
    const { error: err } = await vincularPedido({ ref: refPedido, numeroPedido, telefono });
    setEnviando(false);
    if (err) {
      setError(err);
      return;
    }
    onVinculado();
  };

  return (
    <form className={styles.form} onSubmit={enviar}>
      <div className={styles.campo}>
        <label htmlFor={`${idBase}-num`}><T>Número de pedido</T></label>
        <input
          id={`${idBase}-num`}
          value={numeroPedido}
          onChange={(e) => setNumeroPedido(e.target.value)}
          placeholder="Ej. PD-LQ3X9K2"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          disabled={enviando}
        />
      </div>
      <div className={styles.campo}>
        <label htmlFor={`${idBase}-tel`}><T>Teléfono con el que compraste</T></label>
        <input
          id={`${idBase}-tel`}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value.replace(/[^\d+\s]/g, ''))}
          placeholder="Ej. 987654321"
          required
          disabled={enviando}
        />
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" className={styles.botonPrimario} disabled={enviando || !numeroPedido.trim() || !telefono.trim()}>
        {enviando ? <T>Comprobando…</T> : <T>Vincular pedido</T>}
      </button>
    </form>
  );
}

/**
 * Pedidos que coinciden con el documento del perfil pero que la cuenta aún no
 * demostró que son suyos. Por seguridad solo se muestran la fecha y la fase;
 * para ver el detalle, la persona verifica su correo o vincula el pedido.
 *
 * @param {{ pendientes: Array, emailVerificado: boolean, onCambio: () => void }} props
 */
export default function PedidosPorVerificar({ pendientes, emailVerificado, onCambio }) {
  const [abierto, setAbierto] = useState(null);
  const [correo, setCorreo] = useState({ estado: 'inicial', error: null });

  if (!Array.isArray(pendientes) || pendientes.length === 0) return null;

  const hayDeMiCorreo = !emailVerificado && pendientes.some((p) => p.mismoCorreo);
  const total = pendientes.length;

  const enviarCorreo = async () => {
    setCorreo({ estado: 'enviando', error: null });
    const { error, errorCode, yaVerificado } = await enviarVerificacionCorreo();
    if (yaVerificado) {
      await refrescarVerificacionCorreo();
      onCambio();
      return;
    }
    if (error) {
      setCorreo({ estado: 'inicial', error: getAuthErrorMessage(errorCode, error) });
      return;
    }
    setCorreo({ estado: 'enviado', error: null });
  };

  const yaVerifique = async () => {
    setCorreo((c) => ({ ...c, estado: 'comprobando', error: null }));
    const ok = await refrescarVerificacionCorreo();
    if (ok) {
      onCambio();
      return;
    }
    setCorreo({ estado: 'enviado', error: 'Aún no vemos tu correo verificado. Abre el enlace que te enviamos y vuelve a intentarlo.' });
  };

  return (
    <section className={styles.bloque} aria-labelledby="pedidos-por-verificar">
      <div className={styles.cabecera}>
        <span className={styles.icono} aria-hidden="true"><ShieldCheck size={20} /></span>
        <div>
          <h2 id="pedidos-por-verificar">
            {total === 1
              ? <T>Tienes 1 pedido por verificar</T>
              : <T>{`Tienes ${total} pedidos por verificar`}</T>}
          </h2>
          <p className={styles.sub}>
            <T>Coinciden con tu documento, pero aún no podemos confirmar que son tuyos. Por tu seguridad, solo te mostramos la fecha y la fase.</T>
          </p>
        </div>
      </div>

      {hayDeMiCorreo && (
        <div className={styles.aviso}>
          <MailCheck size={18} aria-hidden="true" className={styles.avisoIcono} />
          <div className={styles.avisoTexto}>
            {correo.estado === 'enviado' || correo.estado === 'comprobando' ? (
              <>
                <p><T>Te enviamos un enlace a tu correo. Ábrelo y luego toca «Ya lo verifiqué».</T></p>
                <div className={styles.acciones}>
                  <button type="button" className={styles.botonPrimario} onClick={yaVerifique} disabled={correo.estado === 'comprobando'}>
                    {correo.estado === 'comprobando' ? <T>Comprobando…</T> : <T>Ya lo verifiqué</T>}
                  </button>
                  <button type="button" className={styles.botonTexto} onClick={enviarCorreo}>
                    <T>Reenviar correo</T>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p><T>Algunos se hicieron con el correo de tu cuenta. Verifícalo y aparecerán completos.</T></p>
                <div className={styles.acciones}>
                  <button type="button" className={styles.botonPrimario} onClick={enviarCorreo} disabled={correo.estado === 'enviando'}>
                    {correo.estado === 'enviando' ? <T>Enviando…</T> : <T>Verificar mi correo</T>}
                  </button>
                </div>
              </>
            )}
            {correo.error && <p className={styles.error} role="alert">{correo.error}</p>}
          </div>
        </div>
      )}

      <ul className={styles.lista}>
        {pendientes.map((p) => (
          <li key={p.ref} className={styles.item}>
            <div className={styles.itemFila}>
              <span className={styles.fecha}>{fechaCorta(p.fecha)}</span>
              <span className={styles.fase}><T>{ETIQUETA_FASE[p.fase] || 'Recibido'}</T></span>
            </div>
            {p.pistaCorreo && !p.mismoCorreo && (
              <p className={styles.pista}>
                <T>Se hizo con el correo</T> <strong>{p.pistaCorreo}</strong>. <T>Si es tuyo, inicia sesión con ese correo para verlo.</T>
              </p>
            )}
            {abierto === p.ref ? (
              <FormVincular refPedido={p.ref} onVinculado={onCambio} />
            ) : (
              <button type="button" className={styles.botonTexto} onClick={() => setAbierto(p.ref)}>
                <T>Vincular con mi número de pedido</T>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
