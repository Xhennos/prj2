# Estrategia de Pruebas — CoworkHub

Este documento define la estrategia de aseguramiento de calidad (QA) para validar que todas las especificaciones en `specs/` se cumplan de forma determinista y automatizada con **Vitest**.

---

## 1. Pirámide y Niveles de Prueba

| Nivel | Archivo en `tests/` | Alcance |
| :--- | :--- | :--- |
| **Humo / Entorno** | `tests/smoke.test.ts` | Verifica que Vitest, TypeScript y `node:sqlite` inicialicen el esquema correctamente |
| **Unitarias de Dominio** | `tests/unit.business-logic.test.ts` | Creación de espacios, creación de reservas válidas, consultas filtradas y cancelaciones |
| **Validación de Entradas** | `tests/validation.test.ts` | Fechas pasadas, formatos ISO inválidos, `endTime <= startTime`, campos faltantes, recursos inexistentes |
| **Reglas Críticas de Negocio** | `tests/business-rules.test.ts` | Horario operativo (`08:00Z-20:00Z`), duración (`30-480 min`), capacidad máxima, espacios inactivos |
| **Anti-Doble Reserva (Obligatorio)** | `tests/no-double-booking.test.ts` | Matriz completa de solapamientos horarios sobre el mismo espacio |
| **Criterios de Aceptación E2E** | `tests/acceptance-criteria.test.ts` | Escenarios Given/When/Then ejecutados a través del servidor HTTP REST real (`src/app.ts`) |

---

## 2. Matriz de Casos de Prueba Anti-Solapamiento (`RB-05`)

Dado un bloque existente confirmado `[10:00, 12:00)` en `Sala Innovación`:

| Caso | Intervalo Solicitado | ¿Solapa? | Resultado Esperado |
| :--- | :--- | :---: | :--- |
| Idéntico | `[10:00, 12:00)` | Sí | Rechazo `409 DOUBLE_BOOKING_CONFLICT` |
| Solapamiento al inicio | `[09:00, 11:00)` | Sí | Rechazo `409 DOUBLE_BOOKING_CONFLICT` |
| Solapamiento al final | `[11:00, 13:00)` | Sí | Rechazo `409 DOUBLE_BOOKING_CONFLICT` |
| Contenido dentro | `[10:30, 11:30)` | Sí | Rechazo `409 DOUBLE_BOOKING_CONFLICT` |
| Envolvente total | `[09:00, 14:00)` | Sí | Rechazo `409 DOUBLE_BOOKING_CONFLICT` |
| Contiguo anterior | `[08:00, 10:00)` | No | Aceptado `201 Created` |
| Contiguo posterior | `[12:00, 14:00)` | No | Aceptado `201 Created` |
| Mismo horario, otra sala | `[10:00, 12:00)` en `Sala B` | No | Aceptado `201 Created` |
| Tras cancelación previa | `[10:00, 12:00)` después de cancelar | No | Aceptado `201 Created` |

---

## 3. Determinismo en Pruebas Temporales
Para evitar pruebas inestables (*flaky tests*) dependientes de la fecha de ejecución, la clase `CoworkReservationService` acepta un parámetro `nowProvider: () => Date`. Todas las pruebas inyectan un reloj fijo (ej. `2026-12-01T07:00:00.000Z`).
