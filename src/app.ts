import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { CoworkReservationService } from "./service.js";
import { DomainError, type ReservationStatus } from "./types.js";

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new DomainError("VALIDATION_ERROR", "El cuerpo de la petición no contiene JSON válido.", 400);
  }
}

export function createApp(service: CoworkReservationService): Server {
  return createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", "http://localhost");
      const pathname = url.pathname;

      if (method === "GET" && pathname === "/health") {
        sendJson(res, 200, { status: "ok", service: "CoworkHub" });
        return;
      }

      if (method === "GET" && pathname === "/api/spaces") {
        const spaces = service.listSpaces();
        sendJson(res, 200, { spaces });
        return;
      }

      if (method === "POST" && pathname === "/api/spaces") {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const space = service.createSpace({
          name: body.name as string,
          type: body.type as never,
          capacity: body.capacity as number,
          isActive: body.isActive as boolean | undefined
        });
        sendJson(res, 201, space);
        return;
      }

      const availabilityMatch = pathname.match(/^\/api\/spaces\/([^/]+)\/availability$/);
      if (method === "GET" && availabilityMatch) {
        const spaceId = decodeURIComponent(availabilityMatch[1]);
        const date = url.searchParams.get("date") ?? "";
        const availability = service.getSpaceAvailability(spaceId, date);
        sendJson(res, 200, availability);
        return;
      }

      if (method === "GET" && pathname === "/api/reservations") {
        const statusParam = url.searchParams.get("status");
        const reservations = service.listReservations({
          spaceId: url.searchParams.get("spaceId") ?? undefined,
          userId: url.searchParams.get("userId") ?? undefined,
          status: statusParam ? (statusParam as ReservationStatus) : undefined,
          date: url.searchParams.get("date") ?? undefined
        });
        sendJson(res, 200, { reservations });
        return;
      }

      if (method === "POST" && pathname === "/api/reservations") {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const reservation = service.createReservation({
          spaceId: body.spaceId as string,
          userId: body.userId as string,
          userEmail: body.userEmail as string,
          title: body.title as string,
          attendeesCount: body.attendeesCount as number,
          startTime: body.startTime as string,
          endTime: body.endTime as string
        });
        sendJson(res, 201, reservation);
        return;
      }

      const cancelMatch = pathname.match(/^\/api\/reservations\/([^/]+)\/cancel$/);
      if (method === "PATCH" && cancelMatch) {
        const reservationId = decodeURIComponent(cancelMatch[1]);
        const reservation = service.cancelReservation(reservationId);
        sendJson(res, 200, reservation);
        return;
      }

      if (method === "GET" && pathname === "/api/maintenance") {
        const spaceId = url.searchParams.get("spaceId") ?? undefined;
        const maintenanceBlocks = service.listMaintenanceBlocks(spaceId);
        sendJson(res, 200, { maintenanceBlocks });
        return;
      }

      if (method === "POST" && pathname === "/api/maintenance") {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const block = service.createMaintenanceBlock({
          spaceId: body.spaceId as string,
          startTime: body.startTime as string,
          endTime: body.endTime as string,
          reason: body.reason as string
        });
        sendJson(res, 201, block);
        return;
      }

      sendJson(res, 404, {
        error: {
          code: "NOT_FOUND",
          message: `Ruta no encontrada: ${method} ${pathname}`
        }
      });
    } catch (error) {
      if (error instanceof DomainError) {
        sendJson(res, error.statusCode, {
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      sendJson(res, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Error interno inesperado"
        }
      });
    }
  });
}
