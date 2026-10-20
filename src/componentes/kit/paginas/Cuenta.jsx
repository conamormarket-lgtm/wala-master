import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, IdCard, LogIn, LogOut, MapPin, Pencil, Plus, Settings, User, Moon, Languages, Gift } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Aviso, EstadoVacio, HojaInferior } from '../Feedback';
import { Interruptor } from '../Formulario';
import { CamposDatosPersonales, validarPerfil, tipoDocumentoPara, NOMBRE_DOCUMENTO } from '../piezas/DatosPersonales';
import { RecortarFoto } from '../piezas/RecortarFoto';
import { Moneda } from '../Etiquetas';
import { MenuCuenta } from '../MenusCabecera';
import { BloqueSeccion } from '../Seccion';
import { CabezaCuenta, TarjetaCuenta, ListaDatos, Estadistica, AccesosCuenta, IdentidadCuenta, ListaEleccion } from '../piezas/Cuenta';
import { TarjetaDireccion } from '../piezas/TarjetaDireccion';
import { CamposDireccion, validarDireccion, cambiarDireccion, documentoDe } from '../piezas/Direccion';
import { EsqueletoTarjeta } from '../Esqueletos';
import { Texto, useTexto } from '../Traduccion';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { Destello } from '../Marca';
import s from './Cuenta.module.css';

/*
 * Páginas de la cuenta (/cuenta). Todas van dentro de MarcoCuenta, que a su
 * vez va dentro de MarcoTienda: en escritorio, el menú de la cuenta al
 * costado; en el celular, cada sección es su propia pantalla con "Mi cuenta"
 * para volver a los accesos. Los datos entran por props (en la tienda:
 * AuthContext, services/direcciones, LanguageContext, ThemeContext…).
 */

/* ── Marco de la cuenta ─────────────────────────────────── */

/**
 * Marco de toda página de /cuenta.
 *  - usuario: { nombre, email, avatar } · grupos: los de MenuCuenta
 *    ({ titulo, tono, items: [{ to, texto, Icono, cuenta }] })
 *  - activo: ruta actual ('/cuenta', '/cuenta/perfil'…)
 *  - onCerrarSesion · promo: la de MenuCuenta
 *  - perfilIncompleto: aviso arriba con "Completar" (falta documento o teléfono)
 *    · urlCompletar
 *  - volver: { texto, url } enlace a los accesos en el celular (null: sin él)
 *  - estadoCompletar: el state del enlace "Completar" (en la tienda,
 *    { from: ruta } para volver aquí al terminar)
 * Los grupos llegan ya traducidos (en la tienda, con el diccionario t());
 * los textos propios del marco pasan por la traducción.
 * El menú lateral aparece cuando el marco mide 860px o más (container query:
 * la vista de celular del editor se ve igual que un celular). En el resumen
 * (activo = '/cuenta') y sin el menú lateral, "Cerrar sesión" va al final.
 */
export function MarcoCuenta({
  usuario, grupos = [], activo, onCerrarSesion, promo, perfilIncompleto = false, urlCompletar = '/completar-perfil',
  volver = { texto: 'Mi cuenta', url: '/cuenta' }, estadoCompletar, children,
}) {
  const enResumen = activo === '/cuenta';
  const etiquetaMenu = useTexto('Menú de tu cuenta');
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
      <div className={s.cuenta}>
        <div className={s.rejilla}>
          <aside className={s.lateral} aria-label={etiquetaMenu} data-componente="MenuCuenta">
            <MenuCuenta lateral usuario={usuario} grupos={grupos} activo={activo} promo={promo} onCerrarSesion={onCerrarSesion} />
          </aside>
          <div className={s.contenido}>
            {!enResumen && volver && (
              <Enlace to={volver.url} className={`${s.volver} ${s.soloAngosto}`}>
                <ArrowLeft aria-hidden="true" /> <Texto>{volver.texto}</Texto>
              </Enlace>
            )}
            {perfilIncompleto && (
              <Aviso
                tipo="info"
                icono={<IdCard aria-hidden="true" />}
                accion={<Boton to={urlCompletar} state={estadoCompletar} tamano="sm"><Texto>Completar</Texto></Boton>}
              >
                Te faltan tu documento y tu teléfono para ver tus pedidos y comprar más rápido.
              </Aviso>
            )}
            <div key={activo} className={s.pagina}>{children}</div>
            {enResumen && onCerrarSesion && (
              <button type="button" className={`${s.salir} ${s.soloAngosto}`} onClick={onCerrarSesion}>
                <LogOut aria-hidden="true" /> <Texto>Cerrar sesión</Texto>
              </button>
            )}
          </div>
        </div>
      </div>
    </BloqueSeccion>
  );
}

