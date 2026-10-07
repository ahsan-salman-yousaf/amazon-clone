import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export type Tx = Parameters<Parameters<NeonDatabase<typeof schema>["transaction"]>[0]>[0];

/**
 * Interactive transaction over Neon's WebSocket driver. The HTTP driver in
 * ./index.ts can't hold a transaction open, and placing an order must take
 * stock and create the order atomically.
 */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    return await drizzle(pool, { schema }).transaction(fn);
  } finally {
    await pool.end();
  }
}
