export type SpaceType = "MEETING_ROOM" | "PHONE_BOOTH" | "DEDICATED_DESK" | "AUDITORIUM";

export type ReservationStatus = "CONFIRMED" | "CANCELLED";

export interface Space {
  id: string;
  name: string;
  type: SpaceType;
  capacity: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateSpaceInput {
  name: string;
  type: SpaceType;
  capacity: number;
  isActive?: boolean;
}

export interface Reservation {
  id: string;
  spaceId: string;
  userId: string;
  userEmail: string;
  title: string;
  attendeesCount: number;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  createdAt: string;
  cancelledAt: string | null;
}

export interface CreateReservationInput {
  spaceId: string;
  userId: string;
  userEmail: string;
  title: string;
  attendeesCount: number;
  startTime: string;
  endTime: string;
}

export interface ReservationFilter {
  spaceId?: string;
  userId?: string;
  status?: ReservationStatus;
  date?: string;
}

export interface AvailabilitySlot {
  reservationId: string;
  startTime: string;
  endTime: string;
}

export interface SpaceAvailability {
  spaceId: string;
  date: string;
  bookedSlots: AvailabilitySlot[];
}

export interface MaintenanceBlock {
  id: string;
  spaceId: string;
  startTime: string;
  endTime: string;
  reason: string;
  createdAt: string;
}

export interface CreateMaintenanceBlockInput {
  spaceId: string;
  startTime: string;
  endTime: string;
  reason: string;
}

export type DomainErrorCode =
  | "VALIDATION_ERROR"
  | "SPACE_NOT_FOUND"
  | "RESERVATION_NOT_FOUND"
  | "SPACE_ALREADY_EXISTS"
  | "DOUBLE_BOOKING_CONFLICT"
  | "SPACE_UNDER_MAINTENANCE"
  | "PAST_RESERVATION_NOT_ALLOWED"
  | "OUTSIDE_OPERATING_HOURS"
  | "INVALID_DURATION"
  | "CAPACITY_EXCEEDED"
  | "SPACE_INACTIVE"
  | "RESERVATION_ALREADY_CANCELLED"
  | "CANCELLATION_WINDOW_EXPIRED";

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly statusCode: number;

  constructor(code: DomainErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
