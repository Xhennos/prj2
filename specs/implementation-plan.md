# Plan de Implementación por Ciclos (SDD) — CoworkHub

Este documento coordina las entregas en **3 ciclos iterativos** con rotación estricta de roles entre **Estiven**, **Einar** y **Ahmed**.

---

## Ciclo 1: Fase ODD + Especificaciones Base (SDD) + Setup
| Rol | Integrante | Entregables |
| :--- | :--- | :--- |
| **Product / Spec Lead** | Estiven | `specs/outcomes.md`, `specs/requirements.md`, `specs/business-rules.md`, `specs/acceptance-criteria.md` |
| **Architecture / Dev Lead** | Einar | `specs/architecture.md`, `specs/data-model.md`, `specs/api.md`, `specs/implementation-plan.md`, setup TypeScript (`package.json`, `tsconfig.json`, `src/types.ts`, `src/db.ts`) |
| **QA / DevOps Lead** | Ahmed | `vitest.config.ts`, smoke test inicial, `docs/testing.md`, `docs/decisions.md` |

---

## Ciclo 2: Desarrollo del Core MVP + Pruebas Automatizadas
| Rol | Integrante | Entregables |
| :--- | :--- | :--- |
| **Product / Spec Lead** | Ahmed | Revisión de alineación entre specs y apertura de Issues funcionales y de QA |
| **Architecture / Dev Lead** | Estiven | Implementación completa en `src/`: `repository.ts`, `service.ts`, `app.ts`, `index.ts` |
| **QA / DevOps Lead** | Einar | Suite completa en `tests/`: unitarias, validaciones, reglas de negocio, aceptación y prueba obligatoria de no doble reserva (`tests/no-double-booking.test.ts`) |

---

## Ciclo 3: Cambio Inesperado de Especificación (`change-request`)
| Rol | Integrante | Entregables |
| :--- | :--- | :--- |
| **Product / Spec Lead** | Einar | Issue `change-request`, actualización trazable de `specs/` (`RB-07`, `RB-08`, `AC-07`, `AC-08`) |
| **Architecture / Dev Lead** | Ahmed | Actualización de `specs/data-model.md`, `specs/api.md` e implementación del cambio en `src/` sin regresiones |
| **QA / DevOps Lead** | Estiven | Nuevas pruebas en `tests/change-request.test.ts`, actualización de `docs/testing.md`, `docs/decisions.md`, `README.md` y bitácora completa `docs/ai-log.md` |
