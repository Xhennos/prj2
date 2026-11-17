# Reglas de Negocio (SDD) — CoworkHub

Las siguientes reglas gobiernan todas las operaciones del dominio en `CoworkHub` y deben cumplirse de forma estricta e invariante en la capa de servicio.

---

## Catálogo de Reglas Base (Ciclo 1)

### RB-01: Horario Operativo del Coworking
- El coworking opera únicamente entre las **08:00 y las 20:00 UTC** del mismo día calendario.
- Tanto `startTime` como `endTime` deben pertenecer a la misma fecha UTC (`YYYY-MM-DD`), con hora de inicio `>= 08:00:00Z` y hora de finalización `<= 20:00:00Z`.
- **Error asociado:** `OUTSIDE_OPERATING_HOURS` (HTTP `422`).

### RB-02: Duración Mínima y Máxima de Reserva
- Toda reserva debe tener una duración mínima de **30 minutos** y una duración máxima de **480 minutos (8 horas)**.
- **Error asociado:** `INVALID_DURATION` (HTTP `422`).

### RB-03: Capacidad del Espacio
- El campo `attendeesCount` debe ser un entero mayor o igual a **1** y menor o igual a la capacidad configurada del espacio (`space.capacity`).
- **Error asociado:** `CAPACITY_EXCEEDED` (HTTP `422`) o `VALIDATION_ERROR` (HTTP `400`) si `attendeesCount < 1`.

### RB-04: Validación Temporal y Consistencia de Intervalo
- El formato de `startTime` y `endTime` debe ser un timestamp ISO 8601 válido con zona horaria explícita (ej. `2026-12-01T10:00:00.000Z`).
- No se permiten reservas en el pasado (`startTime <= currentTime`).
- La hora de finalización debe ser estrictamente posterior a la hora de inicio (`endTime > startTime`).
- **Error asociado:** `PAST_RESERVATION_NOT_ALLOWED` (HTTP `422`) o `VALIDATION_ERROR` (HTTP `400`).

### RB-05: No Doble Reserva / Anti-Solapamiento
- Dos reservas activas (`status = 'CONFIRMED'`) sobre un mismo `spaceId` **no pueden solaparse** en el tiempo.
- Dos intervalos semiabiertos `[startA, endA)` y `[startB, endB)` se solapan si y solo si:
  $$
  \text{newStart} < \text{existingEnd} \quad \land \quad \text{newEnd} > \text{existingStart}
  $$
- **Reservas contiguas:** Si una reserva termina exactamente a las `11:00:00Z` y la siguiente inicia a las `11:00:00Z`, **no hay solapamiento** (`11:00 < 11:00` es falso) y ambas son válidas.
- **Reservas canceladas:** Una reserva en estado `CANCELLED` **no bloquea** el horario.
- **Error asociado:** `DOUBLE_BOOKING_CONFLICT` (HTTP `409`).

### RB-06: Existencia y Disponibilidad Activa del Espacio
- Solo se pueden crear reservas sobre un `spaceId` existente cuyo atributo `isActive` sea `true`.
- **Error asociado:** `SPACE_NOT_FOUND` (HTTP `404`) si no existe, o `SPACE_INACTIVE` (HTTP `422`) si está deshabilitado.
