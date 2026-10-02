# AGENTS — BMatrix Calendario

Instrucciones obligatorias para cualquier agente (Cursor u otro) que trabaje en este repositorio.

## Antes de empezar cualquier sesión

1. Leé este archivo (`AGENTS.md`).
2. Leé `docs/INDEX.md`, `docs/ARCHITECTURE.md` y `docs/PENDIENTES.md`.
3. Usá la matriz de `docs/INDEX.md` para leer los documentos específicos del cambio.
4. Revisá `.cursor/rules/`; `security-supabase.mdc` aplica a auth, Supabase y migraciones.
5. No inventes flujos que contradigan esos docs; si hay ambigüedad, preguntá al usuario.

## Al cerrar o al cambiar comportamiento relevante

Actualizá los docs afectados en la misma PR/cambio:

| Cambio | Actualizar |
|--------|------------|
| Auth, roles, invites, RLS, Edge Functions | `docs/SECURITY.md` |
| Tablas, triggers, políticas o migraciones | `docs/DATABASE.md` y `docs/SECURITY.md` |
| Estructura, modos cloud/local y flujos | `docs/ARCHITECTURE.md` |
| Hosting, env vars, redirects, Cloudflare/GitHub Pages | `docs/DEPLOY.md` |
| Variables/secrets por entorno | `docs/ENV.md` |
| Tests, auditorías o criterios de aceptación | `docs/TESTING.md` |
| Android/iOS | `docs/MOBILE.md` |
| Runbooks, incidentes o rollback | `docs/OPERATIONS.md` |
| Pendientes operativos | `docs/PENDIENTES.md` (única fuente) |
| Cambios visibles publicados | `CHANGELOG.md` |
| Flujo de trabajo del agente / convenciones | `AGENTS.md` y/o `.cursor/rules/` |
| Setup para humanos | `README.md` |

## Alcance del producto

- Calendario estilo Outlook: web (Vite + React + TS) + escritorio (Tauri) + Android (Capacitor APK). iOS: esqueleto.
- Sync multi-dispositivo vía Supabase (Auth + Postgres + Realtime).
- Modo local (`localStorage`) solo para desarrollo / uso sin backend; **no** es el modelo de seguridad para compañeros.

## Reglas de código

- Responder al usuario en **español**.
- No commits ni push salvo pedido explícito.
- No meter `service_role` ni secretos de admin en el frontend, Tauri ni Capacitor.
- Preferir migraciones SQL numeradas en `supabase/migrations/`.
- Operaciones privilegiadas (invitar usuarios, etc.) solo vía **Supabase Edge Functions** con `service_role` en el servidor.
- Mantener tests (`npm test`) y lint (`npm run lint`) en verde cuando el cambio lo amerite.
- No pegar tokens/secrets en el chat si se puede evitar; si el usuario los pasa, usarlos y recordarle rotarlos.

## Gate obligatorio al cerrar implementaciones

La fuente canónica es `.cursor/rules/01-quality-security-gate.mdc`; comandos y criterios detallados están en `docs/TESTING.md`. No cerrar ni publicar una implementación sin cumplir ese gate o documentar con precisión qué control no aplica y por qué.

## Estado operativo

- Versión actual: **v1.2.5**.
- Estado, riesgos y próximos pasos: `docs/PENDIENTES.md`.
- Operación y producción: `docs/OPERATIONS.md` y `docs/DEPLOY.md`.
- Nunca marcar un pendiente como resuelto sin evidencia verificable.
