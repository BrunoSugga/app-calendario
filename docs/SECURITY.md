# Seguridad — plan e implementación

Documento vivo. Actualizar cuando cambie auth, RLS, invites o políticas.

## Principios

1. El frontend **nunca** lleva `service_role` ni secretos de admin.
2. La autorización real está en **Postgres RLS** (+ constraints).
3. Operaciones privilegiadas van en **Edge Functions** (Deno) con `service_role` solo en el runtime de Supabase.
4. Signup público desactivado; altas solo por invitación de admin.
5. Modo local no es modelo de seguridad multi-usuario.

---

## A. Admin + altas solo por invitación (propuesta recomendada)

### Por qué esta vía (mejor que “crear cuenta a medias” a mano)

Usar el flujo nativo de Supabase **Invite user**:

1. Admin (vos) introduce un email en una UI de administración.
2. El front llama a una Edge Function `invite-user` con el JWT del admin.
3. La función verifica `profiles.role = 'admin'`, luego usa `service_role` → `auth.admin.inviteUserByEmail`.
4. El compañero recibe un mail con link.
5. Al abrir el link, la app detecta el hash/recovery de invite y muestra **“Creá tu contraseña”** (mín. 8 + letra y número; ver sección C).
6. Tras `updateUser({ password })`, la cuenta queda operativa (el trigger ya creó perfil + calendario).

Ventajas vs inventar tokens propios: menos código, mails y expiración los maneja Supabase, PKCE se mantiene.

### Modelo de roles

Migración nueva (ej. `005_admin_invites.sql`):

- `profiles.role text not null default 'member' check (role in ('admin', 'member'))`
- Seed: marcar tu usuario como `admin` (por email o UUID que indiques).
- RLS: cada usuario sigue viendo solo sus filas; el rol **no** da acceso a calendarios ajenos.
- Solo admin puede invocar la Edge Function de invite (chequeo server-side).

### Cambios de producto

- Cloud: quitar “Crear cuenta” del `LoginPage`.
- Añadir pantalla/ruta admin: “Invitar usuario” (solo si `role === 'admin'`).
- Añadir `SetPasswordPage` para invite / recovery.
- Supabase Dashboard: **Authentication → Providers → Email → Disable sign ups** (o equivalente “confirm + disable public signup”).

### Alternativa descartada (salvo que pidas lo contrario)

Tabla `invites` + magic link custom + Edge Function que crea el user. Más mantenimiento; mismo resultado que invite nativo.

---

## B. Hardening RLS / integridad (debilidades actuales → plan)

### Estado hoy

- RLS habilitado en `profiles`, `calendars`, `events`, `event_exceptions`, `task_runs`.
- `002` endurece insert/update de events/exceptions (calendar/event deben ser del mismo `auth.uid()`).
- `004` endurece update/delete de `task_runs`.

### Huecos a cerrar (migración `006_rls_hardening.sql` o similar)

| Hueco | Mejora |
|-------|--------|
| Updates pueden cambiar `user_id` si la policy no lo bloquea con `WITH CHECK` estricto | En **todas** las policies `UPDATE`: `using (auth.uid() = user_id)` + `with check (auth.uid() = user_id)` y, donde aplique, EXISTS al padre (calendar/event) |
| Límites solo en cliente (`security.ts`) | `CHECK` en DB: longitudes de `title`/`description`/`name`/`rrule`/`task_note`, `reminder_minutes` entre 0 y 10080, `color ~ '^#[0-9A-Fa-f]{6}$'` |
| `profiles.role` mutable por el propio usuario | Policy update de profiles: **no** permitir cambiar `role` (solo `display_name`); role solo vía SQL/service_role |
| Grants amplios | Revisar `GRANT`/`REVOKE`; API solo con roles `authenticated`/`anon` según necesidad |
| Realtime | Confirmar que las policies SELECT bastan para no filtrar filas ajenas (ya deberían) |

No hace falta “más RLS” en el sentido de compartir calendarios entre usuarios: el modelo sigue siendo **1 usuario = sus datos**. El admin solo gestiona **cuentas**, no lee agendas ajenas.

---

## C. Auth PKCE + contraseña mínima 8 (implementar)

### Ya existe

- Cliente Supabase con `flowType: 'pkce'` (`src/lib/supabase.ts`).
- `assertCloudPassword`: largo 8–128 (`src/lib/security.ts`).
- UI login/registro con `minLength={8}`.

### Plan de cierre (implementar en el mismo epic de auth)

1. Mantener PKCE; no volver a implicit.
2. Unificar validación: login, set-password, invite y “olvidé mi contraseña” usan `assertCloudPassword`.
3. Política acordada:
   - mínimo **8**, máximo 128;
   - al menos **una letra y un número**;
   - rechazar contraseñas solo whitespace.
