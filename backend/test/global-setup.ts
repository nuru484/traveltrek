// test/global-setup.ts
//
// Runs once before the whole suite. Ensures the dedicated `traveltrek_test`
// database exists and is migrated to the current schema. Idempotent — safe to
// re-run.
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { Client } from 'pg';

const baseDbUrl = process.env.DATABASE_URL ?? '';
const testDbUrl = baseDbUrl.replace(/\/[^/?]+(\?|$)/, '/traveltrek_test$1');
const maintenanceUrl = baseDbUrl.replace(/\/[^/?]+(\?|$)/, '/postgres$1');
const TEST_DB_NAME = 'traveltrek_test';

export async function setup(): Promise<void> {
  await ensureDatabaseExists();

  // Apply all migrations to the test database. `migrate deploy` is idempotent.
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: 'ignore',
  });
}

async function ensureDatabaseExists(): Promise<void> {
  const client = new Client({ connectionString: maintenanceUrl });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DB_NAME],
    );
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  } finally {
    await client.end();
  }
}
