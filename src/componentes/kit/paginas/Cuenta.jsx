import React, { useMemo, useState } from 'react';
import { ArrowLeft, IdCard, LogIn, LogOut, MapPin, Pencil, Plus, Settings, User, Moon, Languages, Gift } from 'lucide-react';
import Boton from '../Boton';
import { Enlace } from '../Enlace';
import { Aviso, EstadoVacio, HojaInferior } from '../Feedback';
import { Campo, Interruptor, CampoTelefono } from '../Formulario';
import { CamposDatosPersonales, validarPerfil, NOMBRE_DOCUMENTO } from '../piezas/DatosPersonales';
import { RecortarFoto } from '../piezas/RecortarFoto';
import { Moneda } from '../Etiquetas';
import { MenuCuenta } from '../MenusCabecera';
import { BloqueSeccion } from '../Seccion';
import { CabezaCuenta, TarjetaCuenta, ListaDatos, Estadistica, AccesosCuenta, IdentidadCuenta, ListaEleccion } from '../piezas/Cuenta';
import { TarjetaDireccion } from '../piezas/TarjetaDireccion';
import { EsqueletoTarjeta } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
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
 * El menú lateral aparece cuando el marco mide 860px o más (container query:
 * la vista de celular del editor se ve igual que un celular). En el resumen
 * (activo = '/cuenta') y sin el menú lateral, "Cerrar sesión" va al final.
 */
