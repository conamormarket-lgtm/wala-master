# Clave privada de Culqi en Firebase

`processCulqiPayment` requiere el secreto `CULQI_SECRET_KEY` del proyecto
`sistema-gestion-3b225`. Leer `process.env.CULQI_SECRET_KEY` no basta: la función
debe declarar `runWith({ secrets: ['CULQI_SECRET_KEY'] })` y desplegarse después
de que exista una versión habilitada del secreto.

## Configuración

1. Obtener la clave privada de Culqi del mismo comercio y entorno que la clave
   pública utilizada por la web. No usar una clave de pruebas con una pública
   de producción, ni viceversa.
2. Registrar el valor en Google Cloud Secret Manager con el nombre exacto
   `CULQI_SECRET_KEY`, dentro de `sistema-gestion-3b225`. Alternativamente,
   ejecutar en una terminal privada:

   ```powershell
   npx --yes firebase-tools functions:secrets:set CULQI_SECRET_KEY --project sistema-gestion-3b225
   ```

   Introducir la clave solo en el prompt protegido, nunca como argumento del
   comando, en el chat, en Git ni en una variable `REACT_APP_`/`VITE_` del frontend.
3. Desplegar únicamente la función afectada:

   ```powershell
   npx --yes firebase-tools deploy --only functions:processCulqiPayment --project sistema-gestion-3b225
   ```

4. Verificar que la función activa tenga la vinculación al secreto. Una prueba
   de pago requiere autorización del comprador; desplegar no equivale a cobrar.

## Diagnóstico del 23 de septiembre de 2026

Los registros de las 22:37:52 y 22:38:35 UTC mostraron
`processCulqiPayment: CULQI_SECRET_KEY no configurada.`. La función activa no
tenía la variable ni una vinculación a ese secreto. Secret Manager devolvió
404 al consultar `CULQI_SECRET_KEY`.

Ese error se lanza antes de crear el registro `culqiCharges` y de llamar al
endpoint de cargos de Culqi. Esos intentos abortados no solicitaron un cargo
desde esta función. No describe el estado de otros intentos de pago.

Tras crear el secreto se desplegó únicamente `processCulqiPayment`. Se verificó
que quedó `ACTIVE`, vinculada a la versión `1` de `CULQI_SECRET_KEY`, y que
conservó sus variables previas. Una petición vacía sin autenticación devolvió
`401 UNAUTHENTICATED`, como corresponde. La verificación técnica no ejecutó
ningún cargo. Posteriormente, el usuario realizó una compra y compartió una
captura de Meta con `Purchase` procesado, `value: 42`, `currency: PEN` y
`content_ids: ['factos-polo-adicto-rosaditas']`.
