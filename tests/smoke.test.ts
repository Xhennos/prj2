import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/db.js";

describe("Smoke Test - Entorno SQLite y Vitest", () => {
  it("inicializa la base de datos SQLite en memoria con las tablas spaces y reservations", () => {
    const db = createDatabase(":memory:");
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;

    const tableNames = rows.map((r) => r.name);
    expect(tableNames).toContain("spaces");
    expect(tableNames).toContain("reservations");
    db.close();
  });
});
