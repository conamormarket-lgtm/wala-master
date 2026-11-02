import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Enlace } from '../../Enlace';
import { Hueso } from '../../Esqueletos';
import { Sello, Visto } from '../../Marca';
import { CARAS_KAPI_MINI } from '../../piezas/Flotantes';
import { iconoAdmin } from '../../piezas/admin/iconosAdmin';
import s from './Inicio.module.css';

/*
 * El inicio del panel (/admin, D0): a quién saluda, lo que espera respuesta
 * y los atajos. Reemplaza los accesos sueltos de AdminDashboard. Datos por
 * props: en el admin, las cuentas salen de cada colección (reclamos sin
 * responder, pedidos por recibir…) y los atajos del menú del admin.
 */

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaDeHoy = (d = new Date()) => `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;

/**
 * Inicio del panel.
 *  - usuario: { nombre } · hoy: Date (la fecha del saludo)
 *  - pendientes: [{ id, texto, detalle, cuenta, to, icono, tono }]: lo que
 *    espera (cuenta 0: "al día"); `cargando` mientras llegan las cuentas
 *  - atajos: [{ to, texto, detalle, icono, tono }]
 */
export function PaginaInicioAdmin({ usuario, hoy, pendientes = [], atajos = [], cargando = false }) {
  const nombre = String(usuario?.nombre || '').split(' ')[0];
  const porHacer = pendientes.filter((p) => Number(p.cuenta) > 0);
  const alDia = !cargando && pendientes.length > 0 && porHacer.length === 0;
  return (
    <div className={s.inicio} data-componente="PaginaInicioAdmin">
      <header className={s.saludo}>
        <img className={s.kapi} src={alDia ? CARAS_KAPI_MINI.feliz : CARAS_KAPI_MINI.hambre} alt="" width="88" height="88" />
        <div className={s.saludoTextos}>
          <p className={s.fecha}>{fechaDeHoy(hoy)}</p>
          <h1 className={s.titulo}>{nombre ? `Hola, ${nombre}` : 'Hola'}</h1>
          <p className={s.sub}>
            {cargando ? 'Revisando lo que llegó…'
              : alDia ? 'Todo está al día. Buen momento para mejorar la tienda.'
                : porHacer.length ? `Hay ${porHacer.length === 1 ? 'una cosa que espera' : `${porHacer.length} cosas que esperan`} tu respuesta.`
                  : 'Esto es lo que más se usa del panel.'}
          </p>
        </div>
      </header>

      {pendientes.length > 0 && (
        <section className={s.bloque} aria-labelledby="inicio-pendientes">
          <h2 id="inicio-pendientes" className={s.bloqueTitulo}>Para hoy</h2>
          <ul className={s.pendientes}>
            {pendientes.map((p) => {
              const Icono = iconoAdmin(p.icono);
              const n = Number(p.cuenta) || 0;
              return (
                <li key={p.id}>
                  <Enlace to={p.to} className={[s.pendiente, !cargando && !n && s.pendienteListo].filter(Boolean).join(' ')}>
                    <Sello tamano={40} tono={p.tono}><Icono /></Sello>
                    <span className={s.pendienteTextos}>
                      <strong>{p.texto}</strong>
                      {p.detalle && <span>{p.detalle}</span>}
                    </span>
                    {cargando ? <Hueso ancho={36} alto={26} /> : n ? (
                      <span className={s.pendienteCuenta}>{n > 999 ? '999+' : n}</span>
                    ) : (
                      <span className={s.alDia}><Visto activo tamano={20} /> Al día</span>
                    )}
                    <ChevronRight className={s.flecha} aria-hidden="true" />
                  </Enlace>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {atajos.length > 0 && (
        <section className={s.bloque} aria-labelledby="inicio-atajos">
          <h2 id="inicio-atajos" className={s.bloqueTitulo}>Atajos</h2>
          <ul className={s.atajos}>
            {atajos.map((a) => {
              const Icono = iconoAdmin(a.icono);
              return (
                <li key={a.to}>
                  <Enlace to={a.to} className={s.atajo}>
                    <Sello tamano={36} tono={a.tono}><Icono /></Sello>
                    <span className={s.atajoTextos}>
                      <strong>{a.texto}</strong>
                      {a.detalle && <span>{a.detalle}</span>}
                    </span>
                  </Enlace>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
