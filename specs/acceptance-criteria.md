# Criterios de Aceptación (SDD) — CoworkHub

Todos los criterios están definidos en formato **Given / When / Then** para ser automatizados directamente en la suite de pruebas (`tests/acceptance-criteria.test.ts`).

---

## AC-01: Creación exitosa de una reserva válida
- **Dado** un espacio activo `"Sala Innovación"` con capacidad para 8 personas,
- **Y** sin reservas previas en la fecha `2026-12-01` entre `10:00Z` y `12:00Z`,
- **Cuando** un usuario solicita reservar la sala de `2026-12-01T10:00:00.000Z` a `2026-12-01T12:00:00.000Z` para 5 asistentes,
- **Entonces** el sistema crea la reserva con estado `CONFIRMED`, asigna un `id` único y retorna HTTP `201`.

## AC-02: Bloqueo estricto de doble reserva (solapamiento horario)
- **Dado** una reserva `CONFIRMED` en `"Sala Innovación"` de `10:00Z` a `12:00Z` el `2026-12-01`,
- **Cuando** otro usuario intenta reservar `"Sala Innovación"` en cualquier horario solapado (ej. `10:00-12:00`, `11:00-13:00`, `09:00-11:00`, `10:30-11:30` o `09:00-14:00`),
- **Entonces** el sistema rechaza la solicitud con código de error `DOUBLE_BOOKING_CONFLICT` (HTTP `409`) y no persiste la segunda reserva.

## AC-03: Permiso de reservas contiguas y en distintos espacios
- **Dado** una reserva `CONFIRMED` en `"Sala Innovación"` de `10:00Z` a `11:00Z`,
- **Cuando** un usuario reserva `"Sala Innovación"` de `11:00Z` a `12:00Z` (contigua),
- **O** otro usuario reserva `"Sala Pacífico"` de `10:00Z` a `11:00Z` (mismo horario, distinto espacio),
- **Entonces** ambas reservas son aceptadas y confirmadas con HTTP `201`.

## AC-04: Validación de capacidad máxima y horario operativo
- **Dado** una cabina `"Phone Booth 1"` con capacidad para 1 persona,
- **Cuando** un usuario intenta reservarla para 2 asistentes,
- **O** intenta reservarla fuera del horario de `08:00Z` a `20:00Z` (ej. `07:00Z-08:30Z` o `19:30Z-21:00Z`),
- **O** intenta reservarla por menos de 30 minutos (ej. 15 min),
- **Entonces** el sistema rechaza la operación con HTTP `422` (`CAPACITY_EXCEEDED`, `OUTSIDE_OPERATING_HOURS` o `INVALID_DURATION`).

## AC-05: Rechazo de fechas pasadas, formatos inválidos y espacios inexistentes
- **Dado** una fecha actual simulada de `2026-12-01T09:00:00.000Z`,
- **Cuando** se intenta reservar en el pasado (`2026-11-30T10:00:00.000Z`), con formato de fecha inválido, o para un `spaceId` inexistente,
- **Entonces** el sistema rechaza la petición con el error correspondiente (`422 PAST_RESERVATION_NOT_ALLOWED`, `400 VALIDATION_ERROR` o `404 SPACE_NOT_FOUND`).

## AC-06: Cancelación de reserva y liberación del horario
- **Dado** una reserva `CONFIRMED` de `14:00Z` a `16:00Z` en `"Sala Innovación"`,
- **Cuando** el usuario cancela dicha reserva,
- **Entonces** su estado pasa a `CANCELLED` (HTTP `200`),
- **Y** otro usuario puede reservar inmediatamente `"Sala Innovación"` de `14:00Z` a `16:00Z` con éxito.
