# Contrato de API REST (SDD) — CoworkHub

Todas las respuestas utilizan `Content-Type: application/json; charset=utf-8` y marcas de tiempo en formato ISO 8601 UTC.

---

## 1. Endpoints de Espacios

### `GET /api/spaces`
Lista todos los espacios registrados.
- **Respuesta `200 OK`:**
```json
{
  "spaces": [
    {
      "id": "uuid",
      "name": "Sala Innovación",
      "type": "MEETING_ROOM",
      "capacity": 8,
      "isActive": true,
      "createdAt": "2026-12-01T08:00:00.000Z"
    }
  ]
}
```

### `POST /api/spaces`
Registra un nuevo espacio en el coworking.
- **Body:**
```json
{
  "name": "Sala Innovación",
  "type": "MEETING_ROOM",
  "capacity": 8,
  "isActive": true
}
```
- **Respuesta `201 Created`:** Objeto `Space` creado.
- **Errores:** `400 VALIDATION_ERROR`, `409 SPACE_ALREADY_EXISTS`.

---

## 2. Endpoints de Reservas

### `GET /api/reservations`
Lista reservas con filtros opcionales por query params: `?spaceId=...&userId=...&status=CONFIRMED&date=2026-12-01`.
- **Respuesta `200 OK`:** `{ "reservations": [ ... ] }`

### `GET /api/spaces/:id/availability?date=YYYY-MM-DD`
Consulta los bloques ocupados (`CONFIRMED`) de un espacio en una fecha específica.
- **Respuesta `200 OK`:**
```json
{
  "spaceId": "uuid",
  "date": "2026-12-01",
  "bookedSlots": [
    { "reservationId": "uuid", "startTime": "2026-12-01T10:00:00.000Z", "endTime": "2026-12-01T12:00:00.000Z" }
  ]
}
```

### `POST /api/reservations`
Crea una nueva reserva aplicando todas las validaciones (`RB-01` a `RB-06`).
- **Body:**
```json
{
  "spaceId": "uuid",
  "userId": "usr-01",
  "userEmail": "estiven@coworkhub.io",
  "title": "Sprint Planning",
  "attendeesCount": 5,
  "startTime": "2026-12-01T10:00:00.000Z",
  "endTime": "2026-12-01T12:00:00.000Z"
}
```
- **Respuesta `201 Created`:** Objeto `Reservation` con `status: "CONFIRMED"`.

### `PATCH /api/reservations/:id/cancel`
Cancela una reserva confirmada existente cumpliendo la antelación mínima de **2 horas** (`RB-07` - agregado por `CR-01`).
- **Respuesta `200 OK`:** Objeto `Reservation` actualizado con `status: "CANCELLED"` y `cancelledAt`.
- **Errores adicionales (`CR-01`):** `422 CANCELLATION_WINDOW_EXPIRED` si faltan menos de 120 minutos para `startTime`.

---

## 3. Endpoints de Mantenimiento *(CR-01 - Ciclo 3)*

### `POST /api/maintenance`
Registra un bloqueo administrativo de mantenimiento sobre un espacio (`RB-08`).
- **Body:**
```json
{
  "spaceId": "uuid",
  "startTime": "2026-12-01T13:00:00.000Z",
  "endTime": "2026-12-01T15:00:00.000Z",
  "reason": "Mantenimiento eléctrico y limpieza profunda"
}
```
- **Respuesta `201 Created`:** Objeto `MaintenanceBlock` creado.

### `GET /api/maintenance`
Lista los bloqueos de mantenimiento registrados, filtrable por `?spaceId=...`.
- **Respuesta `200 OK`:** `{ "maintenanceBlocks": [ ... ] }`

---

## 4. Catálogo de Códigos de Error

| HTTP Status | Código (`error.code`) | Cuándo ocurre |
| :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR` | Campos faltantes, email inválido, fechas sin formato ISO 8601 válido o `endTime <= startTime` |
| `404` | `SPACE_NOT_FOUND` | El `spaceId` indicado no existe |
| `404` | `RESERVATION_NOT_FOUND` | El `reservationId` a cancelar no existe |
| `409` | `SPACE_ALREADY_EXISTS` | Ya existe un espacio con ese nombre |
| `409` | `DOUBLE_BOOKING_CONFLICT` | El horario solicitado se solapa con una reserva `CONFIRMED` en el mismo espacio |
| `409` | `SPACE_UNDER_MAINTENANCE` | El horario solicitado se solapa con un bloqueo administrativo de mantenimiento (`CR-01`) |
| `422` | `PAST_RESERVATION_NOT_ALLOWED` | La fecha de inicio es anterior o igual al reloj actual |
| `422` | `OUTSIDE_OPERATING_HOURS` | El intervalo cae fuera de `08:00Z - 20:00Z` o cruza días |
| `422` | `INVALID_DURATION` | Duración menor a 30 min o mayor a 480 min |
| `422` | `CAPACITY_EXCEEDED` | `attendeesCount` supera la capacidad del espacio |
| `422` | `SPACE_INACTIVE` | El espacio está deshabilitado (`isActive = false`) |
| `422` | `RESERVATION_ALREADY_CANCELLED` | La reserva ya había sido cancelada previamente |
| `422` | `CANCELLATION_WINDOW_EXPIRED` | Se intentó cancelar con menos de 2 horas de antelación respecto a `startTime` (`CR-01`) |
