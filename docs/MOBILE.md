# Mobile — Android e iOS

## Estado

- Android: proyecto Capacitor versionado; APK aún no validada integralmente en dispositivo.
- iOS: esqueleto Xcode; requiere Mac, cuenta Apple, firma y pruebas.
- Tareas abiertas y hallazgos de dependencias: `PENDIENTES.md`.

## Requisitos Android

- Node 22+.
- Android Studio, SDK 36, min SDK 26.
- JDK 21.
- Dispositivo o emulador.

## Flujo de desarrollo

```bash
npm ci
npm run check:versions
npm run cap:sync
npx cap open android
# o
npx cap run android
```

Antes de sincronizar, resolver/aceptar explícitamente los hallazgos de `npm audit`; ver `PENDIENTES.md`.

## Seguridad Android

- Solo `VITE_SUPABASE_ANON_KEY`; nunca `service_role`.
- `android:allowBackup="false"`.
- Sin cleartext ni mixed content.
- WebView debugging desactivado en release.
- Notificaciones con visibilidad `PRIVATE`; no mostrar descripción sensible.
- Keystore y `keystore.properties` fuera del repo.
- Redirects de correo siempre al dominio público; nunca `https://localhost`.

## Checklist manual obligatorio

Registrar dispositivo/emulador, versión Android, build y resultado:

- Login cloud y restauración de sesión.
- Drawer/sidebar y layout móvil.
- Organizador: filtros, editar y eliminar.
- Crear evento simple, periódico con fin, recordatorio y tarea.
- Logout y cambio de usuario sin heredar sesión/datos.
- Invite admin; link recibido apunta a `calendario.bmatrix.org`.
- Avisos en foreground, background, app cerrada y tras reinicio.
- Lock screen no muestra descripción.
- Calendarios ocultos/predeterminado por dispositivo.
- Sin errores al perder y recuperar conectividad.

## Verificación del artefacto

```bash
npm run android:apk
```

- Confirmar `versionCode` y `versionName`.
- `versionCode` usa `major*10000 + minor*100 + patch` (v1.2.4 → 10204); `npm run check:versions` lo valida.
- Verificar firma esperada.
- Revisar `strings` sin secretos/tokens administrativos.
- Instalar como actualización sobre la versión anterior.
- Conservar hash del APK y respaldo del keystore en ubicación segura.

## Distribución

Hoy no existe actualización automática para APK sideload. Publicar código o web no actualiza una APK instalada. Definir un canal controlado o Play Store antes de considerar Android “publicado”.

## iOS

No publicar sin:

- Mac/Xcode y cuenta Apple.
- Bundle ID y firma validados.
- Revisión de permisos/notificaciones.
- Mismos controles de auth, redirects, secretos y sesiones que Android.
