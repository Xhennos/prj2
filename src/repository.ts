import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "./db.js";
import {
  DomainError,
  type AvailabilitySlot,
  type CreateMaintenanceBlockInput,
  type CreateReservationInput,
  type CreateSpaceInput,
  type MaintenanceBlock,
  type Reservation,
  type ReservationFilter,
  type Space,
  type SpaceType
} from "./types.js";

interface SpaceRow {
  id: string;
  name: string;
  type: SpaceType;
  capacity: number;
  is_active: number;
  created_at: string;
}

interface ReservationRow {
  id: string;
  space_id: string;
  user_id: string;
  user_email: string;
  title: string;
  attendees_count: number;
  start_time: string;
  end_time: string;
  status: "CONFIRMED" | "CANCELLED";
  created_at: string;
  cancelled_at: string | null;
}

interface MaintenanceBlockRow {
  id: string;
  space_id: string;
  start_time: string;
  end_time: string;
  reason: string;
  created_at: string;
}

function mapSpaceRow(row: SpaceRow): Space {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    capacity: row.capacity,
    isActive: row.is_active === 1,
    createdAt: row.created_at
  };
}

function mapReservationRow(row: ReservationRow): Reservation {
  return {
    id: row.id,
    spaceId: row.space_id,
    userId: row.user_id,
    userEmail: row.user_email,
    title: row.title,
    attendeesCount: row.attendees_count,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at
  };
}

function mapMaintenanceRow(row: MaintenanceBlockRow): MaintenanceBlock {
  return {
    id: row.id,
    spaceId: row.space_id,
    startTime: row.start_time,
    endTime: row.end_time,
    reason: row.reason,
    createdAt: row.created_at
  };
}

export class SQLiteRepository {
  constructor(private readonly db: DatabaseSync) {}

