# Outcomes de Negocio (ODD) — CoworkHub

## 1. Propósito (¿Qué valor queremos conseguir para el usuario?)
Antes de definir pantallas, tablas o código, **CoworkHub** parte del resultado que el usuario necesita: **garantizar que cualquier miembro o equipo de un espacio de coworking pueda encontrar y asegurar una sala o escritorio disponible en segundos, con la certeza absoluta de que nadie más habrá reservado ese mismo espacio a la misma hora.**

---

## 2. Problema Real del Negocio y Dolores Actuales
En las sedes de coworking que aún coordinan salas de reuniones, cabinas de llamadas y escritorios dedicados mediante mensajes de WhatsApp, hojas de cálculo compartidas o recepción manual, ocurren cuatro fricciones críticas:

1. **Colisiones de horario (Doble Reserva):** Dos equipos llegan a la misma sala de juntas a las 10:00 AM porque la recepción anotó una reserva en papel mientras otro miembro confirmó por chat.
2. **Pérdida de tiempo operativo:** Confirmar disponibilidad de una sala toma entre 10 y 25 minutos esperando respuesta humana fuera de horario o en horas pico.
3. **Subutilización de capacidad:** Salas para 10 personas terminan bloqueadas por reuniones de 2 personas sin control de capacidad o duración máxima.
4. **Falta de trazabilidad y métricas:** No existe un historial auditable de reservas confirmadas, cancelaciones o uso real por espacio.

---

## 3. Usuarios Objetivo (Personas)
- **Miembro / Freelancer:** Necesita reservar cabinas o escritorios rápidos para videollamadas o bloques de enfoque sin esperar confirmación manual.
- **Líder de Equipo / Empresa:** Necesita reservar salas de reuniones con capacidad específica (4 a 20 personas) para sesiones planificadas.
- **Administrador de Sede:** Necesita registrar espacios disponibles, consultar ocupación y asegurar que las reglas operativas del coworking se cumplan automáticamente.

---

## 4. Outcomes Esperados y Métricas de Éxito (KPIs)

| Outcome (Resultado Esperado) | Indicador / Métrica de Éxito (KPI) | Meta |
| :--- | :--- | :--- |
| **Cero colisiones de salas** | Porcentaje de reservas confirmadas con solapamiento horario sobre el mismo espacio | **0%** (Bloqueo estricto garantizado por sistema) |
| **Autoservicio inmediato** | Tiempo necesario para validar disponibilidad y confirmar una reserva | **< 30 segundos** (respuesta API < 50 ms) |
| **Uso eficiente del espacio** | Cumplimiento automático de límites de capacidad, horario operativo y duración | **100%** de validaciones aplicadas antes de persistir |
| **Trazabilidad operativa** | Porcentaje de reservas y cancelaciones registradas con timestamp y estado auditable | **100%** persistido en base de datos transaccional |
