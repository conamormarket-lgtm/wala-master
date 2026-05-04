# Activar registro e inicio de sesión con correo (Firebase)

Si al crear cuenta o iniciar sesión con correo aparece el error **"auth/operation-not-allowed"**, hay que activar el proveedor **Correo/Contraseña** en Firebase.

## Pasos

1. Entra en [Firebase Console](https://console.firebase.google.com/) y abre tu proyecto.
2. En el menú izquierdo: **Authentication** (Autenticación).
3. Pestaña **Sign-in method** (Método de inicio de sesión).
4. En la lista de proveedores, haz clic en **Correo/Contraseña** (o "Email/Password").
5. Activa la opción **Habilitar** (Enable) y guarda.

A partir de ese momento, el registro y el inicio de sesión con correo y contraseña funcionarán igual que con Google.
