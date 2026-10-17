import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

let internalPool: Pool | null = null;

if (databaseUrl) {
  const globalForDb = globalThis as typeof globalThis & {
    __wenagePostgresqlPool?: Pool;
  };

  internalPool =
    globalForDb.__wenagePostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__wenagePostgresqlPool = internalPool;
  }
}

// `db` puede ser null en tiempo de build si no hay DATABASE_URL.
// Las rutas API manejan el error de base de datos con try/catch y devuelven 503.
export const pool = internalPool as Pool | null;
export const db = (databaseUrl
  ? drizzle(internalPool!)
  : null) as unknown as ReturnType<typeof drizzle>;

export { databaseUrl };
