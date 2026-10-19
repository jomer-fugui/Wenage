import { NextResponse } from "next/server";
import { databaseUrl, pool } from "@/db";

export { databaseUrl };

/** Devuelve true si la base de datos está configurada y conectada. */
export function isDbReady(): boolean {
  return Boolean(databaseUrl && pool);
}

/** Responde con un error claro y accionable cuando falta DATABASE_URL. */
export function dbNotReadyResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Base de datos no configurada",
      detail:
        "Falta la variable de entorno DATABASE_URL en Vercel. Ve a tu proyecto en Vercel → Settings → Environment Variables y agrega DATABASE_URL con tu cadena de conexión PostgreSQL. Luego vuelve a desplegar.",
      docs: "https://vercel.com/docs/concepts/projects/environment-variables",
    },
    { status: 503 }
  );
}
