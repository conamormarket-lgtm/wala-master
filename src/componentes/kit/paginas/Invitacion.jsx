import React from 'react';
import { ArrowRight, Check, UserPlus, IdCard, Coins, Store, LogIn, RotateCcw, Share2 } from 'lucide-react';
import Boton from '../Boton';
import { Aviso, EstadoVacio } from '../Feedback';
import { GananciaMonedas } from '../Etiquetas';
import { IconoWala } from '../IconosWala';
import { Trazo, Sello, Destello, Puntos } from '../Marca';
import { BloqueSeccion } from '../Seccion';
import { EsqueletoPagina } from '../Esqueletos';
import { CARAS_KAPI } from '../piezas/Flotantes';
import { PasosSellos } from '../piezas/PasosSellos';
import { TextoResaltado } from '../piezas/TextoResaltado';
import { Texto, useTexto } from '../Traduccion';
import s from './Invitacion.module.css';

/* ── La invitación (/invitar/:código) ───────────────────── */

/**
 * La invitación de una cuenta (el link permanente de Mis referidos): quién
 * te invitó, lo que ganas y cómo, antes de crear la cuenta. Quien invita gana
 * cuando haces tu primera compra; a ti no te cuesta nada.
 *  - nombre: el primer nombre de quien invita (sin él, "Te invitaron")
 *  - estado: 'nueva' (sin cuenta) | 'conCuenta' (ya tiene cuenta: la
 *    invitación no aplica, el link vale como uno de compra) | 'faltanDatos'
 *    (cuenta recién creada sin DNI o celular: aún puede recibir el bono) |
 *    'aceptada' (ya recibió el bono) | 'propia' (abrió su propio link) |
 *    'invalida' (el código no existe) | 'error' (no se pudo revisar; con
 *    onReintentar) | 'cargando'
 *  - bono (10 monedas para quien llega) · diasPrimeraCompra (30) · horasCompra (36)
 *  - urlRegistro · urlLogin · urlTienda · urlPerfil (completar los datos) ·
 *    urlReferidos (el propio link)
 * Los textos pasan por la traducción.
 */
