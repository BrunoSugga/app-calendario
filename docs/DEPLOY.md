# Deploy — Cloudflare Pages

Actualizar este archivo cuando cambie el host, `VITE_BASE`, secrets o redirects de Auth.

## URLs

| Entorno | URL |
|---------|-----|
| Producción Pages (usar ahora) | **https://bmx-calendario.pages.dev** |
| Custom domain (objetivo) | **https://calendario.bmatrix.org** |
| Dev local | http://localhost:5173 |

- Proyecto Cloudflare Pages: **`bmx-calendario`**
- Account ID (GitHub secret): ya cargado como `CLOUDFLARE_ACCOUNT_ID`
- Workflow: `.github/workflows/deploy-cloudflare.yml` (push a `main`)
- GitHub Pages: **apagado** (`.github/workflows/deploy-pages.yml` disabled)

## ¿Hay que correr algo local?

**No.** Pages es estático en CDN. No es como Informes (`informes.bmatrix.org` + túnel `cloudflared`).

## Custom domain vs Site URL (importante)

Mientras `calendario.bmatrix.org` en Cloudflare esté **Verifying** (no Active):

1. Supabase → Authentication → **URL Configuration** → **Site URL** = `https://bmx-calendario.pages.dev`
2. Redirect URLs (mantener las tres):
   - `https://bmx-calendario.pages.dev/**`
   - `https://calendario.bmatrix.org/**`
   - `http://localhost:5173/**`

Cuando el dominio custom pase a **Active**, podés poner Site URL = `https://calendario.bmatrix.org`.

Si Site URL apunta a un dominio que aún no responde, los mails de invite/recovery fallan o caen en login vacío.

## Build / CI

| Setting | Valor |
|---------|--------|
| Build | `npm run build` |
| Output | `dist` |
| `VITE_BASE` | `/` |
| Node (CI/Actions) | **24** (`actions/checkout@v5`, `actions/setup-node@v5`, `cloudflare/wrangler-action@v4`) |
| Secrets | `VITE_SUPABASE_*`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |

Archivos: `public/_redirects` (SPA), `public/_headers` (security headers), `wrangler.toml`.

## Relación con Informes

Misma cuenta Cloudflare / dominio `bmatrix.org`. Informes usa túnel Zero Trust; el calendario usa **Pages** (sin proceso local).

## Checklist

- [x] Proyecto Pages `bmx-calendario` + deploy Action OK
- [x] Secrets Cloudflare en GitHub
- [x] Redirect URLs en Supabase (pages.dev + calendario + localhost)
- [ ] `calendario.bmatrix.org` **Active** en Cloudflare
- [ ] Site URL alineada al host que realmente responde
- [ ] Invite + set-password probado en incógnito
- [ ] (Opcional) Cloudflare Access después

## Deuda / notas

- No poner `service_role` ni tokens en el repo.
- Rotar tokens de Supabase/Cloudflare si se pegaron en el chat.
- Access (Zero Trust) solo después de que invite/recovery funcionen.
- Avisos en web: el sitio abre una ventana emergente (`?reminder=1`). Si no aparece el aviso completo, permitir popups para `calendario.bmatrix.org` / `bmx-calendario.pages.dev`. Detalle: `docs/ARCHITECTURE.md`.
