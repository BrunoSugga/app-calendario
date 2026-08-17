# Changelog

Cambios visibles y operativos por versión. Formato basado en Keep a Changelog.

## [Unreleased]

## [1.2.3] — 2026-08-17

### Added

- Repetición mensual por día del mes, conservando el modo mensual por días de semana.
- Los días 29, 30 y 31 se ajustan al último día disponible en los meses más cortos.

## [1.2.2] — 2026-08-15

### Added

- Versión de la aplicación visible en el menú de ajustes, obtenida de `package.json`.
- Aviso de nuevas versiones de escritorio mientras la app Tauri permanece abierta,
  mediante chequeos periódicos y al recuperar foco.

### Changed

- Profesionalización del flujo documental, gates de CI/CD y runbooks.
- Deploy web condicionado a CI verde; releases desktop con gate completo.
- Android CI, CodeQL, Dependabot, CODEOWNERS y validación multiplataforma de versiones.
- `happy-dom` actualizado a 20.11.2 y `nanoid` corregido en tooling.

### Fixed

- Los recordatorios aplazados vuelven a mostrar el popup cuando vence el snooze.

## [1.2.1] — 2026-08-15

### Added

- Organizador cronológico con búsqueda, filtros, historial y acciones de edición/eliminación.
- Fecha opcional de finalización para series recurrentes.

### Changed

- Botones Organizador/Hoy con tamaño y estado visual consistentes.
- Release desktop firmada y web publicada.

## [1.2.0] — 2026-08-15

### Added

- Scaffold Capacitor Android/iOS.
- Notificaciones locales Android.
- Allowlist de redirects Auth en cliente y Edge Function.

## [1.1.5]

### Fixed

- El catch-up de avisos no avanza `lastScan` antes de cargar eventos.

## [1.1.4]

### Added

- Catch-up de avisos al reabrir.

## [1.1.3]

### Fixed

- Build de release y límites DoS para importación de respaldos.

## [1.1.2]

### Added

- Preferencias de calendario por dispositivo y gestión de calendarios.

## [1.1.1]

### Added

- Semana laboral y avisos diferidos fuera de jornada.
