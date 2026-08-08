# Arquitectura — BMatrix Calendario

## Stack

| Capa | Tecnología |
|------|------------|
| Web UI | Vite 8 + React 19 + TypeScript |
| Escritorio | Tauri 2 (Rust) |
| Backend | Supabase (Auth, Postgres, Realtime) |
| Auth cloud | Supabase Auth, flujo **PKCE** |
| Persistencia local | `localStorage` (modo sin Supabase) |
| Tests | Vitest + Testing Library |
| Lint | oxlint |

## Modos de ejecución

1. **Cloud** — si existen `VITE_SUPABASE_URL` (HTTPS válido) y `VITE_SUPABASE_ANON_KEY`. Datos por usuario vía RLS.
2. **Local** — sin esas vars. Login solo por email (sin contraseña real). Datos en el navegador. No usar para compartir con el equipo.

Detección: `src/lib/supabase.ts` → `isCloudMode`.

## Mapa de carpetas (relevante)

```
src/
  components/     UI (Auth, Event, Views, Reminder, Sidebar, Toolbar)
  context/        AuthContext, CalendarDataContext
  domain/         fechas, recurrencia, kinds, reschedule
  hooks/          recordatorios, updater
  lib/
    security.ts   sanitización / CSP web
    authLink.ts   consume invite/recovery sin pisar otra sesión
    invite.ts     llama Edge Function invite-user
    supabase.ts   cliente anon + PKCE (detectSessionInUrl=false)
    localStore.ts modo local
    repositories/ local vs cloud
  pages/          CalendarPage
supabase/migrations/   esquema + RLS
supabase/functions/    Edge Functions (invite-user)
src-tauri/             app escritorio + capabilities
docs/                  contexto del proyecto (leer al inicio de sesión)
```

## Datos (cloud)

Tablas principales (todas con RLS):

- `profiles` — perfil ligado a `auth.users`
- `calendars` — calendarios del usuario
- `events` — eventos / recordatorios / tareas (`kind`)
- `event_exceptions` — excepciones de recurrencia
- `task_runs` — historial de ejecuciones de tareas

Al crear un usuario en Auth, el trigger `handle_new_user` crea perfil + calendario default.

## Auth (cloud)

- Sin registro público en la UI cloud.
- Admin invita por email → Edge Function → `auth.admin.inviteUserByEmail` (cualquier dominio).
- Invitado abre el link → `authLink.consumeInboundAuthLink` (limpia sesión previa) → `SetPasswordPage`.
- Detalle: `docs/SECURITY.md`.

## Seguridad en cliente

- Solo clave **anon** en el front (`VITE_*`).
- Sanitización en `src/lib/security.ts`.
- CSP web en producción (`applyWebCsp`); headers HTTP en Cloudflare (`public/_headers`).

## Avisos / recordatorios (web + desktop)

- Motor: `useReminders` (poll ~15s) → `openReminderWindow` (`src/lib/tauri.ts`).
- UI: `ReminderWindow` en ruta `?reminder=1&t=<token>` (payload one-shot en `localStorage`).
- **Desktop (Tauri):** `WebviewWindow` always-on-top + capabilities `reminder-*`.
- **Web (navegador):** misma UI en `window.open` (popup). Si el navegador bloquea popups, cae a un `alert` pidiendo permitir emergentes en el sitio (`calendario.bmatrix.org` / Pages / localhost).
- Bridge popup ↔ ventana principal: cola `localStorage` (`calendario.pending.*`) + eventos; en Tauri también `emitTo('main', …)`.
- Aplazamientos:
  - **≤12 h** (stepper min/h): solo silencia (`calendario.snooze.*`).
  - **>12 h** (días) o **Reagendar**: mueve el evento (`calendario:reschedule-event`) y prefija el título con `REAGENDADO · ` (`src/domain/reschedule.ts`).

## Escritorio (Tauri)

- Ventana principal + ventana de recordatorio (ver sección Avisos).
- Capabilities en `src-tauri/capabilities/`.
- Updater vía GitHub Releases (workflow `release.yml`).

## Deploy web

- **Live:** `https://bmx-calendario.pages.dev` (Pages `bmx-calendario`).
- **Custom:** `https://calendario.bmatrix.org` (hasta Active, Site URL de Auth = pages.dev).
- GitHub Pages deshabilitado. Detalle: `docs/DEPLOY.md`.
- En web, los avisos requieren **permitir ventanas emergentes** en el dominio.
