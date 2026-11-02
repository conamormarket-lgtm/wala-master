import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso } from '../../Feedback';
import { Etiqueta } from '../../Etiquetas';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { PasoAdmin } from '../../piezas/admin/Pasos';
import { filasMigracion } from '../../adaptadoresAdmin';
import s from './Cuentas.module.css';

/*
 * D3c · Crear cuentas desde pedidos (/admin/crear-cuentas-pedidos): cargar
 * pedidos del ERP, crear las cuentas que faltan (la contraseña inicial es
 * el DNI) y migrar los perfiles antiguos. Lo que hace cada paso no cambia
 * (services/accountFromOrder.js); el kit pone los pasos y cómo avisan.
 */

const entero = (n) => new Intl.NumberFormat('es-PE').format(Number(n) || 0);

/**
 * Crear cuentas desde pedidos.
 *  - cargados · unicos (con correo válido, uno por correo) · hayMas · porPagina (100)
 *  - onCargar({ mas }) → promesa (cargar de nuevo o sumar la página siguiente)
 *  - onCrearCuentas(avisar) → { creadas, existian, errores, detalles: [texto] }
 *  - onMigrar({ simulacion }) → lo que devuelve migrateLegacyAutoCreatedUsers
 *  Un paso a la vez, como antes.
 */
