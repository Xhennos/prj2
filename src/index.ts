import { createApp } from "./app.js";
import { createDatabase } from "./db.js";
import { SQLiteRepository } from "./repository.js";
import { CoworkReservationService } from "./service.js";

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DB_PATH ?? "coworkhub.db";

const db = createDatabase(dbPath);
const repository = new SQLiteRepository(db);
const service = new CoworkReservationService(repository);
const server = createApp(service);

server.listen(port, () => {
  console.log(`CoworkHub API escuchando en http://localhost:${port} (DB: ${dbPath})`);
});
