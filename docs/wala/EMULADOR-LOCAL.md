# Correr TODO en local con el Emulador de Firebase

Con el **Emulador de Firebase** corremos Firestore + Auth + Functions + Storage **en tu PC**,
sin tocar producción. Así se ve y funciona **todo** localmente: catálogo, login, economía
(Kapi/ruleta/monedas), guardado de nichos/vendedores, misiones, etc. Es un proyecto demo
aislado (`demo-wala`); **no usa tus claves reales ni tu Firebase real**.

> Decisión de diseño: en `npm run dev` la app se conecta a los emuladores por defecto
> (proyecto `demo-wala`). Para apuntar al Firebase real del `.env`, define
> `VITE_USE_EMULATORS=false` en tu `.env`. En `npm run build` (producción) SIEMPRE usa el
> Firebase real, nunca el emulador.

---

## Requisitos (ya instalados en esta máquina)
- **Node + npm** (ya).
- **firebase-tools** 15.x (ya, global).
- **JDK 21** portable en `%LOCALAPPDATA%\jdk21` (ya). El script `npm run emulators` lo
  detecta solo; no necesitas configurar `JAVA_HOME`. (firebase-tools 15 exige Java 21+.)

---

## Arrancar (3 terminales)

```powershell
# Terminal 1 — Emuladores (Firestore, Auth, Functions, Storage, UI)
npm run emulators
# Espera a "All emulators ready". UI en http://127.0.0.1:4000

# Terminal 2 — Sembrar datos de ejemplo (con los emuladores ya corriendo)
npm run seed

# Terminal 3 — App web (Vite) conectada a los emuladores
npm run dev
# App en http://localhost:3000
```

| Servicio | URL |
|---|---|
| App (Vite) | http://localhost:3000 |
| Emulator UI (inspeccionar datos/usuarios) | http://127.0.0.1:4000 |
| Firestore | localhost:8080 · Auth localhost:9099 · Functions localhost:5001 · Storage localhost:9199 |

---

## Usuarios de prueba (creados por el seed)
| Rol | Email | Password |
|---|---|---|
| Admin (claim `admin:true`) | `admin@wala.test` | `wala1234` |
| Cliente | `cliente@wala.test` | `wala1234` |

El cliente trae `dni 12345678`, 50 monedas, 3 kapiCoins y un **pedido finalizado** (`order-1`)
para probar el reclamo de monedas.

## Datos sembrados
4 productos (con `vendorId`/`nicheId`/`fulfillmentType`), 2 nichos (`regala-con-amor`,
`ropa-personalizada`), 2 vendedores (`casa`, `estampados-lima`), 2 categorías, premios de
ruleta, un reto semanal activo, y el pedido finalizado.

## Qué probar en local
- Catálogo y **/buscar** (facetas), **/nichos**, **/nicho/:slug**, **/tienda-vendedor/casa**.
- **Login** con los usuarios de prueba (Auth emulator).
- **Admin**: `/admin/nichos`, `/admin/vendedores` (crear/editar **sí persiste** en el emulador,
  porque las reglas corren localmente), y asignar nicho/vendedor en `/admin/productos/nuevo`.
- **Economía/gamificación**: alimentar a Kapi, ruleta, ball sort, reclamar monedas del pedido
  → llaman a las Cloud Functions del emulador (todo local).

---

## Operación
- **Reset de datos:** detén el emulador (Ctrl+C) y vuelve a `npm run emulators` + `npm run seed`
  (por defecto NO persiste entre reinicios). Para inspeccionar/editar a mano: Emulator UI (4000).
- **Apuntar al Firebase real** (no recomendado en dev): `VITE_USE_EMULATORS=false` en `.env`.
- **Notas:** los crons (`resetKapiCoins`, `notifyWishlistBirthdays`, `rotateWeeklyChallenge`)
  se ignoran en el emulador (no hay Pub/Sub); el resto de funciones sí corren. El envío real
  de push/correo no ocurre en local (no hay FCM/SMTP emulado).

---

## Cuando tengas acceso a Firebase (despliegue)
El emulador valida que el código funciona; para producción se despliega lo mismo siguiendo
[DESPLIEGUE.md](./DESPLIEGUE.md) y el orden de [fases/FASE-0-seguridad.md](./fases/FASE-0-seguridad.md)
(secrets → functions → reglas → web). Hasta entonces, todo el desarrollo y la verificación
se hacen aquí, en local.
