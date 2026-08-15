# Entornos, variables y secretos

## Modos

| Entorno | Datos | Auth | Uso |
|---|---|---|---|
| Local sin Supabase | `localStorage` | email simulado | desarrollo aislado |
| Desarrollo cloud | Supabase | Auth real | integración controlada |
| Producción web | Supabase | Auth real | `calendario.bmatrix.org` |
| Desktop Tauri | Supabase | Auth real | instalador firmado |
| Android Capacitor | Supabase | Auth real | APK firmada/sideload |

## Variables de frontend

| Variable | Sensibilidad | Obligatoria | Uso |
|---|---|---|---|
| `VITE_SUPABASE_URL` | pública | cloud | URL HTTPS del proyecto |
| `VITE_SUPABASE_ANON_KEY` | pública, limitada por RLS | cloud | cliente Supabase anon |
| `VITE_PUBLIC_APP_URL` | pública | producción/Tauri/Capacitor | redirect público de invite/recovery |
| `VITE_BASE` | pública | CI web | base Vite; producción usa `/` |

Toda variable `VITE_*` termina en el bundle. Nunca colocar allí `service_role`, claves administrativas, passwords, keystores ni tokens de proveedores.

## Secretos de GitHub Actions

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Los workflows deben usar permisos mínimos. No imprimir secrets ni activar debug de Actions con valores sensibles.

## Archivos locales

- `.env` / `.env.*`: ignorados; `.env.example` es la única plantilla versionada.
- `.tauri/*.key` y password: ignorados; solo se versiona la clave pública si corresponde.
- `*.keystore`, `*.jks`, `keystore.properties`: ignorados y fuera del repo.
- `android/local.properties`: local, ignorado.

## URLs canónicas

- Web: `https://calendario.bmatrix.org`
- Fallback: `https://bmx-calendario.pages.dev`
- Desarrollo: `http://localhost:5173`
- `VITE_PUBLIC_APP_URL` en builds publicables: `https://calendario.bmatrix.org`

No usar `https://localhost`, `tauri.localhost` ni origins Capacitor como redirect de correo.

## Rotación

Seguir `OPERATIONS.md`. Tras rotar:

1. Actualizar el proveedor y GitHub Secrets.
2. Redeploy/release de los consumidores.
3. Revocar el valor anterior.
4. Verificar logs y funcionamiento.
5. Registrar evidencia sin copiar el secreto.
