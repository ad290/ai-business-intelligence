import net from "node:net";
import { URL } from "node:url";
import Redis from "ioredis";
import { config } from "../config/env.js";

/** New ioredis client from `REDIS_URL` (BullMQ requires `maxRetriesPerRequest: null`). */
export function createRedisConnection(): Redis {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
  });
}

/** Quick TCP check used by integration tests and verify scripts. */
export async function isRedisReachable(): Promise<boolean> {
  const url = new URL(config.redisUrl);
  const host = url.hostname || "127.0.0.1";
  const port = Number(url.port || 6379);

  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(1_000);
    socket.on("connect", () => finish(true));
    socket.on("timeout", () => finish(false));
    socket.on("error", () => finish(false));
  });
}
