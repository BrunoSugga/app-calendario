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
| Estructura de carpetas, modos cloud/local, Tauri, Capacitor | `docs/ARCHITECTURE.md` |
| Hosting, env vars, redirects, Cloudflare/GitHub Pages | `docs/DEPLOY.md` |
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

## Estado actual (2026-08-15) — código **v1.2.1** en `main`

Ver detalle en `docs/SECURITY.md` y `docs/DEPLOY.md`.

- **GitHub:** `main` incluye Organizador de eventos, finalización de recurrencias, Capacitor (`android/` + esqueleto `ios/`), allowlist de Auth y avisos nativos.
- **Usuarios en producción:** web `calendario.bmatrix.org` (Cloudflare al push a `main`) + desktop actualizable a **v1.2.1** desde GitHub Releases.
- **APK:** código listo; **no** compilada ni probada en teléfono. Seguir en PC con Android Studio (`git pull` → `npm install` → `npx cap sync` → `npx cap open android`).
- **Admin:** UUID `bfd18782-7bea-4386-bd8f-de050f398aec` (Bruno Sugga).
- **Web live:** `https://calendario.bmatrix.org` (fallback `https://bmx-calendario.pages.dev`).
- **Site URL Supabase:** `https://calendario.bmatrix.org`. Redirect: custom + pages.dev + `localhost:5173`. **No** `https://localhost` (Capacitor).
- **Invites:** allowlist en cliente (ya en el repo / web). Edge Function `invite-user` **pendiente de redeploy** para la misma allowlist.
- **Avisos:** web popup; desktop WebviewWindow; Android LocalNotifications (código listo, falta probar en dispositivo).
- **Rate limit mails Supabase (free):** `email rate limit exceeded` → esperar ~30–60 min.
- **Tests:** `npm test` (121) incluye Organizador, recurrencias, `authLink`, `nativeReminders` y `mobileConfig.security`.

### Pendiente (siguiente sesión)

1. En casa (Android Studio): `git pull`, `npm install`, `npx cap sync`, `npx cap open android` / `npx cap run android`. Probar login cloud, avisos con la app cerrada, drawer, logout.
2. Redeploy Edge Function: `npx supabase functions deploy invite-user --project-ref hznvsuobulrxxpofebkq`.
3. Invite desde la APK (admin) → el mail debe apuntar a `calendario.bmatrix.org`, no a localhost.
4. Keystore fuera del repo + APK release sideload (`docs/DEPLOY.md`).
5. Verificar actualización automática del escritorio a **v1.2.1**.
6. iOS IPA: Mac + cuenta Apple (fuera de esta entrega). Play Store / TestFlight: no.
