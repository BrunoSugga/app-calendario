# Contribuir

## Antes de cambiar código

1. Leer `AGENTS.md` y `docs/INDEX.md`.
2. Revisar `docs/PENDIENTES.md`.
3. Definir objetivo, alcance, criterios de aceptación y riesgo.
4. No trabajar directamente sobre producción ni compartir secretos.

## Desarrollo

- Crear cambios pequeños y revisables.
- Mantener una sola responsabilidad por commit cuando sea posible.
- Añadir tests junto con el comportamiento.
- No editar migraciones ya aplicadas.
- Actualizar la documentación canónica indicada por `docs/INDEX.md`.

## Definition of Done

Cumplir `.cursor/rules/01-quality-security-gate.mdc` y `docs/TESTING.md`.

## Commits y publicación

- No crear commits, push, tags o releases sin autorización explícita del usuario/responsable.
- No force-push a `main`.
- No omitir hooks ni checks para “hacer pasar” una entrega.
- Publicar siguiendo `docs/OPERATIONS.md`.

## Seguridad

- Reportar vulnerabilidades de forma privada al responsable.
- No explotar producción ni acceder a datos ajenos.
- Un pentest requiere autorización y alcance escrito.
- Ante exposición de secretos, detener publicación y seguir el runbook de rotación.
