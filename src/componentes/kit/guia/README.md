# Guía: qué componente va en cada parte de cada página

Una ficha por página real de wala.pe. Cada ficha tiene:

- capturas con cada parte numerada (las mismas etiquetas que muestra
  **Ver componentes** en `/componentes.html` → Páginas → Tienda de prueba);
- una tabla por parte: componente del kit, piezas que usa, archivo donde se
  cambia su diseño, de dónde salen los datos en la tienda y quién la ve;
- qué piezas se repiten en varias partes (cambiar una cambia todas);
- "Llevar a la tienda (a futuro)": qué componente viejo reemplaza cada uno,
  de dónde salen los datos, qué comportamiento no se puede perder, las
  diferencias a propósito y los pasos. La migración todavía NO se hace: es
  la hoja de ruta para cuando se decida.

Lo común a todas las páginas (qué usa ya la tienda, cómo se importa y el
orden de los pasos) está en [MIGRACION.md](MIGRACION.md): es el único plan;
las fichas lo siguen.

Numeración: **M** = marco (cabecera, pie, barra inferior, flotantes: igual en
todas las páginas), **S** = secciones del builder en su orden, **P** =
contenido propio de una página que no es del builder (carrito, minijuegos,
búsqueda), **C** = las secciones de la cuenta (C0 su marco, C1-C12 cada
página).

| Página | Ficha | Estado |
|---|---|---|
| Inicio (`/`) | [INICIO.md](INICIO.md) | armada en la Tienda de prueba; con plan de migración (a futuro) |
| Tienda (`/tienda`) | [TIENDA.md](TIENDA.md) | armada en la Tienda de prueba (catálogo con filtros reales); con plan de migración (a futuro) |
| Kapi (M8, en todas las páginas) | [KAPI.md](KAPI.md) | botón y ventana (`KapiFlotante`, `VentanaKapi`, `RetoSemanal`); con plan de migración (a futuro) |
| Buscar (`/buscar` y el buscador de la cabecera) | [BUSCAR.md](BUSCAR.md) | armada (P4 `PaginaBusqueda`, panel de sugerencias en la `Cabecera`); con plan de migración (a futuro) |
| Minijuegos (`/minijuegos`) | [MINIJUEGOS.md](MINIJUEGOS.md) | armada (P3 `PaginaMinijuegos`, con los estados de cada juego); con plan de migración (a futuro) |
| Mi cuenta (`/cuenta`: resumen, perfil, pedidos, direcciones, ajustes, catálogo, cupones, misiones, referidos, creaciones, lista de deseos, fechas importantes) | [CUENTA.md](CUENTA.md) | armada (C0 `MarcoCuenta` y C1-C12); con plan de migración (a futuro). Mis pedidos (antes P2) es C3 |
| Carrito (`/carrito`) | — | armada (P1 `PaginaCarrito`); falta su ficha |

Para una página nueva: se mapea la página real, lo que falte se crea como
pieza en `piezas/`, después la sección, y la página se arma en la Tienda de
prueba con el mismo marco. Al final se agrega su ficha aquí.
