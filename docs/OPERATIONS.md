# Operaciones y runbooks

## Principios

- Producción solo se publica con CI verde.
- Cambios de datos/auth se prueban primero fuera de producción.
- Toda publicación debe tener versión, evidencia y estrategia de rollback.
- No copiar secretos en tickets, chats, logs ni documentación.
- `docs/PENDIENTES.md` es la única lista de tareas abiertas.

## Deploy web

1. Confirmar `npm run check:versions`, lint, tests, build y audit productivo.
2. Merge/push autorizado a `main`.
3. CI debe finalizar correctamente.
4. El workflow Cloudflare se ejecuta únicamente después del CI exitoso.
5. Verificar `https://calendario.bmatrix.org` y fallback.
6. Smoke: login, calendario, Organizador, CRUD y logout.

Rollback: volver a desplegar el último commit conocido como sano. No hacer force-push a `main`.

## Release desktop

1. Alinear versiones con `npm run check:versions`.
2. Actualizar `CHANGELOG.md`.
3. Confirmar CI verde en el commit.
4. Ejecutar Actions → `Release desktop` con la versión exacta.
5. Verificar `.exe`, `.msi`, firmas y `latest.json`.
6. Probar instalación/actualización en una PC no crítica.

Si falla el updater, retirar la release defectuosa y publicar una versión superior corregida; no reemplazar silenciosamente artefactos firmados.

## Edge Function `invite-user`

```bash
npx supabase functions deploy invite-user --project-ref hznvsuobulrxxpofebkq
```

Después:

1. Probar invite en incógnito.
2. Verificar redirect a `calendario.bmatrix.org`.
3. Probar email nuevo, usuario existente y no-admin.
4. Confirmar que hosts no permitidos y `https://localhost` sean rechazados.
5. Actualizar `PENDIENTES.md` con evidencia.

## Migraciones Supabase

1. Revisar `DATABASE.md` y `SECURITY.md`.
2. Backup antes de cambios destructivos.
3. Aplicar primero en staging/efímero.
4. Ejecutar pruebas de aislamiento con dos usuarios.
5. Aplicar en producción en orden.
6. Verificar tablas, policies, triggers, Realtime y logs.

## Rotación de secretos

1. Identificar consumidores.
2. Crear el secreto nuevo.
3. Actualizar GitHub/proveedor.
4. Redeploy/release.
5. Verificar.
6. Revocar el anterior.
7. Revisar logs por uso indebido.

No registrar el valor, solo nombre, fecha, responsable y evidencia.

## Incidentes

1. Contener: pausar deploys, revocar credenciales o desactivar función afectada.
2. Preservar evidencia: commits, logs, timestamps y alcance; nunca datos personales innecesarios.
3. Evaluar impacto en usuarios y datos.
4. Corregir mediante PR/commit auditable.
5. Recuperar y verificar.
6. Documentar causa raíz, controles fallidos y acciones preventivas.

## Rate limit de emails

`email rate limit exceeded` suele ser cooldown de Supabase free:

- No repetir invites.
- Esperar 30–60 minutos.
- Verificar una sola vez en incógnito.
- Si persiste, revisar logs y límites del proyecto.

## Evidencia mínima

- Commit/tag.
- URL del workflow/release.
- Resultado de smoke/manual.
- Migración o función desplegada.
- Riesgos o tareas remanentes en `PENDIENTES.md`.
