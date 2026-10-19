import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { isDbReady } from "@/lib/db-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbReady()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Base de datos no configurada",
        detail:
          "Falta la variable de entorno DATABASE_URL en Vercel. Agrega tu cadena de conexión PostgreSQL en Settings → Environment Variables y vuelve a desplegar.",
      },
      { status: 503 }
    );
  }
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, database: "postgresql" });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo conectar a la base de datos",
        detail: String(e ?? "error desconocido"),
      },
      { status: 500 }
    );
  }
}
