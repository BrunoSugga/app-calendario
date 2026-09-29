# Deploy — Cloudflare Pages

Actualizar este archivo cuando cambie el host, `VITE_BASE`, secrets o redirects de Auth.

## URLs

| Entorno | URL |
|---------|-----|
| Producción (canónica) | **https://calendario.bmatrix.org** |
| Pages fallback | **https://bmx-calendario.pages.dev** |
| Dev local | http://localhost:5173 |

- Proyecto Cloudflare Pages: **`bmx-calendario`**
- Custom domain `calendario.bmatrix.org`: **Active** (2026-08-08)
- Workflow: `.github/workflows/deploy-cloudflare.yml` (solo después de CI exitoso y publicación explícita de la rama `main`)
- GitHub Pages: **apagado**

## Supabase Auth URLs (con dominio Active)

1. **Site URL:** `https://calendario.bmatrix.org`
2. **Redirect URLs:**
   - `https://calendario.bmatrix.org/**`
   - `https://bmx-calendario.pages.dev/**`
   - `http://localhost:5173/**`

   No agregar `https://localhost` (origen del WebView Capacitor).

## Build / CI

| Setting | Valor |
|---------|--------|
| Build | `npm run build` |
| Output | `dist` |
| `VITE_BASE` | `/` |
| Node (CI/Actions) | **24** (`actions/checkout@v5`, `actions/setup-node@v5`, `cloudflare/wrangler-action@v4`) |
| Secrets | `VITE_SUPABASE_*`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| Auth redirects | Build inyecta `VITE_PUBLIC_APP_URL=https://calendario.bmatrix.org` (invite/recovery desde Tauri) |

Archivos: `public/_redirects` (SPA), `public/_headers` (security headers), `wrangler.toml`.

La versión visible en el menú de ajustes se inyecta en build desde `package.json` mediante
`vite.config.ts`; no mantener una segunda versión manual en el frontend.

### Gates automatizados

- `ci.yml`: versiones, audit runtime, lint, tests y build.
- `deploy-cloudflare.yml`: se dispara por `workflow_run` únicamente si CI concluye correctamente en `main`.
- `release.yml`: valida versión y repite el gate antes de firmar/publicar.
- `android-ci.yml`: sincroniza Capacitor y compila APK debug sin secretos de firma.
- `codeql.yml`: análisis JS/TS en push, PR y semanal.

## Relación con Informes

Misma cuenta Cloudflare / dominio `bmatrix.org`. Informes usa túnel Zero Trust; el calendario usa **Pages** (sin proceso local).

## Estado y pendientes

- Web canónica activa y release desktop v1.2.4 publicada.
- Tareas abiertas de Edge Function, APK, tokens y Access: [`PENDIENTES.md`](PENDIENTES.md).
- Runbooks de publicación/rollback: [`OPERATIONS.md`](OPERATIONS.md).

## Desktop

- Publicar: Actions → **Release desktop** con la versión alineada a `package.json` / `tauri.conf.json` / `Cargo.toml`.
- La app instalada (1.0.1+) consulta `latest.json` al abrir y, mientras siga abierta,
  cada 30 min o al recuperar foco/visibilidad (cooldown de 5 min). Solo Tauri usa este
  updater; web y Android no reciben este aviso.
- Historial de versiones: [`../CHANGELOG.md`](../CHANGELOG.md).

## Android/iOS

Build, firma, seguridad y checklist: [`MOBILE.md`](MOBILE.md). Publicar web no actualiza APKs instaladas.