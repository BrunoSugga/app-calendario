# Arquitectura — BMatrix Calendario

## Stack

| Capa | Tecnología |
|------|------------|
| Web UI | Vite 8 + React 19 + TypeScript |
| Escritorio | Tauri 2 (Rust) |
| Móvil | Capacitor 8 (Android APK; iOS esqueleto) |
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
    platform.ts   isTauri / isCapacitor
    authLink.ts   consume invite/recovery sin pisar otra sesión
    authRedirectAllowlist.ts  hosts permitidos en mails de Auth
    nativeReminders.ts        lote a programar (puro; tests)
    nativeRemindersBridge.ts  plugin LocalNotifications (solo nativo)
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
android/               proyecto nativo Capacitor (APK)
ios/                   esqueleto Xcode (sin IPA en Windows)
docs/                  contexto del proyecto (leer al inicio de sesión)
```

Mapa y responsabilidad de cada documento: `docs/INDEX.md`. Estado operativo únicamente en `docs/PENDIENTES.md`.

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
- En **Capacitor (Android)**: además se programan `LocalNotifications` nativas (~48 h, tope 100) vía `src/lib/nativeReminders.ts` + `nativeRemindersBridge.ts`. Tap o disparo en foreground abre `ReminderWindow` en overlay (no `window.open`). Texto visible: título + hora + calendario (sin descripción). Canal Android `visibility=PRIVATE`.
- Lógica pura de disparo: `src/domain/reminders.ts` (`reminderScanRange`, `reminderScanRangeWithWorkWeek`, `partitionMissedReminders` / `selectDueReminders`) + `src/domain/workWeek.ts` + tests.
- Escaneo: mira **gracia atrás** (5 min) + horizonte 24 h. Sin el lookback, un `kind=reminder` (`ends_at === starts_at`) desaparecía del expand apenas pasaba el segundo de inicio.
- **Catch-up al reabrir:** heartbeat `calendario.reminders.lastScan` en `localStorage`. Al volver, avisos con `remindAt` desde `lastScan` y no en `fired`:
  - **Últimos 15 días** → popup/webview individual (como en uso normal).
  - **Más antiguos** (pero ≥ `lastScan`) → modal resumen `MissedRemindersModal` (tabla desplazable); “Entendido” marca esas keys en `fired`. Mientras el modal esté pendiente no se avanza `lastScan`.
  - Primera vez sin `lastScan`: solo gracia de 5 min (no vuelca el histórico del calendario).
  - El poll **no corre ni avanza `lastScan` mientras `loading`** del snapshot (evita quemar el catch-up con `events=[]` al abrir). Tampoco avanza si falló abrir un aviso due.
- **Semana laboral:** si “No molestar fuera del horario laboral” está activo, los avisos del calendario laboral se retienen fuera de jornada y se disparan al reentrar (lookback desde el fin de la jornada previa vía `previousWorkPeriodEnd` / `reminderScanRangeWithWorkWeek`). No van al modal de antiguos; los demás calendarios usan gracia / catch-up habitual.
- `fired` en `localStorage` (por dispositivo) solo se marca **después** de abrir el aviso o de acusar el modal de antiguos (si falla el webview/popup no se consume el disparo).
- UI: `ReminderWindow` en ruta `?reminder=1&t=<token>` (payload one-shot en `localStorage`).
- **Desktop (Tauri):** `WebviewWindow` always-on-top + capabilities `reminder-*`.
- **Web (navegador):** misma UI en `window.open` (popup). Si el navegador bloquea popups → `alert` (+ Notification si hay permiso).
- Bridge popup ↔ ventana principal: cola `localStorage` (`calendario.pending.*`) + eventos; en Tauri también `emitTo('main', …)`.
- Aplazamientos:
  - **≤12 h** (stepper min/h): en eventos, recordatorios y tareas corre inicio y fin la misma cantidad, sin prefijo «REAGENDADO». El aviso ya visto de esa repetición se limpia; los de los otros días de la serie quedan.
  - Al vencer un aplazamiento viejo guardado en `calendario.snooze.*`, la hora efectiva sigue siendo el fin del snooze.
  - **>12 h** (días) o **Reagendar**: mueve inicio y fin juntos (`movedScheduleWindow`) y prefija el título con `REAGENDADO · `.
  - **Serie periódica:** si hay varias repeticiones vencidas, solo abre aviso la más reciente. Las anteriores se marcan vistas, porque ya existe una posterior.
  - Steppers: flechas ciclan; **clic** aplica; **doble clic** abre lista para elegir directo.
  - Acciones del aviso (fila): Descartar → Reagendar → Abrir (tareas: + Empezar tarea).
- **Fin de una tarea en curso:** si `task_status` es `in_progress` y llega la hora de fin del bloque que se está haciendo, `useTaskEndPrompts` abre un aviso «¿Ya terminaste esta tarea?».
  - En una serie, si ya empezó una repetición posterior, la ejecución vieja se cierra sola (`completeTask`) y no dispara un aviso por cada día pasado.
  - **Sí:** `completeTask` (igual que terminar desde el modal).
  - **No:** la hora de fin se corre una hora (`extendedTaskEnd`). Si esa hora ya pasó porque se respondió tarde, la próxima pregunta queda a una hora de ahora. En una serie solo se mueve esa ocurrencia.
  - Se pregunta una vez por cada hora de fin. Si el popup no puede abrirse (web con bloqueo o Android), la misma pregunta queda en un cuadro dentro de la app.
  - Ventana desktop: misma capability `reminder-*`, ruta `?task-end=1&t=<token>`.
- Si un aviso “no salió”: limpiar `calendario.reminders.fired` / `calendario.reminders.lastScan` / `calendario.snooze.*` en DevTools o esperar; permitir popups en el dominio.

## UI principal

- Sidebar brand: logo + título + **rueda de ajustes** (menú: Gestionar calendarios, Semana laboral, Invitar usuario si admin, Salir y versión visible no interactiva).
- **Organizador de eventos:** botón junto a “Hoy” que reemplaza la grilla por una lista cronológica con búsqueda y filtros por tipo, calendario, periodicidad y estado. Los eventos simples aparecen una vez; de cada serie se muestra solo la próxima ocurrencia efectiva (o la última si la serie terminó), respetando excepciones. El historial se abre contraído en bloques de 90 días. Editar/eliminar reutiliza el alcance “esta ocurrencia / toda la serie”.
- Las recurrencias pueden tener una fecha opcional **Finaliza**, persistida como `UNTIL` en el RRULE. Las series existentes sin límite se muestran como “Sin fecha de fin”.
- La repetición mensual ofrece dos modos: por días de semana (`BYDAY`, comportamiento histórico) y por día del mes (`BYMONTHDAY`). En este último, si el día 29, 30 o 31 no existe en un mes, la expansión crea una única ocurrencia en el último día disponible; las excepciones se vinculan a esa fecha efectiva.
- En **navegador** (no Tauri ni Capacitor): bajo el nombre de usuario, link **Descargar app para PC** → GitHub Releases `…/releases/latest`.
- **Prefs por dispositivo** (`localStorage` `calendario.device.calendars.v1.<userId>`): calendario predeterminado + visibilidad de “Mis calendarios”. No se sincronizan entre PCs; al crear un evento se usa el predeterminado de *este* dispositivo.
- **Gestionar calendarios**: modal para crear, renombrar, color, eliminar y restaurar. Al eliminar: descarga obligatoria de respaldo JSON (`calendarBackup`) y opción de mover eventos a otro calendario o borrarlos (recuperables vía restaurar). Import con topes DoS (5 MB / 5000 eventos·excepciones / 10000 task runs).
- Semana laboral: modal para calendario laboral, días L–D, horario (default L–V 08:00–17:00) y “No molestar fuera del horario laboral”.
- Updater **solo desktop Tauri** vía GitHub Releases (`release.yml`): chequeo inicial a
  los 2,5 s, periódico cada 30 min mientras la app está visible y al recuperar
  foco/visibilidad (con cooldown de 5 min). La misma versión se pregunta una sola vez
  por sesión; web y Android no usan este updater.

## Escritorio (Tauri)

- Ventana principal + ventana de recordatorio (ver sección Avisos).
- Capabilities en `src-tauri/capabilities/`.
- Código **v1.2.5** en `main`; instalador y updater de escritorio publicados mediante GitHub Releases.

## Móvil (Capacitor)

- Mismo `dist/` de Vite dentro de un WebView (`android/` + esqueleto `ios/`). Código en GitHub (`main`, 2026-08-15).
- App ID: `com.bruno.calendario`. Origin Android: `https://localhost` (no usar como redirect de Auth).
- Invites/recovery: siempre `https://calendario.bmatrix.org` (allowlist en `authLink.ts`).
- UI: sidebar en drawer bajo 900 px; overlay de aviso in-app.
- Tras reboot, abrir la app para reprogramar avisos si el OEM no restauró alarmas.
- **Estado:** scaffold listo; APK **no** corrida en dispositivo. iOS: solo esqueleto (sin IPA). Pendiente: `docs/DEPLOY.md` § Android y `AGENTS.md` § Pendiente.

## Deploy web

- **Canónica:** `https://calendario.bmatrix.org` (Active).
- **Fallback:** `https://bmx-calendario.pages.dev`.
- GitHub Pages deshabilitado. Detalle: `docs/DEPLOY.md`.
- En web, los avisos requieren **permitir ventanas emergentes** en el dominio.
