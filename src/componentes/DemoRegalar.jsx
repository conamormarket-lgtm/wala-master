import React from 'react';
import {
  PaginaListaPublica, PaginaRegalar, PaginaRegaloSorpresa, PaginaPagoRapido, tarjetaDesdeProducto, itemRegaloDesde, diaYMes, faltanDias,
} from './kit';
import INICIO from './demo/inicio.json';

/*
 * Regalar en la Tienda de prueba: la lista de deseos de otra persona
 * (/wishlist/:código), regalar para una de sus fechas (/regalar/:código),
 * abrir el regalo (/regalo/:pedido) y el pago rápido (/pago-rapido/:id).
 * Los productos son reales (demo/inicio.json); la persona y sus fechas, de
 * ejemplo.
 */

const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

const { nuevos = [], ofertas = [], destacados = [] } = INICIO.productos;
const DUENO = { nombre: 'Isaac' };

/* Su lista: uno ya regalado y uno que salió de la tienda (borrado). Cada item
   guarda lo que la tienda guarda al agregarlo (nombre, foto, precio). */
const retirado = destacados[4] ? { ...destacados[4], deleted: true } : null;
const LISTA = [...nuevos.slice(0, 4), ...ofertas.slice(1, 3), retirado].filter(Boolean).map((p, k) => ({
  item: { productId: p.id, productName: p.name, productImage: tarjetaDesdeProducto(p).imagen, price: p.salePrice || p.price, isGifted: k === 2 },
  producto: p,
}));
const ITEMS = LISTA.map(({ item, producto }) => itemRegaloDesde(item, producto));
// Mientras llegan los productos: lo que guardó la lista y "Regalar esto" esperando.
const ITEMS_LLEGANDO = LISTA.map(({ item }) => itemRegaloDesde(item, undefined));

/** La próxima vez que cae una fecha 'MM-DD' → 'AAAA-MM-DD'. */
const proxima = (mmdd) => {
  const hoy = new Date();
  const [m, d] = mmdd.split('-').map(Number);
  let a = hoy.getFullYear();
  if (new Date(a, m - 1, d) < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) a += 1;
  return `${a}-${mmdd}`;
};

const FECHAS = [
  { id: 'f1', nombre: 'Isaac', relacion: 'Su cumpleaños', ocasion: 'Cumpleaños', mmdd: '10-24' },
  { id: 'f2', nombre: 'María', relacion: 'Hermana', ocasion: 'Cumpleaños de María', mmdd: '11-12', festivas: ['Día de la Mujer', 'Día de la Madre'] },
  { id: 'f3', nombre: 'Carlos', relacion: 'Pareja', ocasion: 'Aniversario', mmdd: '02-14', festivas: ['San Valentín'] },
].map(({ mmdd, ...f }) => ({ ...f, fecha: proxima(mmdd), dias: faltanDias(proxima(mmdd)), fechaTexto: diaYMes(proxima(mmdd)) }));

export const VISTAS_REGALAR = [
  ['Su lista de deseos', '/wishlist/ISAAC7K'],
  ['Regalar para una fecha', '/regalar/ISAAC7K'],
  ['Abrir el regalo', '/regalo/PD-9QZ38Z'],
];

export const ESTADOS_REGALAR = [
  ['cargando', 'Cargando'],
  ['noEncontrada', 'No encontrada'],
  ['vacia', 'Lista vacía'],
  ['llegando', 'Llegan los productos'],
  ['sinFechas', 'Sin fechas'],
  ['enApp', 'Abierto en la app'],
];

export function RegalarDemo({ ruta = VISTAS_REGALAR[0][1], estados = [], toast, onCarrito, onIrA }) {
  const avisar = (titulo, texto, tipo = 'exito') => toast?.({ tipo, titulo, texto, duracion: 2600 });
  const estado = estados.includes('cargando') ? 'cargando' : estados.includes('noEncontrada') ? 'noEncontrada' : undefined;
  let items = ITEMS;
  if (estados.includes('vacia')) items = [];
  else if (estados.includes('llegando')) items = ITEMS_LLEGANDO;
  const regalar = (it, fecha) => {
    onCarrito?.({
      id: `${it.id}-regalo-${Date.now()}`, imagen: it.producto.imagen, nombre: it.producto.nombre, precio: it.producto.precio, precioAntes: it.producto.precioAntes,
      cantidad: 1, url: it.producto.url,
      variante: fecha ? `Regalo para ${DUENO.nombre} · llega el ${fecha.fechaTexto}` : `Regalo para ${DUENO.nombre}`,
    });
    avisar(fecha ? '¡Regalo agregado!' : '¡Agregado a tu carrito!', fecha ? `Se entrega el ${fecha.fechaTexto} a ${DUENO.nombre}.` : 'Eliges dónde enviarlo al pagar.');
    onIrA?.('/carrito');
  };

  if (ruta.startsWith('/regalo/')) {
    return (
      <PaginaRegaloSorpresa
        key={estados.join()}
        estado={estado === 'noEncontrada' ? 'noEncontrado' : estado}
        regalo={{ para: 'María', mensaje: '¡Feliz cumpleaños, hermana! Que este año te traiga todo lo que te mereces.', sticker: 'kapi-party' }}
        enApp={estados.includes('enApp')}
      />
    );
  }
  if (ruta.startsWith('/regalar/')) {
    return (
      <PaginaRegalar
        key={estados.join()}
        estado={estado}
        dueno={DUENO}
        fechas={estados.includes('sinFechas') ? [] : FECHAS}
        items={items}
        onRegalar={({ item, fecha }) => regalar(item, fecha)}
      />
    );
  }
  return <PaginaListaPublica estado={estado} dueno={DUENO} items={items} urlFechas="/regalar/ISAAC7K" onRegalar={(it) => regalar(it, null)} />;
}

/* ── Pago rápido ── */

export const ESTADOS_PAGO_RAPIDO = [
  ['dolares', 'En dólares (PayPal)'],
  ['pagado', 'Ya pagado'],
  ['vencido', 'Vencido'],
  ['noEncontrado', 'No encontrado'],
  ['falla', 'El pago falla'],
  ['cargando', 'Cargando'],
];

export function PagoRapidoDemo({ estados = [], toast }) {
  const falla = estados.includes('falla');
  let estado;
  if (estados.includes('cargando')) estado = 'cargando';
  else if (estados.includes('noEncontrado')) estado = 'noEncontrado';
  else if (estados.includes('vencido')) estado = 'vencido';
  const usd = estados.includes('dolares');
  return (
    <PaginaPagoRapido
      key={estados.join()}
      estado={estado}
      urlWhatsApp="https://wa.me/51924426791"
      enlace={{
        concepto: usd ? 'Adelanto del pedido PD-9QZ38Z (envío a Chile)' : 'Saldo del pedido PD-9QZ38Z · 2 casacas',
        monto: usd ? 32.5 : 120,
        moneda: usd ? 'USD' : 'PEN',
        vence: 'Vence hoy a las 18:30',
        pagado: estados.includes('pagado'),
        transaccion: '8KX2-41QD',
      }}
      onTarjeta={async () => {
        await espera(1600);
        if (falla) throw new Error('Tu banco rechazó el pago. Revisa los datos o prueba con otra tarjeta.');
        toast?.({ tipo: 'exito', titulo: '¡Pago procesado!', duracion: 2000 });
      }}
      onPaypal={async () => {
        await espera(1400);
        if (falla) throw new Error('No se pudo verificar el pago con el servidor. No vuelvas a pagar todavía; escríbenos si tienes dudas.');
      }}
    />
  );
}
