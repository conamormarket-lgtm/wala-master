import React, { useEffect, useState } from 'react';
import { Archive, CircleAlert, RefreshCw, Trash2 } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, HojaInferior } from '../Feedback';
import { Casilla } from '../Formulario';
import { Texto } from '../Traduccion';
import { TarjetaCuenta } from './Cuenta';
import { BotonGoogle, CampoContrasena } from './Acceso';
import s from './BorrarCuenta.module.css';

/*
 * "Borrar mi cuenta", al final de Ajustes (/cuenta/ajustes#borrar-cuenta).
 * Dice qué se borra y qué se conserva; "Quiero borrar mi cuenta" revisa en el
 * servidor si hay algo pendiente (pedido sin entregar, saldo, suscripción
 * activa…). Sin pendientes, abre una hoja para volver a entrar (contraseña o
 * Google) y confirmar con el botón rojo. Los datos y las llamadas entran por
 * props (en la tienda: components/cuenta/BorrarCuentaDeCuenta.jsx).
 *  - seBorra, seConserva: [texto] lo que se explica
 *  - estado: 'inicio' | 'revisando' | 'pendientes' | 'listo' (hoja abierta)
 *  - pendientes: [{ tipo, texto }] · error: texto del último fallo al revisar
 *  - metodos: { contrasena, google } cómo puede volver a entrar
 *  - onRevisar() · onCancelar() cierra la hoja
 *  - onBorrar({ metodo, contrasena }) → promesa; si falla con Error, su
 *    mensaje se muestra en la hoja
 */
export function TarjetaBorrarCuenta({
  seBorra = [], seConserva = [], estado = 'inicio', pendientes = [], error,
  metodos = { contrasena: true, google: false }, onRevisar, onCancelar, onBorrar, id = 'borrar-cuenta',
}) {
  const revisando = estado === 'revisando';
  // Mientras se revisa de nuevo, lo pendiente sigue a la vista.
  const conPendientes = pendientes.length > 0 && (estado === 'pendientes' || revisando);
  return (
    <TarjetaCuenta
      id={id}
      className={s.tarjeta}
      icono={<Trash2 />}
      tono="peligro"
      titulo={<Texto>Borrar mi cuenta</Texto>}
      subtitulo={<Texto>Borra tu cuenta de Walá y tus datos personales, para siempre.</Texto>}
    >
      <div className={s.columnas}>
        <div className={s.bloque}>
          <p className={s.bloqueTitulo}><Trash2 aria-hidden="true" /> <Texto>Se borra</Texto></p>
          <ul className={s.lista}>{seBorra.map((t) => <li key={t}><Texto>{t}</Texto></li>)}</ul>
        </div>
        <div className={s.bloque}>
          <p className={s.bloqueTitulo}><Archive aria-hidden="true" /> <Texto>Se conserva</Texto></p>
          <ul className={s.lista}>{seConserva.map((t) => <li key={t}><Texto>{t}</Texto></li>)}</ul>
        </div>
      </div>

      {conPendientes && (
        <div className={s.pendientes} role="status">
          <p className={s.pendientesTitulo}><CircleAlert aria-hidden="true" /> <Texto>Antes de borrar tu cuenta resuelve lo pendiente</Texto></p>
          <ul className={s.lista}>{pendientes.map((p) => <li key={`${p.tipo}-${p.texto}`}><Texto>{p.texto}</Texto></li>)}</ul>
          <p className={s.nota}><Texto>Cuando esté resuelto, vuelve aquí. Si crees que es un error, escríbenos por WhatsApp.</Texto></p>
        </div>
      )}
      {error && <Aviso tipo="error" compacto>{error}</Aviso>}

      <div className={s.acciones}>
        {conPendientes ? (
          <Boton variante="secundario" icono={<RefreshCw aria-hidden="true" />} cargando={revisando} onClick={onRevisar}>
            <Texto>Revisar de nuevo</Texto>
          </Boton>
        ) : (
          <Boton variante="contorno" className={s.botonPeligro} icono={<Trash2 aria-hidden="true" />} cargando={revisando} onClick={onRevisar}>
            <Texto>Quiero borrar mi cuenta</Texto>
          </Boton>
        )}
      </div>

      <HojaConfirmarBorrado abierta={estado === 'listo'} metodos={metodos} onCancelar={onCancelar} onBorrar={onBorrar} />
    </TarjetaCuenta>
  );
}

