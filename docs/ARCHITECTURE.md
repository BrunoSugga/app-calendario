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
    supabase.ts   cliente anon + PKCE
    localStore.ts modo local
    repositories/ local vs cloud
  pages/          CalendarPage
supabase/migrations/   esquema + RLS
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

## Auth (objetivo post-hardening)

- Sin registro público en la UI cloud.
- Admin invita por email → Edge Function → `auth.admin.inviteUserByEmail`.
- Invitado abre el link → pantalla “definir contraseña” → sesión lista.
- Detalle y checklist: `docs/SECURITY.md`.

## Seguridad en cliente

- Solo clave **anon** en el front (`VITE_*`).
- Sanitización en `src/lib/security.ts` (límites de texto, email, rrule, drafts).
- CSP web en producción (`applyWebCsp`); en Cloudflare también headers HTTP (ver `docs/DEPLOY.md`).

## Escritorio (Tauri)

- Ventana principal + ventana de recordatorio.
- Capabilities en `src-tauri/capabilities/`.
- Updater vía GitHub Releases (workflow `release.yml`).

## Deploy web

- Histórico: GitHub Pages (`VITE_BASE=/app-calendario/`).
- Objetivo: Cloudflare Pages en raíz (`VITE_BASE=/`). Ver `docs/DEPLOY.md`.
