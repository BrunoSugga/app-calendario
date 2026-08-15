# Pendientes operativos

Única fuente de tareas abiertas del proyecto. Última revisión: **2026-08-15**.

## P0 — seguridad / producción

- [ ] Redeploy de `invite-user` con la allowlist vigente:
  `npx supabase functions deploy invite-user --project-ref hznvsuobulrxxpofebkq`.
- [ ] Probar invite/recovery en incógnito después del deploy; confirmar redirect a `calendario.bmatrix.org`.
- [ ] Rotar cualquier token que haya sido pegado en chats o logs, si aplica.
- [ ] Configurar branch protection de `main`: PR obligatorio, CI/CodeQL requeridos y revisión CODEOWNERS para `.github/`, Supabase y superficies nativas.
- [ ] Configurar el environment GitHub `production` con aprobación requerida y secretos de Cloudflare acotados al entorno.

## P1 — APK Android

- [ ] Actualizar el entorno a Node 22+ antes de trabajar con Capacitor.
- [ ] Resolver o aceptar explícitamente `uuid` moderado vía `@capacitor/cli`/`xcode` antes del release APK; la versión estable actual de Capacitor todavía lo arrastra.
- [ ] Ejecutar `npm ci`, `npm audit --omit=dev`, `npm audit`, `npm run cap:sync`.
- [ ] Abrir Android Studio: `npx cap open android` o `npx cap run android`.
- [ ] Probar login cloud, drawer, Organizador, edición/eliminación, logout y cambio de usuario.
- [ ] Probar avisos en foreground, background, app cerrada y después de reiniciar.
- [ ] Probar invite desde APK; el mail nunca debe apuntar a `https://localhost`.
- [ ] Verificar lock screen sin descripción sensible y `android:allowBackup="false"`.
- [ ] Revisar el APK con `strings` para confirmar ausencia de `service_role`, tokens y secretos.
- [ ] Crear keystore fuera del repo, firmar y conservar respaldo seguro.

## P2 — automatización y cobertura

- [ ] Añadir tests ejecutables para `invite-user` (allowlist, email inválido, no-admin).
- [ ] Añadir tests del repositorio cloud y un entorno de prueba para políticas RLS.
- [ ] Incorporar smoke E2E de login/invite/crear-editar evento en un entorno no productivo.
- [ ] Evaluar CodeQL y auditorías Cargo/Gradle.
- [ ] Restringir CORS de `invite-user` a orígenes conocidos.
- [ ] Evaluar rate limit propio para invites.

## P3 — plataformas

- [ ] Definir distribución Android (sideload controlado o Play Store).
- [ ] iOS: Mac, cuenta Apple, firma y pruebas en dispositivo.
- [ ] Evaluar Cloudflare Access solo después de estabilizar invite/recovery.

## Criterio de cierre

Una tarea se marca completa solo con evidencia: comando/check verde, prueba manual registrada, URL de release o referencia de commit. Los detalles de ejecución pertenecen a `OPERATIONS.md`, `MOBILE.md` o `DEPLOY.md`.

## Resueltos recientemente

- [x] `happy-dom` crítico actualizado a 20.11.2 y suite completa verificada (2026-08-15).
- [x] `nanoid` alto actualizado mediante `npm audit fix` sin `--force` (2026-08-15).
- [x] Temurin JDK 21.0.12 instalado y `JAVA_HOME` configurado; `assembleDebug` completó correctamente (2026-08-15).