/**
 * Sin sesión: la cuenta invita a entrar (en /cuenta/pedidos, con su propio
 * texto). Va dentro de MarcoTienda, sin MarcoCuenta.
 *  - pedidos: el texto de Mis pedidos · urlLogin, urlRegistro
 */
export function PaginaCuentaInvitado({ pedidos = false, urlLogin = '/login', urlRegistro = '/registro' }) {
  return (
    <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
      <div className={s.invitado}>
        <EstadoVacio
          imagen={CARAS_KAPI.feliz}
          titulo={pedidos ? 'Mira por dónde va tu pedido' : 'Tu cuenta Walá'}
          texto={pedidos
            ? 'Inicia sesión con el correo de tu compra para ver tus pedidos y su avance.'
            : 'Inicia sesión para ver tus pedidos, tus monedas y los diseños que guardaste.'}
        >
          <Boton to={urlLogin} icono={<LogIn aria-hidden="true" />}>Iniciar sesión</Boton>
          <Boton to={urlRegistro} variante="contorno">Crear cuenta</Boton>
        </EstadoVacio>
      </div>
    </BloqueSeccion>
  );
}

/* ── Resumen (/cuenta) ──────────────────────────────────── */

/**
 * La pantalla que abre "Mi cuenta": saludo, monedas y los accesos a todo.
 * Con el menú lateral (escritorio) los accesos repetían el menú: en su lugar,
 * Kapi invita a elegir una opción de ese menú. En el celular, los accesos.
 *  - usuario: { nombre } · monedas · enEspera (monedas que llegan al
 *    entregarse un pedido) · grupos (los mismos de MarcoCuenta) · urlCanjear
 */
export function PaginaResumenCuenta({ usuario, monedas = 0, enEspera = 0, grupos = [], urlCanjear = '/cuenta/catalogo' }) {
  const nombre = String(usuario?.nombre || '').trim().split(/\s+/)[0];
  return (
    <>
      <CabezaCuenta
        titulo={<Texto>{nombre ? `Hola, ${nombre}` : 'Mi cuenta'}</Texto>}
        subrayado
        subtitulo={<Texto>Tus pedidos, tus monedas y tus diseños, a un toque.</Texto>}
      />
      <Estadistica
        icono={<Moneda tamano={44} />}
        sello={false}
        etiqueta={<Texto>Tus monedas</Texto>}
        valor={monedas.toLocaleString('es-PE')}
        unidad={<Texto>{monedas === 1 ? 'moneda' : 'monedas'}</Texto>}
        nota={<Texto>{enEspera > 0 ? `+${enEspera} en espera: llegan cuando se entregue tu pedido.` : 'Cada moneda es S/ 1 de descuento en tu próxima compra.'}</Texto>}
      >
        <Boton to={urlCanjear} variante="contorno" tamano="sm" icono={<Gift aria-hidden="true" />}><Texto>Canjear monedas</Texto></Boton>
      </Estadistica>
      <div className={s.soloAngosto}>
        <AccesosCuenta grupos={grupos} />
      </div>
      <div className={s.elegirOpcion} data-componente="ElegirOpcionCuenta">
        <span className={s.elegirKapi} aria-hidden="true">
          <img src={CARAS_KAPI.feliz} alt="" width="96" height="96" />
          <Destello className={s.elegirDestello} />
        </span>
        <div className={s.elegirTexto}>
          <h2><Texto>¿Qué quieres ver hoy?</Texto></h2>
          <p><Texto>Elige una opción del menú: tus pedidos, tus creaciones, tus recompensas y todo lo de tu cuenta.</Texto></p>
          <span className={s.elegirPista}>
            <ArrowLeft aria-hidden="true" /> <Texto>Todo está en el menú de la izquierda</Texto>
          </span>
        </div>
      </div>
    </>
  );
}

