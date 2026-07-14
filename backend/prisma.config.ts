// Prisma 7 CLI config — the datasource URL and seed command live here
// instead of the schema (mirrors khadys-kitchen-backend).
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    path: 'prisma/migrations',
    seed: `tsx prisma/seed.ts`,
  },
  schema: 'prisma/schema.prisma',
});
