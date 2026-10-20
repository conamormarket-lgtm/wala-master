import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Aviso } from '../Feedback';
import { Casilla } from '../Formulario';
import { ProgresoEncuesta } from '../piezas/Encuesta';
import { RequisitosContrasena, contrasenaValida, BotonGoogle, SeparadorAcceso, CampoContrasena } from '../piezas/Acceso';
import { CamposDatosPersonales, validarPerfil, NOMBRE_DOCUMENTO } from '../piezas/DatosPersonales';
import { EsqueletoFormulario } from '../Esqueletos';
import { TextoResaltado } from '../piezas/TextoResaltado';
import { Texto, useTexto } from '../Traduccion';
import { MarcoAcceso, CampoCorreo, BENEFICIOS, correoValido, mensaje } from './Acceso';
import s from './Acceso.module.css';

/*
 * Crear cuenta (/registro, en dos pasos) y completar el perfil
 * (/completar-perfil, al entrar con Google o con datos a medias): las dos
 * páginas con los datos del pedido (CamposDatosPersonales, los de Mi perfil).
 * En su propio archivo: login y recuperar no las bajan.
 */

const PERU = [{ valor: 'PE', texto: 'Perú', prefijo: '+51' }];

/**
 * Los datos del formulario con lo que llega después (el país detectado, el
 * perfil, el cumpleaños de Google): lo que llega se pone solo en los campos
 * que la persona todavía no tocó.
 */
function useDatosConLlegadas(base, llegadas) {
  const [datos, setDatos] = useState(() => ({ ...base, ...llegadas }));
  const tocados = useRef(new Set());
  const firma = JSON.stringify(llegadas || {});
  useEffect(() => {
    const nuevas = JSON.parse(firma);
    setDatos((d) => {
      const libres = Object.fromEntries(Object.entries(nuevas).filter(([k, v]) => !tocados.current.has(k) && v != null && v !== d[k]));
      return Object.keys(libres).length ? { ...d, ...libres } : d;
    });
  }, [firma]);
  const cambiar = (campo, valor) => {
    tocados.current.add(campo);
    setDatos((d) => ({ ...d, [campo]: valor }));
  };
  return [datos, cambiar];
}

/** "DNI 12345678 · 987 654 321": lo que se confirma antes de registrar. */
function ResumenDatos({ datos, paises }) {
  const peru = (datos.pais || 'PE') === 'PE';
  const prefijo = paises.find((p) => p.valor === datos.pais)?.prefijo;
  const tel = String(datos.telefono || '').replace(/\D/g, '');
  return (
    <dl className={s.resumen}>
      <div><dt><Texto>Nombre</Texto></dt><dd>{datos.nombre}</dd></div>
      <div><dt><Texto>{peru ? NOMBRE_DOCUMENTO[datos.tipoDocumento || 'DNI'] : 'Documento'}</Texto></dt><dd>{datos.documento}</dd></div>
      <div><dt><Texto>Celular</Texto></dt><dd>{prefijo && !peru ? `${prefijo} ` : ''}{tel.replace(/(\d{3})(?=\d)/g, '$1 ')}</dd></div>
    </dl>
  );
}

/* ── Crear cuenta (/registro) ───────────────────────────── */

/**
 * Crear cuenta en dos pasos: 1) correo y contraseña (con sus reglas a la
 * vista y los términos), o Google; 2) los datos del pedido (los de Mi
 * perfil), que se confirman en la misma tarjeta antes de guardar.
 *  - paso: 1 o 2 (2 si ya hay sesión pero faltan los datos; si pasa a 2
 *    después, la página también)
 *  - onCrearCuenta({ correo, contrasena }): promesa → pasa al paso 2
 *  - onGoogle(): promesa (la tienda lleva a completar el perfil)
 *  - onRegistrar(datos): promesa con { nombre, pais, tipoDocumento, documento, telefono }
 *  - datosIniciales: { pais } (el detectado; puede llegar después) · paises ·
 *    correo: el de la cuenta (paso 2)
 *  - urlLogin · urlTerminos · urlPrivacidad
 */
