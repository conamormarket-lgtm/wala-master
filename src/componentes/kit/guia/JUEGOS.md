# Los juegos por dentro: Palabra del día, Ruleta y Las Bolitas de Kapi

Cómo verlo en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba** → **Un juego**. También se llega desde los
botones de las tarjetas de **Minijuegos**. "Cómo se abre" tiene tres
opciones:

- **Palabra del día** (`/palabra-del-dia`). Estados: ya jugó hoy (ganó), ya
  jugó hoy (perdió), primera vez (la ayuda se abre sola) y cargando. Se juega
  de verdad, con el teclado en pantalla o el de la computadora.
- **Ruleta Semanal** (`/ruleta`). Estados: lista para girar (por defecto),
  racha 4/7, ya giró esta semana, semana perdida, giro pendiente, cerrada y
  cargando. "Girar la ruleta" sortea un premio y la rueda para en su gajo.
- **Las Bolitas de Kapi** (`/ball-sort`). Estados: casi resuelto (gana en 2
  jugadas), ya ganó hoy, primera vez y cargando.

Sin sesión: la palabra se juega igual, pero el premio invita a entrar. La
ruleta pide entrar. Las bolitas se juegan y el premio también invita a
entrar.

| La Palabra del día (escritorio) | La palabra (celular, noche) |
|---|---|
| ![La palabra a medio jugar con el ranking](palabra-escritorio.webp) | ![La palabra en el celular](palabra-celular.webp) |

| La ruleta (celular, noche) | Su premio | Las bolitas (una levantada) |
|---|---|---|
| ![La rueda con la racha](ruleta-celular.webp) | ![¡Felicidades! con las monedas](ruleta-resultado.webp) | ![Los tubos con los destinos marcados](bolitas-celular.webp) |

Revisado el 2026-10-15 contra estos archivos:

| Juego | Archivo | Líneas |
|---|---|---|
| Palabra del día | `pages/Tienda/WordlePage.jsx` (+ `services/wordle.js`, `data/wordleDictionary.js`) | 803 |
| Ruleta | `pages/Minijuegos/RuletaPage.jsx`, `components/ruleta/RuedaRuleta.jsx`, `utils/ruletaModel.js` | — |
| Bolitas | `pages/Minijuegos/BallSortPage.jsx` | — |
| El marco de los tres | `pages/Minijuegos/ArcadeShell.jsx` | — |

**Qué es real y qué es de ejemplo.**

- **Reales:**
  - La palabra de hoy: la misma cuenta que `getDailyWord`, con la lista de
    `data/wordleDictionary`. Hoy no hay palabra puesta por el admin.
  - El diccionario de la palabra.
  - La rueda: `ruletaConfig/settings` y `ruletaPrizes`, en
    `demo/juegos.json`, con los premios que salen hoy (`premiosDeHoy`).
  - El sorteo usa la misma regla que el servidor (`sortearPremio`).
- **De ejemplo:**
  - el ranking (el real lleva nombres de clientes);
  - las estadísticas;
  - el historial de la ruleta;
  - los códigos de cupón.

  No se guarda nada y las monedas solo suben en la cabecera de la demo.

## Partes

