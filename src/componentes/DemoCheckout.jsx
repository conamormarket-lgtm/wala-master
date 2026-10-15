import React from 'react';
import { PaginaCheckout } from './kit';
import { COUNTRIES } from '../constants/countries';
import { ENVIO_ESTANDAR, ENVIO_GRATIS_DESDE } from '../constants/envio';
import { LUGARES, DIRECCIONES } from './DemoCuenta';

/*
 * El checkout (/checkout) en la Tienda de prueba, con lo que hay en el
 * carrito de la demo. Las reglas son las de la tienda (constants/envio: S/ 15,
 * gratis en compras de más de S/ 100; monedas hasta la mitad). Nada se cobra:
 * la tarjeta, WhatsApp y PayPal solo esperan y avisan.
 */

const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** Estados para probar el checkout. */
export const ESTADOS_CHECKOUT = [
  ['cargando', 'Cargando'],
  ['vacio', 'Carrito vacío'],
  ['sinDirecciones', 'Sin direcciones guardadas'],
  ['tarjetaFalla', 'La tarjeta falla'],
  ['variasMarcas', 'Varias marcas'],
  ['regalo', 'Regalo programado'],
  ['invitacion', 'Con invitación'],
  ['incompleto', 'Falta una talla'],
];

/* Sin emojis de banderas: solo el nombre. */
const PAISES = COUNTRIES.map((c) => ({ valor: c.code, texto: c.name }));

/* Cupones de prueba (en la tienda los valida validarCuponSecure). */
const CUPONES = {
  WALA10: (sub) => ({ texto: '10% de descuento', descuento: Math.round(sub * 10) / 100 }),
  ENVIOGRATIS: () => ({ texto: 'Envío gratis', descuento: 0, envioGratis: true }),
};

/** Una cuenta aproximada en dólares (en la tienda, services/fx). */
const USD_POR_SOL = 0.27;

export function CheckoutDemo({ items = [], sesion, usuario, monedas = 0, estados = [], toast, onIrA }) {
  const avisar = (titulo, texto, tipo = 'exito') => toast?.({ tipo, titulo, texto, duracion: 2600 });
  const elegidos = estados.includes('vacio') ? [] : items;
  const subtotal = elegidos.reduce((t, it) => t + it.precio * it.cantidad, 0);
  return (
    <PaginaCheckout
      key={`${sesion}-${estados.join()}`}
      estado={estados.includes('cargando') ? 'cargando' : undefined}
      items={elegidos}
      incompletos={estados.includes('incompleto') && elegidos[0] ? [elegidos[0].nombre] : []}
      sesion={sesion}
      perfil={sesion ? { nombre: usuario?.nombre || 'Isaac Castro', tipoDocumento: 'DNI', documento: '45871236', telefono: '987654321', email: 'isaac@ejemplo.com', pais: 'PE' } : {}}
      direcciones={sesion && !estados.includes('sinDirecciones') ? DIRECCIONES : []}
      lugares={LUGARES}
      paises={PAISES}
      envio={{ costo: ENVIO_ESTANDAR, gratisDesde: ENVIO_GRATIS_DESDE }}
      monedas={{ saldo: sesion ? monedas : 0 }}
      onCupon={async (codigo) => {
        await espera(600);
        const c = CUPONES[codigo];
        if (!c) throw new Error('Este cupón no existe o ya venció. Prueba WALA10 o ENVIOGRATIS.');
        return { codigo, ...c(subtotal) };
      }}
      onPreparar={async () => {
        await espera(900);
        return { numero: `PD-${Date.now().toString(36).toUpperCase().slice(-6)}` };
      }}
      pago={{
        usd: (total) => total * USD_POR_SOL,
        marcas: estados.includes('variasMarcas') ? [{ id: 'm1', nombre: 'Con Amor Geeks', cantidad: 1 }, { id: 'm2', nombre: 'Mussa Beauty', cantidad: 1 }] : undefined,
        onTarjeta: async () => {
          await espera(1800);
          if (estados.includes('tarjetaFalla')) throw new Error('Tu banco rechazó el pago. Revisa los datos o prueba con otra tarjeta.');
          avisar('¡Pago procesado!', 'En la tienda irías a Mis pedidos.');
        },
        onWhatsApp: async (marca) => {
          await espera(900);
          avisar('Se abriría WhatsApp', marca ? 'Con la parte de esa marca del pedido.' : 'Con el detalle del pedido para el asesor.', 'info');
        },
        onPaypal: async () => {
          await espera(1500);
          avisar('¡Pago con PayPal aprobado!');
        },
      }}
      entrega={estados.includes('regalo') ? { fecha: '24 de octubre', ocasion: 'Cumpleaños', destinatario: 'María', aviso: 'Está cerca: la preparación y el envío toman de 7 a 30 días hábiles.' } : undefined}
      invitacion={estados.includes('invitacion') ? { nombre: 'Andrea' } : undefined}
      onIrA={onIrA}
    />
  );
}
