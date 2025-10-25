import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema";

const client = new Client({
  connectionString: process.env.DATABASE_URL!,
});

// Connect to the database
await client.connect();

export const db = drizzle(client, { schema });

// Graceful shutdown
process.on('SIGTERM', async () => {
  await client.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await client.end();
  process.exit(0);
});