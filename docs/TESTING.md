# Testing y Definition of Done

Fuente canónica para controles de calidad. El gate obligatorio está en `.cursor/rules/01-quality-security-gate.mdc`.

## Comandos base

Requiere Node 22+ (CI usa Node 24).

```bash
npm ci
npm run check:versions
npm run lint
npm test
npm run build
npm audit --omit=dev
npm audit
```

- `npm run build` incluye TypeScript (`tsc -b`) y bundle Vite.
- `npm audit --omit=dev` debe quedar sin vulnerabilidades runtime conocidas.
- Los hallazgos de `npm audit` completo se clasifican como runtime o tooling; no usar `--force` sin evaluar compatibilidad.

## Batería específica de seguridad

```bash
npm test -- \
  src/lib/security.test.ts \
  src/lib/authLink.test.ts \
  src/lib/nativeReminders.test.ts \
  src/lib/mobileConfig.security.test.ts \
  src/lib/calendarBackup.test.ts \
  src/components/Auth/LoginPage.test.tsx
```

Esta batería complementa, no reemplaza, `npm test`.

## Pirámide actual

| Nivel | Cobertura |
|---|---|
| Dominio | fechas, recurrencia, recordatorios, semana laboral, Organizador, tareas |
| Persistencia local | repositorio local, localStorage, backups |
| Seguridad cliente | sanitización, contraseñas, redirects, PKCE, config móvil |
| UI | login, EventModal, Toolbar, OrganizerView |
| Bridges | Tauri, updater desktop y avisos nativos |

## Tests obligatorios según cambio

- Bugfix: reproducir primero la regresión y demostrar que el test falla sin el fix.
- Inputs/archivos/URLs: casos válidos, límites, inválidos e inputs hostiles.
- Recurrencia/fechas: zona horaria, todo el día, límites inclusivos y excepciones.
- Auth/RLS/invites: usuario autorizado, no autorizado, sesión previa, redirect rechazado y error remoto.
- Repositorios: éxito, error, concurrencia/realtime y aislamiento por usuario.
- UI: estado vacío, error, loading, teclado, móvil y acción destructiva.
- Tauri/Capacitor: config estática más smoke manual en la plataforma.
- Updater Tauri: timers inicial/periódico, foco/visibilidad, deduplicación, errores y
  aceptación de descarga/relaunch; completar con smoke contra una release firmada.

## Controles manuales

- Desktop/web: smoke de login, crear/editar/eliminar, recurrencia, Organizador, logout y recordatorios.
- Mobile: seguir `MOBILE.md`; registrar dispositivo/emulador, versión Android y resultado.
- Deploy: seguir `OPERATIONS.md`; verificar URL/artefacto y rollback.

## Cobertura pendiente

La fuente de tareas es `PENDIENTES.md`. Prioridades actuales:

- Edge Function `invite-user` ejecutable en entorno de prueba.
- Repositorio cloud y políticas RLS.
- Smoke E2E de auth y CRUD.
- Build Android debug en CI.

## Evidencia de entrega

Toda entrega debe informar:

1. Comandos ejecutados y resultados.
2. Tests nuevos/modificados y riesgo que cubren.
3. Warnings o vulnerabilidades, incluso si son de tooling.
4. Controles manuales realizados y entorno.
5. Controles omitidos con motivo.

No afirmar “pentest aprobado” ni “sin vulnerabilidades” salvo que el alcance y la evidencia lo permitan.
