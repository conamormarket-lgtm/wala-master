import React, { useState } from 'react';
import { ArrowRight, Mail, Package, Brush, ShieldCheck, Coins, Heart, MailCheck, ArrowLeft, Info } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Aviso } from '../Feedback';
import { Campo, Casilla, CampoContrasena } from '../Formulario';
import { LogoWala, Garabatos, Trazo, Sello } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { ProgresoEncuesta } from '../piezas/Encuesta';
import { RequisitosContrasena, contrasenaValida, BotonGoogle, SeparadorAcceso } from '../piezas/Acceso';
import { CamposDatosPersonales, validarPerfil, NOMBRE_DOCUMENTO } from '../piezas/DatosPersonales';
import s from './Acceso.module.css';

/*
 * Entrar a la tienda: iniciar sesión (/login), crear cuenta (/registro, en
 * dos pasos), recuperar la contraseña (/recuperar-contrasena) y completar el
 * perfil (/completar-perfil, al entrar con Google o con datos a medias).
 * Van dentro de MarcoTienda. Datos por props: las páginas no hablan con
 * Firebase; reciben funciones que devuelven promesas y, si fallan, muestran
 * el mensaje del error (getAuthErrorMessage en la tienda).
 */

const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c || '').trim());
const mensaje = (e, porDefecto) => (e && typeof e.message === 'string' && e.message) || porDefecto;

/** Lo que trae una cuenta, en el panel de la marca de cada página. */
const BENEFICIOS = {
  entrar: [
    { Icono: Package, texto: 'Mira por dónde va tu pedido' },
    { Icono: Brush, texto: 'Tus diseños guardados' },
    { Icono: ShieldCheck, texto: 'Acceso rápido y seguro' },
  ],
  registro: [
    { Icono: Package, texto: 'Rastrea tus compras' },
    { Icono: Coins, texto: 'Gana monedas con tus pedidos' },
    { Icono: Heart, texto: 'Guarda lo que te gusta' },
  ],
};

/**
 * El marco de las páginas de acceso: a la izquierda el panel de la marca
 * (degradado del logo, garabatos quietos, título con trazo, lo que trae la
 * cuenta y Kapi asomado) y a la derecha el formulario. Angosto (menos de
 * 860px), el panel se vuelve una franja arriba del formulario.
 *  - panel: { titulo, texto, beneficios: [{ Icono, texto }] }
 *  - titulo, texto: los del formulario · arriba: nodo sobre el título (avance)
 *  - pie: nodo al final ("¿No tienes una cuenta?…") · children: el formulario
 */
