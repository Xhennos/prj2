import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/db.js";
import { SQLiteRepository } from "../src/repository.js";
import { CoworkReservationService } from "../src/service.js";

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

const activeServers: TestServer[] = [];

async function startTestServer(fixedIsoNow = "2026-12-01T07:00:00.000Z"): Promise<TestServer> {
  const db = createDatabase(":memory:");
  const repo = new SQLiteRepository(db);
  const service = new CoworkReservationService(repo, () => new Date(fixedIsoNow));
  const server = createApp(service);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  const ctx: TestServer = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          db.close();
          if (err) reject(err);
          else resolve();
        });
      })
  };
  activeServers.push(ctx);
  return ctx;
}

afterEach(async () => {
  while (activeServers.length > 0) {
    const srv = activeServers.pop()!;
    await srv.close();
  }
});

describe("Criterios de Aceptación E2E vía HTTP API (AC-01 a AC-06)", () => {
  it("AC-01 & AC-02 & AC-03: flujo completo de creación, rechazo de doble reserva y reservas contiguas", async () => {
    const { baseUrl } = await startTestServer();

    // Crear dos espacios
    const resSpaceA = await fetch(`${baseUrl}/api/spaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sala Innovación", type: "MEETING_ROOM", capacity: 8 })
    });
    expect(resSpaceA.status).toBe(201);
    const spaceA = (await resSpaceA.json()) as { id: string };

    const resSpaceB = await fetch(`${baseUrl}/api/spaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sala Pacífico", type: "MEETING_ROOM", capacity: 6 })
    });
    expect(resSpaceB.status).toBe(201);
    const spaceB = (await resSpaceB.json()) as { id: string };

    // AC-01: Crear reserva válida 10:00-12:00
    const resCreate1 = await fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId: spaceA.id,
        userId: "estiven",
        userEmail: "estiven@coworkhub.io",
        title: "Diseño SDD",
        attendeesCount: 5,
        startTime: "2026-12-01T10:00:00.000Z",
        endTime: "2026-12-01T12:00:00.000Z"
      })
    });
    expect(resCreate1.status).toBe(201);

    // AC-02: Intento de doble reserva en 11:00-13:00 -> 409 DOUBLE_BOOKING_CONFLICT
    const resOverlap = await fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId: spaceA.id,
        userId: "ahmed",
        userEmail: "ahmed@coworkhub.io",
        title: "Colisión",
        attendeesCount: 2,
        startTime: "2026-12-01T11:00:00.000Z",
        endTime: "2026-12-01T13:00:00.000Z"
      })
    });
    expect(resOverlap.status).toBe(409);
    const overlapBody = (await resOverlap.json()) as { error: { code: string } };
    expect(overlapBody.error.code).toBe("DOUBLE_BOOKING_CONFLICT");

    // AC-03: Reserva contigua en Sala A (12:00-13:00) y mismo horario en Sala B (10:00-12:00)
    const resContiguous = await fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId: spaceA.id,
        userId: "einar",
        userEmail: "einar@coworkhub.io",
        title: "Contigua",
        attendeesCount: 3,
        startTime: "2026-12-01T12:00:00.000Z",
        endTime: "2026-12-01T13:00:00.000Z"
      })
    });
    expect(resContiguous.status).toBe(201);

    const resOtherRoom = await fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId: spaceB.id,
        userId: "ahmed",
        userEmail: "ahmed@coworkhub.io",
        title: "En Sala Pacífico",
        attendeesCount: 4,
        startTime: "2026-12-01T10:00:00.000Z",
        endTime: "2026-12-01T12:00:00.000Z"
      })
    });
    expect(resOtherRoom.status).toBe(201);
  });

  it("AC-04 & AC-05: valida capacidad, horario, fechas pasadas y espacio inexistente vía HTTP", async () => {
    const { baseUrl } = await startTestServer("2026-12-01T09:00:00.000Z");

    const resBooth = await fetch(`${baseUrl}/api/spaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Phone Booth 1", type: "PHONE_BOOTH", capacity: 1 })
    });
    const booth = (await resBooth.json()) as { id: string };

    const resCap = await fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId: booth.id,
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Exceso",
        attendeesCount: 2,
        startTime: "2026-12-01T10:00:00.000Z",
        endTime: "2026-12-01T11:00:00.000Z"
      })
    });
    expect(resCap.status).toBe(422);

    const resPast = await fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId: booth.id,
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Pasada",
        attendeesCount: 1,
        startTime: "2026-11-30T10:00:00.000Z",
        endTime: "2026-11-30T11:00:00.000Z"
      })
    });
    expect(resPast.status).toBe(422);

    const resNotFound = await fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId: "inexistente",
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Missing",
        attendeesCount: 1,
        startTime: "2026-12-01T10:00:00.000Z",
        endTime: "2026-12-01T11:00:00.000Z"
      })
    });
    expect(resNotFound.status).toBe(404);
  });

  it("AC-06: cancela reserva por PATCH y libera el bloque para reservar nuevamente", async () => {
    const { baseUrl } = await startTestServer("2026-12-01T07:00:00.000Z");

    const resSpace = await fetch(`${baseUrl}/api/spaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sala Cancela", type: "MEETING_ROOM", capacity: 4 })
    });
    const space = (await resSpace.json()) as { id: string };

    const resCreated = await fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId: space.id,
        userId: "estiven",
        userEmail: "estiven@coworkhub.io",
        title: "Original",
        attendeesCount: 2,
        startTime: "2026-12-01T14:00:00.000Z",
        endTime: "2026-12-01T16:00:00.000Z"
      })
    });
    const created = (await resCreated.json()) as { id: string };

    const resCancel = await fetch(`${baseUrl}/api/reservations/${created.id}/cancel`, {
      method: "PATCH"
    });
    expect(resCancel.status).toBe(200);
    const cancelled = (await resCancel.json()) as { status: string };
    expect(cancelled.status).toBe("CANCELLED");

    const resAvail = await fetch(`${baseUrl}/api/spaces/${space.id}/availability?date=2026-12-01`);
    expect(resAvail.status).toBe(200);
    const avail = (await resAvail.json()) as { bookedSlots: unknown[] };
    expect(avail.bookedSlots).toHaveLength(0);

    const resRebook = await fetch(`${baseUrl}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId: space.id,
        userId: "einar",
        userEmail: "einar@coworkhub.io",
        title: "Re-reserva",
        attendeesCount: 3,
        startTime: "2026-12-01T14:00:00.000Z",
        endTime: "2026-12-01T16:00:00.000Z"
      })
    });
    expect(resRebook.status).toBe(201);
  });
});
