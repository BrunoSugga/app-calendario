## Objetivo

<!-- Qué problema resuelve y por qué. -->

## Cambios

<!-- Lista breve de cambios funcionales/técnicos. -->

## Riesgo y seguridad

- [ ] Evalué auth, RLS, datos, inputs, red, secretos, deploy y Tauri/Capacitor.
- [ ] No incorporé secretos ni `service_role` al cliente.
- [ ] Documenté migración, compatibilidad y rollback si aplica.

## Verificación

- [ ] `npm run check:versions`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev`
- [ ] Revisé y registré los hallazgos del audit completo.
- [ ] Agregué/actualicé tests para el comportamiento.
- [ ] Realicé controles manuales proporcionales.

## Documentación y operación

- [ ] Actualicé la fuente canónica indicada por `docs/INDEX.md`.
- [ ] Actualicé `CHANGELOG.md` si el cambio es visible.
- [ ] Registré pendientes reales en `docs/PENDIENTES.md`.
- [ ] Definí smoke test y rollback para publicación.

## Evidencia

<!-- Comandos, capturas, URLs de checks o notas de prueba. -->