export function PaginaCuentasDePedidos({ cargados = 0, unicos = 0, hayMas = false, porPagina = 100, onCargar, onCrearCuentas, onMigrar }) {
  const [trabajando, setTrabajando] = useState(false);
  const [cuentas, setCuentas] = useState(null);
  // La simulación y la de verdad por separado: se pueden comparar.
  const [migracion, setMigracion] = useState({ simulada: null, real: null });
  const [cargandoMas, setCargandoMas] = useState(false);
  const [falloMas, setFalloMas] = useState('');
  const uno = (fn) => async (...args) => {
    setTrabajando(true);
    try { return await fn(...args); } finally { setTrabajando(false); }
  };
  const motivo = trabajando ? 'Espera a que termine el otro paso.' : undefined;

  const cargar = uno(async () => {
    await onCargar?.({ mas: false });
    setCuentas(null);
    return 'Pedidos cargados.';
  });
  const cargarMas = uno(async () => {
    setCargandoMas(true);
    setFalloMas('');
    try { await onCargar?.({ mas: true }); } catch (err) { setFalloMas(err?.message || 'No se pudo cargar más.'); } finally { setCargandoMas(false); }
  });
  const crear = uno(async (avisar) => {
    setCuentas(null);
    const r = await onCrearCuentas?.(avisar);
    setCuentas(r);
    return r?.errores
      ? { texto: `Terminó con ${entero(r.errores)} ${r.errores === 1 ? 'error' : 'errores'}.`, aviso: true }
      : 'Listo: todas las cuentas están.';
  });
  const clave = (simulacion) => (simulacion ? 'simulada' : 'real');
  const migrar = (simulacion) => uno(async () => {
    setMigracion((m) => ({ ...m, [clave(simulacion)]: null }));
    const d = await onMigrar?.({ simulacion });
    setMigracion((m) => ({ ...m, [clave(simulacion)]: { ...d, dryRun: simulacion } }));
    return simulacion ? 'Simulación lista (no se cambió nada).' : 'Migración hecha.';
  });

  const resumenCuentas = cuentas && (
    <div className={s.resumen}>
      <div className={s.chips}>
        <Etiqueta tono="exito" punto>Creadas: {entero(cuentas.creadas)}</Etiqueta>
        <Etiqueta tono="neutro" punto>Ya existían: {entero(cuentas.existian)}</Etiqueta>
        <Etiqueta tono={cuentas.errores ? 'peligro' : 'neutro'} punto>Errores: {entero(cuentas.errores)}</Etiqueta>
      </div>
      {cuentas.detalles?.length > 0 && (
        <details className={s.detalles}>
          <summary><ChevronDown aria-hidden="true" /> Ver los errores ({cuentas.detalles.length})</summary>
          <ul>{cuentas.detalles.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </details>
      )}
    </div>
  );

  const resumenMigracion = (m) => m && (
    <div className={s.resumen}>
      <Etiqueta tono={m.dryRun ? 'aviso' : 'exito'} punto>{m.dryRun ? 'Simulación: no se cambió nada' : 'Hecho de verdad'}</Etiqueta>
      <dl className={s.filas}>
        {filasMigracion(m).map((f) => (
          <div key={f.texto}><dt>{f.texto}</dt><dd>{entero(f.valor)}</dd></div>
        ))}
      </dl>
    </div>
  );

  return (
    <div className={s.pagina} data-componente="PaginaCuentasDePedidos">
      <CabezaAdmin icono="cuentas" tono="menta" titulo="Cuentas desde pedidos" subtitulo="Crea en el portal las cuentas de quienes compraron y todavía no tienen. Una cuenta por correo; la contraseña inicial es su DNI." />

      <PasoAdmin
        numero={1}
        titulo="Cargar pedidos"
        boton={{ texto: cargados ? 'Volver a cargar' : 'Cargar pedidos' }}
        onEjecutar={cargar}
        deshabilitado={trabajando}
        motivo={motivo}
        contenido={cargados > 0 && (
          <div className={s.resumen}>
            <p className={s.cuenta}><strong>{entero(cargados)}</strong> pedidos cargados · <strong>{entero(unicos)}</strong> con correo válido (uno por correo)</p>
            {hayMas && <Boton tamano="sm" variante="contorno" cargando={cargandoMas} disabled={trabajando && !cargandoMas} onClick={() => cargarMas()}>Cargar {porPagina} más</Boton>}
            {falloMas && <Aviso tipo="error" compacto>{falloMas}</Aviso>}
          </div>
        )}
      >
        Los más recientes del ERP, de a {porPagina}. Solo cuentan los que traen un correo válido.
      </PasoAdmin>

      <PasoAdmin
        numero={2}
        titulo="Crear las cuentas que faltan"
        boton={{ texto: 'Crear cuentas', variante: 'primario' }}
        onEjecutar={crear}
        deshabilitado={trabajando || !unicos}
        motivo={trabajando ? motivo : !unicos ? 'Primero carga pedidos con correo.' : undefined}
        confirmar={{ titulo: `¿Crear las cuentas que falten de ${entero(unicos)} correos?`, texto: 'Se crean con el nombre, el DNI (su contraseña inicial) y el teléfono del pedido, y el pedido queda unido a su cuenta. Las que ya existen no se tocan.', confirmar: 'Crear cuentas' }}
        contenido={resumenCuentas}
      >
        Para cada correo sin cuenta se crea una con los datos del pedido, y el pedido queda unido a ella.
      </PasoAdmin>

      <PasoAdmin
        numero={3}
        titulo="Simular la migración de perfiles antiguos"
        boton={{ texto: 'Simular' }}
        onEjecutar={migrar(true)}
        deshabilitado={trabajando}
        motivo={motivo}
        contenido={resumenMigracion(migracion.simulada)}
      >
        Cuenta, sin cambiar nada, cuántos perfiles creados antes en <code>users</code> (y unidos a pedidos del ERP) pasarían a <code>portal_clientes_users</code>.
      </PasoAdmin>

      <PasoAdmin
        numero={4}
        titulo="Migrar de verdad"
        boton={{ texto: 'Migrar' }}
        onEjecutar={migrar(false)}
        deshabilitado={trabajando}
        motivo={motivo}
        confirmar={{ titulo: '¿Migrar los perfiles antiguos?', texto: 'Pasa los perfiles a portal_clientes_users y borra de users solo los que ya estén verificados en la nueva. Conviene simular primero (paso 3).', confirmar: 'Migrar' }}
        contenido={resumenMigracion(migracion.real)}
      >
        Lo mismo que la simulación, pero de verdad: después de copiar, borra de <code>users</code> los que ya están verificados en la colección nueva.
      </PasoAdmin>
    </div>
  );
}
