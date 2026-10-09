import "dotenv/config";
import pg from "pg";
import { config } from "../src/config/env.js";

async function main(): Promise<void> {
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const client = await pool.connect();

  try {
    const ext = await client.query<{ extname: string; extversion: string }>(
      `SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`,
    );
    if (ext.rowCount === 0) {
      throw new Error(
        "pgvector extension is not installed. Run: npx prisma migrate deploy",
      );
    }

    const smoke = await client.query<{ dist: string }>(
      `SELECT '[1,0,0]'::vector(3) <-> '[0,1,0]'::vector(3) AS dist`,
    );
    const dist = Number(smoke.rows[0]?.dist);
    if (!Number.isFinite(dist) || dist <= 0) {
      throw new Error(`vector distance operator returned invalid value: ${dist}`);
    }

    console.log("pgvector OK");
    console.log(`  extension version: ${ext.rows[0].extversion}`);
    console.log(`  sample L2 distance: ${dist}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
