# Base de datos y migraciones

Supabase Postgres es la fuente de verdad en modo cloud. La autorización real reside en RLS, constraints y triggers; el cliente no es una frontera de seguridad.

## Tablas

| Tabla | Propósito | Aislamiento |
|---|---|---|
| `profiles` | perfil y rol | fila propia; rol protegido |
| `calendars` | calendarios | `user_id = auth.uid()` |
| `events` | eventos, recordatorios y tareas | usuario propietario + calendario propio |
| `event_exceptions` | cancelaciones/overrides recurrentes | evento perteneciente al usuario |
| `task_runs` | historial de tareas | tarea perteneciente al usuario |
| `work_week_settings` | jornada y no molestar | una fila por usuario; calendario laboral propio |

## Migraciones vigentes

1. `001_initial.sql` — esquema inicial, RLS y Realtime.
2. `002_security_hardening.sql` — ownership de calendarios/eventos.
3. `003_event_kinds.sql` — kinds, estados e historial de tareas.
4. `004_task_runs_hardening.sql` — RLS de ejecuciones.
5. `005_admin_invites.sql` — roles y admin seed.
6. `006_rls_hardening.sql` — policies y checks adicionales.
7. `007_work_week_settings.sql` — semana laboral sincronizada.

## Reglas para nuevas migraciones

- Crear un archivo numerado nuevo; no reescribir una migración ya aplicada.
- Hacer cambios compatibles hacia adelante cuando sea posible: agregar antes de eliminar.
- Incluir RLS, constraints, índices y ownership en la misma entrega.
- Toda tabla multiusuario debe habilitar RLS antes de recibir datos.
- Toda FK usada para autorización debe validar pertenencia, no solo existencia.
- Los cambios destructivos requieren backup, plan de migración de datos y rollback.
- Documentar impacto en `SECURITY.md`, `ARCHITECTURE.md` y `CHANGELOG.md`.

## Validación mínima

Antes de producción, en un proyecto de staging o base efímera:

1. Aplicar todas las migraciones desde cero y en orden.
2. Probar dos usuarios distintos.
3. Confirmar CRUD propio.
4. Confirmar que no se puede leer, escribir ni referenciar IDs ajenos.
5. Probar cascadas, triggers, constraints y Realtime.
6. Ejecutar tests Edge/RLS cuando estén disponibles.

## Deploy

Hasta incorporar `supabase/config.toml` y CI de staging, el deploy es manual y debe seguir `OPERATIONS.md`.

Nunca ejecutar cambios destructivos improvisados en producción ni usar `service_role` para “resolver” fallos RLS del cliente.

## Rollback

Postgres no revierte automáticamente una migración aplicada:

- Cambios aditivos: desactivar el uso en cliente y publicar una migración correctiva.
- Cambio de policy: restaurar la policy anterior mediante una migración nueva.
- Cambio destructivo: restaurar backup o ejecutar el runbook aprobado.

Registrar migración aplicada, fecha, proyecto y resultado sin incluir credenciales.