export function PaginaRegistro({
  paso: pasoInicial = 1, onCrearCuenta, onGoogle, onRegistrar, datosIniciales = {}, correo: correoCuenta,
  paises = PERU,
  urlLogin = '/login', urlTerminos = '/terminos-y-condiciones', urlPrivacidad = '/politicas-privacidad',
}) {
  const [paso, setPaso] = useState(pasoInicial);
  const [sentido, setSentido] = useState('adelante');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [repetir, setRepetir] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [datos, cambiarDato] = useDatosConLlegadas({ nombre: '', pais: 'PE', tipoDocumento: 'DNI', documento: '', telefono: '' }, datosIniciales);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(null);
  const [confirmar, setConfirmar] = useState(false);
  const textoPaso = useTexto(`Paso ${paso} de 2`);
  // Los enlaces van dentro de la frase: se buscan ya traducidos en la frase traducida.
  const terminos = useTexto('Términos y Condiciones');
  const privacidad = useTexto('Política de Privacidad');

  // Con la sesión ya abierta (llegó después), al paso de los datos.
  useEffect(() => { if (pasoInicial === 2) setPaso(2); }, [pasoInicial]);

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

  const avance = <ProgresoEncuesta texto={textoPaso} avance={paso / 2} />;

  if (paso === 1) {
    return (
      <MarcoAcceso
        panel={{ titulo: 'Crea tu cuenta', texto: 'En un minuto: tu correo, una contraseña y los datos para tus pedidos.', beneficios: BENEFICIOS.registro }}
        titulo="Crear cuenta"
        texto="Tu correo y una contraseña."
        arriba={avance}
        pie={<><Texto>¿Ya tienes cuenta?</Texto> <Enlace to={urlLogin} className={s.enlace}><Texto>Inicia sesión</Texto></Enlace></>}
      >
        <form key="p1" className={[s.formulario, sentido === 'atras' ? s.entraAtras : s.entraAdelante].join(' ')} onSubmit={crear} noValidate>
          <CampoCorreo
            value={correo}
            onChange={(e) => { setCorreo(e.target.value); setErrores((x) => ({ ...x, correo: undefined })); }}
            error={errores.correo}
            disabled={Boolean(cargando)}
          />
          <CampoContrasena
            nueva
            name="new-password"
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
            name="confirm-password"
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
                <TextoResaltado
                  resaltar={[terminos, privacidad]}
                  envolver={(parte, k) => <Enlace key={k} to={k === 0 ? urlTerminos : urlPrivacidad} target="_blank" rel="noopener noreferrer" className={s.enlace}>{parte}</Enlace>}
                >
                  Acepto los Términos y Condiciones y la Política de Privacidad
                </TextoResaltado>
              )}
            />
            {errores.acepto && <p className={s.errorSuelto} role="alert"><Texto>{errores.acepto}</Texto></p>}
          </div>
          {error && <Aviso tipo="error" compacto>{error}</Aviso>}
          <Boton type="submit" bloque tamano="lg" cargando={cargando === 'correo'} disabled={cargando === 'google'} iconoFin={<ArrowRight aria-hidden="true" />}>
            <Texto>Siguiente</Texto>
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
      texto={correoCuenta ? <><Texto>Tu cuenta:</Texto> <strong className={s.correo}>{correoCuenta}</strong></> : 'Tu nombre, tu documento y tu celular.'}
      arriba={avance}
    >
      <form key="p2" className={[s.formulario, s.entraAdelante].join(' ')} onSubmit={revisar} noValidate>
        <CamposDatosPersonales
          datos={datos}
          onCambiar={(campo, valor) => { cambiarDato(campo, valor); setErrores((x) => ({ ...x, [campo]: undefined })); setConfirmar(false); }}
          errores={errores}
          paises={paises}
          cumpleanos={false}
          disabled={cargando === 'datos'}
        />
        {error && <Aviso tipo="error" compacto>{error}</Aviso>}
        {confirmar ? (
          <div className={s.confirmar} role="group" aria-labelledby="registro-confirmar">
            <p id="registro-confirmar" className={s.confirmarTitulo}><Texto>¿Tus datos son correctos?</Texto></p>
            <p className={s.confirmarTexto}><Texto>Con tu documento y tu celular rastreamos tus pedidos.</Texto></p>
            <ResumenDatos datos={datos} paises={paises} />
            <div className={s.botones}>
              <Boton type="button" variante="fantasma" onClick={() => setConfirmar(false)} disabled={cargando === 'datos'}><Texto>Revisar</Texto></Boton>
              <Boton type="button" onClick={registrar} cargando={cargando === 'datos'} iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Sí, registrarme</Texto></Boton>
            </div>
          </div>
        ) : (
          <Boton type="submit" bloque tamano="lg" iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Registrarme</Texto></Boton>
        )}
      </form>
    </MarcoAcceso>
  );
}

