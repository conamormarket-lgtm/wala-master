import React, { useState } from 'react';
import { Bone } from 'lucide-react';
import Boton from '../Boton';
import { Etiqueta, GananciaMonedas } from '../Etiquetas';
import { HojaInferior } from '../Feedback';
import CuentaRegresiva from '../CuentaRegresiva';
import { Destello } from '../Marca';
import { BarraProgreso } from './BarraProgreso';
import { RetoSemanal } from './RetoSemanal';
import { CARAS_KAPI } from './Flotantes';
import { useTexto } from '../Traduccion';
import s from './VentanaKapi.module.css';

/* Lo que se le dice al cliente según cómo esté Kapi (acompaña a la carita). */
const FRASES = {
  feliz: 'Kapi está feliz. Vuelve mañana por su comida.',
  hambre: 'Kapi tiene hambre. Dale de comer y te llevas una moneda.',
  triste: 'Kapi te echa de menos. Llevas días sin darle de comer.',
};

/**
 * Ventana de Kapi, la mascota: su ánimo, la felicidad, la moneda del día y el
 * reto de la semana. Hoja inferior en el celular y ventana centrada en
 * escritorio (HojaInferior). Mientras Kapi come no se cierra: el resultado
 * (monedas volando, error) sale de aquí.
 *
 *  - abierta, onCerrar, contenida (dentro de un marco, como la demo)
 *  - estado: 'feliz' | 'hambre' | 'triste' (kapiDesdePerfil)
 *  - felicidad: 0-100 · alimentado: ya comió hoy · recompensa: monedas de hoy
 *  - hasta: ISO de la próxima comida (medianoche de Lima)
 *  - onAlimentar(boton) → promesa: la página llama al servidor y hace volar las
 *    monedas desde `boton`; la ventana muestra "Alimentando…" mientras tanto
 *  - reto: props de RetoSemanal (o nada si no hay reto activo)
 *
 * Los id kapi-pet-container, kapi-stats y kapi-feed-btn son los que usa el
 * recorrido de bienvenida de la tienda (driver.js).
 */
export function VentanaKapi({ abierta, onCerrar, contenida = false, estado = 'feliz', felicidad = 0, alimentado = false, recompensa = 1, hasta, onAlimentar, reto }) {
  const [comiendo, setComiendo] = useState(false);
  const cerrar = () => { if (!comiendo) onCerrar?.(); };
  const t = {
    titulo: useTexto('Tu mascota Kapi'),
    frase: useTexto(FRASES[estado] || FRASES.feliz),
    lleno: useTexto('¡Kapi está lleno por hoy!'),
    podras: useTexto('Podrás darle de comer en'),
    ya: useTexto('Ya puedes darle de comer.'),
    alimentando: useTexto('Alimentando…'),
    alimentar: useTexto('Alimentar a Kapi'),
    hecho: useTexto('Hecho hoy'),
    disponible: useTexto('Disponible hoy'),
    monedas: useTexto(recompensa === 2 ? '+2 monedas' : '+1 moneda'),
    felicidad: useTexto('Felicidad'),
  };

  const alimentar = async (e) => {
    if (comiendo || alimentado) return;
    const boton = e.currentTarget;
    setComiendo(true);
    // Lo que tarde el servidor, con un mínimo para que se vea comer.
    await Promise.all([onAlimentar?.(boton), new Promise((r) => setTimeout(r, 700))]).catch(() => {});
    setComiendo(false);
  };

  const pie = alimentado ? (
    <div className={s.lleno}>
      <strong>{t.lleno}</strong>
      {hasta && <CuentaRegresiva variante="frase" hasta={hasta} etiqueta={t.podras} textoFin={t.ya} />}
    </div>
  ) : (
    <Boton id="kapi-feed-btn" bloque tamano="lg" cargando={comiendo} icono={<Bone aria-hidden="true" />} onClick={alimentar}>
      {comiendo ? t.alimentando : t.alimentar}
    </Boton>
  );

  return (
    <HojaInferior abierta={abierta} onCerrar={cerrar} titulo={t.titulo} pie={pie} contenida={contenida}>
      <div className={s.ventana}>
        <p className={s.frase}>{t.frase}</p>

        {/* Kapi suelto, sin círculo, con su sombra en el piso. */}
        <div className={s.retrato} id="kapi-pet-container">
          <Destello className={s.destello1} />
          <Destello className={s.destello2} />
          <img
            src={CARAS_KAPI[comiendo ? 'feliz' : estado] || CARAS_KAPI.feliz}
            alt={`Kapi ${comiendo ? 'comiendo' : estado}`}
            className={[s.kapi, comiendo && s.comiendo].filter(Boolean).join(' ')}
            draggable={false}
          />
        </div>

        <div className={s.chips}>
          {alimentado
            ? <Etiqueta tono="exito">{t.hecho}</Etiqueta>
            : <Etiqueta tono="aviso" punto>{t.disponible}</Etiqueta>}
          <GananciaMonedas>{t.monedas}</GananciaMonedas>
        </div>

        <div id="kapi-stats">
          <BarraProgreso valor={felicidad} max={100} minimo={0} etiqueta={t.felicidad} />
        </div>

        {reto && <RetoSemanal {...reto} />}
      </div>
    </HojaInferior>
  );
}
