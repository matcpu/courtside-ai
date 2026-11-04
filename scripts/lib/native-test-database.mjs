// Multi-session tests only. Refuses hosted URLs and never loads project env files.
import pg from "pg";
import { randomUUID } from "node:crypto";
import { initializeTestDatabase } from "./local-database.mjs";
export async function nativeTestDatabase() {
  const source = process.env.LAUNCHPAD_TEST_DATABASE_URL;
  if (!source)
    throw Error(
      "Set LAUNCHPAD_TEST_DATABASE_URL to the local synthetic test service",
    );
  const url = new URL(source);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/courtside_launchpad_test"
  )
    throw Error(
      "Native tests require a loopback-only courtside_launchpad_test database",
    );
  const admin = new pg.Client({ connectionString: source });
  await admin.connect();
  const name = "courtside_launchpad_test_" + randomUUID().replaceAll("-", "");
  await admin.query(`create database "${name}"`);
  url.pathname = "/" + name;
  const pool = new pg.Pool({ connectionString: url.href, max: 8 });
  const db = {
    query: (sql, params) => pool.query(sql, params),
    exec: (sql) => pool.query(sql),
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const r = await fn({
          query: client.query.bind(client),
          exec: (sql) => client.query(sql),
        });
        await client.query("commit");
        return r;
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        client.release();
      }
    },
    pool,
    close: async () => {
      await pool.end();
      await admin.query(`drop database "${name}"`);
      await admin.end();
    },
  };
  try {
    return await initializeTestDatabase(db);
  } catch (e) {
    await db.close();
    throw e;
  }
}
