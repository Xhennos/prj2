import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/db.js";
import { SQLiteRepository } from "../src/repository.js";
import { CoworkReservationService } from "../src/service.js";
import { DomainError } from "../src/types.js";

function setupWithBaseReservation() {
  const db = createDatabase(":memory:");
  const repo = new SQLiteRepository(db);
  const service = new CoworkReservationService(repo, () => new Date("2026-12-01T07:00:00.000Z"));

  const salaA = service.createSpace({ name: "Sala Innovación", type: "MEETING_ROOM", capacity: 10 });
  const salaB = service.createSpace({ name: "Sala Pacífico", type: "MEETING_ROOM", capacity: 6 });

  const base = service.createReservation({
    spaceId: salaA.id,
    userId: "estiven",
    userEmail: "estiven@coworkhub.io",
    title: "Reserva Base 10:00-12:00",
    attendeesCount: 4,
    startTime: "2026-12-01T10:00:00.000Z",
    endTime: "2026-12-01T12:00:00.000Z"
  });

  return { db, service, salaA, salaB, base };
}

function expectDoubleBookingRejection(fn: () => unknown): void {
  try {
    fn();
    throw new Error("El sistema permitió una doble reserva que debía ser rechazada.");
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    const domainErr = err as DomainError;
    expect(domainErr.code).toBe("DOUBLE_BOOKING_CONFLICT");
    expect(domainErr.statusCode).toBe(409);
  }
}

describe("Regla Crítica RB-05 (OBLIGATORIO): Prevención Estricta de Doble Reserva", () => {
  it("rechaza reserva con exactamente el mismo horario (10:00-12:00)", () => {
    const { db, service, salaA } = setupWithBaseReservation();

    expectDoubleBookingRejection(() =>
      service.createReservation({
        spaceId: salaA.id,
        userId: "ahmed",
        userEmail: "ahmed@coworkhub.io",
        title: "Colisión idéntica",
        attendeesCount: 2,
        startTime: "2026-12-01T10:00:00.000Z",
        endTime: "2026-12-01T12:00:00.000Z"
      })
    );
    expect(service.listReservations({ spaceId: salaA.id })).toHaveLength(1);
    db.close();
  });

  it("rechaza solapamiento parcial al inicio (09:00-11:00)", () => {
    const { db, service, salaA } = setupWithBaseReservation();

    expectDoubleBookingRejection(() =>
      service.createReservation({
        spaceId: salaA.id,
        userId: "einar",
        userEmail: "einar@coworkhub.io",
        title: "Solapamiento inicio",
        attendeesCount: 3,
        startTime: "2026-12-01T09:00:00.000Z",
        endTime: "2026-12-01T11:00:00.000Z"
      })
    );
    db.close();
  });

  it("rechaza solapamiento parcial al final (11:00-13:00)", () => {
    const { db, service, salaA } = setupWithBaseReservation();

    expectDoubleBookingRejection(() =>
      service.createReservation({
        spaceId: salaA.id,
        userId: "ahmed",
        userEmail: "ahmed@coworkhub.io",
        title: "Solapamiento final",
        attendeesCount: 3,
        startTime: "2026-12-01T11:00:00.000Z",
        endTime: "2026-12-01T13:00:00.000Z"
      })
    );
    db.close();
  });

  it("rechaza reserva contenida completamente dentro de otra (10:30-11:30)", () => {
    const { db, service, salaA } = setupWithBaseReservation();

    expectDoubleBookingRejection(() =>
      service.createReservation({
        spaceId: salaA.id,
        userId: "einar",
        userEmail: "einar@coworkhub.io",
        title: "Contenida dentro",
        attendeesCount: 2,
        startTime: "2026-12-01T10:30:00.000Z",
        endTime: "2026-12-01T11:30:00.000Z"
      })
    );
    db.close();
  });

  it("rechaza reserva envolvente que abarca completamente a una existente (09:00-14:00)", () => {
    const { db, service, salaA } = setupWithBaseReservation();

    expectDoubleBookingRejection(() =>
      service.createReservation({
        spaceId: salaA.id,
        userId: "ahmed",
        userEmail: "ahmed@coworkhub.io",
        title: "Envolvente total",
        attendeesCount: 5,
        startTime: "2026-12-01T09:00:00.000Z",
        endTime: "2026-12-01T14:00:00.000Z"
      })
    );
    db.close();
  });

  it("permite reservas contiguas exactas (08:00-10:00 y 12:00-14:00) y mismo horario en distinta sala", () => {
    const { db, service, salaA, salaB } = setupWithBaseReservation();

    const before = service.createReservation({
      spaceId: salaA.id,
      userId: "ahmed",
      userEmail: "ahmed@coworkhub.io",
      title: "Contigua previa",
      attendeesCount: 2,
      startTime: "2026-12-01T08:00:00.000Z",
      endTime: "2026-12-01T10:00:00.000Z"
    });

    const after = service.createReservation({
      spaceId: salaA.id,
      userId: "einar",
      userEmail: "einar@coworkhub.io",
      title: "Contigua posterior",
      attendeesCount: 2,
      startTime: "2026-12-01T12:00:00.000Z",
      endTime: "2026-12-01T14:00:00.000Z"
    });

    const otherRoom = service.createReservation({
      spaceId: salaB.id,
      userId: "ahmed",
      userEmail: "ahmed@coworkhub.io",
      title: "Mismo horario en Sala B",
      attendeesCount: 4,
      startTime: "2026-12-01T10:00:00.000Z",
      endTime: "2026-12-01T12:00:00.000Z"
    });

    expect(before.status).toBe("CONFIRMED");
    expect(after.status).toBe("CONFIRMED");
    expect(otherRoom.status).toBe("CONFIRMED");
    db.close();
  });

  it("libera el horario para una nueva reserva cuando la reserva previa se cancela", () => {
    const { db, service, salaA, base } = setupWithBaseReservation();

    service.cancelReservation(base.id);

    const replacement = service.createReservation({
      spaceId: salaA.id,
      userId: "einar",
      userEmail: "einar@coworkhub.io",
      title: "Reemplazo tras cancelación",
      attendeesCount: 5,
      startTime: "2026-12-01T10:00:00.000Z",
      endTime: "2026-12-01T12:00:00.000Z"
    });

    expect(replacement.status).toBe("CONFIRMED");
    db.close();
  });
});
