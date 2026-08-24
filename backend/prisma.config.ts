// Prisma 7 CLI config: the datasource URL and seed command live here
// instead of the schema.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    /**
     * `prisma migrate diff --from-migrations` replays the migrations into a
     * throwaway database before comparing, and Prisma 7 takes that database
     * from here rather than from a SHADOW_DATABASE_URL variable. Only the
     * drift check in CI sets it; everything else leaves it undefined.
     */
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
    url: process.env.DATABASE_URL,
  },
  migrations: {
    path: 'prisma/migrations',
    seed: `tsx prisma/seed.ts`,
  },
  schema: 'prisma/schema.prisma',
});