4. `SetPasswordPage` para invite y recovery; enlace **Olvidé mi contraseña** en login (`resetPasswordForEmail`).
5. Tests en `security.test.ts` + flujo UI.
6. Alinear política en Supabase Dashboard (mínimo de contraseña) con el cliente.

---

## D. Sanitización (`security.ts`) — mejoras

| Área | Acción |
|------|--------|
| Paridad DB | Mismos límites que CHECKs de la migración de hardening |
| Contraseña | Extender `assertCloudPassword` (letra + número, mín. 8) |
| XSS | Seguir sin `dangerouslySetInnerHTML`; textos siempre como texto React |
| CSP | Mantener `applyWebCsp`; en Cloudflare añadir headers HTTP equivalentes (`docs/DEPLOY.md`) más fuertes que solo `<meta>` |
| IDs / tokens | Seguir `isSafeId` / `isSafeReminderToken` en recordatorios Tauri |
| Admin invite | Validar email con `isValidEmail` antes de llamar a la Edge Function |

---

## E. `service_role` fuera del cliente (aclaración + plan)

**No es una debilidad tenerlo fuera del cliente: es lo correcto.**

Lo que hay que “resolver” es cómo hacer invites de admin **sin** exponer esa clave:

```
[Admin UI] --JWT anon/authenticated--> [Edge Function invite-user]
                                              |
                                              | verifica role=admin
                                              v
                                    service_role (solo en función)
                                              |
                                              v
                                    auth.admin.inviteUserByEmail
```

Checklist:

- [ ] Secretos solo en Supabase secrets / CI (nunca `VITE_*`).
- [ ] Edge Function con CORS acotado al origen de Cloudflare (y localhost en dev).
- [ ] Rate limit / anti-abuso básico en la función (p. ej. límite de invites por admin/día).
- [ ] Logs sin imprimir service_role ni tokens.

---

## Decisiones cerradas (2026-08-08)

| Tema | Decisión |
|------|----------|
| Admin seed | UUID `bfd18782-7bea-4386-bd8f-de050f398aec` (`005_admin_invites.sql`) |
| Dominio de invites | Cualquier email válido (el control es solo-admin) |
| Contraseña | Mín. 8 + al menos una letra y un número; flujo **Olvidé mi contraseña** obligatorio |
| GitHub Pages | Apagado (`deploy-pages.yml` disabled); Cloudflare Pages activo |
| Cloudflare Access | **Después** del primer deploy útil (ver `docs/DEPLOY.md`) |
| Hosting web | Cloudflare Pages → `calendario.bmatrix.org` |

### Cómo obtener tu UUID de admin en Supabase

No hace falta adivinarlo: está en el dashboard.

1. Entrá a [https://supabase.com/dashboard](https://supabase.com/dashboard) y abrí el proyecto del calendario.
2. Menú izquierdo → **Authentication** → **Users**.
3. Buscá tu usuario por email.
4. Abrí la fila: el campo **User UID** (formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) es el UUID.
5. Alternativa SQL (SQL Editor):

```sql
select id, email, created_at
from auth.users
order by created_at;
```

Pasame ese **UUID** (o el email exacto de la fila) y lo usamos en el seed `profiles.role = 'admin'`.

**Seed aplicado:** `bfd18782-7bea-4386-bd8f-de050f398aec`.

Si todavía no tenés usuario creado en ese proyecto: registrate una vez (mientras el signup siga abierto), anotá el UUID, y en la migración de invites desactivamos el signup público.

### Contraseña + “Olvidé mi contraseña”

- `assertCloudPassword`: largo 8–128, al menos una letra y un dígito, sin solo espacios.
- UI: enlace **Olvidé mi contraseña** → `supabase.auth.resetPasswordForEmail` → redirect a `SetPasswordPage`.
- Misma pantalla sirve para invite (primer acceso) y para recovery.

### Restricción de dominio (actualizado)

No se limita el dominio del correo. Solo el **admin** puede invitar; Gmail, Camposur u otros correos válidos están permitidos.

---

## F. Estado de implementación (2026-08-08)

1. [x] Migración roles + seed admin + protect role — `005_admin_invites.sql`
2. [x] Edge Function `invite-user` + UI admin + quitar signup cloud
3. [x] `SetPasswordPage` + “Olvidé mi contraseña” + letra+número
4. [x] Migración hardening RLS + CHECKs — `006_rls_hardening.sql`
5. [x] Cloudflare Pages workflow + `_headers`/`_redirects`; GitHub Pages disabled
6. [ ] Operación manual: correr migraciones 005/006 en Supabase, deploy function, secrets CF, custom domain, disable public signup

## Criterios de aceptación

- Un usuario anónimo no puede registrarse (signup cloud deshabilitado en UI + Dashboard).
- Solo admin puede invitar; el invite crea el user y manda mail.
- El invitado define contraseña en el primer acceso y entra.
- Un member no puede leer/escribir filas de otro `user_id` (probar con dos cuentas).
- Bundle web no contiene `service_role`.
- `npm test` y `npm run lint` OK.