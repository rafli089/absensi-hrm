import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "ok", ts: Date.now() });
  } catch {
    return Response.json({ status: "degraded", db: "error", ts: Date.now() }, { status: 503 });
  }
}
