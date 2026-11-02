import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, RefreshCw, RotateCcw } from 'lucide-react';
import Boton from '../../Boton';
import { Aviso, Confirmar, useToast } from '../../Feedback';
import { Campo, Interruptor } from '../../Formulario';
import { Pestanas } from '../../Navegacion';
import { CabezaAdmin } from '../../piezas/admin/Marco';
import { InsigniaEstado } from '../../piezas/admin/Datos';
import { GrupoCampos, BarraGuardar } from '../../piezas/admin/Formularios';
import { PaginaListaAdmin } from './Lista';
import { numeroWhatsApp, haceCuanto } from '../../adaptadores';
import {
  SECCIONES_WHATSAPP, telefonoEscrito, erroresDeWhatsApp, mensajePedidoDeEjemplo,
  nombreDePaginaGuardada, textoCambioStock, csvInventario,
} from '../../adaptadoresAdmin';
import l from './Lista.module.css';
import s from './Ajustes.module.css';

/*
 * D8b · WhatsApp (/admin/whatsapp) y el historial (/admin/backups): a qué
 * número escribe el cliente según dónde esté, y las copias del diseño de la
 * tienda (para volver a una) y los cambios de stock (para descargarlos).
 */

const errorDe = (err) => err?.message || 'Vuelve a intentar.';
const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// El año solo si no es el de ahora.
const fechaHora = (ms) => {
  if (!ms) return '—';
  const otroAno = new Date(ms).getFullYear() !== new Date().getFullYear();
  return new Date(ms).toLocaleString('es-PE', { day: 'numeric', month: 'short', ...(otroAno && { year: 'numeric' }), hour: '2-digit', minute: '2-digit' });
};
/** +51987654321 → +51 987 654 321 (un celular peruano); los demás, tal cual. */
const legible = (n) => String(n || '').replace(/^\+51(\d{3})(\d{3})(\d{3})$/, '+51 $1 $2 $3');
const enlaceDe = (numero) => {
  const n = numeroWhatsApp(numero);
  return n ? `https://wa.me/${n.replace(/\D/g, '')}` : '';
};

/**
 * WhatsApp (/admin/whatsapp).
 *  - cargando · error · onReintentar
 *  - config: whatsappDesdeMensajes · onGuardar(config) (el conector la pasa por whatsappAMensajes)
 */
export function PaginaWhatsAppAdmin({ cargando = false, error, onReintentar, config, onGuardar }) {
  const toast = useToast();
  const [c, setC] = useState(config);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setC(config); setErrores({}); }, [config]);
  const cambiar = (campo, valor) => {
    setC((x) => ({ ...x, [campo]: valor }));
    setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };
  const guardar = async () => {
    const nuevos = erroresDeWhatsApp(c);
    const primero = Object.keys(nuevos).find((k) => nuevos[k]);
    if (primero) {
      setErrores(nuevos);
      document.getElementById(`wa-${primero}`)?.focus();
      return;
    }
    setGuardando(true);
    try {
      await onGuardar?.(c);
      toast({ tipo: 'exito', titulo: 'WhatsApp guardado', texto: 'El botón usa estos números desde ahora.' });
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo guardar', texto: errorDe(err) });
    } finally {
      setGuardando(false);
    }
  };
  const cabeza = { icono: 'whatsapp', tono: 'menta', titulo: 'WhatsApp', subtitulo: 'A qué número escribe el cliente según dónde esté, y el mensaje al confirmar un pedido.' };

  let cuerpo;
  if (error) {
    cuerpo = <Aviso tipo="error" titulo="No pudimos leer los números" accion={onReintentar && <Boton tamano="sm" variante="contorno" icono={<RefreshCw aria-hidden="true" />} onClick={onReintentar}>Reintentar</Boton>}>{error}</Aviso>;
  } else if (cargando || !c) {
    cuerpo = <p className={s.nota} aria-busy="true">Cargando…</p>;
  } else {
    const conId = c.mensajePedido.includes('{id}');
    cuerpo = (
      <div className={s.whatsapp}>
        {SECCIONES_WHATSAPP.map((x) => {
          const valor = c[x.clave];
          const enlace = enlaceDe(valor || (x.clave === 'tienda' ? '' : c.tienda));
          return (
            <GrupoCampos key={x.clave} titulo={x.titulo} ayuda={x.donde}>
              <Campo
                id={`wa-${x.clave}`}
                etiqueta="Número"
                inputMode="tel"
                autoComplete="off"
                placeholder={x.clave === 'tienda' ? '+51 987 654 321' : 'Vacío: el de la tienda'}
                ayuda={x.clave === 'tienda' ? 'Sin +, se le pone el +51 del Perú.' : (valor ? 'Sin +, se le pone el +51 del Perú.' : 'Vacío, usa el de la tienda.')}
                value={valor}
                error={errores[x.clave]}
                onChange={(e) => cambiar(x.clave, telefonoEscrito(e.target.value))}
              />
              {enlace && (
                <p className={s.enlace}>
                  <span>Escriben a <strong>{legible(numeroWhatsApp(valor || c.tienda))}</strong>{!valor && x.clave !== 'tienda' ? ' (el de la tienda)' : ''}</span>
                  <Boton tamano="sm" variante="fantasma" iconoFin={<ExternalLink aria-hidden="true" />} to={enlace}>Probar</Boton>
                </p>
              )}
              {x.clave === 'tienda' && (
                <>
                  <Campo
                    etiqueta="Mensaje al confirmar un pedido"
                    multilinea={4}
                    ayuda="{id} se cambia por el código del pedido."
                    value={c.mensajePedido}
                    onChange={(e) => cambiar('mensajePedido', e.target.value)}
                  />
                  <div className={s.burbuja} aria-label="Así llega el mensaje">
                    <span className={s.etiqueta}>Así te llega</span>
                    <p>{mensajePedidoDeEjemplo(c.mensajePedido)}</p>
                  </div>
                  {!conId && <Aviso tipo="aviso" compacto titulo="Sin {id}, el mensaje no dice qué pedido es." />}
                </>
              )}
            </GrupoCampos>
          );
        })}
        <GrupoCampos titulo="Iniciar sesión y registro">
          <Interruptor
            etiqueta="Mostrar el botón al entrar a la cuenta"
            descripcion={c.enAcceso ? 'Sale en iniciar sesión, registro y recuperar contraseña.' : 'Esas pantallas van sin el botón, para no distraer de entrar.'}
            activo={c.enAcceso}
            onChange={(v) => cambiar('enAcceso', v)}
          />
        </GrupoCampos>
        <p className={s.nota}>Las marcas y los productos con su propio número mandan sobre estos. El panel y las landing pages no llevan el botón.</p>
        <BarraGuardar visible={!mismo(c, config)} texto="Cambiaste el WhatsApp." onDescartar={() => { setC(config); setErrores({}); }} onGuardar={guardar} guardando={guardando} />
      </div>
    );
  }

  return (
    <div className={s.pagina} data-componente="PaginaWhatsAppAdmin">
      <CabezaAdmin {...cabeza} />
      {cuerpo}
    </div>
  );
}