export function PaginaInvitacion({
  nombre, estado = 'nueva', bono = 10, diasPrimeraCompra = 30, horasCompra = 36, onReintentar,
  urlRegistro = '/registro', urlLogin = '/login', urlTienda = '/tienda', urlPerfil = '/cuenta/perfil', urlReferidos = '/cuenta/referidos',
}) {
  const quien = nombre || 'Quien te invitó';
  const t = {
    titulo: useTexto(nombre ? `${nombre} te invitó a Walá` : 'Te invitaron a Walá'),
    aceptada: useTexto(`¡Ya tienes tus ${bono} monedas!`),
    nota: useTexto(`${quien} gana monedas cuando haces tu primera compra (en los ${diasPrimeraCompra} días siguientes). A ti no te cuesta nada. Es solo para cuentas nuevas: el DNI y el celular no deben estar en otra cuenta ni en compras anteriores.`),
  };
  // Aviso y PasosSellos traducen lo suyo: estos van sin traducir.
  const conCuenta = `Ya tienes una cuenta en Walá, así que no aplica el bono de bienvenida. Igual, si compras en las próximas ${horasCompra} h, ${nombre || 'quien te invitó'} gana monedas con tu pedido.`;
  const faltan = `Completa tu DNI y tu celular en Mi perfil: si tu cuenta es nueva, recibes tus ${bono} monedas al instante.`;

  if (estado === 'cargando') return <EsqueletoPagina forma="invitacion" />;
  if (estado === 'invalida' || estado === 'error') {
    const error = estado === 'error';
    return (
      <BloqueSeccion ajustes={{ paddingTop: '2rem', paddingBottom: '2.5rem' }}>
        <EstadoVacio
          imagen={CARAS_KAPI.triste}
          titulo={<Texto>{error ? 'No pudimos abrir la invitación' : 'Este link de invitación no es válido'}</Texto>}
          texto={<Texto>{error ? 'Revisa tu conexión e inténtalo otra vez.' : 'Revisa que esté completo o pide a quien te invitó que te lo vuelva a enviar.'}</Texto>}
        >
          {error && onReintentar && <Boton onClick={onReintentar} icono={<RotateCcw aria-hidden="true" />}><Texto>Reintentar</Texto></Boton>}
          <Boton to={urlTienda} variante={error ? 'secundario' : 'primario'} icono={<Store aria-hidden="true" />}><Texto>Ir a la tienda</Texto></Boton>
        </EstadoVacio>
      </BloqueSeccion>
    );
  }
  const aceptada = estado === 'aceptada';
  const propia = estado === 'propia';
  let titulo;
  if (aceptada) titulo = t.aceptada;
  else if (propia) titulo = <Texto>Este es tu link de invitación</Texto>;
  else if (nombre) titulo = <TextoResaltado resaltar={[nombre]} envolver={(parte, k) => <span key={k} className={s.invitarNombre}>{parte}</span>}>{t.titulo}</TextoResaltado>;
  else titulo = t.titulo;
  let bajada = 'Prendas, tazas y regalos personalizados con tu diseño, hechos con amor en Perú.';
  if (aceptada) bajada = 'Úsalas en tu primera compra: se descuentan en el checkout.';
  if (propia) bajada = `Compártelo: quien cree su cuenta con él recibe ${bono} monedas, y tú ganas con su primera compra.`;
  return (
    <BloqueSeccion ajustes={{ paddingTop: '1.75rem', paddingBottom: '2.5rem' }}>
      <section className={s.invitar} data-componente="PaginaInvitacion">
        <span className={s.invitarAdornos} aria-hidden="true">
          <Puntos className={s.invitarPuntos} />
          <Destello className={s.invitarDestello1} />
          <Destello className={s.invitarDestello2} />
        </span>
        <Sello tamano={76} girar={-8} tono={aceptada ? 'menta' : 'degradado'}>
          {aceptada ? <Check aria-hidden="true" className={s.invitarSelloIcono} /> : <IconoWala nombre="regalo" tamano={46} />}
        </Sello>
        <h1 className={s.invitarTitulo}>{titulo}<Trazo className={s.trazo} /></h1>
        <p className={s.invitarBajada}><Texto>{bajada}</Texto></p>

        {estado === 'nueva' && (
          <>
            <div className={s.invitarPremio}>
              <GananciaMonedas monto={bono} />
              <span><Texto>de bienvenida al crear tu cuenta</Texto></span>
            </div>
            <PasosSellos
              etiqueta="Cómo recibes tus monedas"
              className={s.invitarPasos}
              pasos={[
                { icono: <UserPlus aria-hidden="true" />, titulo: 'Crea tu cuenta', texto: 'Con tu correo o con Google.' },
                { icono: <IdCard aria-hidden="true" />, titulo: 'Completa tu DNI y celular', texto: 'Así sabemos que tu cuenta es nueva.' },
                { icono: <Coins aria-hidden="true" />, titulo: `Recibes ${bono} monedas`, texto: 'Para usarlas en tu primera compra.' },
              ]}
            />
            <div className={s.invitarBotones}>
              <Boton to={urlRegistro} tamano="lg" icono={<UserPlus aria-hidden="true" />}><Texto>Crear mi cuenta</Texto></Boton>
              <Boton to={urlLogin} tamano="lg" variante="fantasma" icono={<LogIn aria-hidden="true" />}><Texto>Ya tengo cuenta</Texto></Boton>
            </div>
            <p className={s.invitarNota}>{t.nota}</p>
          </>
        )}

        {estado === 'faltanDatos' && (
          <>
            <div className={s.invitarAviso}>
              <Aviso tipo="info" titulo={<Texto>Te falta un paso</Texto>}>{faltan}</Aviso>
            </div>
            <div className={s.invitarBotones}>
              <Boton to={urlPerfil} tamano="lg" icono={<IdCard aria-hidden="true" />}><Texto>Completar mis datos</Texto></Boton>
            </div>
          </>
        )}

        {estado === 'conCuenta' && (
          <>
            <div className={s.invitarAviso}>
              <Aviso tipo="info" titulo={<Texto>La invitación es para cuentas nuevas</Texto>}>{conCuenta}</Aviso>
            </div>
            <div className={s.invitarBotones}>
              <Boton to={urlTienda} tamano="lg" icono={<Store aria-hidden="true" />}><Texto>Ir a la tienda</Texto></Boton>
            </div>
          </>
        )}

        {propia && (
          <div className={s.invitarBotones}>
            <Boton to={urlReferidos} tamano="lg" icono={<Share2 aria-hidden="true" />}><Texto>Compartir mi invitación</Texto></Boton>
            <Boton to={urlTienda} tamano="lg" variante="fantasma" icono={<Store aria-hidden="true" />}><Texto>Ir a la tienda</Texto></Boton>
          </div>
        )}

        {aceptada && (
          <div className={s.invitarBotones}>
            <Boton to={urlTienda} tamano="lg" iconoFin={<ArrowRight aria-hidden="true" />}><Texto>Ir a la tienda</Texto></Boton>
          </div>
        )}
      </section>
    </BloqueSeccion>
  );
}
