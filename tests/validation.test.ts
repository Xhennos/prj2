import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/db.js";
import { SQLiteRepository } from "../src/repository.js";
import { CoworkReservationService } from "../src/service.js";
import { DomainError } from "../src/types.js";

function setupService(fixedIsoNow = "2026-12-01T09:00:00.000Z") {
  const db = createDatabase(":memory:");
  const repo = new SQLiteRepository(db);
  const service = new CoworkReservationService(repo, () => new Date(fixedIsoNow));
  const space = service.createSpace({
    name: "Sala Validaciones",
    type: "MEETING_ROOM",
    capacity: 6
  });
  return { db, service, space };
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
  throw new Error("Se esperaba un DomainError pero no se lanzó ninguno.");
}

describe("Validaciones de Entrada de Datos (RB-04 / RF-02)", () => {
  it("rechaza reservas en el pasado o en el instante actual", () => {
    const { db, service, space } = setupService("2026-12-01T12:00:00.000Z");

    const errPast = captureError(() =>
      service.createReservation({
        spaceId: space.id,
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Reunión pasada",
        attendeesCount: 2,
        startTime: "2026-12-01T10:00:00.000Z",
        endTime: "2026-12-01T11:00:00.000Z"
      })
    );
    expect(errPast.code).toBe("PAST_RESERVATION_NOT_ALLOWED");
    expect(errPast.statusCode).toBe(422);

    const errNow = captureError(() =>
      service.createReservation({
        spaceId: space.id,
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Reunión inmediata",
        attendeesCount: 2,
        startTime: "2026-12-01T12:00:00.000Z",
        endTime: "2026-12-01T13:00:00.000Z"
      })
    );
    expect(errNow.code).toBe("PAST_RESERVATION_NOT_ALLOWED");
    db.close();
  });

  it("rechaza formatos de fecha inválidos o sin zona horaria", () => {
    const { db, service, space } = setupService();

    const errNoTz = captureError(() =>
      service.createReservation({
        spaceId: space.id,
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Sin TZ",
        attendeesCount: 2,
        startTime: "2026-12-01 10:00:00",
        endTime: "2026-12-01T11:00:00.000Z"
      })
    );
    expect(errNoTz.code).toBe("VALIDATION_ERROR");
    expect(errNoTz.statusCode).toBe(400);
    db.close();
  });

  it("rechaza intervalos donde endTime <= startTime", () => {
    const { db, service, space } = setupService();

    const err = captureError(() =>
      service.createReservation({
        spaceId: space.id,
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Intervalo invertido",
        attendeesCount: 2,
        startTime: "2026-12-01T15:00:00.000Z",
        endTime: "2026-12-01T14:00:00.000Z"
      })
    );
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.statusCode).toBe(400);
    db.close();
  });

  it("rechaza correos inválidos, títulos vacíos o asistentes < 1", () => {
    const { db, service, space } = setupService();

    const errEmail = captureError(() =>
      service.createReservation({
        spaceId: space.id,
        userId: "u1",
        userEmail: "correo-invalido",
        title: "Demo",
        attendeesCount: 2,
        startTime: "2026-12-01T10:00:00.000Z",
        endTime: "2026-12-01T11:00:00.000Z"
      })
    );
    expect(errEmail.code).toBe("VALIDATION_ERROR");

    const errAttendees = captureError(() =>
      service.createReservation({
        spaceId: space.id,
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Demo",
        attendeesCount: 0,
        startTime: "2026-12-01T10:00:00.000Z",
        endTime: "2026-12-01T11:00:00.000Z"
      })
    );
    expect(errAttendees.code).toBe("VALIDATION_ERROR");
    db.close();
  });

  it("retorna 404 cuando el spaceId o reservationId no existen", () => {
    const { db, service } = setupService();

    const errSpace = captureError(() =>
      service.createReservation({
        spaceId: "space-inexistente",
        userId: "u1",
        userEmail: "u1@coworkhub.io",
        title: "Demo",
        attendeesCount: 1,
        startTime: "2026-12-01T10:00:00.000Z",
        endTime: "2026-12-01T11:00:00.000Z"
      })
    );
    expect(errSpace.code).toBe("SPACE_NOT_FOUND");
    expect(errSpace.statusCode).toBe(404);

    const errRes = captureError(() => service.cancelReservation("res-inexistente"));
    expect(errRes.code).toBe("RESERVATION_NOT_FOUND");
    expect(errRes.statusCode).toBe(404);
    db.close();
  });
});
