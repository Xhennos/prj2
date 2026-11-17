# Bitácora de Desarrollo con IA — CoworkHub (`docs/ai-log.md`)

Este registro documenta cronológicamente el uso de asistencia con Inteligencia Artificial durante los **3 Ciclos** del proyecto **CoworkHub**, evidenciando el criterio técnico del equipo (**Estiven Quintero**, **Einar Delgado** y **Ahmed Alonso**) en cada fase.

---

## Ciclo 1: Fase ODD + Especificaciones Base (SDD) + Setup

### Entrada 1
- **Actividad:** Definición de Outcomes ODD y dolores de negocio (`specs/outcomes.md`)
- **IA Utilizada:** Gemini / Agente Antigravity
- **Solicitud (Prompt resumido):** Analizar el problema de reservas manuales en un espacio de coworking (salas de reuniones y cabinas) y redactar los outcomes de negocio, personas objetivo y KPIs medibles antes de diseñar código.
- **Resultado:** Generación de una matriz de fricciones operativas (doble reserva, demoras de confirmación, subutilización) junto con 4 outcomes y métricas objetivo (0% colisiones, respuesta < 50 ms).
- **Decisión del Equipo:** Estiven aceptó los outcomes base y ajustó manualmente los KPIs para enfocar la regla crítica en bloqueo estricto de solapamiento horario y trazabilidad en base de datos transaccional.

### Entrada 2
- **Actividad:** Transformación a Requerimientos, Reglas de Negocio y Criterios de Aceptación (`specs/requirements.md`, `specs/business-rules.md`, `specs/acceptance-criteria.md`)
- **IA Utilizada:** Gemini / Agente Antigravity
- **Solicitud (Prompt resumido):** Convertir los outcomes en requerimientos funcionales/no funcionales, reglas invariantes (`RB-01` a `RB-06`) y escenarios Given/When/Then verificables.
- **Resultado:** Borrador completo con reglas de horario operativo, duración, capacidad, validación temporal y fórmula matemática de intervalos semiabiertos `[start, end)`.
- **Decisión del Equipo:** El equipo acotó el horario operativo a `08:00-20:00 UTC` dentro del mismo día calendario (`RB-01`) y definió explícitamente que las reservas contiguas (`11:00` fin / `11:00` inicio) sí deben ser válidas en `RB-05`.

### Entrada 3
- **Actividad:** Diseño de Arquitectura, Modelo de Datos SQLite y Setup TypeScript (`specs/architecture.md`, `specs/data-model.md`, `specs/api.md`, `src/db.ts`)
- **IA Utilizada:** Gemini / Agente Antigravity
- **Solicitud (Prompt resumido):** Diseñar arquitectura en capas con TypeScript, SQLite nativo (`node:sqlite` en Node 22) y definir el contrato HTTP REST junto con los tipos iniciales.
- **Resultado:** Propuesta de arquitectura en 3 capas (`app -> service -> repository`), esquema SQLite con índice compuesto `idx_reservations_overlap` y archivo `package.json`.
- **Decisión del Equipo:** Einar aprobó `node:sqlite` para evitar compilaciones C++ en Windows (`ADR-002`) y ajustó `tsconfig.json` a `NodeNext` para compatibilidad uniforme entre `tsc` y `vitest`.

### Entrada 4
- **Actividad:** Configuración de Vitest, Smoke Test y Resolución de Compatibilidad `node:sqlite`
- **IA Utilizada:** Gemini / Agente Antigravity
- **Solicitud (Prompt resumido):** Configurar Vitest (`vitest.config.ts`), estrategia `docs/testing.md`, `docs/decisions.md` y validar el arranque de `node:sqlite` en pruebas.
- **Resultado:** Al ejecutar el primer smoke test, Vite SSR falló al intentar resolver el import ESM estático `node:sqlite`; la IA propuso cargarlo vía `createRequire(import.meta.url)` en `src/db.ts` manteniendo el tipado estricto.
- **Decisión del Equipo:** Ahmed validó la solución con `tsc --noEmit` y `npm test` (smoke test pasando en 20 ms) y la documentó formalmente como ajuste técnico para garantizar determinismo sin cambiar de motor SQLite.