| Parte | Componente | Piezas que usa | Datos (en la tienda) |
|---|---|---|---|
| P20 Lo común | `MarcoJuego`, `AyudaJuego`, `ResultadoJuego`, `PremioJuego`, `CifrasJuego` (nuevas, `piezas/Juegos.jsx`) | `Boton`, `HojaInferior`, `Sello`, `Trazo`, `GananciaMonedas`, `Cargando` | — |
| P20 Palabra del día | `PaginaPalabra` (`paginas/Juegos.jsx`) | `TableroPalabra`, `FichaPalabra`, `TecladoPalabra`, `LeyendaPalabra`, `RankingPalabra` y las reglas `evaluarIntento`, `estadosDeTeclas` y `normalizarPalabra` (nuevas, `piezas/Palabra.jsx`); `Pestanas`, `Avatar`, `CuentaRegresiva` | `getDailyWord`, `VALID_GUESSES`, `getEstadoPartidaDeHoy` + localStorage (`wala_wordle_{fecha}`), `getWordleRankingToday` / `getWordleRanking`, el perfil (`wordlePlayed`…), `saveWordleResult` + `claimWordleRewardSecure` |
| P20 Ruleta | `PaginaRuleta` | `RuedaRuleta` y `HistorialRuleta` (nuevas, `piezas/Ruleta.jsx`); `BarraProgreso` (la racha), `CodigoCopiable` (el cupón), `IconoWala` por tipo de premio | `getRuletaBoard` (config, premios, historial), `getRuletaEligibility`, `spinRuletaSecure` |
| P20 Bolitas | `PaginaBolitas` | `TuboBolitas` y `Bolita`, y las reglas `nivelBolitas`, `puedeSoltar`, `moverBolita`, `tuboListo` y `nivelResuelto` (nuevas, `piezas/Bolitas.jsx`); `Estallido`, `BarraProgreso` | `lastBallSortReward`, `claimBallSortRewardSecure` |

Esqueletos: `EsqueletoPagina forma="palabra"`, `"ruleta"` y `"bolitas"`
(nuevas, con la medida real en escritorio y en el celular).

`CodigoReclamacion` (del libro de reclamaciones) pasó a ser `CodigoCopiable`,
con `rotulo` y `detalle`. Lo usan la reclamación y el cupón de la ruleta.

### Lo que hace

- **En los tres juegos:**
  - Arriba, "Volver" (a la Zona Arcade), el título con su trazo y "Cómo
    jugar". En el celular, los dos botones quedan solo con su ícono.
  - "Cómo se juega" es una hoja con los pasos numerados en sellos. Se abre
    sola la primera vez (`ayudaVista`).
  - El resultado es otra hoja: Kapi (feliz o triste), el título con su trazo
    y el premio. Mientras se acreditan las monedas, la hoja no se cierra.
  - Kapi no asoma en el pie ni flota: aparece en el resultado.
