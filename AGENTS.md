# AGENTS — BMatrix Calendario

Instrucciones obligatorias para cualquier agente (Cursor u otro) que trabaje en este repositorio.

## Antes de empezar cualquier sesión

1. Leé este archivo (`AGENTS.md`).
2. Leé `docs/ARCHITECTURE.md`.
3. Si el trabajo toca auth, datos, RLS, invites o deploy: leé `docs/SECURITY.md` y `docs/DEPLOY.md`.
4. Revisá `.cursor/rules/` (reglas always-apply del proyecto).
5. No inventes flujos que contradigan esos docs; si hay ambigüedad, preguntá al usuario.

## Al cerrar o al cambiar comportamiento relevante

Actualizá los docs afectados en la misma PR/cambio:

| Cambio | Actualizar |
|--------|------------|
| Auth, roles, invites, RLS, Edge Functions | `docs/SECURITY.md` |
| Estructura de carpetas, modos cloud/local, Tauri | `docs/ARCHITECTURE.md` |
| Hosting, env vars, redirects, Cloudflare/GitHub Pages | `docs/DEPLOY.md` |
| Flujo de trabajo del agente / convenciones | `AGENTS.md` y/o `.cursor/rules/` |
| Setup para humanos | `README.md` |

## Alcance del producto

- Calendario estilo Outlook: web (Vite + React + TS) + escritorio (Tauri).
- Sync multi-dispositivo vía Supabase (Auth + Postgres + Realtime).
- Modo local (`localStorage`) solo para desarrollo / uso sin backend; **no** es el modelo de seguridad para compañeros.

## Reglas de código

- Responder al usuario en **español**.
- No commits ni push salvo pedido explícito.
- No meter `service_role` ni secretos de admin en el frontend ni en Tauri.
- Preferir migraciones SQL numeradas en `supabase/migrations/`.
- Operaciones privilegiadas (invitar usuarios, etc.) solo vía **Supabase Edge Functions** con `service_role` en el servidor.
- Mantener tests (`npm test`) y lint (`npm run lint`) en verde cuando el cambio lo amerite.

## Estado de seguridad

Ver `docs/SECURITY.md`. Resumen:

- Signup público deshabilitado (UI cloud + Dashboard).
- Solo un **admin** (`bfd18782-7bea-4386-bd8f-de050f398aec`) puede invitar (cualquier email válido).
- Invite/recovery: `src/lib/authLink.ts` limpia sesión local antes de aplicar el token del mail (no pisar admin).
- RLS + CHECKs en migraciones `005`/`006`.
- Deploy web: **Cloudflare Pages** (`calendario.bmatrix.org` / `bmx-calendario.pages.dev`).
- Tests de seguridad: `authLink.test.ts` + `security.test.ts` (correr `npm test` ante cambios de auth).
