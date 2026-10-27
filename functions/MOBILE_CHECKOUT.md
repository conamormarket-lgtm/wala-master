# Checkout de clientes mobile-v1

La app `wala-mobile` reutiliza `prepareCheckoutPayment`, `processCulqiPayment`, el materializador ERP/webhook y `misPedidosSecure`. No agrega permisos administrativos. Los nuevos endpoints `getMobileCheckoutStatusSecure` y `cancelMobileCheckoutSecure` solo operan sobre la intención derivada del UID autenticado y un requestId aleatorio; no aceptan un UID objetivo arbitrario.

Estado al 27/10/2026: PR #4 combinado (`eb1d8082`), formulario publicado en Firebase Hosting y cuatro funciones de checkout desplegadas/ACTIVE en `sistema-gestion-3b225`. El usuario autorizó explícitamente habilitar Culqi de producción con el comercio existente; `MOBILE_CHECKOUT_ENABLED=true`, clave pública live y secreto previo conservado en Secret Manager. Se comprobaron assets HTTP200/no-store y protección de consultas HTTP401 sin sesión. No se realizaron transacciones reales ni se crearon pedidos/usuarios de prueba en producción. La validación manual nativa de tarjeta y banco/3DS sigue pendiente; no se ejecutó sandbox del comercio.

## Contrato y compatibilidad

`mobileCheckout.js` reconstruye productos/opciones/dirección desde el catálogo público y valida total y stock; el snapshot independiente `mobile-domain` contiene únicamente reglas puras exportadas desde la app. Envío S/15 hasta S/200 inclusive y gratis por encima, igual que la web actual. El checkout antiguo conserva el umbral S/100. No se permiten cupones/monedas/personalización ni importes o banderas de pago introducidos en el request móvil.

ID determinista por UID/requestId, hash canónico de entrada, `culqiCharges`, bloqueo de intención y creador ERP existente controlan reintentos. Se revalida antes de un cobro nuevo, pero un recibo confirmado sigue siendo recuperable si cambió inventario. HTTP201 sin un objeto charge no crea pedido: mobile conserva token/dispositivo y solicita 3DS; legacy se rechaza de forma segura. Respuestas ambiguas dejan el bloqueo para reconciliación. Estado pagado exige `pedidoCreado:true`; no basta recibir un token ni una respuesta cliente.

El HTML/CSS/JS de `public/mobile-culqi.*` es un tokenizer aislado: no tiene Auth, secretos ni acceso al ERP. Solo pasa tokens/fingerprint/3DS a la app. Hosting aplica no-store/no-referrer/nosniff y frame-ancestors limitado a primera parte. El build web debe copiar esos archivos a `build/`; comprobarlos antes de publicar. Nunca desplegar la fixture local del repositorio móvil.

## Configuración y activación

Variables del entorno Functions (no son variables EXPO_PUBLIC):

```dotenv
MOBILE_CHECKOUT_ENABLED=false
CULQI_PUBLIC_KEY=pk_test_CLAVE_PUBLICA_DEL_COMERCIO
```

`CULQI_SECRET_KEY` sigue en Secret Manager, asociado a `processCulqiPayment` como ya estaba; nunca moverlo a HTML ni a la app. La clave pública y el secreto deben ser del mismo comercio y modo test/live. El servidor rechaza tokens de otro modo. La configuración local existente del comercio es live: no usar tarjetas reales para QA automático.

Secuencia de referencia para futuras publicaciones:

1. Revisar/combinar el cambio, conservar el flag en false y configurar la clave pública del entorno correcto. Construir la web con su comando habitual y comprobar que `build/mobile-culqi.html`, `.css` y `.js` existen.
2. Desplegar solo `prepareCheckoutPayment`, `processCulqiPayment`, `getMobileCheckoutStatusSecure`, `cancelMobileCheckoutSecure` y el hosting preparado. No cambiar reglas, usuarios, productos o secretos durante esta operación. Con flag false la app no prepara ni inicia nuevos cobros; consultar/reconciliar recibos sigue permitido.
3. Validar con credenciales sandbox en un proyecto de prueba: tokenización real, aprobación/rechazo, 3DS bancario, cancelación, segundo plano y pérdida de conexión; verificar un solo pedido y su stock mediante los mecanismos existentes. La suite local simula al proveedor y no certifica el desafío bancario real.
4. Solo tras esa validación y autorización del comercio configurar el par live correcto y activar el flag. Cambios de variables requieren desplegar las funciones afectadas. Verificar capacidades y hacer la comprobación manual del comercio. No ejecutar pagos reales desde automatización.

El interruptor impide preparación y cobros nuevos mobile; no borra intenciones ni recibos. Un cobro ya enviado a Culqi se reconcilia mediante el flujo existente, no mediante volver a pagar. Si queda `cobrando`/ERP pendiente, revisar webhook/anomalías existentes antes de liberar algo manualmente.

## Validación reproducible

```powershell
node --test functions/test/mobileCheckout.test.js functions/test/mobileCulqiFlow.test.js functions/test/checkoutTotals.test.js functions/test/cartValidation.test.js
node --check functions/index.js
node --check public/mobile-culqi.js
```

Las pruebas de flujo extraen los handlers reales de `index.js` con AST y ejecutan sus dependencias simuladas; no llaman a Culqi ni a Firebase real. Cubren compatibilidad de envío legacy, flag, totales, aislamiento, stock/opciones, aprobación, rechazo, 3DS, duplicados y respuestas ambiguas. La app prueba además con Emulator Suite demo-wala y formulario ficticio. El despliegue autorizado se verificó aparte sin realizar cargos reales.

Para suspender nuevas compras móviles: poner `MOBILE_CHECKOUT_ENABLED=false` en el entorno Functions y redesplegar esas cuatro funciones. No cambiar el secreto ni borrar intenciones/recibos. Los cobros en curso se consultan y reconcilian por el mecanismo existente; apagar el flag no cancela un cargo ya enviado. El checkout web legacy conserva su contrato.

Para regenerar reglas, desde `wala-mobile`: `node scripts/export-payment-domain.mjs ../wala-master/functions/mobile-domain`. Revisar el manifiesto/hashes y volver a ejecutar ambas suites. No existe dependencia en runtime hacia la carpeta móvil.
