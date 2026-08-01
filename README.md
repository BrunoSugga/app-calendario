# Calendario

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

## Uso rápido

1. Entrar con correo (y contraseña si hay Supabase).
2. Crear eventos con clic en la rejilla horaria.
3. Configurar repetición diaria/semanal/mensual.
4. En escritorio, la app puede ocultarse al cerrar; los recordatorios abren una ventana encima.
