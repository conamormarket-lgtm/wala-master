# Plantilla de Documentación de Funcionalidad

Toda nueva funcionalidad desarrollada en el sistema debe documentarse siguiendo esta estructura para mantener un estándar claro y facilitar el mantenimiento futuro por parte de cualquier desarrollador.

### 1. Razón
¿Por qué se creó esta funcionalidad? (Justificación de negocio o técnica, qué problema resuelve).

### 2. Acción
¿Qué hace exactamente la funcionalidad? (Resumen de las acciones principales que el usuario o el sistema puede realizar).

### 3. Cómo
Explicación técnica de cómo funciona bajo el capó. (Flujo de datos, servicios involucrados, componentes principales).

### 4. Conexión a Base de Datos y Esquema
¿Se conecta a Firebase u otra base de datos? Especificar colecciones, documentos y la estructura del objeto JSON (esquema) que se guarda o lee.

### 5. Archivo de Esquema / Servicio
Ruta relativa al archivo donde se definen los modelos de datos, servicios o validaciones correspondientes (ej. `src/services/fechasImportantes.js`).

### 6. Ubicación de la Funcionalidad
Ruta relativa de los componentes, páginas o archivos principales donde vive esta funcionalidad en el código fuente.
