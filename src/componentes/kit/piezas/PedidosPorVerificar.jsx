import React, { useState } from 'react';
import { ShieldCheck, MailCheck, Link2 } from 'lucide-react';
import Boton from '../Boton';
import { Aviso } from '../Feedback';
import { Etiqueta } from '../Etiquetas';
import { Campo, CampoTelefono } from '../Formulario';
import { TarjetaCuenta } from './Cuenta';
import s from './PedidosPorVerificar.module.css';

function FormVincular({ referencia, onVincular }) {
  const [numero, setNumero] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const vincular = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await onVincular({ ref: referencia, numeroPedido: numero.trim().toUpperCase(), telefono });
    } catch (err) {
      setError(err?.message || 'No se pudo vincular el pedido. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };
  return (
    <form className={s.form} onSubmit={vincular} noValidate>
      <div className={s.fila}>
        <Campo etiqueta="Número de pedido" value={numero} onChange={(e) => setNumero(e.target.value.toUpperCase())} placeholder="Ej. PD-LQ3X9K2" autoCapitalize="characters" />
        <CampoTelefono etiqueta="Teléfono con el que compraste" valor={telefono} onCambiar={setTelefono} />
      </div>
      {error && <Aviso tipo="error" compacto>{error}</Aviso>}
      <Boton type="submit" tamano="sm" cargando={enviando} disabled={!numero.trim() || !telefono}>Vincular pedido</Boton>
    </form>
  );
}

/**
 * Pedidos que coinciden con el documento pero aún no se sabe si son del
 * cliente: solo la fecha y la fase. Se ven completos al verificar el correo
 * con el que se hicieron o al vincularlos con el número de pedido.
 *  - pendientes: [{ ref, fecha ("12 oct 2026"), fase ("En producción"),
 *    mismoCorreo, pistaCorreo ("i***@gmail.com") }]
 *  - correoVerificado
 *  - onEnviarVerificacion(): promesa → { yaVerificado } (enviarVerificacionCorreo)
 *  - onYaVerifique(): promesa → true si ya está verificado (refrescarVerificacionCorreo)
 *  - onVincular({ ref, numeroPedido, telefono }): promesa; si falla, su mensaje
 */
export function PedidosPorVerificar({ pendientes = [], correoVerificado = false, onEnviarVerificacion, onYaVerifique, onVincular }) {
  const [abierto, setAbierto] = useState(null);
  const [paso, setPaso] = useState('inicio'); // inicio | enviado
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  if (!pendientes.length) return null;
  const n = pendientes.length;
  const conCorreo = !correoVerificado && pendientes.some((p) => p.mismoCorreo);

  const enviar = async () => {
    setOcupado(true); setError('');
    try {
      const r = await onEnviarVerificacion?.();
      if (r?.yaVerificado) await onYaVerifique?.();
      else setPaso('enviado');
    } catch (err) { setError(err?.message || 'No pudimos enviar el correo. Inténtalo de nuevo.'); } finally { setOcupado(false); }
  };
  const comprobar = async () => {
    setOcupado(true); setError('');
    try {
      const ok = await onYaVerifique?.();
      if (!ok) setError('Aún no vemos tu correo verificado. Abre el enlace que te enviamos y vuelve a intentarlo.');
    } finally { setOcupado(false); }
  };

  return (
    <TarjetaCuenta
      icono={<ShieldCheck />}
      tono="oro"
      titulo={n === 1 ? 'Tienes 1 pedido por verificar' : `Tienes ${n} pedidos por verificar`}
      subtitulo="Coinciden con tu documento, pero aún no podemos confirmar que son tuyos. Por tu seguridad, solo te mostramos la fecha y la fase."
    >
      {conCorreo && (
        <Aviso
          tipo="info"
          icono={<MailCheck aria-hidden="true" />}
          accion={paso === 'inicio' ? (
            <Boton tamano="sm" cargando={ocupado} onClick={enviar}>Verificar mi correo</Boton>
          ) : (
            <span className={s.botones}>
              <Boton tamano="sm" cargando={ocupado} onClick={comprobar}>Ya lo verifiqué</Boton>
              <Boton tamano="sm" variante="fantasma" onClick={enviar} disabled={ocupado}>Reenviar correo</Boton>
            </span>
          )}
        >
          {paso === 'inicio'
            ? 'Algunos se hicieron con el correo de tu cuenta. Verifícalo y aparecerán completos.'
            : 'Te enviamos un enlace a tu correo. Ábrelo y luego toca «Ya lo verifiqué».'}
        </Aviso>
      )}
      {error && <Aviso tipo="error" compacto>{error}</Aviso>}
      <ul className={s.lista}>
        {pendientes.map((p) => (
          <li key={p.ref} className={s.pendiente}>
            <div className={s.cabeza}>
              <span className={s.fecha}>{p.fecha || 'Fecha no disponible'}</span>
              <Etiqueta tono="violeta" punto>{p.fase || 'Recibido'}</Etiqueta>
            </div>
            {p.pistaCorreo && !p.mismoCorreo && (
              <p className={s.pista}>Se hizo con el correo <strong>{p.pistaCorreo}</strong>. Si es tuyo, inicia sesión con ese correo para verlo.</p>
            )}
            {onVincular && (abierto === p.ref ? (
              <FormVincular referencia={p.ref} onVincular={onVincular} />
            ) : (
              <button type="button" className={s.textoBoton} onClick={() => setAbierto(p.ref)}>
                <Link2 aria-hidden="true" /> Vincular con mi número de pedido
              </button>
            ))}
          </li>
        ))}
      </ul>
    </TarjetaCuenta>
  );
}