/* ── Completar perfil (/completar-perfil) ───────────────── */

/**
 * Los datos que faltan para pedir (al entrar con Google, o si el registro
 * quedó a medias): los de Mi perfil, con el cumpleaños opcional.
 *  - inicial: { nombre, pais, tipoDocumento, documento, telefono, cumpleanos }
 *    (lo que llegue después, como el país detectado o el cumpleaños de
 *    Google, se pone en los campos que aún no se tocaron)
 *  - correo: el de la cuenta · deGoogle: { nombre, cumpleanos } (vienen de Google)
 *  - onGuardar(datos): promesa (la tienda sigue a la encuesta o adonde iba)
 *  - paises · cargando: mientras se lee el perfil
 */
export function PaginaCompletarPerfil({ inicial = {}, correo, deGoogle = {}, onGuardar, paises = PERU, cargando = false }) {
  const [datos, cambiarDato] = useDatosConLlegadas({ nombre: '', pais: 'PE', tipoDocumento: 'DNI', documento: '', telefono: '', cumpleanos: '' }, inicial);
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

  const nombreDeGoogle = deGoogle.nombre && datos.nombre === deGoogle.nombre;
  return (
    <MarcoAcceso
      panel={{ titulo: 'Completa tu perfil', texto: 'Con tu documento y tu celular ubicamos tus pedidos y te avisamos cuando estén listos.', beneficios: BENEFICIOS.registro }}
      titulo="Completa tu perfil"
      texto={correo
        ? <TextoResaltado resaltar={[correo]} envolver={(c, k) => <strong key={k} className={s.correo}>{c}</strong>}>{`Entraste como ${correo}. Solo falta esto para tus pedidos.`}</TextoResaltado>
        : 'Solo falta esto para tus pedidos.'}
    >
      {cargando ? (
        <div aria-busy="true"><EsqueletoFormulario titulo={false} /></div>
      ) : (
        <form className={s.formulario} onSubmit={guardar} noValidate>
          <CamposDatosPersonales
            datos={datos}
            onCambiar={(campo, valor) => { cambiarDato(campo, valor); setErrores((x) => ({ ...x, [campo]: undefined })); }}
            errores={errores}
            paises={paises}
            ayudaNombre={nombreDeGoogle ? 'Lo tomamos de tu cuenta de Google.' : undefined}
            cumpleanos={{
              etiqueta: 'Tu cumpleaños',
              ayuda: deGoogle.cumpleanos && datos.cumpleanos === deGoogle.cumpleanos
                ? 'La tomamos de tu cuenta de Google: ¿es correcta?'
                : 'Opcional. Para sorprenderte en tu día.',
            }}
            disabled={guardando}
          />
          {error && <Aviso tipo="error" compacto>{error}</Aviso>}
          <Boton type="submit" bloque tamano="lg" cargando={guardando} iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Guardar y continuar</Texto></Boton>
        </form>
      )}
    </MarcoAcceso>
  );
}
