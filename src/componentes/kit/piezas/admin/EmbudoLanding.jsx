import React, { useState } from 'react';
import { BloqueMetrica, FilaCifras, Cifra, ListaBarras, SinDatos } from './Metricas';
import { Selector } from '../../Formulario';
import { Aviso } from '../../Feedback';
import { EsqueletoTexto } from '../../Esqueletos';
import Boton from '../../Boton';
import s from './EmbudoLanding.module.css';

const entero = n => new Intl.NumberFormat('es-PE').format(n || 0);
const porcentaje = (n, base) => base ? `${new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(n / base * 100)}%` : '—';

export default function EmbudoLanding({ data, cargando, error, onActualizar }) {
  const [seleccion, setSeleccion] = useState('');
  const producto = data?.products?.find(p => p.landingId === seleccion);
  const c = producto?.counts || data?.total;
  const filas = c ? [
    ['landing', 'Llegaron a la landing', c.landing, 'Base del recorrido'],
    ['cart', 'Entraron al carrito · opcional', c.landing, 'Vista del carrito, no solo agregar un producto'],
    ['shipping', 'Vieron los datos de envío', c.landing, `${entero(c.directShipping)} llegaron directamente, sin pasar antes por el carrito`],
    ['payment', 'Vieron las opciones de pago', c.shipping, 'Después de continuar desde los datos de envío'],
    ['selected', 'Eligieron un medio de pago', c.payment, 'Personas que pulsaron al menos una opción'],
  ].map(([id, nombre, base, nota]) => ({ id, nombre, valor: c[id], texto: `${entero(c[id])} · ${porcentaje(c[id], c.landing)} de las visitas`,
    nota, sub: id === 'payment' ? `${porcentaje(c[id], base)} de quienes llegaron al envío` : id === 'selected' ? `${porcentaje(c[id], base)} de quienes vieron las opciones` : undefined,
  })) : [];
  return (
    <BloqueMetrica titulo="De la landing al pago" ayuda="Personas que entraron a una página /producto/…/landing en el periodo seleccionado y su avance hasta el final de ese periodo."
      acciones={onActualizar && <Boton tamano="sm" variante="fantasma" onClick={onActualizar} cargando={cargando}>Actualizar embudo</Boton>}>
      <div className={s.contenido}>
        {error ? <Aviso tipo="error" titulo="No se pudo cargar el embudo">{error}</Aviso>
          : !data ? <EsqueletoTexto lineas={5} /> : <>
            <Selector etiqueta="Landing" valor={producto?.landingId || ''} onCambiar={setSeleccion}
              opciones={[{ valor: '', texto: 'Todas las landings' }, ...(data.products || []).map(p => ({ valor: p.landingId, texto: `${p.name} · ${p.landingId}` }))]} />
            {c?.landing ? <>
              <ListaBarras filas={filas} max={5} conCeros multilinea />
              <FilaCifras etiqueta="Medio de pago elegido">
                <Cifra nombre="Eligieron WhatsApp" valor={entero(c.whatsapp)} explicacion={`${porcentaje(c.whatsapp, c.payment)} de quienes vieron las opciones`} tono="exito" />
                <Cifra nombre="Eligieron tarjeta" valor={entero(c.card)} explicacion={`${porcentaje(c.card, c.payment)} de quienes vieron las opciones`} tono="violeta" />
                {c.paypal > 0 && <Cifra nombre="Eligieron PayPal" valor={entero(c.paypal)} explicacion="Checkout internacional" />}
                <Cifra nombre="Sin elegir un medio" valor={entero(c.payment - c.selected)} explicacion="Vieron las opciones, pero no pulsaron ninguna en este periodo" />
              </FilaCifras>
            </> : <SinDatos>Aún no hay visitas medidas a las landings en este periodo. La medición empieza al publicar esta actualización.</SinDatos>}
          </>}
        <p className={s.nota}>«Comprar ahora» puede saltarse el carrito. Cada persona se cuenta una vez por paso y periodo según su navegador; al filtrar una landing, se cuenta una vez en esa landing. No se suman visitas repetidas ni recargas.</p>
        <p className={s.nota}>Elegir una opción no confirma el pago. Una persona puede probar tarjeta y WhatsApp: aparece en ambas opciones, pero una sola vez en «Eligieron un medio de pago». La atribución se conserva durante 24 horas en la misma pestaña y solo en el checkout enlazado desde la landing. Se excluyen administradores y bots.</p>
      </div>
    </BloqueMetrica>
  );
}
