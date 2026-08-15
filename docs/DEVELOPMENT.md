# Desarrollo local

## Requisitos

- Node 22+; CI usa Node 24.
- npm con `package-lock.json`.
- Rust + Visual Studio Build Tools 2022 para Tauri Windows.
- Android Studio + JDK 21 para Android.
- Supabase opcional para modo cloud.

## Inicio

```bash
npm ci
copy .env.example .env
npm run dev
```

Sin variables Supabase se usa modo local. Ver `ENV.md`.

## Comandos

```bash
npm run dev
npm run tauri:dev
npm run cap:sync
npm run check:versions
npm run lint
npm test
npm run build
```

Usar `npm ci` para reproducibilidad. `npm install` solo al cambiar dependencias deliberadamente y revisar el diff de `package-lock.json`.

## Convenciones

- TypeScript estricto; no ocultar errores con casts amplios sin justificación.
- Lógica de calendario/seguridad en funciones puras testeables.
- UI reutiliza dominio y repositorios; no duplica reglas RLS en cliente.
- Migraciones numeradas; ver `DATABASE.md`.
- Secretos fuera del repo; ver `ENV.md`.
- Cambios funcionales incluyen tests y documentación proporcional.

## Modos y plataformas

- Web local: Vite.
- Desktop: Tauri usa el mismo frontend con capacidades restringidas.
- Android/iOS: Capacitor copia `dist`; `cap:sync` siempre construye primero.
- Cloud: Supabase Auth/Postgres/Realtime con RLS.

## Antes de publicar

Cumplir `TESTING.md`, verificar `PENDIENTES.md`, actualizar `CHANGELOG.md` y seguir `OPERATIONS.md`.

## Troubleshooting

- `vitest`/Vite no inicia con Node 18: instalar Node 22+; no parchear dependencias para sostener un runtime fuera de soporte.
- `email rate limit exceeded`: ver `OPERATIONS.md`.
- Auth redirige a localhost/Tauri: revisar `VITE_PUBLIC_APP_URL` y `ENV.md`.
- Android no encuentra SDK/JDK: configurar Android Studio y `android/local.properties` local.
