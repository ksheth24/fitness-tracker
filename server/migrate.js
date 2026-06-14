import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migration = await fs.readFile(path.join(__dirname, "schema.sql"), "utf8");

try {
  await pool.query(migration);
  console.log("Database migration complete.");
} finally {
  await pool.end();
}
