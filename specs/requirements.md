# Especificación de Requerimientos (SDD) — CoworkHub

Este documento traduce los outcomes definidos en `specs/outcomes.md` en requerimientos verificables para el sistema de reservas de espacios de coworking y salas de reuniones.

---

## 1. Requerimientos Funcionales (RF)

### RF-01: Gestión de Espacios de Coworking y Salas
- El sistema debe permitir registrar nuevos espacios de trabajo (`MEETING_ROOM`, `PHONE_BOOTH`, `DEDICATED_DESK`, `AUDITORIUM`) con un nombre, tipo, capacidad máxima de asistentes y estado activo/inactivo.
- El sistema debe permitir consultar el catálogo de espacios disponibles junto con su capacidad y estado.

### RF-02: Registro de Reservas con Validación Horaria y de Capacidad
- El sistema debe permitir crear una reserva asociando un espacio (`spaceId`), nombre o identificador del solicitante (`userId`, `userEmail`), propósito/título, número de asistentes (`attendeesCount`) e intervalo horario ISO 8601 (`startTime`, `endTime`).
- Antes de confirmar la reserva, el sistema debe validar todas las reglas de negocio aplicables (`RB-01` a `RB-06`).
- Toda reserva creada exitosamente inicia en estado `CONFIRMED` y recibe un identificador único y fecha de creación.

### RF-03: Prevención Estricta de Solapamiento de Horarios (No Doble Reserva)
- El sistema debe impedir que dos reservas en estado `CONFIRMED` ocupen el mismo `spaceId` en intervalos de tiempo que se solapen parcial o totalmente.
- Ante un intento de doble reserva, el sistema debe rechazar la operación con un error de conflicto explícito (`DOUBLE_BOOKING_CONFLICT`) sin alterar el estado de la reserva existente.

### RF-04: Consulta de Disponibilidad y Reservas por Espacio / Fecha
- El sistema debe permitir listar reservas filtrando opcionalmente por `spaceId`, `userId`, `status` o fecha (`YYYY-MM-DD`).
- El sistema debe permitir consultar la disponibilidad de un espacio específico para un rango horario o fecha dada, indicando si está libre o qué reservas están ocupándolo.

### RF-05: Cancelación de Reservas
- El sistema debe permitir cancelar una reserva existente en estado `CONFIRMED` cambiando su estado a `CANCELLED` y registrando la marca temporal de cancelación.
- Al cancelarse una reserva, el intervalo horario correspondiente debe quedar liberado inmediatamente para nuevas reservas de otros usuarios.

---

## 2. Requerimientos No Funcionales (RNF)

### RNF-01: Integridad Transaccional y Persistencia
- Los datos de espacios y reservas deben persistirse en una base de datos relacional SQLite (`node:sqlite`) aplicando restricciones de claves foráneas y validación transaccional para evitar condiciones de carrera.

### RNF-02: Rendimiento y Latencia
- Las operaciones de creación y consulta de reservas deben responder en menos de **50 ms** bajo carga local estándar utilizando índices sobre `(space_id, start_time, end_time)`.

### RNF-03: Tipado Estricto y Modularidad
- Todo el código fuente debe estar escrito en TypeScript (`strict: true`), separando claramente las capas de entrada HTTP/controlador, lógica de negocio (`Service`) y persistencia (`Repository`).

### RNF-04: Verificabilidad Automatizada
- Todas las reglas de negocio y criterios de aceptación deben estar respaldados por una suite automatizada en Vitest ejecutable con un único comando (`npm test`) y 100% determinista (sin depender del reloj real del sistema gracias a inyección de tiempo).
