import React, { useState } from 'react';
import CuentaRegresiva from '../../componentes/kit/CuentaRegresiva';
import { LUMI_BLACK_FRIDAY } from '../../utils/lumiBlackFriday.mjs';
import s from './BlackFridayLumi.module.css';

export default function BlackFridayLumi() {
  const [comenzo, setComenzo] = useState(() => Date.now() >= Date.parse(LUMI_BLACK_FRIDAY.startsAt));
  return <div className={s.tarjeta} aria-label="Black Friday de Lumi">
    <p>{comenzo ? '¡Llegó el' : 'Cuenta regresiva para el'}<strong>Black Friday</strong></p>
    {!comenzo && <>
      <div className={s.reloj}>
        <CuentaRegresiva hasta={LUMI_BLACK_FRIDAY.startsAt} variante="texto" etiqueta="Black Friday comienza en" onTerminar={() => setComenzo(true)} />
      </div>
      <span className={s.unidades}>HORAS · MIN · SEG</span>
    </>}
    {comenzo && <span className={s.inicio}>en Lumi</span>}
  </div>;
}