const PESTANAS_HISTORIAL = [{ id: 'diseno', texto: 'Diseño de la tienda' }, { id: 'inventario', texto: 'Inventario' }];
const ESTADOS_VERSION = { actual: { texto: 'Puesta', tono: 'exito' }, antes: { texto: 'Anterior', tono: 'neutro' } };

/** Baja un texto como archivo (con BOM: Excel lee bien las tildes). */
function descargar(texto, nombre) {
  const url = URL.createObjectURL(new Blob([`\ufeff${texto}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Historial (/admin/backups).
 *  - pestana + onPestana
 *  - cambios: conVersionActual([cambioDisenoDesde]) · cargando · error · onReintentar · onRestaurar(cambio)
 *  - movimientos: [movimientoInventarioDesde] · cargandoMovimientos · errorMovimientos · onReintentarMovimientos
 */
export function PaginaHistorialAdmin({
  pestana: pestanaFuera, onPestana,
  cambios = [], cargando = false, error, onReintentar, onRestaurar,
  movimientos = [], cargandoMovimientos = false, errorMovimientos, onReintentarMovimientos,
}) {
  const toast = useToast();
  const [pestanaDentro, setPestanaDentro] = useState('diseno');
  const pestana = pestanaFuera || pestanaDentro;
  const ir = (p) => (onPestana ? onPestana(p) : setPestanaDentro(p));
  const [restaurar, setRestaurar] = useState(null);
  const cabeza = { icono: 'historial', tono: 'plata', titulo: 'Historial', subtitulo: 'Las copias del diseño de la tienda y los cambios de stock.' };
  const secciones = <div className={s.pestanas}><Pestanas etiqueta="Partes del historial" opciones={PESTANAS_HISTORIAL} valor={pestana} onChange={ir} /></div>;
  const paginas = useMemo(() => [...new Set(cambios.map((x) => x.pagina))].map((p) => ({ valor: p, texto: nombreDePaginaGuardada(p) })), [cambios]);

  const confirmarRestaurar = async () => {
    const x = restaurar;
    try {
      await onRestaurar?.(x);
      toast({ tipo: 'exito', titulo: 'Versión restaurada', texto: `${nombreDePaginaGuardada(x.pagina)} tiene puesta la copia del ${fechaHora(x.cuando)}` });
      setRestaurar(null);
    } catch (err) {
      toast({ tipo: 'error', titulo: 'No se pudo restaurar', texto: errorDe(err) });
    }
  };

  if (pestana === 'inventario') {
    return (
      <PaginaListaAdmin
        cabeza={cabeza}
        antes={(
          <>
            {secciones}
            <div className={s.fila}>
              <p className={s.nota}>Cada cambio de stock hecho desde el inventario, con quién lo hizo.</p>
              <Boton tamano="sm" variante="secundario" icono={<Download aria-hidden="true" />} disabled={!movimientos.length} onClick={() => descargar(csvInventario(movimientos), `inventario_${new Date().toISOString().slice(0, 10)}.csv`)}>Descargar CSV</Boton>
            </div>
          </>
        )}
        registros={movimientos}
        cargando={cargandoMovimientos}
        error={errorMovimientos}
        onReintentar={onReintentarMovimientos}
        nombreDe={(m) => m.producto}
        unidad={['cambio', 'cambios']}
        buscarEn={(m) => `${m.producto} ${m.quien}`}
        placeholder="Buscar por producto o persona"
        filtros={[{ id: 'tipo', etiqueta: 'Cambio', todos: 'Subió o bajó', opciones: [{ valor: 'sube', texto: 'Subió' }, { valor: 'baja', texto: 'Bajó' }], filtrar: (m, v) => (v === 'sube' ? m.cambio > 0 : m.cambio < 0) }]}
        columnas={[
          { id: 'producto', titulo: 'Producto', tarjeta: 'titulo', celda: (m) => <>{m.producto}<span className={l.sub}>{m.quien}</span></> },
          { id: 'cuando', titulo: 'Cuándo', ancho: 190, tarjeta: 'detalle', ordenable: true, celda: (m) => fechaHora(m.cuando) },
          { id: 'stock', titulo: 'Stock', ancho: 110, alinear: 'fin', tarjeta: 'detalle', celda: (m) => <span className={l.numero}>{m.antes} → {m.despues}</span> },
          { id: 'cambio', titulo: 'Cambio', ancho: 120, tarjeta: 'estado', celda: (m) => (
            <span className={m.cambio > 0 ? s.sube : m.cambio < 0 ? s.baja : s.igual}>{m.cambio > 0 ? 'Subió' : m.cambio < 0 ? 'Bajó' : 'Igual'} {textoCambioStock(m.cambio)}</span>
          ) },
        ]}
        ordenes={{ cuando: (a, b) => a.cuando - b.cuando }}
        ordenInicial={{ por: 'cuando', dir: 'desc' }}
        vacio={{ titulo: 'Todavía no hay cambios de stock', texto: 'Aparecen aquí cuando alguien cambia el stock desde el inventario.' }}
      />
    );
  }

  return (
    <PaginaListaAdmin
      cabeza={cabeza}
      antes={(
        <>
          {secciones}
          <p className={s.nota}>Cada vez que alguien guarda en el editor de la tienda queda una copia. Las 50 más nuevas.</p>
          <Confirmar
            abierta={Boolean(restaurar)}
            titulo={restaurar ? `¿Restaurar esta copia de «${nombreDePaginaGuardada(restaurar.pagina)}»?` : ''}
            texto={restaurar ? `Se pone la copia del ${fechaHora(restaurar.cuando)} en lugar de la que está ahora. La de ahora queda en el historial: puedes volver a ella.` : ''}
            confirmar="Restaurar"
            onConfirmar={confirmarRestaurar}
            onCancelar={() => setRestaurar(null)}
          />
        </>
      )}
      registros={cambios}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      nombreDe={(x) => nombreDePaginaGuardada(x.pagina)}
      unidad={['copia', 'copias']}
      femenino
      filtros={paginas.length > 1 ? [{ id: 'pagina', etiqueta: 'Página', todos: 'Todas', opciones: paginas, filtrar: (x, v) => x.pagina === v }] : []}
      columnas={[
        { id: 'pagina', titulo: 'Página', tarjeta: 'titulo', celda: (x) => nombreDePaginaGuardada(x.pagina) },
        { id: 'cuando', titulo: 'Cuándo', tarjeta: 'detalle', celda: (x) => <span className={s.cuando}>{fechaHora(x.cuando)}<span className={l.sub}>{haceCuanto(x.cuando, x.descripcion.startsWith('Restaurada') ? 'Restaurada' : 'Guardada', { fino: true })}</span></span> },
        { id: 'estado', titulo: 'Estado', ancho: 130, tarjeta: 'estado', celda: (x) => <InsigniaEstado estado={x.actual ? 'actual' : 'antes'} estados={ESTADOS_VERSION} /> },
        // El editor solo anota «Admin» como autor: no se muestra.
        { id: 'accion', titulo: '', ancho: 150, tarjeta: 'control', celda: (x) => (x.actual
          ? null
          : <Boton tamano="sm" variante="secundario" icono={<RotateCcw aria-hidden="true" />} disabled={!x.config} onClick={() => setRestaurar(x)}>Restaurar</Boton>) },
      ]}
      vacio={{ titulo: 'Todavía no hay copias', texto: 'Aparecen aquí cuando alguien guarda en el editor de la tienda.' }}
    />
  );
}
