# BMatrix Calendario

Aplicación de calendario estilo Outlook con:

- Web (Vite + React + TypeScript)
- Escritorio (Tauri) con ventanas de recordatorio
- Sync multi-dispositivo vía Supabase (Auth + Postgres + Realtime)
- Modo local (localStorage) si no configurás Supabase

## Requisitos

- Node.js 20+
- Para escritorio: [Rust](https://rustup.rs/) y **Visual Studio Build Tools 2022** con workload “Desktop development with C++” (MSVC)
- Proyecto [Supabase](https://supabase.com) (opcional para sync)

## Configuración Supabase

1. Creá un proyecto en Supabase.
2. En el SQL Editor, ejecutá el contenido de [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql).
3. Copiá `.env.example` a `.env` y completá:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Sin esas variables, la app arranca en **modo local**.

## Producción (web)

La web se publica en GitHub Pages:

**https://brunosugga.github.io/app-calendario/**

Cada push a `main` dispara el deploy (workflow `Deploy GitHub Pages`).

En Supabase → **Authentication → URL Configuration**:

1. **Site URL:** `https://brunosugga.github.io/app-calendario/`
2. **Redirect URLs:** agregá `https://brunosugga.github.io/app-calendario/**`

Los secrets `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` viven en GitHub → Settings → Secrets.

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

1. Entrar con correo (y contraseña si hay Supabase).
2. Crear eventos con clic en la rejilla horaria.
3. Configurar repetición diaria/semanal/mensual.
4. En escritorio, la app puede ocultarse al cerrar; los recordatorios abren una ventana encima.
