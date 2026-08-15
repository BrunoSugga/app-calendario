# BMatrix Calendario

Aplicación de calendario estilo Outlook con:

- Web (Vite + React + TypeScript); avisos en ventana emergente (permitir popups)
- Escritorio (Tauri) con ventanas de recordatorio siempre encima
- Android (Capacitor): APK sideload; avisos locales nativos
- Sync multi-dispositivo vía Supabase (Auth + Postgres + Realtime)
- Modo local (localStorage) si no configurás Supabase

**Producción:** [https://calendario.bmatrix.org](https://calendario.bmatrix.org) · web y escritorio **v1.2.2** · APK Capacitor aún no distribuida.

## Contexto del proyecto (agentes y humanos)

Antes de trabajar, leer [`AGENTS.md`](AGENTS.md) y [`docs/INDEX.md`](docs/INDEX.md). El índice enlaza arquitectura, seguridad, testing, entornos, base de datos, mobile, deploy, operaciones y pendientes sin duplicar fuentes.

## Requisitos

- Node.js 22+ (CI usa Node 24)
- Para escritorio: [Rust](https://rustup.rs/) y **Visual Studio Build Tools 2022** con workload “Desktop development with C++” (MSVC)
- Para Android: [Android Studio](https://developer.android.com/studio) (SDK 36, min 26) + JDK 21
- Proyecto [Supabase](https://supabase.com) (opcional para sync)

## Configuración Supabase

1. Creá un proyecto en Supabase.
2. En el SQL Editor, ejecutá las migraciones en orden:
   - [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql)
   - [`supabase/migrations/002_security_hardening.sql`](supabase/migrations/002_security_hardening.sql)
   - [`supabase/migrations/003_event_kinds.sql`](supabase/migrations/003_event_kinds.sql) (tipos Evento/Recordatorio/Tarea + historial)
   - [`supabase/migrations/004_task_runs_hardening.sql`](supabase/migrations/004_task_runs_hardening.sql) (RLS más estricto en historial de tareas)
   - [`supabase/migrations/005_admin_invites.sql`](supabase/migrations/005_admin_invites.sql) (rol admin + seed)
   - [`supabase/migrations/006_rls_hardening.sql`](supabase/migrations/006_rls_hardening.sql) (policies + CHECKs)
   - [`supabase/migrations/007_work_week_settings.sql`](supabase/migrations/007_work_week_settings.sql) (semana laboral sincronizada)
3. Desplegá la Edge Function `invite-user` (`supabase/functions/invite-user`).
4. En Auth → Providers → Email: **desactivá signups públicos**.
5. Copiá `.env.example` a `.env` y completá:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_PUBLIC_APP_URL=https://calendario.bmatrix.org
```

Sin las variables Supabase, la app arranca en **modo local**. Referencia completa: [`docs/ENV.md`](docs/ENV.md).

## Producción (web)

Deploy en **Cloudflare Pages** (GitHub Pages apagado). Detalle: [`docs/DEPLOY.md`](docs/DEPLOY.md).

- **URL canónica:** https://calendario.bmatrix.org  
- **Fallback Pages:** https://bmx-calendario.pages.dev  
- Workflow: `Deploy Cloudflare Pages` después de que CI termine correctamente en `main`
- Secrets CI: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

En Supabase → **Authentication → URL Configuration**:

1. **Site URL:** `https://calendario.bmatrix.org`
2. **Redirect URLs:**
   - `https://calendario.bmatrix.org/**`
   - `https://bmx-calendario.pages.dev/**`
   - `http://localhost:5173/**`

Altas de usuario: solo el **admin** invita (cualquier correo; sidebar → Invitar usuario). Si el correo ya existe, se reenvía recovery. Borrar usuarios: Dashboard Supabase → Authentication → Users.

Si ves `email rate limit exceeded`, esperá 30–60 min (límite free de Supabase).

## Desarrollo

```bash
npm ci
npm run dev          # solo web
npm run tauri:dev    # web + escritorio Tauri
npm run cap:sync     # build web + sync a android/ e ios/
```

Guía completa: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Tests y calidad

```bash
npm run check:versions
npm test
npm run lint         # oxlint
npm run build        # typecheck + bundle web
npm audit --omit=dev
```

Definition of Done y baterías específicas: [`docs/TESTING.md`](docs/TESTING.md).

## Build

```bash
npm run build
npm run tauri:build
```

El build de escritorio genera instaladores Windows (NSIS `.exe` y MSI) en `src-tauri/target/release/bundle/`.

## Android/iOS

Preparación, hallazgos de dependencias, seguridad, firma y checklist de dispositivo: [`docs/MOBILE.md`](docs/MOBILE.md). Las tareas abiertas están únicamente en [`docs/PENDIENTES.md`](docs/PENDIENTES.md).

## Actualizaciones automáticas (escritorio)

La app de escritorio usa el updater de Tauri + GitHub Releases.

1. Al abrir, si hay una versión nueva pregunta si querés actualizar.
2. Para publicar: Actions → **Release desktop** → Run workflow con la versión exacta (actual: `1.2.2`).
3. Secretos requeridos en GitHub:
   - `TAURI_SIGNING_PRIVATE_KEY` (contenido de `.tauri/bmx-calendario.key`)
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (vacío si la clave no tiene password)
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`

La primera vez hay que instalar un `.exe` con updater. Después se actualiza sola. Runbook: [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Uso rápido

1. Entrar con correo (y contraseña si hay Supabase). En cloud no hay registro público: el admin invita.
2. Crear eventos con clic en la rejilla horaria.
3. Configurar repetición diaria/semanal/mensual.
4. Recordatorios: en escritorio abren una ventana encima; en el navegador usan un popup (hay que permitir emergentes en el sitio); en Android se programan notificaciones locales. Aplazar ≤12 h solo silencia; más de 12 h o Reagendar mueve el evento y marca `REAGENDADO ·`.
