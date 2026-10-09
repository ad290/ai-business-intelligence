import type { Express } from "express";
import { createServer, type Server } from "node:http";

export async function startTestServer(app: Express): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server: Server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Failed to bind test HTTP server");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  const close = () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  return { baseUrl, close };
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