/* ── Mi perfil (/cuenta/perfil) ─────────────────────────── */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2001-07-12" → "12 de julio de 2001" (sin año si es 0000). */
export const fechaLegible = (iso) => {
  const [a, m, d] = String(iso || '').split('-').map(Number);
  if (!m || !d) return '';
  return `${d} de ${MESES[m - 1]}${a ? ` de ${a}` : ''}`;
};

/** "910425972" → "910 425 972" (celular peruano); lo demás, como viene. */
const telefonoLegible = (tel, prefijo) => {
  const n = String(tel || '').replace(/\D/g, '');
  if (!n) return '';
  const local = n.length === 9 ? `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : n;
  return prefijo && prefijo !== '+51' ? `${prefijo} ${local}` : local;
};

// Las reglas viven con los campos (piezas/DatosPersonales): Mi perfil, Crear cuenta y Completar perfil.
export { validarPerfil };

/**
 * Mi perfil: la identidad, el saldo de monedas y los datos personales (con
 * su edición en la misma tarjeta).
 *  - perfil: { nombre, email, avatar, pais, tipoDocumento, documento,
 *    telefono, cumpleanos ('AAAA-MM-DD') } (perfilDesdeUsuario)
 *  - monedas, enEspera · urlInvitar, urlCanjear
 *  - whatsapp, onWhatsapp(activo): ofertas por WhatsApp (se guarda al tocar)
 *  - onGuardar(datos): promesa; si falla, su mensaje se muestra en la tarjeta
 *  - onCambiarFoto(blob): promesa con la foto ya recortada (RecortarFoto, JPG
 *    cuadrado) · onQuitarFoto: promesa, se confirma en la página · subiendoFoto
 *    (si alguna falla, su mensaje sale bajo la foto)
 *  - paises: [{ valor, texto, prefijo }] para el campo País
 *  - validar: reglas propias (por defecto validarPerfil)
 *  - guardandoWhatsapp: el interruptor espera mientras se guarda
 *  - cargando: el perfil todavía no llegó (esqueleto; no se puede editar)
 * "Cancelar" deja los datos como estaban (cada vez que se abre la edición,
 * empieza desde `perfil`). Al cambiar de país, el tipo de documento pasa al
 * que corresponde (tipoDocumentoPara).
 */
export function PaginaPerfil({
  perfil = {}, monedas = 0, enEspera = 0, urlInvitar = '/cuenta/referidos', urlCanjear = '/cuenta/catalogo',
  whatsapp = false, onWhatsapp, guardandoWhatsapp = false, onGuardar, onCambiarFoto, onQuitarFoto, subiendoFoto = false,
  paises = [{ valor: 'PE', texto: 'Perú', prefijo: '+51' }], validar = validarPerfil, cargando = false,
}) {
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [recorte, setRecorte] = useState(null);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');
  const editando = form !== null;
  const pais = paises.find((p) => p.valor === (perfil.pais || 'PE')) || paises[0];
  const completo = Boolean(perfil.documento && perfil.telefono);

  // La foto elegida se muestra con una URL temporal: se suelta al cerrar el recorte.
  useEffect(() => () => { if (recorte) URL.revokeObjectURL(recorte); }, [recorte]);

  if (cargando) {
    return (
      <div className={s.perfilRejilla} aria-busy="true">
        <EsqueletoTarjeta lineas={2} alto={150} />
        <EsqueletoTarjeta lineas={4} alto={260} />
      </div>
    );
  }

  const abrir = () => {
    const paisForm = perfil.pais || 'PE';
    setForm({
      nombre: perfil.nombre || '', pais: paisForm, tipoDocumento: tipoDocumentoPara(paisForm, perfil.tipoDocumento),
      documento: perfil.documento || '', telefono: perfil.telefono || '', cumpleanos: perfil.cumpleanos || '',
    });
    setErrores({});
    setError('');
  };
  const cambiar = (campo) => (e) => {
    let v = e.target.value;
    if (campo === 'documento' && form.pais === 'PE') v = v.replace(/\s/g, '');
    if (campo === 'telefono' && form.pais === 'PE') v = v.replace(/\D/g, '').slice(0, 9);
    setForm((f) => ({
      ...f,
      [campo]: v,
      ...(campo === 'pais' ? { tipoDocumento: tipoDocumentoPara(v, f.tipoDocumento) } : {}),
    }));
    setErrores((x) => ({ ...x, [campo]: undefined }));
  };
  const cambiarFoto = async (blob) => {
    setErrorFoto('');
    try {
      await onCambiarFoto(blob);
    } catch (err) {
      setErrorFoto(err?.message || 'No se pudo subir la foto. Inténtalo de nuevo.');
    } finally {
      setRecorte(null);
    }
  };
  const confirmarQuitar = async () => {
    setQuitando(true);
    setErrorFoto('');
    try {
      await onQuitarFoto();
    } catch (err) {
      setErrorFoto(err?.message || 'No se pudo quitar la foto. Inténtalo de nuevo.');
    } finally {
      setQuitando(false);
      setQuitarFoto(false);
    }
  };
  const guardar = async (e) => {
    e.preventDefault();
    const encontrados = validar(form);
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;
    setGuardando(true);
    setError('');
    try {
      await onGuardar?.(form);
      setForm(null);
    } catch (err) {
      setError(err?.message || 'No pudimos guardar tus datos. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };


  return (
    <>
      <IdentidadCuenta
        nombre={perfil.nombre}
        email={perfil.email}
        avatar={perfil.avatar}
        completo={completo}
        onCambiarFoto={onCambiarFoto && ((archivo) => { setErrorFoto(''); setRecorte(URL.createObjectURL(archivo)); })}
        onQuitarFoto={onQuitarFoto && (() => setQuitarFoto(true))}
        subiendo={subiendoFoto || quitando}
      />
      {errorFoto && <Aviso tipo="error" compacto>{errorFoto}</Aviso>}
      {quitarFoto && (
        <Aviso
          tipo="aviso"
          titulo="¿Quitar tu foto de perfil?"
          accion={(
            <span className={s.botonesAviso}>
              <Boton tamano="sm" variante="fantasma" onClick={() => setQuitarFoto(false)} disabled={quitando}><Texto>Cancelar</Texto></Boton>
              <Boton tamano="sm" variante="peligro" cargando={quitando} onClick={confirmarQuitar}><Texto>Quitar foto</Texto></Boton>
            </span>
          )}
        >
          Se verán tus iniciales en su lugar.
        </Aviso>
      )}
      <RecortarFoto
        abierta={Boolean(recorte)}
        src={recorte}
        onCancelar={() => setRecorte(null)}
        onListo={cambiarFoto}
      />
      <div className={s.perfilRejilla}>
        <Estadistica
          grande
          icono={<Moneda tamano={56} />}
          sello={false}
          etiqueta={<Texto>Tus monedas</Texto>}
          valor={monedas.toLocaleString('es-PE')}
          unidad={<Texto>{monedas === 1 ? 'moneda' : 'monedas'}</Texto>}
          nota={<Texto>{enEspera > 0 ? `+${enEspera} en espera: llegan cuando se entregue tu pedido.` : 'Cada moneda es S/ 1 de descuento.'}</Texto>}
        >
          <div className={s.botonesCifra}>
            <Boton to={urlInvitar} variante="contorno" bloque><Texto>Invita y gana monedas</Texto></Boton>
            <Boton to={urlCanjear} variante="fantasma" bloque><Texto>Canjear en el catálogo</Texto></Boton>
          </div>
        </Estadistica>

        <TarjetaCuenta
          icono={<User />}
          titulo={<Texto>Datos personales</Texto>}
          subtitulo={<Texto>{editando ? 'Revisa y guarda tus cambios.' : 'Con estos datos ubicamos tus pedidos.'}</Texto>}
        >
          {editando ? (
            <form className={s.formulario} onSubmit={guardar} noValidate>
              <CamposDatosPersonales
                datos={form}
                onCambiar={(campo, valor) => cambiar(campo)({ target: { value: valor } })}
                errores={errores}
                paises={paises}
                disabled={guardando}
              />
              {error && <Aviso tipo="error" compacto>{error}</Aviso>}
              <div className={s.botonesForm}>
                <Boton type="button" variante="fantasma" onClick={() => setForm(null)} disabled={guardando}><Texto>Cancelar</Texto></Boton>
                <Boton type="submit" cargando={guardando}><Texto>Guardar</Texto></Boton>
              </div>
            </form>
          ) : (
            <>
              <ListaDatos
                datos={[
                  ...(perfil.pais && perfil.pais !== 'PE' ? [{ etiqueta: 'País', valor: pais?.texto }] : []),
                  { etiqueta: (perfil.pais || 'PE') === 'PE' ? (NOMBRE_DOCUMENTO[perfil.tipoDocumento] || 'DNI') : 'Documento', valor: perfil.documento },
                  { etiqueta: 'Celular', valor: telefonoLegible(perfil.telefono, pais?.prefijo) },
                  { etiqueta: 'Cumpleaños', valor: fechaLegible(perfil.cumpleanos) },
                ]}
              />
              {!completo && (
                <Aviso tipo="aviso" compacto>Para ver tus pedidos necesitamos tu documento y tu celular.</Aviso>
              )}
              {onWhatsapp && (
                <div className={s.interruptor}>
                  <Interruptor
                    activo={whatsapp}
                    onChange={onWhatsapp}
                    disabled={guardandoWhatsapp}
                    etiqueta={<Texto>Ofertas por WhatsApp</Texto>}
                    descripcion={<Texto>Te avisamos de descuentos y novedades. Puedes desactivarlo cuando quieras.</Texto>}
                  />
                </div>
              )}
              {onGuardar && <Boton bloque icono={<Pencil aria-hidden="true" />} onClick={abrir}><Texto>Editar mis datos</Texto></Boton>}
            </>
          )}
        </TarjetaCuenta>
      </div>
    </>
  );
}

/* ── Mis direcciones (/cuenta/direcciones) ──────────────── */

// Los campos y sus reglas viven en piezas/Direccion (los usa también el checkout).
export { validarDireccion };

/**
 * Mis direcciones: las guardadas (la principal primero), agregar, editar,
 * elegir la principal y eliminar. El formulario es una hoja inferior en el
 * celular y una ventana en escritorio.
 *  - direcciones: [{ id, principal, nombre, tipoDocumento, documento,
 *    telefono, pais, ciudad, departamento, provincia, distrito, direccion }]
 *    (direccionDesdeFirestore)
 *  - cargando · maximo (10)
 *  - lugares: { departamentos, provincias(dep), distritos(dir), legible(dir) }
 *    (en la tienda: constants/peruUbigeo y utils/ubicacionErp)
 *  - perfil: { nombre, tipoDocumento, documento, telefono, pais } para llenar una nueva
 *  - onGuardar(direccion): promesa (nueva sin id) · onPrincipal(id) · onEliminar(id)
 *  - ocupada: algo se está guardando (las tarjetas esperan)
 *  - error: no se pudo leer la libreta (sin "Agregar": guardar la reemplazaría
 *    entera) · onReintentar
 *  - paises: [{ valor, texto, prefijo }] para elegir el país de la dirección
 *    (con su prefijo en el teléfono)
 * El distrito tiene que ser uno del lugar (lugares.distritos).
 */
export function PaginaDirecciones({
  direcciones = [], cargando = false, maximo = 10, lugares = {}, perfil = {}, onGuardar, onPrincipal, onEliminar,
  ocupada = false, error: errorCarga, onReintentar, paises,
}) {
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [verDestinatario, setVerDestinatario] = useState(false);
  const ordenadas = useMemo(() => [...direcciones].sort((a, b) => Number(b.principal) - Number(a.principal)), [direcciones]);
  const lleno = direcciones.length >= maximo;
  const { legible = () => '' } = lugares;

  const abrir = (dir) => {
    const base = dir || {
      nombre: perfil.nombre || '', tipoDocumento: perfil.tipoDocumento || 'DNI', documento: perfil.documento || '',
      telefono: perfil.telefono || '', pais: perfil.pais || 'PE', ciudad: (perfil.pais || 'PE') === 'PE' ? 'Lima' : '', departamento: '', provincia: '', distrito: '', direccion: '',
    };
    setForm({ ...base });
    setErrores({});
    setError('');
    setVerDestinatario(!(base.nombre && base.documento && base.telefono));
  };
  const cambiar = (campo, v) => {
    setForm((f) => cambiarDireccion(f, campo, v));
    setErrores((x) => ({ ...x, [campo]: undefined }));
  };
  const guardar = async (e) => {
    e?.preventDefault();
    const encontrados = validarDireccion(form, { distritos: form.pais && form.pais !== 'PE' ? undefined : lugares.distritos?.(form) });
    setErrores(encontrados);
    if (Object.keys(encontrados).length) {
      if (encontrados.nombre || encontrados.documento || encontrados.telefono) setVerDestinatario(true);
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await onGuardar?.(form);
      setForm(null);
    } catch (err) {
      setError(err?.message || 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };


  return (
    <>
      <CabezaCuenta
        icono={<MapPin />}
        titulo={<Texto>Mis direcciones</Texto>}
        subtitulo={<Texto>Se guarda sola en tu primera compra. Aquí eliges a cuál te llega.</Texto>}
        accion={!errorCarga && direcciones.length > 0 && onGuardar && (
          <Boton icono={<Plus aria-hidden="true" />} onClick={() => abrir()} disabled={lleno || ocupada}><Texto>Agregar dirección</Texto></Boton>
        )}
      />
      {lleno && !errorCarga && (
        <Aviso tipo="info" compacto>{`Llegaste a ${maximo} direcciones. Elimina una para agregar otra.`}</Aviso>
      )}

      {errorCarga ? (
        <Aviso
          tipo="error"
          titulo="No pudimos cargar tus direcciones"
          accion={onReintentar && <Boton tamano="sm" variante="contorno" onClick={onReintentar}><Texto>Reintentar</Texto></Boton>}
        >
          Revisa tu conexión e inténtalo de nuevo.
        </Aviso>
      ) : cargando ? (
        <ul className={s.direcciones} aria-busy="true">
          {[0, 1].map((k) => <li key={k}><EsqueletoTarjeta lineas={3} alto={190} /></li>)}
        </ul>
      ) : ordenadas.length === 0 ? (
        // Sin la cara de Kapi: en la tienda ya está el flotante (un solo Kapi a la vista).
        <EstadoVacio
          imagen={null}
          icono={<MapPin />}
          titulo={<Texto>Aún no tienes direcciones</Texto>}
          texto={<Texto>Se guarda sola en tu primera compra, o agrégala aquí para pagar más rápido.</Texto>}
        >
          {onGuardar && <Boton icono={<Plus aria-hidden="true" />} onClick={() => abrir()} disabled={ocupada}><Texto>Agregar dirección</Texto></Boton>}
        </EstadoVacio>
      ) : (
        <ul className={s.direcciones}>
          {ordenadas.map((d) => (
            <li key={d.id}>
              <TarjetaDireccion
                nombre={d.nombre}
                direccion={d.direccion}
                lugar={legible(d)}
                documento={d.documento ? documentoDe(d) : ''}
                telefono={d.telefono}
                principal={d.principal}
                ocupada={ocupada}
                onPrincipal={onPrincipal && (() => onPrincipal(d.id))}
                onEditar={onGuardar && (() => abrir(d))}
                onEliminar={onEliminar && (() => onEliminar(d.id))}
              />
            </li>
          ))}
        </ul>
      )}

      <HojaInferior
        abierta={form !== null}
        onCerrar={() => !guardando && setForm(null)}
        bloqueada={guardando}
        titulo={form?.id ? 'Editar dirección' : 'Nueva dirección'}
        pie={(
          <div className={s.botonesForm}>
            <Boton variante="fantasma" onClick={() => setForm(null)} disabled={guardando}><Texto>Cancelar</Texto></Boton>
            <Boton onClick={guardar} cargando={guardando}><Texto>Guardar dirección</Texto></Boton>
          </div>
        )}
      >
        {form && (
          <form className={s.formulario} onSubmit={guardar} noValidate>
            <CamposDireccion
              valor={form}
              onCambiar={cambiar}
              errores={errores}
              lugares={lugares}
              paises={paises}
              verDestinatario={verDestinatario}
              onVerDestinatario={() => setVerDestinatario(true)}
            />
            {error && <Aviso tipo="error" compacto>{error}</Aviso>}
          </form>
        )}
      </HojaInferior>
    </>
  );
}

/* ── Ajustes (/cuenta/ajustes) ──────────────────────────── */

/**
 * Ajustes: modo noche e idioma (y, sin el menú lateral, cerrar sesión).
 *  - tema: 'claro' | 'noche' · onTema()
 *  - brillo · onBrillo(bool): el brillo mágico del dedo; sin onBrillo no se
 *    muestra (la tienda lo pasa solo en el celular, donde hay dedo)
 *  - idioma: código actual · idiomas: [{ valor, texto, detalle }] · onIdioma(codigo)
 *  - onCerrarSesion
 */
export function PaginaAjustes({
  tema = 'claro', onTema, brillo = true, onBrillo, idioma = 'es', onIdioma, onCerrarSesion,
  idiomas = [
    { valor: 'es', texto: 'Español', detalle: 'Perú' },
    { valor: 'en', texto: 'English', detalle: 'Inglés' },
    { valor: 'pt', texto: 'Português', detalle: 'Portugués (Brasil)' },
  ],
}) {
  const noche = tema === 'noche' || tema === 'dark';
  const etiquetaIdioma = useTexto('Idioma de la tienda');
  return (
    <>
      <CabezaCuenta icono={<Settings />} titulo={<Texto>Ajustes</Texto>} subtitulo={<Texto>Cómo se ve Walá en este dispositivo.</Texto>} />
      <div className={s.ajustes}>
        <TarjetaCuenta icono={<Moon />} titulo={<Texto>Apariencia</Texto>}>
          <div className={s.interruptor}>
            <Interruptor
              activo={noche}
              onChange={() => onTema?.()}
              etiqueta={<Texto>Modo noche</Texto>}
              descripcion={<Texto>Colores oscuros, más cómodos de noche y con poca luz.</Texto>}
            />
          </div>
          {onBrillo && (
            <div className={s.interruptor}>
              <Interruptor
                activo={brillo}
                onChange={(v) => onBrillo(v)}
                etiqueta={<Texto>Brillo mágico</Texto>}
                descripcion={<Texto>La luz violeta y los destellos que siguen a tu dedo al tocar y deslizar.</Texto>}
              />
            </div>
          )}
        </TarjetaCuenta>
        <TarjetaCuenta icono={<Languages />} titulo={<Texto>Idioma</Texto>}>
          <ListaEleccion
            etiqueta={etiquetaIdioma}
            valor={idioma}
            onElegir={onIdioma}
            // El nombre de cada idioma va en su propio idioma; el detalle se traduce.
            opciones={idiomas.map((i) => ({
              ...i,
              detalle: i.detalle && <Texto>{i.detalle}</Texto>,
              icono: <span className={s.codigoIdioma}>{i.valor.toUpperCase()}</span>,
            }))}
          />
        </TarjetaCuenta>
      </div>
      {onCerrarSesion && (
        <button type="button" className={`${s.salir} ${s.soloAngosto}`} onClick={onCerrarSesion}>
          <LogOut aria-hidden="true" /> <Texto>Cerrar sesión</Texto>
        </button>
      )}
    </>
  );
}
