# Las Bolitas de Kapi: lo pendiente

Estado al 2026-10-22. Lo hecho está en
[`src/componentes/kit/guia/JUEGOS.md`](../../src/componentes/kit/guia/JUEGOS.md)
(secciones "Las bolitas: niveles…", "Fase 1", "Fase 2" y "Fase 3"). El código
está en `master` (`d969d6a5`).

## 1. Publicar (en este orden)

- [ ] **Reglas de Firestore** — PR
  [#3](https://github.com/conamormarket-lgtm/wala-master/pull/3). Pone las
  colecciones de las bolitas en `esSoloWala` (`bolitasConfig`,
  `bolitasJugadores`, `bolitasPatrocinios`, `bolitasPremios`,
  `bolitasProgreso`, `bolitasRetos`, `bolitasSemanas`, `bolitasStats`,
  `loyaltyConfig`). Antes de publicar: copiar el archivo al repo del ERP
  (tiene que quedar idéntico en los dos) y el ok del dueño. Sin esto,
  cualquiera con sesión puede escribir esas colecciones.
- [ ] **Después de las reglas**, las dos funciones que faltan:
  ```
  npx firebase deploy --only "functions:registrarPartidaBolitasSecure,functions:premiarRankingBolitas" --project sistema-gestion-3b225
  ```
  - `registrarPartidaBolitasSecure`: la versión de la fase 3 (cupón del reto
    patrocinado y métricas de partidas y jugadores). En producción está la de
    la fase 2.
  - `premiarRankingBolitas`: los premios del ranking semanal, cada lunes.
  - No subirlas antes de las reglas: alguien podría escribirse un patrocinio
    o los premios y el servidor le emitiría cupones (hasta 50 % o S/ 100,
    1000 por día).
- [ ] **Confirmar que Vercel publicó la web** de `master` (`d969d6a5`).
- [ ] **App de Android, versión nueva**: trae el permiso `VIBRATE` (vibración
  del juego y del estudio), las partidas comprobadas, el aviso local del reto
  y el toque en los avisos locales que abre su página.
- [ ] **Cerrar el cobro sin prueba** cuando la mayoría tenga la app nueva:
  `loyaltyConfig/global.bolitasExigirPrueba = true` en la consola. Mientras,
  las apps viejas cobran el +2 con `claimBallSortRewardSecure`, anotado como
  `ball_sort_daily_sin_prueba` en el libro mayor (se puede medir cuántos
  quedan).

Ya publicado: `registrarPartidaBolitasSecure` (versión de la fase 2),
`getRankingBolitasSecure`, `claimBallSortRewardSecure`, `validarCuponSecure`,
`canjearCuponSecure`, `adminBolitasSecure` y `contarClicBolitasSecure`.

## 2. Decisiones y configuración (del dueño)

- [ ] **Misiones**: `bolitas_nivel` ("Pasa un nivel") y `bolitas_reto` ("Haz
  el reto del día") existen pero están apagadas: pagan monedas de verdad.
  Activarlas en `/admin/misiones` si se quiere.
- [ ] **En `/admin/bolitas`**: el orden de las marcas de los mundos, los
  patrocinios del reto (marca, cupón, cupo por fecha) y los premios del
  ranking semanal.
- [ ] **Patrocinios**: ¿las marcas pagan por patrocinar o es un beneficio para
  ellas? ¿Cuánto presupuesto de cupones por semana?
- [ ] **Monedas**: hoy +2 una vez al día. Si se quieren dar más (por ejemplo,
  por estrellas), hace falta un tope diario en el servidor.

## 3. Sin probar

- [ ] Escuchar los sonidos de verdad (se comprobó que se disparan).
- [ ] La vibración y el aviso local del reto en un Android real (hace falta
  la app nueva).
- [ ] Un pedido completo pagado con un cupón de marca (solo se probó validar;
  `canjearCuponSecure` usa el mismo cálculo).
- [ ] La tarea del lunes (`premiarRankingBolitas`) ejecutándose sola.
- [ ] Guardar desde los formularios de `/admin/bolitas` (el servidor sí se
  probó; la página avisa con `alert`).
- [ ] La hoja "Sin movimientos" en pantalla (la regla está en las pruebas).
- [ ] La versión en inglés (el traductor no responde en local).
- [ ] La web publicada antes que una función (la vuelta al cobro de antes).

## 4. Limitaciones conocidas

- **Sin sesión no se ven** los mundos de marca ni el reto patrocinado: las
  reglas vivas no dejan leer esas colecciones sin cuenta. Se arregla con las
  reglas del PR #3.
- **El ranking se puede falsear** escribiendo a mano en `bolitasRetos` y
  `bolitasSemanas` hasta que se publiquen las reglas (hoy no da premios: los
  premios llegan con `premiarRankingBolitas`, que espera a las reglas).
- **Las métricas solo cuentan a quien juega con sesión** (las partidas que
  comprueba el servidor). Los toques hacia la tienda cuentan a todos.
- **El ranking lee hasta 1.000 filas** y ordena en el servidor. Si crece
  mucho, conviene un índice de Firestore.
- **Los ganadores del ranking semanal no reciben aviso**: el cupón aparece
  en Mis cupones sin notificación.
- **iPhone**: sin vibración (`navigator.vibrate` no existe ahí).
- **Armar un nivel** tarda 0,5 ms la mitad de las veces y hasta 160 ms en un
  PC; en un celular lento puede notarse en el peor caso (el siguiente nivel se
  prepara mientras se ve el resultado).

## 5. Ideas que quedaron fuera

- **Kapi en el tablero** (fase 1 del mapa): que reaccione al ganar o al
  trabarse.
- **Aviso por push** (servidor) para la racha o el reto, además del aviso
  local de la app.
- **Una moneda por estrellas** u otros premios en monedas (ver la decisión
  del punto 2).

## 6. Limpieza

- **Datos de prueba en los emuladores locales** (`demo-wala`): usuarios Ana,
  Beto, Caro, Jefa y Prueba Navegador (este último con permiso de admin),
  marcas "Kapi Moda" y "Marca Prueba", productos y patrocinios de prueba. Se
  van al borrar los datos del emulador.
- **La página vieja** (`pages/Minijuegos/BallSortViejo.jsx`) sigue detrás del
  interruptor `juegosViejo`. Borrarla cuando la nueva lleve un tiempo en
  producción.
