import { SQLiteRepository } from "./repository.js";
import {
  DomainError,
  type CreateReservationInput,
  type CreateSpaceInput,
  type Reservation,
  type ReservationFilter,
  type Space,
  type SpaceAvailability,
  type SpaceType
} from "./types.js";

const VALID_SPACE_TYPES: ReadonlySet<SpaceType> = new Set([
  "MEETING_ROOM",
  "PHONE_BOOTH",
  "DEDICATED_DESK",
  "AUDITORIUM"
]);

const ISO_WITH_TZ_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_DURATION_MINUTES = 30;
const MAX_DURATION_MINUTES = 480;

function parseIsoTimestamp(value: string, fieldName: string): Date {
  if (typeof value !== "string" || !ISO_WITH_TZ_REGEX.test(value)) {
    throw new DomainError(
      "VALIDATION_ERROR",
      `El campo ${fieldName} debe ser una fecha ISO 8601 válida con zona horaria (ej. 2026-12-01T10:00:00.000Z).`,
      400
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new DomainError("VALIDATION_ERROR", `El campo ${fieldName} no representa una fecha válida.`, 400);
  }
  return parsed;
}

function assertValidCalendarDate(dateStr: string): void {
  if (!DATE_ONLY_REGEX.test(dateStr)) {
    throw new DomainError("VALIDATION_ERROR", "La fecha debe tener formato YYYY-MM-DD.", 400);
  }
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateStr) {
    throw new DomainError("VALIDATION_ERROR", `La fecha ${dateStr} no es válida.`, 400);
  }
}

export class CoworkReservationService {
  constructor(
    private readonly repo: SQLiteRepository,
    private readonly nowProvider: () => Date = () => new Date()
  ) {}

