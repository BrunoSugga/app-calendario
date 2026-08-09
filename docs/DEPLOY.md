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
- Workflow: `.github/workflows/deploy-cloudflare.yml` (push a `main`)
- GitHub Pages: **apagado**

## Supabase Auth URLs (con dominio Active)

1. **Site URL:** `https://calendario.bmatrix.org`
2. **Redirect URLs:**
   - `https://calendario.bmatrix.org/**`
   - `https://bmx-calendario.pages.dev/**`
   - `http://localhost:5173/**`

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

## Relación con Informes

Misma cuenta Cloudflare / dominio `bmatrix.org`. Informes usa túnel Zero Trust; el calendario usa **Pages** (sin proceso local).

## Checklist

- [x] Proyecto Pages `bmx-calendario` + deploy Action OK
- [x] Secrets Cloudflare en GitHub
- [x] Redirect URLs en Supabase (pages.dev + calendario + localhost)
- [x] `calendario.bmatrix.org` **Active** en Cloudflare
- [x] Site URL Supabase = `https://calendario.bmatrix.org` (confirmar en dashboard si un invite falla)
- [x] Invite + set-password probado (navegador OK; escritorio desde v1.0.8+)
- [x] Baseline: desktop **v1.1.3** (+ web canónica; prefs por dispositivo / gestionar calendarios / topes import)
- [ ] (Opcional) Cloudflare Access después
- [ ] Rotar tokens si se pegaron en chats antiguos

## Desktop

- Publicar: Actions → **Release desktop** con la versión alineada a `package.json` / `tauri.conf.json` / `Cargo.toml`.
- La app instalada (1.0.1+) pregunta al abrir si hay release más nueva (`latest.json` del updater).
- **v1.1.3** = topes DoS en import de respaldos JSON + fix build release (tipos en tests).
- **v1.1.2** = prefs de calendario por dispositivo, gestionar calendarios (respaldo/mover), CTA descarga PC en web.
- **v1.1.1** = desktop con Semana laboral (avisos laborales diferidos fuera de jornada).

## Deuda / notas

- No poner `service_role` ni tokens en el repo.
- Rotar tokens de Supabase/Cloudflare si se pegaron en el chat.
- Access (Zero Trust) solo después de que invite/recovery funcionen de forma estable.
- Avisos en web: popup (`?reminder=1`); permitir emergentes. Detalle: `docs/ARCHITECTURE.md`.
- Rate limit email Supabase free: no spamear invites.