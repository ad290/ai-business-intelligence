import { config } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { isRedisReachable } from "../lib/redis.js";

/**
 * Fails fast when Postgres or Redis are not running (no retries).
 * Throws a clear message about what to start manually.
 */
export async function requireLocalServices(): Promise<void> {
  const redisOk = await isRedisReachable();
  if (!redisOk) {
    throw new Error(
      `Redis is not reachable at ${config.redisUrl}. Start Redis locally (for example: redis-server) or set REDIS_URL to a running instance.`
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw new Error(
      `PostgreSQL is not reachable via DATABASE_URL. Ensure the database is running and migrations are applied (prisma migrate deploy).`
    );
  }
}