  createSpace(input: CreateSpaceInput): Space {
    if (!input || typeof input !== "object") {
      throw new DomainError("VALIDATION_ERROR", "El cuerpo de la solicitud es inválido.", 400);
    }
    if (typeof input.name !== "string" || input.name.trim().length < 2) {
      throw new DomainError("VALIDATION_ERROR", "El nombre del espacio debe tener al menos 2 caracteres.", 400);
    }
    if (!VALID_SPACE_TYPES.has(input.type)) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "El tipo de espacio debe ser MEETING_ROOM, PHONE_BOOTH, DEDICATED_DESK o AUDITORIUM.",
        400
      );
    }
    if (!Number.isInteger(input.capacity) || input.capacity < 1) {
      throw new DomainError("VALIDATION_ERROR", "La capacidad del espacio debe ser un entero mayor o igual a 1.", 400);
    }

    const existing = this.repo.findSpaceByName(input.name);
    if (existing) {
      throw new DomainError(
        "SPACE_ALREADY_EXISTS",
        `Ya existe un espacio registrado con el nombre '${input.name.trim()}'.`,
        409
      );
    }

    return this.repo.createSpace(input, this.nowProvider().toISOString());
  }

  listSpaces(): Space[] {
    return this.repo.listSpaces();
  }

  createReservation(input: CreateReservationInput): Reservation {
    if (!input || typeof input !== "object") {
      throw new DomainError("VALIDATION_ERROR", "El cuerpo de la solicitud es inválido.", 400);
    }
    if (typeof input.spaceId !== "string" || input.spaceId.trim().length === 0) {
      throw new DomainError("VALIDATION_ERROR", "El campo spaceId es obligatorio.", 400);
    }
    if (typeof input.userId !== "string" || input.userId.trim().length === 0) {
      throw new DomainError("VALIDATION_ERROR", "El campo userId es obligatorio.", 400);
    }
    if (typeof input.userEmail !== "string" || !EMAIL_REGEX.test(input.userEmail.trim())) {
      throw new DomainError("VALIDATION_ERROR", "El campo userEmail debe ser un correo electrónico válido.", 400);
    }
    if (typeof input.title !== "string" || input.title.trim().length === 0) {
      throw new DomainError("VALIDATION_ERROR", "El campo title es obligatorio.", 400);
    }
    if (!Number.isInteger(input.attendeesCount) || input.attendeesCount < 1) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "El número de asistentes (attendeesCount) debe ser un entero mayor o igual a 1.",
        400
      );
    }

    const startDate = parseIsoTimestamp(input.startTime, "startTime");
    const endDate = parseIsoTimestamp(input.endTime, "endTime");

    if (endDate.getTime() <= startDate.getTime()) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "La hora de finalización (endTime) debe ser posterior a la hora de inicio (startTime).",
        400
      );
    }

    const now = this.nowProvider();
    // RB-04: No reservas en el pasado
    if (startDate.getTime() <= now.getTime()) {
      throw new DomainError(
        "PAST_RESERVATION_NOT_ALLOWED",
        "No se permiten reservas en el pasado ni en el instante actual.",
        422
      );
    }

    // RB-01: Horario operativo 08:00Z - 20:00Z en el mismo día UTC
    const dayUtc = startDate.toISOString().slice(0, 10);
    const openMs = Date.parse(`${dayUtc}T08:00:00.000Z`);
    const closeMs = Date.parse(`${dayUtc}T20:00:00.000Z`);
    if (startDate.getTime() < openMs || endDate.getTime() > closeMs) {
      throw new DomainError(
        "OUTSIDE_OPERATING_HOURS",
        "Las reservas deben realizarse dentro del horario operativo del mismo día (08:00 a 20:00 UTC).",
        422
      );
    }

    // RB-02: Duración entre 30 y 480 minutos
    const durationMinutes = (endDate.getTime() - startDate.getTime()) / 60_000;
    if (durationMinutes < MIN_DURATION_MINUTES || durationMinutes > MAX_DURATION_MINUTES) {
      throw new DomainError(
        "INVALID_DURATION",
        "La duración de la reserva debe estar entre 30 minutos y 480 minutos (8 horas).",
        422
      );
    }

    // RB-06: Existencia y estado activo del espacio
    const space = this.repo.findSpaceById(input.spaceId.trim());
    if (!space) {
      throw new DomainError("SPACE_NOT_FOUND", `Espacio '${input.spaceId}' no encontrado.`, 404);
    }
    if (!space.isActive) {
      throw new DomainError("SPACE_INACTIVE", `El espacio '${space.name}' no está activo para reservas.`, 422);
    }

    // RB-03: Capacidad máxima
    if (input.attendeesCount > space.capacity) {
      throw new DomainError(
        "CAPACITY_EXCEEDED",
        `El espacio '${space.name}' tiene capacidad máxima para ${space.capacity} personas (se solicitaron ${input.attendeesCount}).`,
        422
      );
    }

    // RB-05: Prevención estricta de doble reserva (transacción atómica en SQLite)
    return this.repo.createReservationIfAvailable(
      {
        spaceId: space.id,
        userId: input.userId,
        userEmail: input.userEmail,
        title: input.title,
        attendeesCount: input.attendeesCount,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString()
      },
      now.toISOString()
    );
  }

  listReservations(filter: ReservationFilter = {}): Reservation[] {
    if (filter.date) {
      assertValidCalendarDate(filter.date);
    }
    if (filter.status && filter.status !== "CONFIRMED" && filter.status !== "CANCELLED") {
      throw new DomainError("VALIDATION_ERROR", "El filtro status debe ser CONFIRMED o CANCELLED.", 400);
    }
    return this.repo.listReservations(filter);
  }

  getSpaceAvailability(spaceId: string, date: string): SpaceAvailability {
    const space = this.repo.findSpaceById(spaceId);
    if (!space) {
      throw new DomainError("SPACE_NOT_FOUND", `Espacio '${spaceId}' no encontrado.`, 404);
    }
    assertValidCalendarDate(date);
    return {
      spaceId: space.id,
      date,
      bookedSlots: this.repo.listConfirmedSlotsForDate(space.id, date)
    };
  }

  cancelReservation(reservationId: string): Reservation {
    const existing = this.repo.findReservationById(reservationId);
    if (!existing) {
      throw new DomainError("RESERVATION_NOT_FOUND", `Reserva '${reservationId}' no encontrada.`, 404);
    }
    if (existing.status === "CANCELLED") {
      throw new DomainError("RESERVATION_ALREADY_CANCELLED", "La reserva ya se encuentra cancelada.", 422);
    }

    return this.repo.cancelReservation(existing.id, this.nowProvider().toISOString());
  }
}