- **Palabra del día:**
  - Se escribe con el teclado en pantalla (con Ñ y "Enviar") o con el de la
    computadora. Tocar una casilla permite corregirla.
  - Si faltan letras o la palabra no existe, la fila se sacude y sale un
    mensaje que se va solo ("Faltan letras", "Esa palabra no está en el
    diccionario"). No sale un `alert`.
  - Al enviar, cada letra se voltea y muestra su color: verde (en su sitio),
    ámbar (en otro sitio) o gris (no está). El teclado se pinta igual.
  - Al terminar, en lugar del teclado: "Lo lograste en N intentos" o "La
    palabra era X", "Nueva palabra en 9 h 22 min" y "Ver mi resultado".
  - El resultado muestra el premio ("+4 acreditadas. ¡Bonus por acertar
    rápido!"), las cuatro cifras, la cuenta atrás, "Compartir mi resultado" y
    "Ver otros juegos".
  - El ranking va al costado en escritorio y abajo en el celular. Tiene dos
    pestañas, Hoy y Global, y tu fila va marcada.
- **Ruleta:**
  - Arriba de la rueda, la racha con Kapi en 7 pasos y una línea según el
    estado (se completó la semana, es el giro de la semana pasada, se perdió
    un día, ya se usó el giro).
  - La rueda tiene los gajos con el color del admin y el texto con la letra
    de la marca, sin emojis.
  - El centro con la W no gira. El texto del gajo ganador queda derecho al
    parar.
  - El botón: "Girar la ruleta" (brilla cuando está lista), "Girando…", "Ya
    giraste esta semana", "Semana perdida" o "Bloqueada: te faltan 3 días".
    Debajo, "Vuelve el lunes, en 3 d 9 h".
  - El resultado puede tener:
    - las monedas acreditadas;
    - el cupón con "Copiar código" y "Válido hasta el 14 de noviembre";
    - "Nos pondremos en contacto contigo" (premio manual);
    - "Compartir mi premio".
  - Al costado, "Tus premios": cada giro con el ícono de Walá de su tipo y su
    cupón.
- **Bolitas:**
  - Se toca un tubo y su bolita de arriba sube. Los tubos donde sí se puede
    soltar se marcan con un borde verde punteado.
  - Las bolitas viajan de un tubo a otro. Un tubo listo celebra con confeti.
  - "Deshacer" (nuevo) vuelve un paso. "Otro nivel" reparte otra vez.
  - Al costado: "+2 al ordenar todos los tubos" (o "Ya ganaste tus monedas
    hoy"), Movimientos, Tubos listos y su barra en pasos.
  - Al ganar: "¡Nivel completado! Lo resolviste en N movimientos", el
    premio, "Jugar otra vez" y "Ver otros juegos".

## Llevar a la tienda (a futuro: TODAVÍA NO se hace)

### Reemplazos

| Hoy | Pasa a (kit) |
|---|---|
| `ArcadeShell` (barra con "Volver" y `acciones`) | `MarcoJuego` |
| Los modales de ayuda hechos a mano (`createPortal`, `.ayudaCard`) | `AyudaJuego` |
| Los modales de resultado (`.resultCard`, `.winCard`, el de la ruleta con framer) | `ResultadoJuego` + `PremioJuego` + `CifrasJuego` |
| `WordlePage` (tablero, teclado, ranking) | `PaginaPalabra` |
| `RuletaPage` + `components/ruleta/RuedaRuleta` | `PaginaRuleta` + `RuedaRuleta` (del kit) |
| `BallSortPage` (tubos con framer, `TubeConfetti`) | `PaginaBolitas` + `TuboBolitas` (`Estallido`) |

**Lo que no cambia:**

- Todo lo del servidor: `claimWordleRewardSecure`, `spinRuletaSecure`,
  `getRuletaBoard` y `claimBallSortRewardSecure`, con sus reglas y sus
  textos de error.
- `saveWordleResult` y las rachas.
- `volarMonedasGanadas` y `useEntregaMonedas`: la página espera a
  `coins-animation-end` antes de dar por cobrado.
- `trackMinigame` (start / complete).
- Las claves de localStorage.
- La vista previa del admin de la ruleta, que puede pasar a usar la
  `RuedaRuleta` del kit (es solo presentación).

### De dónde sale cada dato

- **Palabra:**
  - `objetivo`: `getDailyWord(limaTodayStr())`.
  - `esValida(p)`: `VALID_GUESSES.has(p)`.
  - `inicial.filas`: `wala_wordle_{fecha}.guesses`. Si
    `getEstadoPartidaDeHoy()` dice `'jugada'` y no hay tablero guardado,
    `inicial.terminada` = `{ gano, intentos, palabra }`.
  - `estadisticas`: `wordlePlayed`, `wordleWins`, `wordleCurrentStreak` y
    `wordleMaxStreak` del perfil.
  - `ranking.hoy` y `ranking.global`: las dos consultas, con `yo` en la fila
    del uid.
  - `hasta`: `Date.now() + msHastaMananaLima()`.
  - `onTerminar`: `saveWordleResult` y, si ganó, `claimWordleReward()`.
    Devuelve `{ monto: reward, rapido }`, `{ ya: true }` si `alreadyClaimed`,
    o `null`.
  - `ayudaVista`: `wala_wordle_ayuda_vista`.
- **Ruleta:**
  - De `getRuletaBoard()`:
    - `premios`: los premios, con `texto: textoPremio(p)`;
    - `tema` y `reglas`: `config` (`normalizarConfig`);
    - `historial`: `historial` → `{ id, tipo, texto, cupon: cuponCode, fecha: fechaCorta }`.
  - `eleccion`: `getRuletaEligibility()`, que devuelve `isUnlocked` →
    `desbloqueada`, `days` → `dias`, `hasSpun` → `girada`, `hasLost` →
    `perdida` y `esPendienteAnterior` → `pendienteAnterior`.
  - `estado`: `'cerrada'` si `!config.activa`; `'preparacion'` si no hay
    premios.
  - `hasta`: `msHastaLunesLima()`.
  - `onGirar`: `spinRuletaSecure` → `{ indice: premios.findIndex(id), premio, cupon: { codigo, vence: expiraEn } }`.
    Las monedas vuelan al terminar el giro.
- **Bolitas:**
  - `yaHoy`: `lastBallSortReward === limaTodayStr()`.
  - `onGanar`: `claimBallSortReward()` → `{ monto: reward }`, o `{ ya: true }`
    si el servidor dice "Ya reclamaste".

### Comportamiento que no se puede perder

- **Palabra:**
  - Un resultado por día. El servidor revisa la palabra y los intentos antes
    de pagar.
  - Si guardar falla, se dice: no entró al ranking ni se acreditaron
    monedas.
  - Escape cierra la ayuda o el resultado.
- **Ruleta:**
  - La rueda para en el gajo que dice el servidor: el orden de los premios
    tiene que ser el mismo (`premiosDeHoy`, por id).
  - Si el premio ganado no está en la rueda cargada, se vuelve a pedir el
    tablero.
  - Con "reducir movimiento", una vuelta en 600 ms.
- **Bolitas:**
  - Se puede seguir jugando después de cobrar, sin prometer premio.
  - Sin sesión hoy se manda al login. En el kit se juega, y el premio invita
    a entrar (ver abajo).

### Diferencias a propósito (no "corregirlas" al migrar)

- **Palabra:**
  - Faltan letras o la palabra no existe: la fila se sacude y sale un aviso
    que se va solo. Hoy no pasa nada, o sale un `alert` que bloquea.
  - Las letras se voltean al revelarse. Hoy aparecen de golpe.
  - La cuenta atrás de la palabra nueva y "Compartir" (sin cuadritos de
    emoji).
  - "Enviar" en vez de "ENTER".
  - El ranking dice "persona" y no "el primero".
- **Ruleta:**
  - La racha se ve en la página (hoy solo en la tarjeta de Minijuegos).
  - Íconos de Walá en vez de emojis (🪙, 🏷️, 🎁, 📦, 🍀) y sin emojis en los
    botones ("✅", "❌", "🔒").
  - El botón bloqueado dice cuántos días faltan.
  - El centro de la rueda no gira, y el premio ganador queda derecho.
- **Bolitas:**
  - "Deshacer".
  - "Otro nivel" en vez de "Reiniciar nivel".
  - Sin sesión se puede jugar (como la palabra), y el premio invita a entrar.
- Las tres pantallas viven dentro del marco de la tienda (cabecera y pie),
  como el resto del kit. Hoy `ArcadeShell` no muestra las monedas: las pone
  la cabecera.

### Lo que se encontró de paso (para decidir aparte)

- **La Ñ de la palabra nunca sirve:**
  - el diccionario (`VALID_GUESSES`) no tiene ninguna palabra con Ñ;
  - `removeAccents` convierte la Ñ de la palabra objetivo en N.

  `normalizarPalabra` del kit conserva la Ñ: si se agregan palabras con Ñ,
  funcionan.
- **Palabras más largas que 5:** el admin acepta palabras de 5 a 8 letras,
  pero el diccionario solo tiene de 5. Con una de 6, nadie puede ganar.
- **"AEDAS" para el 2026-10-09:** está fija en `PALABRAS_FIJAS`, pero el
  propio diccionario la pone como ejemplo de palabra mala.
- **Lo que guarda el cliente:** la partida y las estadísticas las escribe el
  cliente, y las reglas solo revisan el `userId`. El cobro sí se valida en el
  servidor, pero el ranking se puede falsear.
- **Bolitas sin solución:** el nivel se mezcla al azar sin comprobar que
  tenga solución. Con dos tubos vacíos casi siempre la tiene. "Otro nivel"
  es la salida.

### Pasos

1. `MarcoJuego` + `AyudaJuego` + `ResultadoJuego` en las bolitas (es la más
   chica), con el mismo `claimBallSortReward`.
2. La ruleta: primero cambiar `components/ruleta/RuedaRuleta` por la del
   kit (también en la vista previa del admin) y comprobar con
   `?premios=demo` que para en el gajo correcto. Después, `PaginaRuleta`.
3. La palabra: `PaginaPalabra`, manteniendo `saveWordleResult`, el
   localStorage y el ranking.
4. Decidir aparte la Ñ y el largo de las palabras del admin.
