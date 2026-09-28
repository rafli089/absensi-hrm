import { prisma } from "@/lib/db";

/**
 * Readiness probe (K8s style, §13): cek dependensi benar-benar siap.
 * `/api/health` (liveness) dipakai CI; endpoint ini untuk deployment
 * orchestrator yang butuh probe terpisah.
 */
export async function GET() {
  let dbOK = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOK = true;
  } catch {
    dbOK = false;
  }

  const checks = { db: dbOK ? "ok" : "error" };
  const sehat = dbOK;
  return Response.json(
    { status: sehat ? "ok" : "degraded", checks, ts: Date.now() },
    { status: sehat ? 200 : 503 },
  );
}