export function MarcoCuenta({
  usuario, grupos = [], activo, onCerrarSesion, promo, perfilIncompleto = false, urlCompletar = '/completar-perfil',
  volver = { texto: 'Mi cuenta', url: '/cuenta' }, children,
}) {
  const enResumen = activo === '/cuenta';
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.25rem', paddingBottom: '2.5rem' }}>
      <div className={s.cuenta}>
        <div className={s.rejilla}>
          <aside className={s.lateral} aria-label="Menú de tu cuenta" data-componente="MenuCuenta">
            <MenuCuenta lateral usuario={usuario} grupos={grupos} activo={activo} promo={promo} onCerrarSesion={onCerrarSesion} />
          </aside>
          <div className={s.contenido}>
            {!enResumen && volver && (
              <Enlace to={volver.url} className={`${s.volver} ${s.soloAngosto}`}>
                <ArrowLeft aria-hidden="true" /> {volver.texto}
              </Enlace>
            )}
            {perfilIncompleto && (
              <Aviso
                tipo="info"
                icono={<IdCard aria-hidden="true" />}
                accion={<Boton to={urlCompletar} tamano="sm">Completar</Boton>}
              >
                Te faltan tu documento y tu teléfono para ver tus pedidos y comprar más rápido.
              </Aviso>
            )}
            <div key={activo} className={s.pagina}>{children}</div>
            {enResumen && onCerrarSesion && (
              <button type="button" className={`${s.salir} ${s.soloAngosto}`} onClick={onCerrarSesion}>
                <LogOut aria-hidden="true" /> Cerrar sesión
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
 *  - usuario: { nombre } · monedas · enEspera (monedas que llegan al
 *    entregarse un pedido) · grupos (los mismos de MarcoCuenta) · urlCanjear
 */
export function PaginaResumenCuenta({ usuario, monedas = 0, enEspera = 0, grupos = [], urlCanjear = '/cuenta/catalogo' }) {
  const nombre = String(usuario?.nombre || '').trim().split(/\s+/)[0];
  return (
    <>
      <CabezaCuenta
        titulo={nombre ? `Hola, ${nombre}` : 'Mi cuenta'}
        subrayado
        subtitulo="Tus pedidos, tus monedas y tus diseños, a un toque."
      />
      <Estadistica
        icono={<Moneda tamano={44} />}
        sello={false}
        etiqueta="Tus monedas"
        valor={monedas.toLocaleString('es-PE')}
        unidad={monedas === 1 ? 'moneda' : 'monedas'}
        nota={enEspera > 0 ? `+${enEspera} en espera: llegan cuando se entregue tu pedido.` : 'Cada moneda es S/ 1 de descuento en tu próxima compra.'}
      >
        <Boton to={urlCanjear} variante="contorno" tamano="sm" icono={<Gift aria-hidden="true" />}>Canjear monedas</Boton>
      </Estadistica>
      <AccesosCuenta grupos={grupos} />
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
 *  - paises: [{ valor, texto, prefijo }] para el campo País
 *  - validar: reglas propias (por defecto validarPerfil)
 * "Cancelar" deja los datos como estaban (cada vez que se abre la edición,
 * empieza desde `perfil`).
 */
export function PaginaPerfil({
  perfil = {}, monedas = 0, enEspera = 0, urlInvitar = '/cuenta/referidos', urlCanjear = '/cuenta/catalogo',
  whatsapp = false, onWhatsapp, onGuardar, onCambiarFoto, onQuitarFoto, subiendoFoto = false,
  paises = [{ valor: 'PE', texto: 'Perú', prefijo: '+51' }], validar = validarPerfil,
}) {
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [recorte, setRecorte] = useState(null);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const editando = form !== null;
  const pais = paises.find((p) => p.valor === (perfil.pais || 'PE')) || paises[0];
  const completo = Boolean(perfil.documento && perfil.telefono);

  const abrir = () => {
    setForm({
      nombre: perfil.nombre || '', pais: perfil.pais || 'PE', tipoDocumento: perfil.tipoDocumento || 'DNI',
      documento: perfil.documento || '', telefono: perfil.telefono || '', cumpleanos: perfil.cumpleanos || '',
    });
    setErrores({});
    setError('');
  };
  const cambiar = (campo) => (e) => {
    let v = e.target.value;
    if (campo === 'documento') v = v.replace(/\s/g, '');
    if (campo === 'telefono' && form.pais === 'PE') v = v.replace(/\D/g, '').slice(0, 9);
    setForm((f) => ({ ...f, [campo]: v }));
    setErrores((x) => ({ ...x, [campo]: undefined }));
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
        onCambiarFoto={onCambiarFoto && ((archivo) => setRecorte(URL.createObjectURL(archivo)))}
        onQuitarFoto={onQuitarFoto && (() => setQuitarFoto(true))}
        subiendo={subiendoFoto}
      />
      {quitarFoto && (
        <Aviso
          tipo="aviso"
          titulo="¿Quitar tu foto de perfil?"
          accion={(
            <span className={s.botonesAviso}>
              <Boton tamano="sm" variante="fantasma" onClick={() => setQuitarFoto(false)}>Cancelar</Boton>
              <Boton tamano="sm" variante="peligro" onClick={async () => { await onQuitarFoto(); setQuitarFoto(false); }}>Quitar foto</Boton>
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
        onListo={async (blob) => { await onCambiarFoto(blob); setRecorte(null); }}
      />
      <div className={s.perfilRejilla}>
        <Estadistica
          grande
          icono={<Moneda tamano={56} />}
          sello={false}
          etiqueta="Tus monedas"
          valor={monedas.toLocaleString('es-PE')}
          unidad={monedas === 1 ? 'moneda' : 'monedas'}
          nota={enEspera > 0 ? `+${enEspera} en espera: llegan cuando se entregue tu pedido.` : 'Cada moneda es S/ 1 de descuento.'}
        >
          <div className={s.botonesCifra}>
            <Boton to={urlInvitar} variante="contorno" bloque>Invita y gana monedas</Boton>
            <Boton to={urlCanjear} variante="fantasma" bloque>Canjear en el catálogo</Boton>
          </div>
        </Estadistica>

        <TarjetaCuenta icono={<User />} titulo="Datos personales" subtitulo={editando ? 'Revisa y guarda tus cambios.' : 'Con estos datos ubicamos tus pedidos.'}>
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
                <Boton type="button" variante="fantasma" onClick={() => setForm(null)} disabled={guardando}>Cancelar</Boton>
                <Boton type="submit" cargando={guardando}>Guardar</Boton>
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
                    etiqueta="Ofertas por WhatsApp"
                    descripcion="Te avisamos de descuentos y novedades. Puedes desactivarlo cuando quieras."
                  />
                </div>
              )}
              {onGuardar && <Boton bloque icono={<Pencil aria-hidden="true" />} onClick={abrir}>Editar mis datos</Boton>}
            </>
          )}
        </TarjetaCuenta>
      </div>
    </>
  );
}

/* ── Mis direcciones (/cuenta/direcciones) ──────────────── */

const CIUDADES = [
  { valor: 'Lima', texto: 'Lima Metropolitana' },
  { valor: 'Callao', texto: 'Callao' },
  { valor: 'Provincias', texto: 'Otras provincias' },
];
const DOCS_DIRECCION = [
  { valor: 'DNI', texto: 'DNI' },
  { valor: 'CE', texto: 'Carnet de extranjería' },
  { valor: 'Pasaporte', texto: 'Pasaporte' },
];

/** Reglas de una dirección (las de MisDireccionesPage). Devuelve { campo: mensaje }. */
export function validarDireccion(d) {
  const e = {};
  const fuera = d.pais && d.pais !== 'PE';
  if (String(d.nombre || '').trim().length < 3) e.nombre = 'Escribe el nombre de quien recibe.';
  if (String(d.documento || '').trim().length < 6) e.documento = 'Escribe un número de documento válido.';
  if (String(d.telefono || '').replace(/\D/g, '').length < 6) e.telefono = 'Escribe un teléfono válido.';
  if (fuera) {
    if (!String(d.provincia || '').trim()) e.provincia = 'Escribe la región o estado.';
    if (!String(d.distrito || '').trim()) e.distrito = 'Escribe la ciudad.';
  } else {
    if (d.ciudad === 'Provincias' && (!d.departamento || !d.provincia)) e.provincia = 'Elige el departamento y la provincia.';
    if (!d.distrito) e.distrito = 'Elige el distrito.';
  }
  if (String(d.direccion || '').trim().length < 5) e.direccion = 'Escribe la dirección exacta.';
  return e;
}

const opcionesDe = (lista, primera) => [{ valor: '', texto: primera, deshabilitada: true }, ...lista.map((x) => ({ valor: x, texto: x }))];

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
 *  - perfil: { nombre, tipoDocumento, documento, telefono } para llenar una nueva
 *  - onGuardar(direccion): promesa (nueva sin id) · onPrincipal(id) · onEliminar(id)
 */
export function PaginaDirecciones({
  direcciones = [], cargando = false, maximo = 10, lugares = {}, perfil = {}, onGuardar, onPrincipal, onEliminar,
}) {
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [verDestinatario, setVerDestinatario] = useState(false);
  const ordenadas = useMemo(() => [...direcciones].sort((a, b) => Number(b.principal) - Number(a.principal)), [direcciones]);
  const lleno = direcciones.length >= maximo;
  const { departamentos = [], provincias = () => [], distritos = () => [], legible = () => '' } = lugares;

  const abrir = (dir) => {
    const base = dir || {
      nombre: perfil.nombre || '', tipoDocumento: perfil.tipoDocumento || 'DNI', documento: perfil.documento || '',
      telefono: perfil.telefono || '', pais: 'PE', ciudad: 'Lima', departamento: '', provincia: '', distrito: '', direccion: '',
    };
    setForm({ ...base });
    setErrores({});
    setError('');
    setVerDestinatario(!(base.nombre && base.documento && base.telefono));
  };
  const cambiar = (campo) => (e) => {
    const v = e.target.value;
    setForm((f) => {
      const n = { ...f, [campo]: v };
      // Al cambiar de ciudad o de provincia, el distrito ya no corresponde.
      if (campo === 'ciudad') Object.assign(n, { departamento: '', provincia: '', distrito: '' });
      if (campo === 'departamento') Object.assign(n, { provincia: '', distrito: '' });
      if (campo === 'provincia') n.distrito = '';
      return n;
    });
    setErrores((x) => ({ ...x, [campo]: undefined }));
  };
  const guardar = async (e) => {
    e?.preventDefault();
    const encontrados = validarDireccion(form);
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

  const fuera = form && form.pais && form.pais !== 'PE';
  const listaDistritos = form && !fuera ? distritos(form) : [];
  const docTexto = (d) => `${DOCS_DIRECCION.find((x) => x.valor === d.tipoDocumento)?.valor || 'DNI'} ${d.documento}`;

  return (
    <>
      <CabezaCuenta
        icono={<MapPin />}
        titulo="Mis direcciones"
        subtitulo="Se guarda sola en tu primera compra. Aquí eliges a cuál te llega."
        accion={direcciones.length > 0 && onGuardar && (
          <Boton icono={<Plus aria-hidden="true" />} onClick={() => abrir()} disabled={lleno}>Agregar dirección</Boton>
        )}
      />
      {lleno && (
        <Aviso tipo="info" compacto>Llegaste a {maximo} direcciones. Elimina una para agregar otra.</Aviso>
      )}

      {cargando ? (
        <ul className={s.direcciones} aria-busy="true">
          {[0, 1].map((k) => <li key={k}><EsqueletoTarjeta lineas={3} alto={190} /></li>)}
        </ul>
      ) : ordenadas.length === 0 ? (
        <EstadoVacio
          imagen={CARAS_KAPI.feliz}
          titulo="Aún no tienes direcciones"
          texto="Se guarda sola en tu primera compra, o agrégala aquí para pagar más rápido."
        >
          {onGuardar && <Boton icono={<Plus aria-hidden="true" />} onClick={() => abrir()}>Agregar dirección</Boton>}
        </EstadoVacio>
      ) : (
        <ul className={s.direcciones}>
          {ordenadas.map((d) => (
            <li key={d.id}>
              <TarjetaDireccion
                nombre={d.nombre}
                direccion={d.direccion}
                lugar={legible(d)}
                documento={d.documento ? docTexto(d) : ''}
                telefono={d.telefono}
                principal={d.principal}
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
        titulo={form?.id ? 'Editar dirección' : 'Nueva dirección'}
        pie={(
          <div className={s.botonesForm}>
            <Boton variante="fantasma" onClick={() => setForm(null)} disabled={guardando}>Cancelar</Boton>
            <Boton onClick={guardar} cargando={guardando}>Guardar dirección</Boton>
          </div>
        )}
      >
        {form && (
          <form className={s.formulario} onSubmit={guardar} noValidate>
            {verDestinatario ? (
              <>
                <Campo etiqueta="Nombre de quien recibe" value={form.nombre} onChange={cambiar('nombre')} error={errores.nombre} autoComplete="name" />
                <div className={s.fila}>
                  <Campo etiqueta="Documento" opciones={DOCS_DIRECCION} value={form.tipoDocumento} onChange={cambiar('tipoDocumento')} />
                  <Campo etiqueta="Número" value={form.documento} onChange={cambiar('documento')} error={errores.documento} />
                </div>
                <CampoTelefono valor={form.telefono} onCambiar={(v) => cambiar('telefono')({ target: { value: v } })} error={errores.telefono} />
              </>
            ) : (
              <div className={s.destinatario}>
                <span className={s.destinatarioTexto}>
                  <small>Recibe</small>
                  <strong>{form.nombre}</strong>
                  <span>{docTexto(form)} · {form.telefono}</span>
                </span>
                <button type="button" className={s.cambiar} onClick={() => setVerDestinatario(true)}>Cambiar</button>
              </div>
            )}

            {fuera ? (
              <div className={s.fila}>
                <Campo etiqueta="Región / Estado" value={form.provincia} onChange={cambiar('provincia')} error={errores.provincia} />
                <Campo etiqueta="Ciudad" value={form.distrito} onChange={cambiar('distrito')} error={errores.distrito} />
              </div>
            ) : (
              <>
                <Campo etiqueta="Ciudad o región" opciones={CIUDADES} value={form.ciudad} onChange={cambiar('ciudad')} />
                {form.ciudad === 'Provincias' && (
                  <div className={s.fila}>
                    <Campo
                      etiqueta="Departamento"
                      opciones={opcionesDe(departamentos.filter((d) => d !== 'Callao'), 'Elige…')}
                      value={form.departamento}
                      onChange={cambiar('departamento')}
                    />
                    <Campo
                      etiqueta="Provincia"
                      opciones={opcionesDe(form.departamento ? provincias(form.departamento).filter((p) => !(form.departamento === 'Lima' && p === 'Lima')) : [], form.departamento ? 'Elige…' : 'Primero el departamento')}
                      value={form.provincia}
                      onChange={cambiar('provincia')}
                      error={errores.provincia}
                      disabled={!form.departamento}
                    />
                  </div>
                )}
                <Campo
                  etiqueta="Distrito"
                  opciones={opcionesDe(listaDistritos, listaDistritos.length ? 'Elige…' : 'Primero la provincia')}
                  value={form.distrito}
                  onChange={cambiar('distrito')}
                  error={errores.distrito}
                  disabled={!listaDistritos.length}
                />
              </>
            )}
            <Campo
              etiqueta="Dirección exacta"
              value={form.direccion}
              onChange={cambiar('direccion')}
              error={errores.direccion}
              placeholder="Calle, número, dpto. y una referencia"
              autoComplete="street-address"
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
 *  - idioma: código actual · idiomas: [{ valor, texto, detalle }] · onIdioma(codigo)
 *  - onCerrarSesion
 */
export function PaginaAjustes({
  tema = 'claro', onTema, idioma = 'es', onIdioma, onCerrarSesion,
  idiomas = [
    { valor: 'es', texto: 'Español', detalle: 'Perú' },
    { valor: 'en', texto: 'English', detalle: 'Inglés' },
    { valor: 'pt', texto: 'Português', detalle: 'Portugués (Brasil)' },
  ],
}) {
  const noche = tema === 'noche' || tema === 'dark';
  return (
    <>
      <CabezaCuenta icono={<Settings />} titulo="Ajustes" subtitulo="Cómo se ve Walá en este dispositivo." />
      <div className={s.ajustes}>
        <TarjetaCuenta icono={<Moon />} titulo="Apariencia">
          <div className={s.interruptor}>
            <Interruptor
              activo={noche}
              onChange={() => onTema?.()}
              etiqueta="Modo noche"
              descripcion="Colores oscuros, más cómodos de noche y con poca luz."
            />
          </div>
        </TarjetaCuenta>
        <TarjetaCuenta icono={<Languages />} titulo="Idioma">
          <ListaEleccion
            etiqueta="Idioma de la tienda"
            valor={idioma}
            onElegir={onIdioma}
            opciones={idiomas.map((i) => ({ ...i, icono: <span className={s.codigoIdioma}>{i.valor.toUpperCase()}</span> }))}
          />
        </TarjetaCuenta>
      </div>
      {onCerrarSesion && (
        <button type="button" className={`${s.salir} ${s.soloAngosto}`} onClick={onCerrarSesion}>
          <LogOut aria-hidden="true" /> Cerrar sesión
        </button>
      )}
    </>
  );
}
