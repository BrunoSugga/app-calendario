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

Archivos: `public/_redirects` (SPA), `public/_headers` (security headers), `wrangler.toml`.

## Relación con Informes

Misma cuenta Cloudflare / dominio `bmatrix.org`. Informes usa túnel Zero Trust; el calendario usa **Pages** (sin proceso local).

## Checklist

- [x] Proyecto Pages `bmx-calendario` + deploy Action OK
- [x] Secrets Cloudflare en GitHub
- [x] Redirect URLs en Supabase (pages.dev + calendario + localhost)
- [x] `calendario.bmatrix.org` **Active** en Cloudflare
- [ ] Site URL Supabase = `https://calendario.bmatrix.org` (hacerlo al quedar Active)
- [ ] Invite + set-password probado en incógnito
- [ ] (Opcional) Cloudflare Access después

## Deuda / notas

- No poner `service_role` ni tokens en el repo.
- Rotar tokens de Supabase/Cloudflare si se pegaron en el chat.
- Access (Zero Trust) solo después de que invite/recovery funcionen.
- Avisos en web: el sitio abre una ventana emergente (`?reminder=1`). Si no aparece el aviso completo, permitir popups para `calendario.bmatrix.org` / `bmx-calendario.pages.dev`. Detalle: `docs/ARCHITECTURE.md`.
