import app from "./app";
import { logger } from "./lib/logger";
import { initializeDb, hasMasterUser, insertMasterUser } from "@workspace/db";
import { startBackupScheduler } from "./lib/backup-scheduler";
import bcrypt from "bcryptjs";

initializeDb();
startBackupScheduler();

if (!hasMasterUser()) {
  const hash = bcrypt.hashSync("master123", 10);
  insertMasterUser("master", hash);
  logger.info("Created default master user: username=master password=master123");
}

const rawPort = process.env["PORT"] ?? "3001";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
