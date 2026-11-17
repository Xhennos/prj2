import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/db.js";
import { SQLiteRepository } from "../src/repository.js";
import { CoworkReservationService } from "../src/service.js";
import { DomainError } from "../src/types.js";

function setupService(fixedIsoNow = "2026-12-01T06:00:00.000Z") {
  const db = createDatabase(":memory:");
  const repo = new SQLiteRepository(db);
  const service = new CoworkReservationService(repo, () => new Date(fixedIsoNow));
  return { db, service };
}

function captureError(fn: () => unknown): DomainError {
  try {
    fn();
  } catch (err) {
    if (err instanceof DomainError) {
      return err;
    }
    throw err;
  }
  throw new Error("Se esperaba un DomainError.");
}

describe("Reglas Críticas de Negocio (RB-01, RB-02, RB-03, RB-06)", () => {
  it("RB-01: rechaza reservas fuera del horario operativo (08:00 a 20:00 UTC) o que cruzan días", () => {
    const { db, service } = setupService();
    const space = service.createSpace({ name: "Sala A", type: "MEETING_ROOM", capacity: 6 });

    const tooEarly = captureError(() =>
      service.createReservation({
        spaceId: space.id,
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Madrugada",
        attendeesCount: 2,
        startTime: "2026-12-01T07:30:00.000Z",
        endTime: "2026-12-01T08:30:00.000Z"
      })
    );
    expect(tooEarly.code).toBe("OUTSIDE_OPERATING_HOURS");
    expect(tooEarly.statusCode).toBe(422);

    const tooLate = captureError(() =>
      service.createReservation({
        spaceId: space.id,
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Noche",
        attendeesCount: 2,
        startTime: "2026-12-01T19:00:00.000Z",
        endTime: "2026-12-01T20:30:00.000Z"
      })
    );
    expect(tooLate.code).toBe("OUTSIDE_OPERATING_HOURS");

    // Borde exacto permitido: 08:00Z a 20:00Z no porque excede 8h, pero 08:00Z a 16:00Z sí
    const valid = service.createReservation({
      spaceId: space.id,
      userId: "u1",
      userEmail: "u1@coworkhub.io",
      title: "Jornada completa",
      attendeesCount: 2,
      startTime: "2026-12-01T08:00:00.000Z",
      endTime: "2026-12-01T16:00:00.000Z"
    });
    expect(valid.status).toBe("CONFIRMED");
    db.close();
  });

  it("RB-02: rechaza reservas menores a 30 minutos o mayores a 480 minutos (8 horas)", () => {
    const { db, service } = setupService();
    const space = service.createSpace({ name: "Sala B", type: "MEETING_ROOM", capacity: 6 });

    const tooShort = captureError(() =>
      service.createReservation({
        spaceId: space.id,
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Daily corta",
        attendeesCount: 2,
        startTime: "2026-12-01T10:00:00.000Z",
        endTime: "2026-12-01T10:20:00.000Z"
      })
    );
    expect(tooShort.code).toBe("INVALID_DURATION");
    expect(tooShort.statusCode).toBe(422);

    const tooLong = captureError(() =>
      service.createReservation({
        spaceId: space.id,
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Workshop muy largo",
        attendeesCount: 2,
        startTime: "2026-12-01T09:00:00.000Z",
        endTime: "2026-12-01T18:00:00.000Z"
      })
    );
    expect(tooLong.code).toBe("INVALID_DURATION");
    db.close();
  });

  it("RB-03: rechaza reservas que superan la capacidad máxima del espacio", () => {
    const { db, service } = setupService();
    const booth = service.createSpace({ name: "Phone Booth 1", type: "PHONE_BOOTH", capacity: 1 });

    const err = captureError(() =>
      service.createReservation({
        spaceId: booth.id,
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Llamada grupal",
        attendeesCount: 2,
        startTime: "2026-12-01T10:00:00.000Z",
        endTime: "2026-12-01T10:30:00.000Z"
      })
    );
    expect(err.code).toBe("CAPACITY_EXCEEDED");
    expect(err.statusCode).toBe(422);
    db.close();
  });

  it("RB-06: rechaza reservas en espacios marcados como inactivos", () => {
    const { db, service } = setupService();
    const inactive = service.createSpace({
      name: "Sala Remodelación",
      type: "AUDITORIUM",
      capacity: 30,
      isActive: false
    });

    const err = captureError(() =>
      service.createReservation({
        spaceId: inactive.id,
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Charla",
        attendeesCount: 10,
        startTime: "2026-12-01T10:00:00.000Z",
        endTime: "2026-12-01T12:00:00.000Z"
      })
    );
    expect(err.code).toBe("SPACE_INACTIVE");
    expect(err.statusCode).toBe(422);
    db.close();
  });
});