export function MarcoAcceso({ panel = {}, titulo, texto, arriba, pie, children }) {
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
      <div className={s.contenedor}>
        <div className={s.acceso} data-componente="MarcoAcceso">
          <aside className={s.panel}>
            <Garabatos className={s.garabatos} />
            <LogoWala tono="blanco" tamano={30} className={s.logo} />
            <div className={s.panelTextos}>
              <h2 className={s.panelTitulo}>
                {panel.titulo}
                <Trazo className={s.panelTrazo} />
              </h2>
              {panel.texto && <p className={s.panelTexto}>{panel.texto}</p>}
            </div>
            {panel.beneficios?.length > 0 && (
              <ul className={s.beneficios}>
                {panel.beneficios.map(({ Icono, texto: t }, k) => (
                  <li key={t} style={{ '--i': k }}>
                    <Sello tamano={32} tono="suave" girar={k % 2 ? 6 : -8}><Icono aria-hidden="true" /></Sello>
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <img className={s.kapi} src="/assets/kapi/kapi-happy.webp" alt="" width="120" height="120" />
          </aside>
          <div className={s.lado}>
            {arriba}
            <header className={s.cabeza}>
              <h1 className={s.titulo}>{titulo}</h1>
              {texto && <p className={s.texto}>{texto}</p>}
            </header>
            {children}
            {pie && <p className={s.pie}>{pie}</p>}
          </div>
        </div>
      </div>
    </BloqueSeccion>
  );
}

/* ── Iniciar sesión (/login) ────────────────────────────── */

/**
 * Iniciar sesión con correo y contraseña o con Google.
 *  - onEntrar({ correo, contrasena }): promesa; si falla, su mensaje se ve
 *  - onGoogle(): promesa (cerrar la ventana de Google no es un error: resolver)
 *  - motivo: por qué se pide entrar ("Inicia sesión para participar en el sorteo")
 *  - urlRegistro · urlRecuperar
 * Al entrar, la tienda decide adónde ir (completar perfil, encuesta o volver).
 */
export function PaginaLogin({ onEntrar, onGoogle, motivo, urlRegistro = '/registro', urlRecuperar = '/recuperar-contrasena' }) {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(null);

  const entrar = async (e) => {
    e.preventDefault();
    if (cargando) return;
    const faltan = {};
    if (!correoValido(correo)) faltan.correo = 'Escribe tu correo (ej. nombre@correo.com).';
    if (!contrasena) faltan.contrasena = 'Escribe tu contraseña.';
    setErrores(faltan);
    setError('');
    if (Object.keys(faltan).length) return;
    setCargando('correo');
    try {
      await onEntrar?.({ correo: correo.trim().toLowerCase(), contrasena });
    } catch (err) {
      setError(mensaje(err, 'No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo.'));
    } finally {
      setCargando(null);
    }
  };
  const google = async () => {
    if (cargando) return;
    setError('');
    setCargando('google');
    try {
      await onGoogle?.();
    } catch (err) {
      setError(mensaje(err, 'No pudimos entrar con Google. Inténtalo de nuevo.'));
    } finally {
      setCargando(null);
    }
  };

  return (
    <MarcoAcceso
      panel={{ titulo: 'Bienvenido de vuelta', texto: 'Entra para ver tus pedidos, tus monedas y los diseños que guardaste.', beneficios: BENEFICIOS.entrar }}
      titulo="Iniciar sesión"
      texto="Con tu correo y tu contraseña."
      pie={<>¿No tienes una cuenta? <Enlace to={urlRegistro} className={s.enlace}>Regístrate aquí</Enlace></>}
    >
      {motivo && <Aviso tipo="info" compacto icono={<Info aria-hidden="true" />}>{motivo}</Aviso>}
      <form className={s.formulario} onSubmit={entrar} noValidate>
        <Campo
          etiqueta="Correo electrónico"
          icono={<Mail />}
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nombre@correo.com"
          value={correo}
          onChange={(e) => { setCorreo(e.target.value); setErrores((x) => ({ ...x, correo: undefined })); }}
          error={errores.correo}
          disabled={Boolean(cargando)}
        />
        <div className={s.conEnlace}>
          <CampoContrasena
            valor={contrasena}
            onCambiar={(v) => { setContrasena(v); setErrores((x) => ({ ...x, contrasena: undefined })); }}
            placeholder="Tu contraseña"
            error={errores.contrasena}
            disabled={Boolean(cargando)}
          />
          <Enlace to={urlRecuperar} className={`${s.enlace} ${s.olvido}`}>¿Olvidaste tu contraseña?</Enlace>
        </div>
        {error && <Aviso tipo="error" compacto>{error}</Aviso>}
        <Boton type="submit" bloque tamano="lg" cargando={cargando === 'correo'} disabled={cargando === 'google'} iconoFin={<ArrowRight aria-hidden="true" />}>
          Iniciar sesión
        </Boton>
      </form>
      {onGoogle && (
        <>
          <SeparadorAcceso />
          <BotonGoogle onClick={google} cargando={cargando === 'google'} disabled={cargando === 'correo'}>Iniciar con Google</BotonGoogle>
        </>
      )}
    </MarcoAcceso>
  );
}

/* ── Crear cuenta (/registro) ───────────────────────────── */

/** "DNI 12345678 · 987 654 321": lo que se confirma antes de registrar. */
function ResumenDatos({ datos, paises }) {
  const peru = (datos.pais || 'PE') === 'PE';
  const prefijo = paises.find((p) => p.valor === datos.pais)?.prefijo;
  const tel = String(datos.telefono || '').replace(/\D/g, '');
  return (
    <dl className={s.resumen}>
      <div><dt>Nombre</dt><dd>{datos.nombre}</dd></div>
      <div><dt>{peru ? NOMBRE_DOCUMENTO[datos.tipoDocumento || 'DNI'] : 'Documento'}</dt><dd>{datos.documento}</dd></div>
      <div><dt>Celular</dt><dd>{prefijo && !peru ? `${prefijo} ` : ''}{tel.replace(/(\d{3})(?=\d)/g, '$1 ')}</dd></div>
    </dl>
  );
}

/**
 * Crear cuenta en dos pasos: 1) correo y contraseña (con sus reglas a la
 * vista y los términos), o Google; 2) los datos del pedido (los de Mi
 * perfil), que se confirman en la misma tarjeta antes de guardar.
 *  - paso: 1 o 2 (2 si ya hay sesión pero faltan los datos)
 *  - onCrearCuenta({ correo, contrasena }): promesa → pasa al paso 2
 *  - onGoogle(): promesa (la tienda lleva a completar el perfil)
 *  - onRegistrar(datos): promesa con { nombre, pais, tipoDocumento, documento, telefono }
 *  - datosIniciales: { pais } (el detectado) · paises · correo: el de la cuenta (paso 2)
 *  - urlLogin · urlTerminos · urlPrivacidad
 */
export function PaginaRegistro({
  paso: pasoInicial = 1, onCrearCuenta, onGoogle, onRegistrar, datosIniciales = {}, correo: correoCuenta,
  paises = [{ valor: 'PE', texto: 'Perú', prefijo: '+51' }],
  urlLogin = '/login', urlTerminos = '/terminos-y-condiciones', urlPrivacidad = '/politicas-privacidad',
}) {
  const [paso, setPaso] = useState(pasoInicial);
  const [sentido, setSentido] = useState('adelante');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [repetir, setRepetir] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [datos, setDatos] = useState(() => ({ nombre: '', pais: 'PE', tipoDocumento: 'DNI', documento: '', telefono: '', ...datosIniciales }));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(null);
  const [confirmar, setConfirmar] = useState(false);

  const crear = async (e) => {
    e.preventDefault();
    if (cargando) return;
    const faltan = {};
    if (!correoValido(correo)) faltan.correo = 'Escribe un correo válido (ej. nombre@correo.com).';
    if (!contrasenaValida(contrasena)) faltan.contrasena = 'Tu contraseña aún no cumple todo lo de abajo.';
    if (repetir !== contrasena || !repetir) faltan.repetir = 'Las contraseñas no coinciden.';
    if (!acepto) faltan.acepto = 'Acepta los términos para crear tu cuenta.';
    setErrores(faltan);
    setError('');
    if (Object.keys(faltan).length) return;
    setCargando('correo');
    try {
      await onCrearCuenta?.({ correo: correo.trim().toLowerCase(), contrasena });
      setSentido('adelante');
      setPaso(2);
    } catch (err) {
      setError(mensaje(err, 'No pudimos crear tu cuenta. Inténtalo de nuevo.'));
    } finally {
      setCargando(null);
    }
  };
  const google = async () => {
    if (cargando) return;
    setError('');
    setCargando('google');
    try {
      await onGoogle?.();
    } catch (err) {
      setError(mensaje(err, 'No pudimos entrar con Google. Inténtalo de nuevo.'));
    } finally {
      setCargando(null);
    }
  };
  const revisar = (e) => {
    e.preventDefault();
    const encontrados = validarPerfil(datos);
    setErrores(encontrados);
    setError('');
    if (Object.keys(encontrados).length) return;
    setConfirmar(true);
  };
  const registrar = async () => {
    setCargando('datos');
    setError('');
    try {
      await onRegistrar?.({ ...datos, nombre: datos.nombre.trim(), documento: String(datos.documento).trim() });
    } catch (err) {
      setConfirmar(false);
      setError(mensaje(err, 'No pudimos guardar tus datos. Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      setCargando(null);
    }
  };

  const avance = <ProgresoEncuesta texto={`Paso ${paso} de 2`} avance={paso / 2} />;

  if (paso === 1) {
    return (
      <MarcoAcceso
        panel={{ titulo: 'Crea tu cuenta', texto: 'En un minuto: tu correo, una contraseña y los datos para tus pedidos.', beneficios: BENEFICIOS.registro }}
        titulo="Crear cuenta"
        texto="Tu correo y una contraseña."
        arriba={avance}
        pie={<>¿Ya tienes cuenta? <Enlace to={urlLogin} className={s.enlace}>Inicia sesión</Enlace></>}
      >
        <form key="p1" className={[s.formulario, sentido === 'atras' ? s.entraAtras : s.entraAdelante].join(' ')} onSubmit={crear} noValidate>
          <Campo
            etiqueta="Correo electrónico"
            icono={<Mail />}
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nombre@correo.com"
            value={correo}
            onChange={(e) => { setCorreo(e.target.value); setErrores((x) => ({ ...x, correo: undefined })); }}
            error={errores.correo}
            disabled={Boolean(cargando)}
          />
          <CampoContrasena
            nueva
            etiqueta="Crea una contraseña"
            valor={contrasena}
            onCambiar={(v) => { setContrasena(v); setErrores((x) => ({ ...x, contrasena: undefined })); }}
            error={errores.contrasena}
            disabled={Boolean(cargando)}
            aria-describedby="registro-requisitos"
          />
          <RequisitosContrasena id="registro-requisitos" contrasena={contrasena} />
          <CampoContrasena
            nueva
            etiqueta="Repite la contraseña"
            valor={repetir}
            onCambiar={(v) => { setRepetir(v); setErrores((x) => ({ ...x, repetir: undefined })); }}
            error={errores.repetir || (repetir && repetir !== contrasena && repetir.length >= contrasena.length ? 'Las contraseñas no coinciden.' : undefined)}
            ayuda={repetir && repetir === contrasena ? 'Coinciden.' : undefined}
            disabled={Boolean(cargando)}
          />
          <div className={s.terminos}>
            <Casilla
              activo={acepto}
              onChange={(v) => { setAcepto(v); setErrores((x) => ({ ...x, acepto: undefined })); }}
              disabled={Boolean(cargando)}
              etiqueta={(
                <>
                  Acepto los <Enlace to={urlTerminos} target="_blank" rel="noopener noreferrer" className={s.enlace}>Términos y Condiciones</Enlace> y
                  la <Enlace to={urlPrivacidad} target="_blank" rel="noopener noreferrer" className={s.enlace}>Política de Privacidad</Enlace>
                </>
              )}
            />
            {errores.acepto && <p className={s.errorSuelto} role="alert">{errores.acepto}</p>}
          </div>
          {error && <Aviso tipo="error" compacto>{error}</Aviso>}
          <Boton type="submit" bloque tamano="lg" cargando={cargando === 'correo'} disabled={cargando === 'google'} iconoFin={<ArrowRight aria-hidden="true" />}>
            Siguiente
          </Boton>
        </form>
        {onGoogle && (
          <>
            <SeparadorAcceso />
            <BotonGoogle onClick={google} cargando={cargando === 'google'} disabled={cargando === 'correo'} />
          </>
        )}
      </MarcoAcceso>
    );
  }

  return (
    <MarcoAcceso
      panel={{ titulo: 'Ya casi', texto: 'Con tu documento y tu celular ubicamos tus pedidos y te avisamos cuando estén listos.', beneficios: BENEFICIOS.registro }}
      titulo="Tus datos para el pedido"
      texto={correoCuenta ? <>Tu cuenta: <strong className={s.correo}>{correoCuenta}</strong></> : 'Tu nombre, tu documento y tu celular.'}
      arriba={avance}
    >
      <form key="p2" className={[s.formulario, s.entraAdelante].join(' ')} onSubmit={revisar} noValidate>
        <CamposDatosPersonales
          datos={datos}
          onCambiar={(campo, valor) => { setDatos((d) => ({ ...d, [campo]: valor })); setErrores((x) => ({ ...x, [campo]: undefined })); setConfirmar(false); }}
          errores={errores}
          paises={paises}
          cumpleanos={false}
          disabled={cargando === 'datos'}
        />
        {error && <Aviso tipo="error" compacto>{error}</Aviso>}
        {confirmar ? (
          <div className={s.confirmar} role="group" aria-labelledby="registro-confirmar">
            <p id="registro-confirmar" className={s.confirmarTitulo}>¿Tus datos son correctos?</p>
            <p className={s.confirmarTexto}>Con tu documento y tu celular rastreamos tus pedidos.</p>
            <ResumenDatos datos={datos} paises={paises} />
            <div className={s.botones}>
              <Boton type="button" variante="fantasma" onClick={() => setConfirmar(false)} disabled={cargando === 'datos'}>Revisar</Boton>
              <Boton type="button" onClick={registrar} cargando={cargando === 'datos'} iconoFin={<ArrowRight aria-hidden="true" />}>Sí, registrarme</Boton>
            </div>
          </div>
        ) : (
          <Boton type="submit" bloque tamano="lg" iconoFin={<ArrowRight aria-hidden="true" />}>Registrarme</Boton>
        )}
      </form>
    </MarcoAcceso>
  );
}

/* ── Recuperar la contraseña (/recuperar-contrasena) ────── */

/**
 * Pedir el enlace para cambiar la contraseña. Enviado, dice que revise el
 * correo (sin decir si la cuenta existe).
 *  - onEnviar(correo): promesa · urlLogin
 */
export function PaginaRecuperar({ onEnviar, urlLogin = '/login' }) {
  const [correo, setCorreo] = useState('');
  const [errorCorreo, setErrorCorreo] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    if (cargando) return;
    if (!correoValido(correo)) { setErrorCorreo('Escribe tu correo (ej. nombre@correo.com).'); return; }
    setError('');
    setCargando(true);
    try {
      await onEnviar?.(correo.trim().toLowerCase());
      setEnviado(correo.trim().toLowerCase());
    } catch (err) {
      setError(mensaje(err, 'No pudimos enviar el correo. Inténtalo de nuevo.'));
    } finally {
      setCargando(false);
    }
  };

  const panel = { titulo: 'Recupera tu acceso', texto: 'Te enviamos un enlace seguro para que elijas una contraseña nueva.', beneficios: BENEFICIOS.entrar };
  if (enviado) {
    return (
      <MarcoAcceso panel={panel} titulo="Revisa tu correo">
        <div className={`${s.enviado} ${s.entraAdelante}`}>
          <Sello tamano={56} tono="menta" girar={-8}><MailCheck aria-hidden="true" /></Sello>
          <p>
            Si hay una cuenta con <strong className={s.correo}>{enviado}</strong>, te llegará un enlace para cambiar tu contraseña.
            Mira también en spam o promociones.
          </p>
          <Boton to={urlLogin} bloque icono={<ArrowLeft aria-hidden="true" />}>Volver a iniciar sesión</Boton>
          <Boton variante="fantasma" bloque onClick={() => setEnviado('')}>Usar otro correo</Boton>
        </div>
      </MarcoAcceso>
    );
  }
  return (
    <MarcoAcceso
      panel={panel}
      titulo="Recuperar contraseña"
      texto="Escribe tu correo y te enviamos un enlace para cambiarla."
      pie={<Enlace to={urlLogin} className={s.enlace}>Volver a iniciar sesión</Enlace>}
    >
      <form className={s.formulario} onSubmit={enviar} noValidate>
        <Campo
          etiqueta="Correo electrónico"
          icono={<Mail />}
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nombre@correo.com"
          value={correo}
          onChange={(e) => { setCorreo(e.target.value); setErrorCorreo(''); }}
          error={errorCorreo}
          disabled={cargando}
        />
        {error && <Aviso tipo="error" compacto>{error}</Aviso>}
        <Boton type="submit" bloque tamano="lg" cargando={cargando} iconoFin={<ArrowRight aria-hidden="true" />}>Enviar enlace</Boton>
      </form>
    </MarcoAcceso>
  );
}

/* ── Completar perfil (/completar-perfil) ───────────────── */

/**
 * Los datos que faltan para pedir (al entrar con Google, o si el registro
 * quedó a medias): los de Mi perfil, con el cumpleaños opcional.
 *  - inicial: { nombre, pais, tipoDocumento, documento, telefono, cumpleanos }
 *  - correo: el de la cuenta · deGoogle: { nombre, cumpleanos } (vienen de Google)
 *  - onGuardar(datos): promesa (la tienda sigue a la encuesta o adonde iba)
 *  - paises · cargando: mientras se lee el perfil
 */
export function PaginaCompletarPerfil({ inicial = {}, correo, deGoogle = {}, onGuardar, paises = [{ valor: 'PE', texto: 'Perú', prefijo: '+51' }], cargando = false }) {
  const [datos, setDatos] = useState(() => ({ nombre: '', pais: 'PE', tipoDocumento: 'DNI', documento: '', telefono: '', cumpleanos: '', ...inicial }));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    if (guardando) return;
    const encontrados = validarPerfil(datos);
    setErrores(encontrados);
    setError('');
    if (Object.keys(encontrados).length) return;
    setGuardando(true);
    try {
      await onGuardar?.({ ...datos, nombre: datos.nombre.trim(), documento: String(datos.documento).trim() });
    } catch (err) {
      setError(mensaje(err, 'No pudimos guardar tus datos. Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      setGuardando(false);
    }
  };

  const nombreDeGoogle = deGoogle.nombre && datos.nombre === inicial.nombre;
  return (
    <MarcoAcceso
      panel={{ titulo: 'Completa tu perfil', texto: 'Con tu documento y tu celular ubicamos tus pedidos y te avisamos cuando estén listos.', beneficios: BENEFICIOS.registro }}
      titulo="Completa tu perfil"
      texto={correo ? <>Entraste como <strong className={s.correo}>{correo}</strong>. Solo falta esto para tus pedidos.</> : 'Solo falta esto para tus pedidos.'}
    >
      {cargando ? (
        <div className={s.esqueleto} aria-busy="true">
          {[0, 1, 2, 3].map((k) => <span key={k} />)}
        </div>
      ) : (
        <form className={s.formulario} onSubmit={guardar} noValidate>
          <CamposDatosPersonales
            datos={datos}
            onCambiar={(campo, valor) => { setDatos((d) => ({ ...d, [campo]: valor })); setErrores((x) => ({ ...x, [campo]: undefined })); }}
            errores={errores}
            paises={paises}
            ayudaNombre={nombreDeGoogle ? 'Lo tomamos de tu cuenta de Google.' : undefined}
            cumpleanos={{
              etiqueta: 'Tu cumpleaños',
              ayuda: deGoogle.cumpleanos && datos.cumpleanos === inicial.cumpleanos
                ? 'La tomamos de tu cuenta de Google: ¿es correcta?'
                : 'Opcional. Para sorprenderte en tu día.',
            }}
            disabled={guardando}
          />
          {error && <Aviso tipo="error" compacto>{error}</Aviso>}
          <Boton type="submit" bloque tamano="lg" cargando={guardando} iconoFin={<ArrowRight aria-hidden="true" />}>Guardar y continuar</Boton>
        </form>
      )}
    </MarcoAcceso>
  );
}
