# Registro de Decisiones de Arquitectura (ADRs) — CoworkHub

---

## ADR-001: Uso de TypeScript estricto sobre Node.js 22
- **Estado:** Aceptado (Ciclo 1)
- **Contexto:** Se requiere desarrollar una API de reservas robusta, mantenible y con detección temprana de errores de contrato entre capas.
- **Decisión:** Utilizar TypeScript 5 con `"strict": true` sobre Node.js v22 LTS.
- **Consecuencias:** Tipado estático completo desde los DTOs de entrada hasta las respuestas de repositorio; requiere compilación o ejecución vía `tsx` / `vitest`.

---

## ADR-002: Persistencia con `node:sqlite` nativo en lugar de drivers C++ externos
- **Estado:** Aceptado (Ciclo 1)
- **Contexto:** Drivers tradicionales como `better-sqlite3` o `sqlite3` requieren compilación nativa (`node-gyp` / Visual Studio Build Tools) en entornos Windows, introduciendo fricción de instalación.
- **Decisión:** Emplear el módulo integrado `node:sqlite` (`DatabaseSync`) disponible en Node.js v22.23+.
- **Consecuencias:** Cero dependencias nativas de terceros, instalación instantánea, soporte para `:memory:` en Vitest y transacciones síncronas atómicas (`BEGIN IMMEDIATE`) que eliminan condiciones de carrera.

---

## ADR-003: Algoritmo de detección de solapamiento de intervalos semiabiertos
- **Estado:** Aceptado (Ciclo 1)
- **Contexto:** El sistema debe bloquear cualquier doble reserva y permitir reservas contiguas exactas (ej. `10:00-11:00` y `11:00-12:00`).
- **Decisión:** Modelar cada reserva como un intervalo semiabierto `[startTime, endTime)` normalizado a UTC ISO 8601 y evaluar intersección mediante `newStart < existingEnd AND newEnd > existingStart` únicamente sobre filas con `status = 'CONFIRMED'`.
- **Consecuencias:** Cubre matemáticamente los 5 casos de solapamiento en una sola consulta SQL indexada y permite reservas contiguas sin necesidad de márgenes artificiales.

---

## ADR-004: Flujo Git colaborativo con rotación de roles e identidades reales
- **Estado:** Aceptado (Ciclo 1)
- **Contexto:** La metodología del proyecto exige trazabilidad real de commits, Issues, PRs y revisiones cruzadas entre los 3 integrantes (**Estiven**, **Einar** y **Ahmed**).
- **Decisión:** Toda tarea se vincula a un Issue en GitHub, se desarrolla en una rama dedicada y requiere aprobación (`gh pr review --approve`) y merge por un integrante distinto al autor de la rama.
- **Consecuencias:** Historial auditable con contribuciones diferenciadas por ciclo y protección contra auto-aprobaciones sin revisión.

---

## ADR-005: Carga de `node:sqlite` vía `createRequire` y gestión de CR-01 en tabla dedicada
- **Estado:** Aceptado (Ciclos 1 y 3)
- **Contexto:** Vite 5 (usado internamente por Vitest 2.1) intenta resolver imports ESM estáticos `node:sqlite` eliminando el prefijo `node:`. Adicionalmente, el Change Request `CR-01` requirió introducir bloqueos administrativos de mantenimiento sin contaminar la semántica de reservas de usuarios.
- **Decisión:**
  1. Cargar `node:sqlite` en `src/db.ts` mediante `createRequire(import.meta.url)` preservando el tipado TypeScript estricto (`import type { DatabaseSync }`).
  2. Modelar los bloqueos de mantenimiento en una tabla separada `maintenance_blocks` validada dentro de la misma transacción `BEGIN IMMEDIATE` que crea reservas (`RB-08`), junto a la validación de ventana mínima de 120 minutos en cancelaciones (`RB-07`).
- **Consecuencias:** Cero conflictos con el runner de Vitest, separación limpia entre reservas de clientes y bloqueos operativos, y cero regresiones sobre la suite existente.
