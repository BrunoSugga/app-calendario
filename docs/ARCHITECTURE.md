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
  domain/         fechas, recurrencia, kinds, reschedule, reminders, workWeek
  hooks/          recordatorios, updater
  lib/
    security.ts   sanitización / CSP web
    authLink.ts   consume invite/recovery sin pisar otra sesión
    invite.ts     llama Edge Function invite-user
    supabase.ts   cliente anon + PKCE (detectSessionInUrl=false)
    localStore.ts modo local (+ workWeek opcional)
    deviceCalendarPrefs.ts  predeterminado + visibilidad por dispositivo
    calendarBackup.ts       export/import JSON de un calendario
    repositories/ local vs cloud (+ workWeekSettings)
  pages/          CalendarPage
supabase/migrations/   esquema + RLS (incl. 007 work_week_settings)
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
- `work_week_settings` — semana laboral (calendario laboral, días, horario, mute fuera de jornada)

Al crear un usuario en Auth, el trigger `handle_new_user` crea perfil + calendario default.
Las preferencias de semana laboral se crean al primer guardado (defaults en cliente si no hay fila).

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
- Lógica pura de disparo: `src/domain/reminders.ts` (`reminderScanRange`, `reminderScanRangeWithWorkWeek`, `selectDueReminders`) + `src/domain/workWeek.ts` + tests.
- Escaneo: mira **gracia atrás** (5 min) + horizonte 24 h. Sin el lookback, un `kind=reminder` (`ends_at === starts_at`) desaparecía del expand apenas pasaba el segundo de inicio.
- **Semana laboral:** si “No molestar fuera del horario laboral” está activo, los avisos del calendario laboral se retienen fuera de jornada y se disparan al reentrar (lookback desde el fin de la jornada previa vía `previousWorkPeriodEnd` / `reminderScanRangeWithWorkWeek`). Los demás calendarios usan la gracia de 5 min habitual.
- `fired` en `localStorage` solo se marca **después** de abrir el aviso (si falla el webview/popup no se consume el disparo).
- UI: `ReminderWindow` en ruta `?reminder=1&t=<token>` (payload one-shot en `localStorage`).
- **Desktop (Tauri):** `WebviewWindow` always-on-top + capabilities `reminder-*`.
- **Web (navegador):** misma UI en `window.open` (popup). Si el navegador bloquea popups → `alert` (+ Notification si hay permiso).
- Bridge popup ↔ ventana principal: cola `localStorage` (`calendario.pending.*`) + eventos; en Tauri también `emitTo('main', …)`.
- Aplazamientos:
  - **≤12 h** (stepper min/h): solo silencia (`calendario.snooze.*`).
  - **>12 h** (días) o **Reagendar**: mueve el evento (`calendario:reschedule-event`) y prefija el título con `REAGENDADO · ` (`src/domain/reschedule.ts`).
  - Steppers: flechas ciclan; **clic** aplica; **doble clic** abre lista para elegir directo.
  - Acciones del aviso (fila): Descartar → Reagendar → Abrir (tareas: + Empezar tarea).
- Si un aviso “no salió”: limpiar `calendario.reminders.fired` / `calendario.snooze.*` en DevTools o esperar; permitir popups en el dominio.

## UI principal

- Sidebar brand: logo + título + **rueda de ajustes** (menú: Gestionar calendarios, Semana laboral, Invitar usuario si admin, Salir).
- En **navegador** (no Tauri): bajo el nombre de usuario, link **Descargar app para PC** → GitHub Releases `…/releases/latest`.
- **Prefs por dispositivo** (`localStorage` `calendario.device.calendars.v1.<userId>`): calendario predeterminado + visibilidad de “Mis calendarios”. No se sincronizan entre PCs; al crear un evento se usa el predeterminado de *este* dispositivo.
- **Gestionar calendarios**: modal para crear, renombrar, color, eliminar y restaurar. Al eliminar: descarga obligatoria de respaldo JSON (`calendarBackup`) y opción de mover eventos a otro calendario o borrarlos (recuperables vía restaurar).
- Semana laboral: modal para calendario laboral, días L–D, horario (default L–V 08:00–17:00) y “No molestar fuera del horario laboral”.
- Updater desktop vía GitHub Releases (`release.yml`).

## Escritorio (Tauri)

- Ventana principal + ventana de recordatorio (ver sección Avisos).
- Capabilities en `src-tauri/capabilities/`.
- Baseline primeros usuarios: **v1.1.1**.

## Deploy web

- **Canónica:** `https://calendario.bmatrix.org` (Active).
- **Fallback:** `https://bmx-calendario.pages.dev`.
- GitHub Pages deshabilitado. Detalle: `docs/DEPLOY.md`.
- En web, los avisos requieren **permitir ventanas emergentes** en el dominio.
