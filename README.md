# BMatrix Calendario

Aplicación de calendario estilo Outlook con:

- Web (Vite + React + TypeScript); avisos en ventana emergente (permitir popups)
- Escritorio (Tauri) con ventanas de recordatorio siempre encima
- Sync multi-dispositivo vía Supabase (Auth + Postgres + Realtime)
- Modo local (localStorage) si no configurás Supabase

## Contexto del proyecto (agentes y humanos)

Antes de trabajar en el repo, consultá:

| Doc | Contenido |
|-----|-----------|
| [`AGENTS.md`](AGENTS.md) | Obligatorio al inicio de cada sesión de agente; cuándo actualizar docs |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack, modos cloud/local, mapa de carpetas |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Plan de seguridad: admin, invites, RLS, PKCE, Edge Functions |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Cloudflare Pages (objetivo) y legado GitHub Pages |

Reglas Cursor: `.cursor/rules/` (always-apply + seguridad).

## Requisitos

- Node.js 20+
- Para escritorio: [Rust](https://rustup.rs/) y **Visual Studio Build Tools 2022** con workload “Desktop development with C++” (MSVC)
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
3. Desplegá la Edge Function `invite-user` (`supabase/functions/invite-user`).
4. En Auth → Providers → Email: **desactivá signups públicos**.
5. Copiá `.env.example` a `.env` y completá:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Sin esas variables, la app arranca en **modo local**.

## Producción (web)

Deploy en **Cloudflare Pages** (GitHub Pages apagado). Detalle: [`docs/DEPLOY.md`](docs/DEPLOY.md).

- **URL canónica:** https://calendario.bmatrix.org  
- **Fallback Pages:** https://bmx-calendario.pages.dev  
- Workflow: `Deploy Cloudflare Pages` (push a `main`)
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
npm install
npm run dev          # solo web
npm run tauri:dev    # web + escritorio Tauri
```

## Tests y calidad

```bash
npm test             # Vitest (dominio + localStore)
npm run lint         # oxlint
npm run build        # typecheck + bundle web
```

## Build

```bash
npm run build
npm run tauri:build
```

El build de escritorio genera instaladores Windows (NSIS `.exe` y MSI) en `src-tauri/target/release/bundle/`.

## Actualizaciones automáticas (escritorio)

La app de escritorio usa el updater de Tauri + GitHub Releases.

1. Al abrir, si hay una versión nueva pregunta si querés actualizar.
2. Para publicar: Actions → **Release desktop** → Run workflow con la versión (ej. `1.0.1`).
3. Secretos requeridos en GitHub:
   - `TAURI_SIGNING_PRIVATE_KEY` (contenido de `.tauri/bmx-calendario.key`)
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (vacío si la clave no tiene password)
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`

La primera vez hay que instalar el `.exe` con updater (1.0.1+). Después se actualiza sola.

## Uso rápido

1. Entrar con correo (y contraseña si hay Supabase). En cloud no hay registro público: el admin invita.
2. Crear eventos con clic en la rejilla horaria.
3. Configurar repetición diaria/semanal/mensual.
4. Recordatorios: en escritorio abren una ventana encima; en el navegador usan un popup (hay que permitir emergentes en el sitio). Aplazar ≤12 h solo silencia; más de 12 h o Reagendar mueve el evento y marca `REAGENDADO ·`.
