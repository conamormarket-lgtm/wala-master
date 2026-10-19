import React from 'react';
import { LogIn, Sparkles } from 'lucide-react';
import Boton from '../Boton';
import { Aviso } from '../Feedback';
import { Encabezado } from '../SeccionesContenido';
import { BloqueSeccion } from '../Seccion';
import { TarjetaJuego } from '../piezas/TarjetaJuego';
import { Texto, useTexto } from '../Traduccion';
import s from './Minijuegos.module.css';

/* ── Zona Arcade (/minijuegos) ─────────────────────────── */

/**
 * Zona Arcade: el encabezado con el estado del día y las tarjetas de los
 * juegos. Va dentro de MarcoTienda, como el carrito.
 *  - juegos: props de TarjetaJuego (juegosDelArcade los arma desde el perfil)
 *  - listos: cuántos juegos quedan hoy
 *  - sesion, cargando: sin sesión, una invitación a entrar; cargando, "Cargando
 *    tu progreso…" (no se anuncia nada hasta saberlo)
 *  - titulo, subtitulo, urlLogin · aviso: un nodo bajo el estado (el aviso
 *    del modo diseño en la tienda)
 * Los textos pasan por la traducción.
 */
export function PaginaMinijuegos({
  juegos = [], listos = 0, sesion = false, cargando = false, urlLogin = '/login',
  titulo = 'Zona Arcade', subtitulo = 'Cuatro juegos, una rutina diaria y premios que sí se canjean en tus compras.',
  aviso,
}) {
  const t = {
    titulo: useTexto(titulo),
    subtitulo: useTexto(subtitulo),
    listos: useTexto(listos === 1 ? 'juego listo para hoy' : 'juegos listos para hoy'),
  };
  // Cuántos juegos quedan: dato de la página, en texto (no en etiqueta).
  let estado;
  if (cargando) {
    estado = <p className={s.listos} role="status"><Sparkles aria-hidden="true" /><Texto>Cargando tu progreso…</Texto></p>;
  } else if (sesion) {
    estado = (
      <p className={s.listos} role="status">
        <Sparkles aria-hidden="true" />
        {listos === 0 ? <Texto>Ya hiciste todo por hoy. Vuelve mañana.</Texto> : <span><strong>{listos}</strong> {t.listos}</span>}
      </p>
    );
  } else {
    estado = (
      <div className={s.entrar}>
        <Aviso titulo="Entra con tu cuenta" accion={<Boton to={urlLogin} icono={<LogIn aria-hidden="true" />}><Texto>Iniciar sesión</Texto></Boton>}>
          Para reclamar monedas, guardar tu racha y girar la ruleta.
        </Aviso>
      </div>
    );
  }
  return (
    <>
      <BloqueSeccion ajustes={{ paddingTop: '1.75rem', paddingBottom: '0.5rem' }}>
        <Encabezado ajustes={{ title: t.titulo, subtitle: t.subtitulo }}>{estado}{aviso}</Encabezado>
      </BloqueSeccion>
      <BloqueSeccion ajustes={{ paddingTop: '1rem', paddingBottom: '2.5rem' }}>
        <ul className={s.juegos}>
          {juegos.map((j) => <li key={j.id || j.titulo}><TarjetaJuego {...j} /></li>)}
        </ul>
      </BloqueSeccion>
    </>
  );
}