  createSpace(input: CreateSpaceInput, createdAt: string): Space {
    const id = randomUUID();
    const isActive = input.isActive ?? true;

    this.db
      .prepare(
        `INSERT INTO spaces (id, name, type, capacity, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.name.trim(), input.type, input.capacity, isActive ? 1 : 0, createdAt);

    return {
      id,
      name: input.name.trim(),
      type: input.type,
      capacity: input.capacity,
      isActive,
      createdAt
    };
  }

  listSpaces(): Space[] {
    const rows = this.db
      .prepare("SELECT id, name, type, capacity, is_active, created_at FROM spaces ORDER BY name ASC")
      .all() as unknown as SpaceRow[];

    return rows.map(mapSpaceRow);
  }

  findSpaceById(id: string): Space | null {
    const row = this.db
      .prepare("SELECT id, name, type, capacity, is_active, created_at FROM spaces WHERE id = ?")
      .get(id) as unknown as SpaceRow | undefined;

    return row ? mapSpaceRow(row) : null;
  }

  findSpaceByName(name: string): Space | null {
    const row = this.db
      .prepare("SELECT id, name, type, capacity, is_active, created_at FROM spaces WHERE LOWER(name) = LOWER(?)")
      .get(name.trim()) as unknown as SpaceRow | undefined;

    return row ? mapSpaceRow(row) : null;
  }

  createReservationIfAvailable(input: CreateReservationInput, createdAt: string): Reservation {
    const id = randomUUID();
    this.db.exec("BEGIN IMMEDIATE;");

    try {
      const maintenance = this.db
        .prepare(
          `SELECT id, start_time, end_time, reason
           FROM maintenance_blocks
           WHERE space_id = ?
             AND start_time < ?
             AND end_time > ?
           LIMIT 1`
        )
        .get(input.spaceId, input.endTime, input.startTime) as
        | { id: string; start_time: string; end_time: string; reason: string }
        | undefined;

      if (maintenance) {
        throw new DomainError(
          "SPACE_UNDER_MAINTENANCE",
          `El espacio se encuentra bloqueado por mantenimiento (${maintenance.start_time} - ${maintenance.end_time}): ${maintenance.reason}.`,
          409
        );
      }

      const overlapping = this.db
        .prepare(
          `SELECT id, start_time, end_time
           FROM reservations
           WHERE space_id = ?
             AND status = 'CONFIRMED'
             AND start_time < ?
             AND end_time > ?
           LIMIT 1`
        )
        .get(input.spaceId, input.endTime, input.startTime) as
        | { id: string; start_time: string; end_time: string }
        | undefined;

      if (overlapping) {
        throw new DomainError(
          "DOUBLE_BOOKING_CONFLICT",
          `El espacio ya tiene una reserva confirmada (${overlapping.start_time} - ${overlapping.end_time}) que se solapa con el horario solicitado.`,
          409
        );
      }

      this.db
        .prepare(
          `INSERT INTO reservations (
             id, space_id, user_id, user_email, title, attendees_count,
             start_time, end_time, status, created_at, cancelled_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, NULL)`
        )
        .run(
          id,
          input.spaceId,
          input.userId.trim(),
          input.userEmail.trim(),
          input.title.trim(),
          input.attendeesCount,
          input.startTime,
          input.endTime,
          createdAt
        );

      this.db.exec("COMMIT;");

      return {
        id,
        spaceId: input.spaceId,
        userId: input.userId.trim(),
        userEmail: input.userEmail.trim(),
        title: input.title.trim(),
        attendeesCount: input.attendeesCount,
        startTime: input.startTime,
        endTime: input.endTime,
        status: "CONFIRMED",
        createdAt,
        cancelledAt: null
      };
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  findReservationById(id: string): Reservation | null {
    const row = this.db
      .prepare(
        `SELECT id, space_id, user_id, user_email, title, attendees_count,
                start_time, end_time, status, created_at, cancelled_at
         FROM reservations
         WHERE id = ?`
      )
      .get(id) as unknown as ReservationRow | undefined;

    return row ? mapReservationRow(row) : null;
  }

  listReservations(filter: ReservationFilter = {}): Reservation[] {
    const conditions: string[] = [];
    const params: string[] = [];

    if (filter.spaceId) {
      conditions.push("space_id = ?");
      params.push(filter.spaceId);
    }
    if (filter.userId) {
      conditions.push("user_id = ?");
      params.push(filter.userId);
    }
    if (filter.status) {
      conditions.push("status = ?");
      params.push(filter.status);
    }
    if (filter.date) {
      conditions.push("start_time >= ? AND start_time < ?");
      params.push(`${filter.date}T00:00:00.000Z`, `${filter.date}T23:59:59.999Z`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `SELECT id, space_id, user_id, user_email, title, attendees_count,
                start_time, end_time, status, created_at, cancelled_at
         FROM reservations
         ${whereClause}
         ORDER BY start_time ASC`
      )
      .all(...params) as unknown as ReservationRow[];

    return rows.map(mapReservationRow);
  }

  listConfirmedSlotsForDate(spaceId: string, date: string): AvailabilitySlot[] {
    const rows = this.db
      .prepare(
        `SELECT id, start_time, end_time
         FROM reservations
         WHERE space_id = ?
           AND status = 'CONFIRMED'
           AND start_time >= ?
           AND start_time <= ?
         ORDER BY start_time ASC`
      )
      .all(spaceId, `${date}T00:00:00.000Z`, `${date}T23:59:59.999Z`) as unknown as Array<{
      id: string;
      start_time: string;
      end_time: string;
    }>;

    return rows.map((row) => ({
      reservationId: row.id,
      startTime: row.start_time,
      endTime: row.end_time
    }));
  }

  cancelReservation(id: string, cancelledAt: string): Reservation {
    this.db
      .prepare(
        `UPDATE reservations
         SET status = 'CANCELLED', cancelled_at = ?
         WHERE id = ?`
      )
      .run(cancelledAt, id);

    const updated = this.findReservationById(id);
    if (!updated) {
      throw new DomainError("RESERVATION_NOT_FOUND", `Reserva ${id} no encontrada.`, 404);
    }
    return updated;
  }

  createMaintenanceBlock(input: CreateMaintenanceBlockInput, createdAt: string): MaintenanceBlock {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO maintenance_blocks (id, space_id, start_time, end_time, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.spaceId, input.startTime, input.endTime, input.reason.trim(), createdAt);

    return {
      id,
      spaceId: input.spaceId,
      startTime: input.startTime,
      endTime: input.endTime,
      reason: input.reason.trim(),
      createdAt
    };
  }

  listMaintenanceBlocks(spaceId?: string): MaintenanceBlock[] {
    if (spaceId) {
      const rows = this.db
        .prepare(
          `SELECT id, space_id, start_time, end_time, reason, created_at
           FROM maintenance_blocks
           WHERE space_id = ?
           ORDER BY start_time ASC`
        )
        .all(spaceId) as unknown as MaintenanceBlockRow[];
      return rows.map(mapMaintenanceRow);
    }

    const rows = this.db
      .prepare(
        `SELECT id, space_id, start_time, end_time, reason, created_at
         FROM maintenance_blocks
         ORDER BY start_time ASC`
      )
      .all() as unknown as MaintenanceBlockRow[];
    return rows.map(mapMaintenanceRow);
  }
}