/** La hoja final: volver a entrar, marcar que se entiende y el botón rojo. */
function HojaConfirmarBorrado({ abierta, metodos, onCancelar, onBorrar }) {
  const [metodo, setMetodo] = useState(metodos.contrasena ? 'contrasena' : 'google');
  const [contrasena, setContrasena] = useState('');
  const [entiendo, setEntiendo] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState('');

  // Cada vez que se abre, desde cero.
  useEffect(() => {
    if (!abierta) return;
    setMetodo(metodos.contrasena ? 'contrasena' : 'google');
    setContrasena('');
    setEntiendo(false);
    setError('');
  }, [abierta, metodos.contrasena]);

  const listo = entiendo && (metodo !== 'contrasena' || contrasena.length > 0);
  const borrar = async () => {
    if (!listo || borrando) return;
    setBorrando(true);
    setError('');
    try {
      await onBorrar?.({ metodo, contrasena });
    } catch (e) {
      setError(e?.message || 'No pudimos borrar tu cuenta. Vuelve a intentarlo.');
    } finally {
      setBorrando(false);
    }
  };

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCancelar}
      titulo="¿Borrar tu cuenta para siempre?"
      tamano="sm"
      bloqueada={borrando}
      pie={(
        <div className={s.pie}>
          <Boton variante="fantasma" onClick={onCancelar} disabled={borrando}><Texto>Cancelar</Texto></Boton>
          <Boton variante="peligro" icono={<Trash2 aria-hidden="true" />} onClick={borrar} cargando={borrando} disabled={!listo}>
            <Texto>{metodo === 'google' ? 'Confirmar con Google y borrar mi cuenta' : 'Borrar mi cuenta para siempre'}</Texto>
          </Boton>
        </div>
      )}
    >
      <div className={s.hoja}>
        <p className={s.texto}>
          <Texto>Se borran tu perfil, tus direcciones, tus creaciones, tus monedas y cupones, y tu acceso. No se puede deshacer.</Texto>
        </p>
        <p className={s.texto}>
          <Texto>Por seguridad, confirma que eres tú.</Texto>
        </p>
        {metodo === 'contrasena' ? (
          <CampoContrasena valor={contrasena} onCambiar={setContrasena} disabled={borrando} etiqueta="Tu contraseña" />
        ) : (
          <p className={s.nota}><Texto>Al confirmar se abre Google: elige la misma cuenta con la que entras a Walá.</Texto></p>
        )}
        {/* Con las dos formas de entrar, se elige una. */}
        {metodos.contrasena && metodos.google && (metodo === 'contrasena' ? (
          <BotonGoogle disabled={borrando} onClick={() => { setMetodo('google'); setError(''); }}>Usar Google en vez de la contraseña</BotonGoogle>
        ) : (
          <Boton variante="fantasma" bloque disabled={borrando} onClick={() => { setMetodo('contrasena'); setError(''); }}><Texto>Usar mi contraseña</Texto></Boton>
        ))}
        <Casilla
          activo={entiendo}
          onChange={setEntiendo}
          disabled={borrando}
          etiqueta="Entiendo que mi cuenta se borra para siempre"
          descripcion="Mis pedidos y comprobantes se conservan solo porque la ley lo exige."
        />
        {error && <Aviso tipo="error" compacto>{error}</Aviso>}
      </div>
    </HojaInferior>
  );
}
