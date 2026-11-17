# CoworkHub — Sistema de Reservas de Espacios de Coworking y Salas de Reuniones (Proyecto #2)

Sistema backend REST y motor de reglas de negocio construido en **TypeScript + Node.js 22 + SQLite (`node:sqlite`)** aplicando las metodologías **ODD (Outcome-Driven Development)** y **SDD (Spec-Driven Development)** con flujo colaborativo real en GitHub.

---

## 1. Problema y Enfoque ODD (Outcome-Driven Development)

En espacios de coworking que coordinan salas de reuniones y cabinas mediante mensajes manuales o planillas compartidas, los principales dolores son:
- **Colisiones de horario (doble reserva)** sobre una misma sala.
- **Demoras operativas** al confirmar disponibilidad manualmente.
- **Incumplimiento de capacidad máxima** o reservas fuera de horario.

**CoworkHub** resuelve estos problemas orientándose a outcomes medibles (`specs/outcomes.md`):
- **0% de colisiones** garantizado mediante validación transaccional atómica en SQLite (`BEGIN IMMEDIATE`).
- **Validación determinista** de horario operativo (`08:00-20:00 UTC`), duración (`30-480 min`), capacidad y fechas pasadas.
- **Adaptación controlada a cambios (`CR-01`)**: política de cancelación con antelación mínima de 2 horas y bloqueos administrativos por mantenimiento.

---

## 2. Equipo y Rotación de Roles por Ciclo

| Ciclo | Product / Spec Lead | Architecture / Dev Lead | QA / DevOps Lead |
| :--- | :--- | :--- | :--- |
| **Ciclo 1: ODD + SDD Base + Setup** | **Estiven Quintero** (`Xhennos`) | **Einar Delgado** (`EinarDelgado`) | **Ahmed Alonso** (`ahmedalonsoi`) |
| **Ciclo 2: Core MVP + Suite QA** | **Ahmed Alonso** (`ahmedalonsoi`) | **Estiven Quintero** (`Xhennos`) | **Einar Delgado** (`EinarDelgado`) |
| **Ciclo 3: Change Request (`CR-01`)** | **Einar Delgado** (`EinarDelgado`) | **Ahmed Alonso** (`ahmedalonsoi`) | **Estiven Quintero** (`Xhennos`) |

---

## 3. Estructura del Proyecto

```text
├── README.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── specs/
│   ├── outcomes.md
│   ├── requirements.md
│   ├── business-rules.md
│   ├── architecture.md
│   ├── data-model.md
│   ├── api.md
│   ├── acceptance-criteria.md
│   └── implementation-plan.md
├── docs/
│   ├── ai-log.md
│   ├── decisions.md
│   └── testing.md
├── src/
│   ├── types.ts
│   ├── db.ts
│   ├── repository.ts
│   ├── service.ts
│   ├── app.ts
│   └── index.ts
└── tests/
    ├── smoke.test.ts
    ├── unit.business-logic.test.ts
    ├── validation.test.ts
    ├── business-rules.test.ts
    ├── no-double-booking.test.ts
    ├── acceptance-criteria.test.ts
    └── change-request.test.ts
```

---

## 4. Instalación y Ejecución

### Requisitos previos
- **Node.js** `v22.23+` (utiliza el módulo nativo `node:sqlite`).
- **npm** `10+`.

### Instalación
```bash
npm install
```

### Compilar TypeScript
```bash
npm run build
```

### Ejecutar el servidor API REST
```bash
npm run dev
# O tras compilar:
npm start
```
Variables de entorno opcionales:
- `PORT` (por defecto `3000`)
- `DB_PATH` (por defecto `coworkhub.db`)

---

## 5. Ejecución de Pruebas Automatizadas

Ejecutar toda la suite de **Vitest**:
```bash
npm test
```

La suite valida:
- Lógica de negocio unitaria (`tests/unit.business-logic.test.ts`).
- Validaciones de entrada y fechas pasadas (`tests/validation.test.ts`).
- Reglas de negocio `RB-01` a `RB-06` (`tests/business-rules.test.ts`).
- **Prueba obligatoria anti-doble reserva** (`tests/no-double-booking.test.ts`).
- Criterios de aceptación E2E vía HTTP (`tests/acceptance-criteria.test.ts`).
- **Change Request `CR-01`**: cancelación >= 2h y bloqueos por mantenimiento (`tests/change-request.test.ts`).

---

## 6. Resumen de Endpoints de la API

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/health` | Estado del servicio |
| `GET` | `/api/spaces` | Lista los espacios de coworking |
| `POST` | `/api/spaces` | Registra un nuevo espacio |
| `GET` | `/api/spaces/:id/availability?date=YYYY-MM-DD` | Bloques ocupados por fecha |
| `GET` | `/api/reservations` | Lista reservas con filtros opcionales |
| `POST` | `/api/reservations` | Crea una reserva validando reglas y anti-solapamiento |
| `PATCH` | `/api/reservations/:id/cancel` | Cancela una reserva (`>= 2h` de antelación) |
| `GET` | `/api/maintenance` | Lista bloqueos de mantenimiento |
| `POST` | `/api/maintenance` | Registra un bloqueo administrativo por mantenimiento |
