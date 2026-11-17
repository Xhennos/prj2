import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/db.js";
import { SQLiteRepository } from "../src/repository.js";
import { CoworkReservationService } from "../src/service.js";
import { DomainError } from "../src/types.js";

function setupMutableClock(initialIso: string) {
  let currentNow = new Date(initialIso);
  const db = createDatabase(":memory:");
  const repo = new SQLiteRepository(db);
  const service = new CoworkReservationService(repo, () => currentNow);

  return {
    db,
    service,
    setNow: (iso: string) => {
      currentNow = new Date(iso);
    }
  };
}

const openServers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (openServers.length > 0) {
    await openServers.pop()!();
  }
});

describe("Change Request CR-01 (Ciclo 3): Cancelación 2h y Bloqueos por Mantenimiento", () => {
  it("RB-07 / AC-07: permite cancelar cuando faltan exactamente 2 horas (>= 120 min)", () => {
    const { db, service, setNow } = setupMutableClock("2026-12-01T08:00:00.000Z");
    const sala = service.createSpace({ name: "Sala CR-01", type: "MEETING_ROOM", capacity: 6 });

    const reservation = service.createReservation({
      spaceId: sala.id,
      userId: "einar",
      userEmail: "einar@coworkhub.io",
      title: "Sesión de Diseño",
      attendeesCount: 4,
      startTime: "2026-12-01T14:00:00.000Z",
      endTime: "2026-12-01T15:00:00.000Z"
    });

    // Avanzamos el reloj exactamente a las 12:00Z (faltan 120 minutos exactos)
    setNow("2026-12-01T12:00:00.000Z");
    const cancelled = service.cancelReservation(reservation.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).toBe("2026-12-01T12:00:00.000Z");
    db.close();
  });

  it("RB-07 / AC-07: rechaza cancelar con menos de 2 horas de antelación (CANCELLATION_WINDOW_EXPIRED)", () => {
    const { db, service, setNow } = setupMutableClock("2026-12-01T08:00:00.000Z");
    const sala = service.createSpace({ name: "Sala Política 2h", type: "MEETING_ROOM", capacity: 6 });

    const reservation = service.createReservation({
      spaceId: sala.id,
      userId: "ahmed",
      userEmail: "ahmed@coworkhub.io",
      title: "Revisión Técnica",
      attendeesCount: 3,
      startTime: "2026-12-01T14:00:00.000Z",
      endTime: "2026-12-01T16:00:00.000Z"
    });

    // Avanzamos el reloj a las 12:30Z (faltan 90 minutos < 120 minutos)
    setNow("2026-12-01T12:30:00.000Z");

    let captured: DomainError | null = null;
    try {
      service.cancelReservation(reservation.id);
    } catch (err) {
      captured = err as DomainError;
    }

    expect(captured).toBeInstanceOf(DomainError);
    expect(captured?.code).toBe("CANCELLATION_WINDOW_EXPIRED");
    expect(captured?.statusCode).toBe(422);

    // La reserva debe seguir CONFIRMED
    const persisted = service.listReservations({ spaceId: sala.id });
    expect(persisted[0].status).toBe("CONFIRMED");
    db.close();
  });

  it("RB-08 / AC-08: bloquea nuevas reservas solapadas con mantenimiento y permite fuera de la ventana", () => {
    const { db, service } = setupMutableClock("2026-12-01T07:00:00.000Z");
    const salaA = service.createSpace({ name: "Sala Mantenimiento A", type: "MEETING_ROOM", capacity: 8 });
    const salaB = service.createSpace({ name: "Sala Disponible B", type: "MEETING_ROOM", capacity: 8 });

    const block = service.createMaintenanceBlock({
      spaceId: salaA.id,
      startTime: "2026-12-01T13:00:00.000Z",
      endTime: "2026-12-01T15:00:00.000Z",
      reason: "Mantenimiento de aire acondicionado"
    });
    expect(block.spaceId).toBe(salaA.id);
    expect(service.listMaintenanceBlocks(salaA.id)).toHaveLength(1);

    // Intento solapado en Sala A (14:00-16:00) -> 409 SPACE_UNDER_MAINTENANCE
    let captured: DomainError | null = null;
    try {
      service.createReservation({
        spaceId: salaA.id,
        userId: "estiven",
        userEmail: "estiven@coworkhub.io",
        title: "Reserva bloqueada",
        attendeesCount: 4,
        startTime: "2026-12-01T14:00:00.000Z",
        endTime: "2026-12-01T16:00:00.000Z"
      });
    } catch (err) {
      captured = err as DomainError;
    }
    expect(captured).toBeInstanceOf(DomainError);
    expect(captured?.code).toBe("SPACE_UNDER_MAINTENANCE");
    expect(captured?.statusCode).toBe(409);

    // Reserva contigua fuera del mantenimiento (15:00-16:30) -> Permitida
    const afterMaint = service.createReservation({
      spaceId: salaA.id,
      userId: "estiven",
      userEmail: "estiven@coworkhub.io",
      title: "Después de mantenimiento",
      attendeesCount: 4,
      startTime: "2026-12-01T15:00:00.000Z",
      endTime: "2026-12-01T16:30:00.000Z"
    });
    expect(afterMaint.status).toBe("CONFIRMED");

    // Reserva en Sala B durante el horario de mantenimiento de Sala A -> Permitida
    const otherSpace = service.createReservation({
      spaceId: salaB.id,
      userId: "ahmed",
      userEmail: "ahmed@coworkhub.io",
      title: "En otra sala",
      attendeesCount: 4,
      startTime: "2026-12-01T13:00:00.000Z",
      endTime: "2026-12-01T15:00:00.000Z"
    });
    expect(otherSpace.status).toBe("CONFIRMED");
    db.close();
  });

  it("E2E HTTP: valida POST/GET /api/maintenance y rechazo de cancelación < 2h vía PATCH", async () => {
    let currentNow = new Date("2026-12-01T08:00:00.000Z");
    const db = createDatabase(":memory:");
    const repo = new SQLiteRepository(db);
    const service = new CoworkReservationService(repo, () => currentNow);
    const server = createApp(service);

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    openServers.push(
      () =>
        new Promise<void>((resolve, reject) =>
          server.close((err) => {
            db.close();
            if (err) reject(err);
            else resolve();
          })
        )
    );
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    const spaceRes = await fetch(`${baseUrl}/api/spaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Auditorio Central", type: "AUDITORIUM", capacity: 25 })
    });
    const space = (await spaceRes.json()) as { id: string };

    // Crear bloqueo de mantenimiento vía HTTP
    const maintRes = await fetch(`${baseUrl}/api/maintenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId: space.id,
        startTime: "2026-12-01T10:00:00.000Z",
        endTime: "2026-12-01T12:00:00.000Z",
        reason: "Actualización de proyector"
      })
    });
    expect(maintRes.status).toBe(201);

    const listMaintRes = await fetch(`${baseUrl}/api/maintenance?spaceId=${space.id}`);
    expect(listMaintRes.status).toBe(200);
    const listMaintBody = (await listMaintRes.json()) as { maintenanceBlocks: unknown[] };
    expect(listMaintBody.maintenanceBlocks).toHaveLength(1);

    // Intentar reservar durante mantenimiento -> 409 SPACE_UNDER_MAINTENANCE
    const blockedRes = await fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId: space.id,
        userId: "einar",
        userEmail: "einar@coworkhub.io",
        title: "Keynote",
        attendeesCount: 15,
        startTime: "2026-12-01T11:00:00.000Z",
        endTime: "2026-12-01T12:30:00.000Z"
      })
    });
    expect(blockedRes.status).toBe(409);
    const blockedBody = (await blockedRes.json()) as { error: { code: string } };
    expect(blockedBody.error.code).toBe("SPACE_UNDER_MAINTENANCE");

    // Crear reserva válida de 14:00Z a 15:00Z
    const okRes = await fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId: space.id,
        userId: "einar",
        userEmail: "einar@coworkhub.io",
        title: "Keynote Tarde",
        attendeesCount: 15,
        startTime: "2026-12-01T14:00:00.000Z",
        endTime: "2026-12-01T15:00:00.000Z"
      })
    });
    expect(okRes.status).toBe(201);
    const created = (await okRes.json()) as { id: string };

    // Avanzar reloj a las 13:15Z (45 min antes) -> PATCH cancel debe fallar con 422
    currentNow = new Date("2026-12-01T13:15:00.000Z");
    const lateCancelRes = await fetch(`${baseUrl}/api/reservations/${created.id}/cancel`, {
      method: "PATCH"
    });
    expect(lateCancelRes.status).toBe(422);
    const lateBody = (await lateCancelRes.json()) as { error: { code: string } };
    expect(lateBody.error.code).toBe("CANCELLATION_WINDOW_EXPIRED");
  });
});
