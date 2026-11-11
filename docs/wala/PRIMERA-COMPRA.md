# Primera compra gratis (semana de bienvenida)

Promo pedida el 2026-11-04/05 (dos PDFs) y ajustada el 2026-11-11. El plan
ajustado para dirección está en un artifact privado del usuario. Construida el
2026-11-11; **queda apagada** hasta prenderla en `/admin/primera-compra`.

## Las reglas

- Toda cuenta creada desde que se prende la promo tiene **168 h** (su "semana
  de bienvenida"). Las de antes, las anónimas, las `erp_auto` y quien ya
  compró (por uid, DNI o teléfono en `pedidos`, `pedidos_web`, `wala_pedidos`)
  no participan.
- Por cada amigo nuevo (invitación aceptada con DNI y teléfono,
  `aceptarInvitacionSecure`) que paga **S/ 50** en productos con dinero y deja
  **S/ 15** de margen (margen por marca, o costo real si lo hay; menos 4 % de
  comisión y S/ 5 de provisión de monedas), quien invitó gana **S/ 10**.
- El saldo paga **solo productos**, hasta el % de cada marca (100 % por
  defecto; Lumi y Daida 10 %). El envío va aparte. Si dejaría el pedido en
  S/ 0, deja **S/ 1**.
- Durante la semana, monedas y cupones se ganan pero están **en pausa**
  (checkout, `spendCoinsSecure`, `freezeCoinsSecure`, `redeemRewardSecure`,
  `validarCuponSecure`). El reinicio de fin de mes no las borra en la semana
  ni 7 días después.
- Las compras de los invitados durante la semana no dan monedas
  (`referrals.premioModo = 'primera_compra'`); un pedido pagado con saldo no
  premia a nadie (`'sin_premio'`). `claimReferralSecure` respeta las dos.
- La primera compra (tarjeta o WhatsApp) cierra la semana: se usa lo reservado
  y el resto vence para siempre.

Todos los montos se cambian en el admin (Ajustes). Al apagar la promo, cada
instancia del servidor tarda hasta 1 minuto en enterarse (caché).

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Cuentas puras (fase, saldo, tope, premio) | `functions/primeraCompraLogic.js` (+ `test/primeraCompraLogic.test.js`) |
| Servidor: fase, checkout, premios, revisión horaria, callables | `functions/primeraCompra.js`, enganchado en `functions/index.js` |
| Prueba de punta a punta (emuladores con functions) | `functions/test/primeraCompra.emulator.test.js` |
| Config (solo servidor) | `loyaltyConfig/primeraCompra` |
| Fase de cada cuenta (solo servidor) | `portal_clientes_users/{uid}/primeraCompra/estado` |
| Premios (uno por amigo, solo servidor) | `portal_clientes_users/{uid}/primeraCompraPremios/{uid del amigo}` |
| Costos de Lumi y ajustes iniciales | `scripts/primera-compra-config.js` + `scripts/data/lumi-costos.json` |
| Piezas del kit | `src/componentes/kit/piezas/Bienvenida.jsx` (franja, fila del checkout, pausa, aviso al invitado, tarjeta de Mi cuenta) |
| Checkout | `paginas/Checkout.jsx` (prop `bienvenida`), `components/checkout/CheckoutDeTienda.jsx`, `services/pedidoCheckout.js` (`saldoBienvenida`) |
| Checkout de la app | `functions/mobileCheckout.js` (`welcomeBalance`), capacidad en `getMobileCheckoutStatusSecure` |
| Aviso grande (popup: al entrar y cada 4 h, 5 s sin cerrar) y la píldora flotante que lo abre | `components/marco/BienvenidaDeTienda.jsx`, `components/marco/FlotantesDeLaTienda.jsx` (la franja de arriba se quitó el 2026-11-11) |
| Mi cuenta → Referidos | `components/cuenta/ReferidosDeCuenta.jsx` |
| Condiciones | `/bienvenida` (`config/legales/bienvenida.js`) y sección "Promociones" de los términos |
| Admin | `/admin/primera-compra` (`paginas/admin/Bienvenida.jsx`, `components/panel/PrimeraCompraDelPanel.jsx`) |
| ERP | línea "Saldo de bienvenida" en el pedido web y aviso al anular (`cambiar-etapa-modal.tsx`) |

Las subcolecciones de `portal_clientes_users` y `loyaltyConfig` ya son solo
del servidor con las reglas actuales (`esSoloWala`): no hizo falta desplegar
reglas.

## Revisión cada hora (`primeraCompraReconciliar`)

- Premio pendiente (pedido por WhatsApp): cuando el pedido está aprobado en
  `pedidos` y pagó al menos el mínimo, pasa a disponible y se avisa.
- Pedido anulado: el premio se revierte (si ya se usó, el costo queda).
- Fase cerrada: los pendientes vencen.
- "Te quedan 24 horas": una vez por cuenta con saldo.

## App wala-mobile

Hecha el 2026-11-11 (`features/welcome` de wala-mobile; `docs/CHECKOUT.md`,
"Saldo de bienvenida"): franja de arriba, tarjeta en Mis referidos y, en el
checkout, la pausa, la fila del saldo y el aviso al invitado. El saldo viaja
como `welcomeBalance` en el contrato `mobile-v1` (`functions/mobileCheckout.js`
→ `saldoBienvenida`, revisado por `revisarCheckout` como el de la web; sin el
campo la huella del intento es la de siempre) y la app solo lo ofrece si
`getMobileCheckoutStatusSecure` responde `welcomeBalance: true`. La app deja
S/ 3 por pagar (mínimo de Culqi en la app) en vez de S/ 1.

## Falta

- Probar la app en un teléfono con la promo prendida.
- Publicar una versión nueva de la app Capacitor antes de prender la promo.
- Medir: costo por comprador nuevo (saldo usado ÷ amigos que compraron, en el
  admin) contra lo que cuesta una compra con publicidad; revisiones a los 30,
  60 y 90 días.

## Orden de las ventanas

Al crear una cuenta, el aviso de bienvenida va primero; Walito (con su
recorrido) y el popup de campaña esperan su turno (`src/utils/turnoVentanas.js`),
con 15 s entre una y otra.