---

## Ciclo 2: Desarrollo del Core MVP + Pruebas Automatizadas

### Entrada 5
- **Actividad:** Implementación del Repositorio Transaccional, Servicio de Dominio y API REST (`src/repository.ts`, `src/service.ts`, `src/app.ts`)
- **IA Utilizada:** Gemini / Agente Antigravity
- **Solicitud (Prompt resumido):** Implementar todas las reglas `RB-01` a `RB-06`, inyección de reloj determinista (`nowProvider`) y bloqueo transaccional anti-doble reserva en SQLite.
- **Resultado:** Código TypeScript modular con transacciones `BEGIN IMMEDIATE ... COMMIT` para evitar condiciones de carrera y mapeo uniforme de `DomainError` a códigos HTTP (`400`, `404`, `409`, `422`).
- **Decisión del Equipo:** Estiven incorporó validación estricta de formato ISO 8601 con zona horaria obligatoria en `parseIsoTimestamp` y verificó que reservas `CANCELLED` no bloqueen nuevas solicitudes.

### Entrada 6
- **Actividad:** Creación de la Suite Completa de Pruebas y Matriz Anti-Doble Reserva (`tests/*.test.ts`)
- **IA Utilizada:** Gemini / Agente Antigravity
- **Solicitud (Prompt resumido):** Generar pruebas unitarias, validaciones de entrada, reglas de negocio, pruebas E2E HTTP y una suite dedicada exclusivamente a demostrar que no se permiten dobles reservas.
- **Resultado:** Cinco archivos de prueba cubriendo los 5 casos de solapamiento (idéntico, inicio, fin, contenido, envolvente), reservas contiguas, multi-sala y ciclo HTTP completo (24 pruebas pasando).
- **Decisión del Equipo:** Einar revisó los relojes simulados en los tests de cancelación para asegurar fechas realistas (>= 2h de antelación) y ejecutó toda la suite con 0 fallos.

---

## Ciclo 3: Cambio Inesperado de Especificación (`change-request` CR-01)

### Entrada 7
- **Actividad:** Incorporación de Change Request CR-01 en Especificaciones e Implementación (`RB-07` y `RB-08`)
- **IA Utilizada:** Gemini / Agente Antigravity
- **Solicitud (Prompt resumido):** Simular un cambio de requerimiento a mitad del proyecto: exigir 2 horas mínimas de antelación para cancelar (`CANCELLATION_WINDOW_EXPIRED`) y permitir bloqueos administrativos de mantenimiento (`SPACE_UNDER_MAINTENANCE`).
- **Resultado:** Actualización trazable de `specs/` (`requirements.md`, `business-rules.md`, `acceptance-criteria.md`, `data-model.md`, `api.md`), nueva tabla `maintenance_blocks` y endpoints `POST/GET /api/maintenance`.
- **Decisión del Equipo:** Einar y Ahmed decidieron aislar los bloqueos administrativos en una tabla separada (`maintenance_blocks`) en lugar de crear reservas ficticias de usuario, manteniendo limpia la consulta de reservas de clientes (`ADR-005`).

### Entrada 8
- **Actividad:** Creación de Pruebas del Change Request (`tests/change-request.test.ts`) y Cierre Documental
- **IA Utilizada:** Gemini / Agente Antigravity
- **Solicitud (Prompt resumido):** Desarrollar pruebas automatizadas unitarias y HTTP E2E para validar `RB-07` y `RB-08`, actualizar `README.md` y consolidar la trazabilidad final.
- **Resultado:** Suite `tests/change-request.test.ts` validando ventana exacta de 120 minutos, rechazo a los 90 minutos y bloqueo/liberación por mantenimiento, elevando el total a 28 pruebas exitosas sin regresiones.
- **Decisión del Equipo:** Estiven ejecutó la verificación integral (`npm test`, `npm run build`, revisión de PRs y estado de Issues) confirmando el cumplimiento del 100% de la rúbrica ODD + SDD.
