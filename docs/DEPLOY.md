# Deploy — web (Cloudflare Pages + legado GitHub Pages)

Actualizar este archivo cuando cambie el host, `VITE_BASE`, secrets o redirects de Auth.

## Objetivo

Publicar la SPA en **Cloudflare Pages** para compartirla con el equipo (URL estable, fácil de rotar, opcional **Cloudflare Access**).

La app es estática (`npm run build` → `dist/`). No necesita Worker de backend propio; el backend es Supabase (+ Edge Functions).

## ¿Hay que correr algo local con Cloudflare?

**No.** A diferencia del dashboard de informes (`informes.bmatrix.org`), que usa un **túnel Cloudflare** (`cloudflared`) hacia un servidor local/Django, el calendario en **Pages** funciona como GitHub Pages:

1. Push (o deploy desde CI) → Cloudflare construye o sube `dist/`.
2. La app queda en la CDN de Cloudflare.
3. En tu PC no hace falta dejar un proceso ni un túnel encendido para que los compañeros la usen.

Desarrollo diario: seguís con `npm run dev` en localhost. Producción: solo Pages + Supabase.

## Relación con el proyecto Informes

En `DESHBOARD DE INFORMES` / producción ya usás la cuenta Cloudflare y el dominio **bmatrix.org** (`informes.bmatrix.org` vía túnel Zero Trust). **No hay `wrangler.toml` ni Account ID en ese repo** (el túnel se configura en el dashboard de Cloudflare).

Para el calendario reutilizamos la **misma cuenta + dominio**:

- Subdominio propuesto: **`calendario.bmatrix.org`** → proyecto Cloudflare Pages.
- DNS: registro CNAME en Cloudflare (Pages lo guía al conectar el dominio custom).
- Invites Auth: solo admin; cualquier email válido (Gmail, Camposur, etc.).
- Anti-bug: abrir el link de invite en ventana **sin** sesión admin (o confiar en `authLink` que hace signOut local).

Account ID / API token: se toman del dashboard Cloudflare al cablear el workflow (no están en el repo de informes; no los copies a git).

## Decisiones cerradas (2026-08-08)

| Tema | Decisión |
|------|----------|
| Host | Cloudflare Pages + custom domain `calendario.bmatrix.org` |
| GitHub Pages | Apagar al estabilizar Cloudflare |
| Access | **Después** del primer deploy (Auth Supabase primero; Access no debe romper invite/reset links) |
| Parallel Pages/GitHub | No; migrar y cortar GitHub Pages |
| Cuenta CF | Misma que Informes (`bmatrix.org` en dash.cloudflare.com); Pages ≠ túnel `cloudflared` |

---

## Cloudflare Pages (plan de puesta a punto)

### Build

| Setting | Valor |
|---------|--------|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node | 22 |
| `VITE_BASE` | `/` (raíz; distinto de GitHub Pages) |
| Env | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

### SPA routing

Archivo `public/_redirects` (se copia a `dist`):

```
/*    /index.html   200
```

### Headers de seguridad (CSP HTTP)

Archivo `public/_headers` — alinear `connect-src` con el proyecto Supabase real (actualizar al desplegar):

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; media-src 'self'; worker-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://YOUR_PROJECT.supabase.co wss://YOUR_PROJECT.supabase.co
```

La CSP en meta (`applyWebCsp`) sigue como defensa en profundidad; los headers de Cloudflare son la fuente principal en producción.

### Supabase Auth URLs

Tras tener el dominio Pages (ej. `https://bmx-calendario.pages.dev` o custom):

1. **Site URL** → URL de Cloudflare.
2. **Redirect URLs** → `https://tu-dominio/**` (+ `http://localhost:5173/**` para dev).
3. Quitar o mantener GitHub Pages según si se apaga ese deploy.

### GitHub Action (a añadir en implementación)

Workflow sugerido `deploy-cloudflare.yml`:

- Trigger: push a `main` (o workflow_dispatch).
- `npm ci` + build con secrets.
- Deploy con `cloudflare/wrangler-action` o “Pages upload” usando `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` + nombre del proyecto.

Secrets CI:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### Cloudflare Access (recomendado para compañeros)

Opcional pero fuerte: política Access que solo permite emails `@tu-empresa.com` (o lista) **antes** de cargar la SPA. Complementa (no reemplaza) Auth + RLS de Supabase.

### Qué no poner en Cloudflare

- `service_role`
- claves Tauri de firma
- `.env` con secretos de admin

---

## Legado: GitHub Pages

- Workflow: `.github/workflows/deploy-pages.yml`
- URL actual documentada en `README.md`: `https://brunosugga.github.io/app-calendario/`
- Usa `VITE_BASE=/app-calendario/`

Decisión pendiente: ¿mantener Pages en paralelo o apagarlo cuando Cloudflare esté estable?

También existe `vercel.json` (alternativa no activa como deploy principal).

---

## Checklist post-deploy

### Una vez (manual)

1. Cloudflare Dashboard → **Workers & Pages** → Create project `bmx-calendario` (o conectar el repo).
2. GitHub → Secrets: `CLOUDFLARE_API_TOKEN` (permiso Pages Edit), `CLOUDFLARE_ACCOUNT_ID`, más los `VITE_SUPABASE_*` ya existentes.
3. Tras el primer deploy, Custom domains → `calendario.bmatrix.org`.
4. Supabase SQL: ejecutar `005_admin_invites.sql` y `006_rls_hardening.sql` si aún no están.
5. `supabase functions deploy invite-user` (CLI) o dashboard.
6. Auth: Site URL + Redirect URLs a `https://calendario.bmatrix.org/**`; **Disable sign ups**.
7. Verificar que tu usuario tenga `profiles.role = 'admin'`.

### Verificación

- [ ] Build OK en Cloudflare.
- [ ] Login / set-password / invite funcionan con redirects nuevos.
- [ ] Realtime (websocket) no bloqueado por CSP (meta `applyWebCsp`).
- [ ] GitHub Pages ya no publica (workflow disabled).
- [ ] `README.md` y este doc con la URL final.