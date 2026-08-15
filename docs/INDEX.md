# Índice de documentación

Fuente de entrada para humanos y agentes. Cada tema debe tener **un solo documento canónico**; los demás archivos enlazan a él en vez de copiarlo.

## Lectura obligatoria

1. [`AGENTS.md`](../AGENTS.md) — reglas de trabajo y matriz de lectura.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — arquitectura y flujos del producto.
3. [`PENDIENTES.md`](PENDIENTES.md) — estado operativo y próximos pasos.

## Según el cambio

| Si el cambio toca… | Leer y actualizar |
|---|---|
| Auth, roles, RLS, invites, secretos, inputs o CSP | [`SECURITY.md`](SECURITY.md) |
| Tablas, políticas, triggers o migraciones | [`DATABASE.md`](DATABASE.md) y `SECURITY.md` |
| Hosting, CI/CD, versiones o releases | [`DEPLOY.md`](DEPLOY.md) |
| Variables o secretos por entorno | [`ENV.md`](ENV.md) |
| Tests, criterios de aceptación o auditorías | [`TESTING.md`](TESTING.md) |
| Desarrollo local, Tauri o herramientas | [`DEVELOPMENT.md`](DEVELOPMENT.md) |
| Android/iOS, permisos, firma o notificaciones | [`MOBILE.md`](MOBILE.md) |
| Incidentes, rollback, rotación o recuperación | [`OPERATIONS.md`](OPERATIONS.md) |
| Comportamiento visible publicado | [`../CHANGELOG.md`](../CHANGELOG.md) |

## Reglas Cursor

- [`.cursor/rules/00-project-context.mdc`](../.cursor/rules/00-project-context.mdc) — entrada always-apply.
- [`.cursor/rules/01-quality-security-gate.mdc`](../.cursor/rules/01-quality-security-gate.mdc) — Definition of Done canónica.
- [`.cursor/rules/security-supabase.mdc`](../.cursor/rules/security-supabase.mdc) — reglas específicas para auth/Supabase.

## Responsabilidad documental

- `README.md`: onboarding breve; no contiene estado operativo detallado.
- `AGENTS.md`: cómo trabajar; no replica runbooks ni checklists.
- `ARCHITECTURE.md`: cómo está construido el producto.
- `SECURITY.md`: modelo de amenazas, controles y deuda de seguridad.
- `DEPLOY.md`: cómo se publica.
- `PENDIENTES.md`: única lista de trabajo operativo pendiente.

Al cerrar un cambio, actualizar la fuente canónica afectada y registrar la fecha solo cuando el estado operativo cambie.
