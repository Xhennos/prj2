import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/db.js";
import { SQLiteRepository } from "../src/repository.js";
import { CoworkReservationService } from "../src/service.js";
import { DomainError } from "../src/types.js";

function setupService(fixedIsoNow = "2026-12-01T07:00:00.000Z") {
  const db = createDatabase(":memory:");
  const repo = new SQLiteRepository(db);
  const service = new CoworkReservationService(repo, () => new Date(fixedIsoNow));
  return { db, service };
}

describe("Pruebas Unitarias de Lógica de Negocio", () => {
  it("crea y lista espacios de coworking correctamente", () => {
    const { db, service } = setupService();
    const salaA = service.createSpace({
      name: "Sala Innovación",
      type: "MEETING_ROOM",
      capacity: 8
    });
    const booth = service.createSpace({
      name: "Cabina Focus 1",
      type: "PHONE_BOOTH",
      capacity: 1
    });

    const spaces = service.listSpaces();
    expect(spaces).toHaveLength(2);
    expect(salaA.isActive).toBe(true);
    expect(booth.capacity).toBe(1);
    db.close();
  });

  it("impide registrar dos espacios con el mismo nombre", () => {
    const { db, service } = setupService();
    service.createSpace({ name: "Sala Pacífico", type: "MEETING_ROOM", capacity: 6 });

    expect(() =>
      service.createSpace({ name: "sala pacífico", type: "MEETING_ROOM", capacity: 10 })
    ).toThrowError(DomainError);
    db.close();
  });

  it("crea una reserva confirmada, consulta disponibilidad y filtra reservas", () => {
    const { db, service } = setupService();
    const space = service.createSpace({
      name: "Sala Atlántico",
      type: "MEETING_ROOM",
      capacity: 10
    });

    const reservation = service.createReservation({
      spaceId: space.id,
      userId: "estiven-01",
      userEmail: "estiven@coworkhub.io",
      title: "Arquitectura ODD/SDD",
      attendeesCount: 4,
      startTime: "2026-12-01T10:00:00.000Z",
      endTime: "2026-12-01T12:00:00.000Z"
    });

    expect(reservation.status).toBe("CONFIRMED");
    expect(reservation.cancelledAt).toBeNull();

    const filtered = service.listReservations({ userId: "estiven-01", date: "2026-12-01" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(reservation.id);

    const availability = service.getSpaceAvailability(space.id, "2026-12-01");
    expect(availability.bookedSlots).toHaveLength(1);
    expect(availability.bookedSlots[0].reservationId).toBe(reservation.id);
    db.close();
  });

  it("cancela una reserva confirmada e impide cancelarla dos veces", () => {
    const { db, service } = setupService();
    const space = service.createSpace({
      name: "Sala Norte",
      type: "MEETING_ROOM",
      capacity: 6
    });

    const reservation = service.createReservation({
      spaceId: space.id,
      userId: "einar-01",
      userEmail: "einar@coworkhub.io",
      title: "Revisión de Sprint",
      attendeesCount: 3,
      startTime: "2026-12-01T14:00:00.000Z",
      endTime: "2026-12-01T15:00:00.000Z"
    });

    const cancelled = service.cancelReservation(reservation.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).toBe("2026-12-01T07:00:00.000Z");

    expect(() => service.cancelReservation(reservation.id)).toThrowError(
      /ya se encuentra cancelada/
    );
    db.close();
  });
});
