import React, { useState } from 'react';
import { ArrowRight, Mail, Package, Brush, ShieldCheck, Coins, Heart, MailCheck, ArrowLeft, Info } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Aviso } from '../Feedback';
import { Campo } from '../Formulario';
import { LogoWala, Garabatos, Trazo, Sello } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { BotonGoogle, SeparadorAcceso, CampoContrasena } from '../piezas/Acceso';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { TextoResaltado } from '../piezas/TextoResaltado';
import { Texto } from '../Traduccion';
import s from './Acceso.module.css';

/*
 * Entrar a la tienda: iniciar sesión (/login) y recuperar la contraseña
 * (/recuperar-contrasena), con el marco de las cuatro páginas de acceso.
 * Crear cuenta y completar el perfil viven en AccesoDatos.jsx (bajan solo con
 * esas dos páginas). Van dentro de MarcoTienda. Datos por props: las páginas
 * no hablan con Firebase; reciben funciones que devuelven promesas y, si
 * fallan, muestran el mensaje del error (getAuthErrorMessage en la tienda).
 * Los textos pasan por la traducción (<Texto> y useTexto).
 */

export const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c || '').trim());
export const mensaje = (e, porDefecto) => (e && typeof e.message === 'string' && e.message) || porDefecto;

/** Lo que trae una cuenta, en el panel de la marca de cada página. */
export const BENEFICIOS = {
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

/** Un texto suelto traducido (o el nodo tal cual) dentro de un error de campo. */
export const conTexto = (t) => (t ? <Texto>{t}</Texto> : undefined);

/**
 * El marco de las páginas de acceso: a la izquierda el panel de la marca
 * (degradado del logo, garabatos quietos, título con trazo, lo que trae la
 * cuenta y Kapi asomado) y a la derecha el formulario. Angosto (menos de
 * 860px), el panel se vuelve una franja arriba del formulario.
 *  - panel: { titulo, texto, beneficios: [{ Icono, texto }] }
 *  - titulo, texto: los del formulario · arriba: nodo sobre el título (avance)
 *  - pie: nodo al final ("¿No tienes una cuenta?…") · children: el formulario
 * Los textos que llegan como texto se traducen aquí.
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
                <Texto>{panel.titulo}</Texto>
                <Trazo className={s.panelTrazo} />
              </h2>
              {panel.texto && <p className={s.panelTexto}><Texto>{panel.texto}</Texto></p>}
            </div>
            {panel.beneficios?.length > 0 && (
              <ul className={s.beneficios}>
                {panel.beneficios.map(({ Icono, texto: t }, k) => (
                  <li key={t} style={{ '--i': k }}>
                    <Sello tamano={32} tono="suave" girar={k % 2 ? 6 : -8}><Icono aria-hidden="true" /></Sello>
                    <Texto>{t}</Texto>
                  </li>
                ))}
              </ul>
            )}
            <img className={s.kapi} src={CARAS_KAPI.feliz} alt="" width="120" height="120" />
          </aside>
          <div className={s.lado}>
            {arriba}
            <header className={s.cabeza}>
              <h1 className={s.titulo}><Texto>{titulo}</Texto></h1>
              {texto && <p className={s.texto}><Texto>{texto}</Texto></p>}
            </header>
            {children}
            {pie && <p className={s.pie}>{pie}</p>}
          </div>
        </div>
      </div>
    </BloqueSeccion>
  );
}

/** El campo del correo de las cuatro páginas (Campo traduce la etiqueta y el ejemplo). */
export function CampoCorreo({ autoComplete = 'email', ...props }) {
  return (
    <Campo
      etiqueta="Correo electrónico"
      icono={<Mail />}
      type="email"
      name="email"
      autoComplete={autoComplete}
      inputMode="email"
      autoCapitalize="none"
      spellCheck={false}
      placeholder="nombre@correo.com"
      {...props}
      error={conTexto(props.error)}
    />
  );
}

/* ── Iniciar sesión (/login) ────────────────────────────── */

/**
 * Iniciar sesión con correo y contraseña o con Google.
 *  - onEntrar({ correo, contrasena }): promesa; si falla, su mensaje se ve
 *  - onGoogle(): promesa (cerrar la ventana de Google no es un error: resolver)
 *  - motivo: por qué se pide entrar ("Inicia sesión para participar en el sorteo")
 *  - urlRegistro · urlRecuperar (en la tienda, con ?redirect= para volver)
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
      pie={<><Texto>¿No tienes una cuenta?</Texto> <Enlace to={urlRegistro} className={s.enlace}><Texto>Regístrate aquí</Texto></Enlace></>}
    >
      {motivo && <Aviso tipo="info" compacto icono={<Info aria-hidden="true" />}>{motivo}</Aviso>}
      <form className={s.formulario} onSubmit={entrar} noValidate>
        <CampoCorreo
          autoComplete="username"
          value={correo}
          onChange={(e) => { setCorreo(e.target.value); setErrores((x) => ({ ...x, correo: undefined })); }}
          error={errores.correo}
          disabled={Boolean(cargando)}
        />
        <div className={s.conEnlace}>
          <CampoContrasena
            name="password"
            valor={contrasena}
            onCambiar={(v) => { setContrasena(v); setErrores((x) => ({ ...x, contrasena: undefined })); }}
            placeholder="Tu contraseña"
            error={errores.contrasena}
            disabled={Boolean(cargando)}
          />
          <Enlace to={urlRecuperar} className={`${s.enlace} ${s.olvido}`}><Texto>¿Olvidaste tu contraseña?</Texto></Enlace>
        </div>
        {error && <Aviso tipo="error" compacto>{error}</Aviso>}
        <Boton type="submit" bloque tamano="lg" cargando={cargando === 'correo'} disabled={cargando === 'google'} iconoFin={<ArrowRight aria-hidden="true" />}>
          <Texto>Iniciar sesión</Texto>
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
        <div className={`${s.enviado} ${s.entraAdelante}`} role="status">
          <Sello tamano={56} tono="menta" girar={-8}><MailCheck aria-hidden="true" /></Sello>
          <p>
            <TextoResaltado resaltar={[enviado]} envolver={(correo, k) => <strong key={k} className={s.correo}>{correo}</strong>}>
              {`Si hay una cuenta con ${enviado}, te llegará un enlace para cambiar tu contraseña.`}
            </TextoResaltado>{' '}
            <Texto>Mira también en spam o promociones.</Texto>
          </p>
          <Boton to={urlLogin} bloque icono={<ArrowLeft aria-hidden="true" />}><Texto>Volver a iniciar sesión</Texto></Boton>
          <Boton variante="fantasma" bloque onClick={() => setEnviado('')}><Texto>Usar otro correo</Texto></Boton>
        </div>
      </MarcoAcceso>
    );
  }
  return (
    <MarcoAcceso
      panel={panel}
      titulo="Recuperar contraseña"
      texto="Escribe tu correo y te enviamos un enlace para cambiarla."
      pie={<Enlace to={urlLogin} className={s.enlace}><Texto>Volver a iniciar sesión</Texto></Enlace>}
    >
      <form className={s.formulario} onSubmit={enviar} noValidate>
        <CampoCorreo
          value={correo}
          onChange={(e) => { setCorreo(e.target.value); setErrorCorreo(''); }}
          error={errorCorreo}
          disabled={cargando}
        />
        {error && <Aviso tipo="error" compacto>{error}</Aviso>}
        <Boton type="submit" bloque tamano="lg" cargando={cargando} iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Enviar enlace</Texto></Boton>
      </form>
    </MarcoAcceso>
  );
}
