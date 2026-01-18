import { Pool } from "pg";

type SslConfig = { rejectUnauthorized: boolean };

export function getSslConfig(): SslConfig | undefined {
  if (
    process.env.POSTGRES_SSL === "true" ||
    process.env.DATABASE_SSL === "true"
  ) {
    return { rejectUnauthorized: false };
  }

  return undefined;
}

export function getConnectionString() {
  const connectionString = process.env.POSTGRES || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing POSTGRES or DATABASE_URL environment variable.");
  }
  return connectionString;
}

export function createPgPool() {
  return new Pool({
    connectionString: getConnectionString(),
    ssl: getSslConfig(),
  });
}

let pool: Pool | null = null;

export function getPgPool() {
  if (!pool) {
    pool = createPgPool();
  }
  return pool;
}
