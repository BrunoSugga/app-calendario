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

## Relación con Informes

Misma cuenta Cloudflare / dominio `bmatrix.org`. Informes usa túnel Zero Trust; el calendario usa **Pages** (sin proceso local).

## Checklist

- [x] Proyecto Pages `bmx-calendario` + deploy Action OK
- [x] Secrets Cloudflare en GitHub
- [x] Redirect URLs en Supabase (pages.dev + calendario + localhost)
- [x] `calendario.bmatrix.org` **Active** en Cloudflare
- [x] Site URL Supabase = `https://calendario.bmatrix.org` (confirmar en dashboard si un invite falla)
- [x] Invite + set-password probado (navegador OK; escritorio desde v1.0.8+)
- [x] Código **v1.2.1** en `main` (Organizador + fin de recurrencias + Capacitor)
- [ ] Redeploy Edge Function `invite-user` (allowlist en el servidor)
- [ ] APK debug en dispositivo (Android Studio en casa)
- [ ] Invite de prueba desde la APK → mail a `calendario.bmatrix.org`
- [ ] APK release firmada (keystore fuera del repo)
- [x] Release desktop 1.2.1
- [ ] (Opcional) Cloudflare Access después
- [ ] Rotar tokens si se pegaron en chats antiguos

## Desktop

- Publicar: Actions → **Release desktop** con la versión alineada a `package.json` / `tauri.conf.json` / `Cargo.toml`.
- La app instalada (1.0.1+) pregunta al abrir si hay release más nueva (`latest.json` del updater).
- **v1.2.1** = Organizador cronológico, edición/eliminación desde la lista, fecha final de recurrencias y ajustes visuales del selector Organizador/Hoy.
- **v1.2.0** = scaffold Capacitor Android/iOS + allowlist Auth + avisos locales nativos. APK no publicada.
- **v1.1.5** = fix catch-up al reabrir (no avanzar `lastScan` antes de cargar eventos).
- **v1.1.4** = catch-up de avisos al reabrir (popup ≤15 días; modal resumen si más antiguos).
- **v1.1.3** = topes DoS en import de respaldos JSON + fix build release (tipos en tests).
- **v1.1.2** = prefs de calendario por dispositivo, gestionar calendarios (respaldo/mover), CTA descarga PC en web.
- **v1.1.1** = desktop con Semana laboral (avisos laborales diferidos fuera de jornada).

## Deuda / notas

- No poner `service_role` ni tokens en el repo.
- Rotar tokens de Supabase/Cloudflare si se pegaron en el chat.
- Access (Zero Trust) solo después de que invite/recovery funcionen de forma estable.
- Avisos en web: popup (`?reminder=1`); permitir emergentes. Detalle: `docs/ARCHITECTURE.md`.
- Rate limit email Supabase free: no spamear invites.

## Android (APK sideload)

Misma web empaquetada con Capacitor (`android/`). Código en `main`; **falta** abrir el proyecto en Android Studio y generar/probar la APK. iOS: carpeta `ios/` como esqueleto (Mac + cuenta Apple para IPA).

En la PC de casa (con Android Studio):

```bash
git pull
npm install
npm run cap:sync
npx cap open android
# o: npx cap run android
```

Release firmada (keystore **fuera del repo**):

1. `keytool -genkeypair -v -keystore bmatrix-calendario.keystore -alias bmatrix -keyalg RSA -keysize 2048 -validity 10000`
2. En `android/keystore.properties` (gitignored): `storeFile`, `storePassword`, `keyAlias`, `keyPassword`.
3. `npm run android:apk` → `android/app/build/outputs/apk/release/app-release.apk`
4. En el teléfono: permitir instalar apps de orígenes desconocidos.

Invites desde la APK usan `VITE_PUBLIC_APP_URL` / `https://calendario.bmatrix.org`, nunca `https://localhost`. Redeploy de `invite-user` si el proyecto aún aceptaba cualquier `https:`.

Si los avisos no disparan con la app cerrada: desactivar optimización de batería para BMatrix Calendario (OEM Xiaomi/Huawei, etc.). Tras un reboot, abrir la app una vez para reprogramar alarmas.